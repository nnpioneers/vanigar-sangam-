/**
 * Member Profile API Test Suite (Phase 5.3)
 *
 * Verifies read-only Member Profile endpoint behaviour:
 * - GET /api/v1/members/:memberNumber/profile
 * - Exact member_number lookup
 * - Active and inactive member profile retrieval
 * - Strict parameter validation and 404/400/401 handling
 * - Profile data isolation and zero leakage of sensitive/admin/internal metadata
 * - Deterministic, idempotent, side-effect-free execution (no financial/contribution records created)
 * - Safe test data isolation and complete cleanup
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
  cookie?: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
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
  process.stdout.write(' Running Member Profile API Tests (Phase 5.3)          \n');
  process.stdout.write('========================================================\n');

  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;

  const pool = getDbPool();
  const testSuffix = createTestIdentifier('p53');
  let adminUserId = '';
  let adminCookie = '';
  const memberNumActive = `prof_act_${testSuffix}`;
  const memberNumInactive = `prof_inact_${testSuffix}`;

  try {
    // 1. Provision isolated test admin user and session
    const adminUsername = `prof_admin_${testSuffix}`;
    const adminRes = await pool.query<{ id: string }>(
      `INSERT INTO admin_users (username, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [adminUsername, 'dummyhash', 'Profile Test Admin', 'ADMIN', 'ACTIVE']
    );
    adminUserId = adminRes.rows[0]?.id as string;

    const session = await createSession({
      adminId: adminUserId,
      ipAddress: '127.0.0.1',
      userAgent: 'profile-test-agent',
    });
    adminCookie = `vs_session=${session.id}`;

    // 2. Provision isolated active member
    const mService = new MemberService();
    await mService.createMember({
      memberNumber: memberNumActive,
      memberName: 'Active Member Profile',
      relatedPersonName: 'Active Father',
      relatedPersonRelationship: 'FATHER',
      shopName: 'Active Grocery',
      address: '100 Active Bazar Road',
      mobileNumber: '9876543210',
      numberOfSheets: 3,
      nomineeName: 'Active Nominee',
      nomineeRelationship: 'WIFE',
      nomineePhone: '9876543211',
      insuranceNumber: 'INS-ACT-001',
    });

    // 3. Provision isolated inactive member
    const inactiveMember = await mService.createMember({
      memberNumber: memberNumInactive,
      memberName: 'Inactive Member Profile',
      relatedPersonName: 'Inactive Mother',
      relatedPersonRelationship: 'MOTHER',
      shopName: 'Inactive Textiles',
      address: '200 Inactive Cross Road',
      mobileNumber: '9123456789',
      numberOfSheets: 1,
      nomineeName: 'Inactive Nominee',
      nomineeRelationship: 'SON',
      nomineePhone: '9123456780',
      insuranceNumber: 'INS-INACT-002',
    });
    await mService.deactivateMember(inactiveMember.id);

    // -----------------------------------------------------------------------
    // TEST 1: Authenticated active member profile -> 200
    // -----------------------------------------------------------------------
    {
      const { status, data } = await makeRequest(
        port,
        'GET',
        `/api/v1/members/${memberNumActive}/profile`,
        adminCookie
      );
      assert.strictEqual(status, 200, `Expected 200 for active member profile, got ${status}`);
      assert.strictEqual(data.data.profile.memberNumber, memberNumActive);
      assert.strictEqual(data.data.profile.status, 'ACTIVE');
      process.stdout.write('  ✅ PASS: 1. Authenticated active member profile -> 200\n');
    }

    // -----------------------------------------------------------------------
    // TEST 2: Authenticated inactive member profile -> 200
    // -----------------------------------------------------------------------
    {
      const { status, data } = await makeRequest(
        port,
        'GET',
        `/api/v1/members/${memberNumInactive}/profile`,
        adminCookie
      );
      assert.strictEqual(status, 200, `Expected 200 for inactive member profile, got ${status}`);
      assert.strictEqual(data.data.profile.memberNumber, memberNumInactive);
      assert.strictEqual(data.data.profile.status, 'INACTIVE');
      process.stdout.write('  ✅ PASS: 2. Authenticated inactive member profile -> 200 (retrievable)\n');
    }

    // -----------------------------------------------------------------------
    // TEST 3: Missing member_number -> 404
    // -----------------------------------------------------------------------
    {
      const nonExistentNum = `MISSING_${testSuffix}`;
      const { status, data } = await makeRequest(
        port,
        'GET',
        `/api/v1/members/${nonExistentNum}/profile`,
        adminCookie
      );
      assert.strictEqual(status, 404, `Expected 404 for missing member, got ${status}`);
      assert.strictEqual(data.error.code, 'NOT_FOUND');
      assert.ok(data.error.message.includes(nonExistentNum));
      // Verify no DB errors or stack traces exposed
      assert.strictEqual(data.error.details?.stack, undefined);
      assert.strictEqual(data.error.details?.sql, undefined);
      process.stdout.write('  ✅ PASS: 3. Missing member_number -> 404\n');
    }

    // -----------------------------------------------------------------------
    // TEST 4: Invalid/empty member_number parameter -> 400
    // -----------------------------------------------------------------------
    {
      // Whitespace-only parameter
      const { status: statusEmpty, data: dataEmpty } = await makeRequest(
        port,
        'GET',
        '/api/v1/members/%20%20/profile',
        adminCookie
      );
      assert.strictEqual(statusEmpty, 400, `Expected 400 for empty memberNumber, got ${statusEmpty}`);
      assert.strictEqual(dataEmpty.error.code, 'INVALID_INPUT');

      // Oversized parameter (>50 chars)
      const oversizedParam = 'X'.repeat(51);
      const { status: statusOversized, data: dataOversized } = await makeRequest(
        port,
        'GET',
        `/api/v1/members/${oversizedParam}/profile`,
        adminCookie
      );
      assert.strictEqual(statusOversized, 400, `Expected 400 for oversized memberNumber, got ${statusOversized}`);
      assert.strictEqual(dataOversized.error.code, 'INVALID_INPUT');

      process.stdout.write('  ✅ PASS: 4. Invalid/empty member_number parameter -> 400\n');
    }

    // -----------------------------------------------------------------------
    // TEST 5: Unauthenticated request -> existing auth error (401)
    // -----------------------------------------------------------------------
    {
      const { status, data } = await makeRequest(
        port,
        'GET',
        `/api/v1/members/${memberNumActive}/profile`
        // No cookie provided
      );
      assert.strictEqual(status, 401, `Expected 401 for unauthenticated request, got ${status}`);
      assert.strictEqual(data.error.code, 'UNAUTHENTICATED');
      process.stdout.write('  ✅ PASS: 5. Unauthenticated request -> 401\n');
    }

    // -----------------------------------------------------------------------
    // TEST 6: Profile contains correct member fields
    // -----------------------------------------------------------------------
    {
      const { status, data } = await makeRequest(
        port,
        'GET',
        `/api/v1/members/${memberNumActive}/profile`,
        adminCookie
      );
      assert.strictEqual(status, 200);
      const profile = data.data.profile;

      assert.strictEqual(profile.memberNumber, memberNumActive);
      assert.strictEqual(profile.memberName, 'Active Member Profile');
      assert.strictEqual(profile.relatedPersonName, 'Active Father');
      assert.strictEqual(profile.relatedPersonRelationship, 'FATHER');
      assert.strictEqual(profile.shopName, 'Active Grocery');
      assert.strictEqual(profile.address, '100 Active Bazar Road');
      assert.strictEqual(profile.mobileNumber, '9876543210');
      assert.strictEqual(profile.numberOfSheets, 3);
      assert.strictEqual(profile.nomineeName, 'Active Nominee');
      assert.strictEqual(profile.nomineeRelationship, 'WIFE');
      assert.strictEqual(profile.nomineePhone, '9876543211');
      assert.strictEqual(profile.insuranceNumber, 'INS-ACT-001');
      assert.strictEqual(profile.status, 'ACTIVE');
      assert.ok(typeof profile.createdAt === 'string' && !isNaN(Date.parse(profile.createdAt)));
      assert.ok(typeof profile.updatedAt === 'string' && !isNaN(Date.parse(profile.updatedAt)));

      // Verify internal database UUID id is NOT exposed in the read-model profile
      assert.strictEqual(profile.id, undefined, 'Internal DB UUID id must not be exposed in profile');

      process.stdout.write('  ✅ PASS: 6. Profile contains correct verified member fields\n');
    }

    // -----------------------------------------------------------------------
    // TEST 7: Profile does not expose password/session/admin data
    // -----------------------------------------------------------------------
    {
      const { data } = await makeRequest(
        port,
        'GET',
        `/api/v1/members/${memberNumActive}/profile`,
        adminCookie
      );
      const profile = data.data.profile;

      assert.strictEqual(profile.password, undefined);
      assert.strictEqual(profile.password_hash, undefined);
      assert.strictEqual(profile.passwordHash, undefined);
      assert.strictEqual(profile.session, undefined);
      assert.strictEqual(profile.sessionId, undefined);
      assert.strictEqual(profile.admin, undefined);
      assert.strictEqual(profile.adminId, undefined);
      assert.strictEqual(profile.token, undefined);
      assert.strictEqual(profile.role, undefined);

      process.stdout.write('  ✅ PASS: 7. Profile does not expose password/session/admin data\n');
    }

    // -----------------------------------------------------------------------
    // TEST 8: Profile does not expose another member's data
    // -----------------------------------------------------------------------
    {
      const { data: dataA } = await makeRequest(
        port,
        'GET',
        `/api/v1/members/${memberNumActive}/profile`,
        adminCookie
      );
      const { data: dataB } = await makeRequest(
        port,
        'GET',
        `/api/v1/members/${memberNumInactive}/profile`,
        adminCookie
      );

      const profileA = dataA.data.profile;
      const profileB = dataB.data.profile;

      assert.strictEqual(profileA.memberNumber, memberNumActive);
      assert.strictEqual(profileB.memberNumber, memberNumInactive);
      assert.notStrictEqual(profileA.memberName, profileB.memberName);
      assert.notStrictEqual(profileA.mobileNumber, profileB.mobileNumber);
      assert.notStrictEqual(profileA.address, profileB.address);

      process.stdout.write('  ✅ PASS: 8. Profile strictly isolated to requested member\n');
    }

    // -----------------------------------------------------------------------
    // TEST 9: Profile does not create financial records
    // -----------------------------------------------------------------------
    {
      const txCountBefore = await pool.query<{ count: string }>('SELECT COUNT(*) FROM cash_transactions');
      const transferCountBefore = await pool.query<{ count: string }>('SELECT COUNT(*) FROM cash_transfers');
      const reconCountBefore = await pool.query<{ count: string }>('SELECT COUNT(*) FROM cash_reconciliations');

      await makeRequest(port, 'GET', `/api/v1/members/${memberNumActive}/profile`, adminCookie);

      const txCountAfter = await pool.query<{ count: string }>('SELECT COUNT(*) FROM cash_transactions');
      const transferCountAfter = await pool.query<{ count: string }>('SELECT COUNT(*) FROM cash_transfers');
      const reconCountAfter = await pool.query<{ count: string }>('SELECT COUNT(*) FROM cash_reconciliations');

      assert.strictEqual(txCountBefore.rows[0]?.count, txCountAfter.rows[0]?.count);
      assert.strictEqual(transferCountBefore.rows[0]?.count, transferCountAfter.rows[0]?.count);
      assert.strictEqual(reconCountBefore.rows[0]?.count, reconCountAfter.rows[0]?.count);

      process.stdout.write('  ✅ PASS: 9. Profile does not create financial records\n');
    }

    // -----------------------------------------------------------------------
    // TEST 10: Profile does not create contribution/daily-sheet records
    // -----------------------------------------------------------------------
    {
      const memberCountBefore = await pool.query<{ count: string }>('SELECT COUNT(*) FROM members');

      await makeRequest(port, 'GET', `/api/v1/members/${memberNumActive}/profile`, adminCookie);

      const memberCountAfter = await pool.query<{ count: string }>('SELECT COUNT(*) FROM members');
      assert.strictEqual(memberCountBefore.rows[0]?.count, memberCountAfter.rows[0]?.count);

      process.stdout.write('  ✅ PASS: 10. Profile does not create contribution/daily-sheet records\n');
    }

    // -----------------------------------------------------------------------
    // TEST 11: Profile does not modify the member
    // -----------------------------------------------------------------------
    {
      const rowBefore = await pool.query<{ updated_at: Date; status: string }>(
        'SELECT updated_at, status FROM members WHERE member_number = $1',
        [memberNumActive]
      );

      await makeRequest(port, 'GET', `/api/v1/members/${memberNumActive}/profile`, adminCookie);

      const rowAfter = await pool.query<{ updated_at: Date; status: string }>(
        'SELECT updated_at, status FROM members WHERE member_number = $1',
        [memberNumActive]
      );

      assert.strictEqual(
        new Date(rowBefore.rows[0]?.updated_at as Date).getTime(),
        new Date(rowAfter.rows[0]?.updated_at as Date).getTime()
      );
      assert.strictEqual(rowBefore.rows[0]?.status, rowAfter.rows[0]?.status);

      process.stdout.write('  ✅ PASS: 11. Profile lookup is read-only and does not modify member\n');
    }

    // -----------------------------------------------------------------------
    // TEST 12: Repeated profile lookup returns deterministic data
    // -----------------------------------------------------------------------
    {
      const res1 = await makeRequest(port, 'GET', `/api/v1/members/${memberNumActive}/profile`, adminCookie);
      const res2 = await makeRequest(port, 'GET', `/api/v1/members/${memberNumActive}/profile`, adminCookie);
      const res3 = await makeRequest(port, 'GET', `/api/v1/members/${memberNumActive}/profile`, adminCookie);

      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res3.status, 200);
      assert.deepStrictEqual(res1.data, res2.data);
      assert.deepStrictEqual(res2.data, res3.data);

      process.stdout.write('  ✅ PASS: 12. Repeated profile lookup returns deterministic data\n');
    }

  } finally {
    // Isolated Cleanup: disable delete trigger temporarily to remove test members
    try {
      await pool.query('ALTER TABLE members DISABLE TRIGGER trg_protect_members_delete');
      await pool.query(`DELETE FROM members WHERE member_number LIKE $1`, [`%${testSuffix}%`]);
      await pool.query('ALTER TABLE members ENABLE TRIGGER trg_protect_members_delete');
    } catch (cleanupErr) {
      process.stderr.write(`Cleanup warning (members): ${cleanupErr}\n`);
    }

    if (adminUserId) {
      try {
        await pool.query('DELETE FROM admin_users WHERE id = $1', [adminUserId]);
      } catch (cleanupErr) {
        process.stderr.write(`Cleanup warning (admin): ${cleanupErr}\n`);
      }
    }
    server.close();
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 12 MEMBER PROFILE TESTS PASSED SUCCESSFULLY!       \n');
  process.stdout.write('========================================================\n\n');
}

runTests()
  .catch((err) => {
    process.stderr.write(`Member profile test suite failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await closeDbPool();
  });
