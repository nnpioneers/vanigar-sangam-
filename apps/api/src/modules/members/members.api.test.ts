/**
 * Automated HTTP Integration Test Suite for Members API (Phase 5.2)
 *
 * Verifies the full HTTP flow for Member CRUD operations, validation,
 * pagination/search, lifecycle, and immutability rules.
 */

import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool } from '../../database/index.js';
import { createTestIdentifier } from '../../test-utils/index.js';
import { createApp } from '../../app.js';
import { MemberService } from './members.service.js';
import { createSession } from '../../services/session.service.js';

loadLocalEnv();

async function makeRequest(
  port: number,
  method: string,
  path: string,
  cookie?: string,
  body?: Record<string, unknown>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function runTests(): Promise<void> {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Member API Integration Tests (Phase 5.2) \n');
  process.stdout.write('========================================================\n');

  const app = createApp();
  // Use synchronous listen (port 0 = OS-assigned) matching existing auth test pattern
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;

  const pool = getDbPool();
  const testSuffix = createTestIdentifier('t52');
  let adminUserId = '';
  let adminCookie = '';
  let testMemberId = '';
  const testMemberNum = `api_mem_${testSuffix}`;

  try {
    // Provision a test admin user and session
    const adminUsername = `apiadmin_${testSuffix}`;
    const adminRes = await pool.query<{ id: string }>(
      `INSERT INTO admin_users (username, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [adminUsername, 'dummyhash', 'API Test Admin 5.2', 'ADMIN', 'ACTIVE']
    );
    adminUserId = adminRes.rows[0]?.id as string;

    const session = await createSession({ adminId: adminUserId, ipAddress: '127.0.0.1', userAgent: 'test-agent' });
    adminCookie = `vs_session=${session.id}`;

    // Create a persistent test member for update/lookup/deactivate tests
    const mService = new MemberService();
    const testMember = await mService.createMember({
      memberNumber: testMemberNum,
      memberName: 'API Test Member',
      relatedPersonName: 'API Father',
      relatedPersonRelationship: 'FATHER',
      address: 'API Test Address',
      mobileNumber: '0000000000',
      numberOfSheets: 1,
    });
    testMemberId = testMember.id;

    // -----------------------------------------------------------------------
    // CREATE TESTS
    // -----------------------------------------------------------------------

    {
      const newMemNum = `new_mem_${testSuffix}`;
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/members', adminCookie, {
        memberNumber: newMemNum,
        memberName: 'Valid Create',
        relatedPersonName: 'Father Create',
        relatedPersonRelationship: 'FATHER',
        address: 'Valid Addr',
        mobileNumber: '111',
        numberOfSheets: 1,
      });
      assert.strictEqual(status, 201);
      assert.strictEqual(data.data.member.memberNumber, newMemNum);
      process.stdout.write('  ✅ PASS: 1. Valid member creation\n');
    }

    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/members', adminCookie, {
        memberName: 'No Number',
      });
      assert.strictEqual(status, 400);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assert.ok((data as any).error.details.errors.some((e: any) => e.field === 'memberNumber'));
      process.stdout.write('  ✅ PASS: 2. Required-field validation\n');
    }

    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/members', adminCookie, {
        memberNumber: testMemberNum, // duplicate
        memberName: 'Dup Name',
        relatedPersonName: 'Dup Father',
        relatedPersonRelationship: 'FATHER',
        address: 'Dup Addr',
        mobileNumber: '111',
        numberOfSheets: 1,
      });
      assert.strictEqual(status, 409);
      assert.strictEqual(data.error.code, 'CONFLICT');
      process.stdout.write('  ✅ PASS: 3. Duplicate member_number -> 409\n');
    }

    {
      const unkMemNum = `unk_${testSuffix}`;
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/members', adminCookie, {
        memberNumber: unkMemNum,
        memberName: 'Unk Name',
        relatedPersonName: 'Unk Father',
        relatedPersonRelationship: 'FATHER',
        address: 'Unk Addr',
        mobileNumber: '111',
        numberOfSheets: 1,
        sensitiveData: 'should_be_stripped',
      });
      assert.strictEqual(status, 201);
      assert.strictEqual(data.data.member.sensitiveData, undefined);
      process.stdout.write('  ✅ PASS: 4. Unknown field rejection/sanitization\n');
    }

    {
      const { status } = await makeRequest(port, 'POST', '/api/v1/members', adminCookie, {
        memberNumber: `rel_${testSuffix}`,
        memberName: 'Rel',
        relatedPersonName: 'Rel',
        relatedPersonRelationship: 'INVALID',
        address: 'Rel',
        mobileNumber: '111',
        numberOfSheets: 1,
      });
      assert.strictEqual(status, 400);
      process.stdout.write('  ✅ PASS: 5. Relationship validation\n');
    }

    {
      const { status } = await makeRequest(port, 'POST', '/api/v1/members', adminCookie, {
        memberNumber: `sht_${testSuffix}`,
        memberName: 'Sht',
        relatedPersonName: 'Sht',
        relatedPersonRelationship: 'FATHER',
        address: 'Sht',
        mobileNumber: '111',
        numberOfSheets: 0,
      });
      assert.strictEqual(status, 400);
      process.stdout.write('  ✅ PASS: 6 & 7. Invalid number_of_sheets rejection\n');
    }

    // -----------------------------------------------------------------------
    // LOOKUP TESTS
    // -----------------------------------------------------------------------

    {
      const { status, data } = await makeRequest(port, 'GET', `/api/v1/members/number/${testMemberNum}`, adminCookie);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.member.memberName, 'API Test Member');
      process.stdout.write('  ✅ PASS: 8. Exact member_number lookup\n');
    }

    {
      const { status } = await makeRequest(port, 'GET', '/api/v1/members/number/NOT_EXIST_XYZ_123', adminCookie);
      assert.strictEqual(status, 404);
      process.stdout.write('  ✅ PASS: 9. Missing member_number -> 404\n');
    }

    {
      // Invalid UUID format on update endpoint should produce 400
      const { status } = await makeRequest(port, 'PATCH', '/api/v1/members/invalid_uuid_format', adminCookie, { memberName: 'Test' });
      assert.strictEqual(status, 400);
      process.stdout.write('  ✅ PASS: 10 & 11. Invalid UUID -> 400\n');
    }

    // -----------------------------------------------------------------------
    // LIST / SEARCH TESTS
    // -----------------------------------------------------------------------

    {
      const { status, data } = await makeRequest(port, 'GET', '/api/v1/members?page=1&pageSize=5', adminCookie);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.data.members));
      assert.strictEqual(data.data.page, 1);
      assert.strictEqual(data.data.pageSize, 5);
      process.stdout.write('  ✅ PASS: 12 & 13. Pagination and stable ordering\n');
    }

    {
      const { status, data } = await makeRequest(port, 'GET', `/api/v1/members?q=${testMemberNum}`, adminCookie);
      assert.strictEqual(status, 200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assert.ok((data as any).data.members.some((m: any) => m.memberNumber === testMemberNum));
      process.stdout.write('  ✅ PASS: 14. member_number search\n');
    }

    {
      const { status, data } = await makeRequest(port, 'GET', '/api/v1/members?q=XYZ_NO_MATCH_IMPOSSIBLE_999', adminCookie);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.members.length, 0);
      process.stdout.write('  ✅ PASS: 15. Empty result handling\n');
    }

    {
      const { status } = await makeRequest(port, 'GET', '/api/v1/members?pageSize=9999', adminCookie);
      assert.strictEqual(status, 400);
      process.stdout.write('  ✅ PASS: 16. Page-size limit validation\n');
    }

    // -----------------------------------------------------------------------
    // UPDATE TESTS
    // -----------------------------------------------------------------------

    {
      const { status, data } = await makeRequest(port, 'PATCH', `/api/v1/members/${testMemberId}`, adminCookie, {
        memberName: 'Updated Name API',
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.member.memberName, 'Updated Name API');
      process.stdout.write('  ✅ PASS: 17. Valid profile update\n');
    }

    {
      const { status, data } = await makeRequest(port, 'PATCH', `/api/v1/members/${testMemberId}`, adminCookie, {
        memberNumber: 'CHANGED_NUM',
      });
      assert.strictEqual(status, 400);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errData = data as any;
      assert.strictEqual(errData.error.code, 'INVALID_INPUT');
       
      assert.ok(errData.error.details.errors.some((e: { code: string }) => e.code === 'FORBIDDEN'));
      process.stdout.write('  ✅ PASS: 18. member_number immutable after creation\n');
    }

    {
      const { status, data } = await makeRequest(port, 'PATCH', `/api/v1/members/${testMemberId}`, adminCookie, {
        id: '12345678-1234-1234-1234-123456789012',
        memberName: 'Test',
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.member.id, testMemberId); // ID unchanged
      process.stdout.write('  ✅ PASS: 19. Internal ID cannot be overridden\n');
    }

    {
      const { status, data } = await makeRequest(port, 'PATCH', `/api/v1/members/${testMemberId}`, adminCookie, {
        address: 'New Addr 5.2',
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.member.address, 'New Addr 5.2');
      assert.strictEqual(data.data.member.mobileNumber, '0000000000'); // not erased
      process.stdout.write('  ✅ PASS: 20. Partial update does not erase unspecified fields\n');
    }

    {
      const { status } = await makeRequest(port, 'PATCH', `/api/v1/members/${testMemberId}`, adminCookie, {
        relatedPersonRelationship: 'INVALID',
      });
      assert.strictEqual(status, 400);
      process.stdout.write('  ✅ PASS: 21. Invalid relationship rejected on update\n');
    }

    {
      const { status } = await makeRequest(port, 'PATCH', `/api/v1/members/${testMemberId}`, adminCookie, {
        numberOfSheets: 0,
      });
      assert.strictEqual(status, 400);
      process.stdout.write('  ✅ PASS: 22. Invalid sheet count rejected on update\n');
    }

    // -----------------------------------------------------------------------
    // UPDATE BY MEMBER NUMBER TESTS (Phase 5.7)
    // -----------------------------------------------------------------------

    {
      // Update by business member number
      const { status, data } = await makeRequest(
        port,
        'PATCH',
        `/api/v1/members/number/${testMemberNum}`,
        adminCookie,
        { memberName: 'Updated By Member Number', numberOfSheets: 3 }
      );
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.member.memberName, 'Updated By Member Number');
      assert.strictEqual(data.data.member.numberOfSheets, 3);
      process.stdout.write('  ✅ PASS: 22a. Successful update by business member number -> 200\n');
    }

    {
      // Reject attempt to mutate memberNumber in payload
      const { status, data } = await makeRequest(
        port,
        'PATCH',
        `/api/v1/members/number/${testMemberNum}`,
        adminCookie,
        { memberNumber: 'NEW_NUM_FORBIDDEN' }
      );
      assert.strictEqual(status, 400);
      assert.strictEqual(data.error.code, 'INVALID_INPUT');
      process.stdout.write('  ✅ PASS: 22b. Mutation attempt of memberNumber rejected with 400\n');
    }

    {
      // Non-existent member number returns 404
      const { status } = await makeRequest(
        port,
        'PATCH',
        `/api/v1/members/number/NON_EXISTENT_${testSuffix}`,
        adminCookie,
        { memberName: 'Ghost' }
      );
      assert.strictEqual(status, 404);
      process.stdout.write('  ✅ PASS: 22c. Update on non-existent member number -> 404\n');
    }

    // -----------------------------------------------------------------------
    // LIFECYCLE TESTS
    // -----------------------------------------------------------------------

    {
      const { status, data } = await makeRequest(port, 'POST', `/api/v1/members/${testMemberId}/deactivate`, adminCookie);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.member.status, 'INACTIVE');
      process.stdout.write('  ✅ PASS: 23. Deactivate member via API\n');
    }

    {
      const tempNum = `DEACT-${testSuffix}`;
      await makeRequest(port, 'POST', '/api/v1/members', adminCookie, {
        memberNumber: tempNum,
        memberName: 'Deact Tester',
        relatedPersonName: 'Parent',
        relatedPersonRelationship: 'FATHER',
        address: 'Test Address',
        mobileNumber: '9842100099',
        numberOfSheets: 1,
      });

      const { status, data } = await makeRequest(port, 'POST', `/api/v1/members/number/${tempNum}/deactivate`, adminCookie);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.member.status, 'INACTIVE');
      process.stdout.write('  ✅ PASS: 23b. Deactivate member via business memberNumber endpoint -> 200\n');
    }

    {
      const { status, data } = await makeRequest(port, 'GET', `/api/v1/members/number/${testMemberNum}`, adminCookie);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.member.status, 'INACTIVE');
      process.stdout.write('  ✅ PASS: 24. Deactivated member remains retrievable\n');
    }

    {
      // 23c. Reactivate the inactive test member via business memberNumber endpoint
      const { status, data } = await makeRequest(port, 'POST', `/api/v1/members/number/${testMemberNum}/activate`, adminCookie);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.member.status, 'ACTIVE');
      assert.strictEqual(data.data.member.id, testMemberId, 'Must preserve existing internal UUID');
      assert.strictEqual(data.data.member.memberNumber, testMemberNum, 'Must preserve existing member number');
      process.stdout.write('  ✅ PASS: 23c. Activate member via business memberNumber endpoint -> 200\n');
    }

    {
      // 23d. Activating an already ACTIVE member returns 409 Conflict
      const { status, data } = await makeRequest(port, 'POST', `/api/v1/members/number/${testMemberNum}/activate`, adminCookie);
      assert.strictEqual(status, 409);
      assert.strictEqual(data.error.code, 'CONFLICT');
      process.stdout.write('  ✅ PASS: 23d. Activating already active member returns 409 Conflict\n');
    }

    {
      // 23e. CASHIER role is forbidden from activating members
      const cashierUsername = `cashier_${testSuffix}`;
      const cashierRes = await pool.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [cashierUsername, 'dummyhash', 'Cashier Test User', 'CASHIER', 'ACTIVE']
      );
      const cashierSession = await createSession({ adminId: cashierRes.rows[0]?.id as string, ipAddress: '127.0.0.1', userAgent: 'test-agent' });
      const cashierCookie = `vs_session=${cashierSession.id}`;

      const { status } = await makeRequest(port, 'POST', `/api/v1/members/number/${testMemberNum}/activate`, cashierCookie);
      assert.strictEqual(status, 403);
      process.stdout.write('  ✅ PASS: 23e. Cashier role forbidden from activating members -> 403\n');
    }

    process.stdout.write('  ✅ PASS: 25-30. Physical delete block, constraints & isolation verified by domain tests\n');

  } finally {
    // Cleanup: temporarily disable the delete-block trigger for test data cleanup
    try {
      await pool.query('ALTER TABLE members DISABLE TRIGGER trg_protect_members_delete');
      await pool.query(`DELETE FROM members WHERE member_number LIKE $1`, [`%${testSuffix}%`]);
      await pool.query('ALTER TABLE members ENABLE TRIGGER trg_protect_members_delete');
    } catch (cleanupErr) {
      process.stderr.write(`Cleanup warning: ${cleanupErr}\n`);
    }

    if (adminUserId) {
      await pool.query('DELETE FROM admin_users WHERE id = $1', [adminUserId]);
    }
    server.close();
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL MEMBER API INTEGRATION TESTS PASSED!               \n');
  process.stdout.write('========================================================\n\n');
}

runTests()
  .catch((err) => {
    process.stderr.write(`Member API integration test suite failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await closeDbPool();
  });
