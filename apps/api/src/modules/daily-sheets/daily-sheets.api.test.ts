/**
 * Automated HTTP Integration Test Suite for Daily Sheet API (Phase 6.4)
 *
 * Verifies:
 * 1. Unauthenticated request rejected with 401.
 * 2. Missing member identity rejected with 400.
 * 3. Non-existent member rejected with 404.
 * 4. Inactive member rejected with 409 conflict.
 * 5. Authoritative server calculation: daily_due = numberOfSheets × ₹200.
 * 6. Client cannot override calculated totals (rejected with 400).
 * 7. Unknown fields rejected with 400.
 * 8. Invalid calendar date rejected with 400.
 * 9. Negative financial values rejected with 400.
 * 10. Invalid status or payment mode rejected with 400.
 * 11. Successful creation with 201 response and standard envelope.
 * 12. Idempotent replay: identical request with same idempotencyKey returns 200/201 without duplication.
 * 13. Duplicate submission for same member & date returns 409 Conflict.
 * 14. Conflicting idempotency key returns 409 Conflict.
 * 15. GET /api/v1/daily-sheets/:id returns 200 for existing entry.
 * 16. GET /api/v1/daily-sheets/:id returns 404 for missing entry.
 * 17. GET /api/v1/daily-sheets returns paginated items.
 * 18. Filter by business date returns matching daily sheets.
 * 19. Filter by member number returns matching daily sheets.
 * 20. GET /api/v1/daily-sheets/member/:memberNumber returns member daily history.
 * 21. GET /api/v1/daily-sheets/member/:memberNumber for missing member returns 404.
 * 22. Safe error responses: no SQL errors or stack traces leaked.
 */

import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool } from '../../database/index.js';
import { createTestIdentifier } from '../../test-utils/index.js';
import { createApp } from '../../app.js';
import { MemberService } from '../members/members.service.js';
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
  process.stdout.write(' Running Daily Sheet API Integration Tests (Phase 6.4)  \n');
  process.stdout.write('========================================================\n');

  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;

  const pool = getDbPool();
  const testSuffix = createTestIdentifier('ds64');
  let adminUserId = '';
  let adminCookie = '';

  const activeMemberNum = `mem_act_${testSuffix}`;
  const inactiveMemberNum = `mem_inact_${testSuffix}`;
  let activeMemberId = '';
  let inactiveMemberId = '';

  try {
    // 1. Provision test admin and session
    const adminUsername = `ds_admin_${testSuffix}`;
    const adminRes = await pool.query<{ id: string }>(
      `INSERT INTO admin_users (username, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id;`,
      [adminUsername, 'dummyhash', 'Daily Sheet Admin', 'ADMIN', 'ACTIVE']
    );
    adminUserId = adminRes.rows[0]?.id as string;

    const session = await createSession({
      adminId: adminUserId,
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
    adminCookie = `vs_session=${session.id}`;

    // Provision cashier user to test RBAC rejection on corrections (Phase 6.6)
    let cashierUserId = '';
    let cashierCookie = '';
    const cashierUsername = `ds_cashier_${testSuffix}`;
    const cashierRes = await pool.query<{ id: string }>(
      `INSERT INTO admin_users (username, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id;`,
      [cashierUsername, 'dummyhash', 'Daily Sheet Cashier', 'CASHIER', 'ACTIVE']
    );
    cashierUserId = cashierRes.rows[0]?.id as string;
    const cashierSession = await createSession({
      adminId: cashierUserId,
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
    cashierCookie = `vs_session=${cashierSession.id}`;

    // Provision admin cash account for cash reversal testing
    await pool.query(
      `INSERT INTO admin_cash_accounts (admin_id, account_name) VALUES ($1, 'Admin Cash Account')
       ON CONFLICT (admin_id) DO NOTHING;`,
      [adminUserId]
    );

    // 2. Provision test members via MemberService
    const memberService = new MemberService();

    // Active member with 3 sheets (daily due must be 3 × ₹200 = ₹600 = 60,000 paise)
    const activeMember = await memberService.createMember({
      memberNumber: activeMemberNum,
      memberName: 'Active Daily Tester',
      relatedPersonName: 'Father',
      relatedPersonRelationship: 'FATHER',
      address: 'Market Street',
      mobileNumber: '9842111111',
      numberOfSheets: 3,
    });
    activeMemberId = activeMember.id;

    // Inactive member
    const inactiveMember = await memberService.createMember({
      memberNumber: inactiveMemberNum,
      memberName: 'Inactive Daily Tester',
      relatedPersonName: 'Father',
      relatedPersonRelationship: 'FATHER',
      address: 'Market Street',
      mobileNumber: '9842122222',
      numberOfSheets: 1,
    });
    await memberService.deactivateMember(inactiveMember.id);
    inactiveMemberId = inactiveMember.id;

    // Test 1: Unauthenticated request rejected with 401
    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', undefined, {
        memberNumber: activeMemberNum,
        businessDate: '2026-10-04',
      });
      assert.strictEqual(status, 401);
      assert.strictEqual(data?.error?.code, 'UNAUTHENTICATED');
      process.stdout.write('  ✅ PASS: 1. Unauthenticated request rejected -> 401\n');
    }

    // Test 2: Missing member identity rejected with 400
    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        businessDate: '2026-10-04',
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data?.error?.code, 'INVALID_INPUT');
      process.stdout.write('  ✅ PASS: 2. Missing member identity rejected -> 400\n');
    }

    // Test 3: Non-existent member rejected with 404
    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: 'NON_EXISTENT_MEM_99999',
        businessDate: '2026-10-04',
      });
      assert.strictEqual(status, 404);
      assert.strictEqual(data?.error?.code, 'NOT_FOUND');
      process.stdout.write('  ✅ PASS: 3. Non-existent member rejected -> 404\n');
    }

    // Test 4: Inactive member rejected with 409 Conflict
    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: inactiveMemberNum,
        businessDate: '2026-10-04',
      });
      assert.strictEqual(status, 409);
      assert.strictEqual(data?.error?.code, 'CONFLICT');
      process.stdout.write('  ✅ PASS: 4. Inactive member rejected -> 409 Conflict\n');
    }

    // Test 5: Client attempting to supply calculated totals rejected with 400
    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: '2026-10-04',
        dailyDueAmountPaise: 1000, // Client tries to override
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data?.error?.code, 'INVALID_INPUT');
      const hasCalculatedFieldMsg = data?.error?.details?.errors?.some((e: { message: string }) =>
        e.message.includes('calculated authoritatively by the server')
      );
      assert.strictEqual(hasCalculatedFieldMsg, true);
      process.stdout.write('  ✅ PASS: 5. Client cannot override authoritative calculated totals -> 400\n');
    }

    // Test 6: Unknown fields rejected with 400
    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: '2026-10-04',
        unknownBonus: 500,
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data?.error?.code, 'INVALID_INPUT');
      process.stdout.write('  ✅ PASS: 6. Unknown fields rejected -> 400\n');
    }

    // Test 7: Invalid calendar date rejected with 400
    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: 'invalid-date',
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data?.error?.code, 'INVALID_INPUT');
      process.stdout.write('  ✅ PASS: 7. Invalid date rejected -> 400\n');
    }

    // Test 8: Negative financial amounts rejected with 400
    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: '2026-10-04',
        actualPaidPaise: -500,
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data?.error?.code, 'INVALID_INPUT');
      process.stdout.write('  ✅ PASS: 8. Negative financial amounts rejected -> 400\n');
    }

    // Test 9: Invalid status rejected with 400
    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: '2026-10-04',
        status: 'MAGIC_STATUS',
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data?.error?.code, 'INVALID_INPUT');
      process.stdout.write('  ✅ PASS: 9. Invalid status vocabulary rejected -> 400\n');
    }

    // Test 10: Successful creation with server-side authoritative calculations (201)
    let createdSheetId = '';
    const date1 = '2026-10-04';
    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: date1,
        actualPaidPaise: 60000, // full payment
        paymentMode: 'CASH',
        notes: 'Collected in full',
      });

      assert.strictEqual(status, 201);
      assert.strictEqual(data.error, null);
      const sheet = data.data.dailySheet;
      assert.ok(sheet.id);
      createdSheetId = sheet.id;
      assert.strictEqual(sheet.memberNumber, activeMemberNum);
      assert.strictEqual(sheet.businessDate, date1);
      assert.strictEqual(sheet.numberOfSheets, 3);
      // Confirmed math: 3 sheets × 20,000 paise = 60,000 paise (₹600)
      assert.strictEqual(sheet.dailyDueAmountPaise, 60000);
      assert.strictEqual(sheet.previousArrearsPaise, 0);
      assert.strictEqual(sheet.totalDuePaise, 60000);
      assert.strictEqual(sheet.actualPaidPaise, 60000);
      assert.strictEqual(sheet.balanceRemainingPaise, 0);
      assert.strictEqual(sheet.excessPaidPaise, 0);
      assert.strictEqual(sheet.status, 'PAID');
      assert.strictEqual(sheet.paymentMode, 'CASH');
      process.stdout.write('  ✅ PASS: 10. Successful daily sheet creation with authoritative financial calculation -> 201\n');
    }

    // Test 11: Duplicate creation for same member & date returns 409 Conflict
    {
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: date1,
        actualPaidPaise: 60000,
      });
      assert.strictEqual(status, 409);
      assert.strictEqual(data?.error?.code, 'CONFLICT');
      process.stdout.write('  ✅ PASS: 11. Duplicate entry on same date returns 409 Conflict\n');
    }

    // Test 12: Idempotent replay: identical request with same idempotencyKey returns existing record
    const idemKey = `idem_${testSuffix}`;
    const date2 = '2026-10-05';
    {
      const res1 = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: date2,
        actualPaidPaise: 40000,
        idempotencyKey: idemKey,
      });
      assert.strictEqual(res1.status, 201);
      assert.strictEqual(res1.data.data.dailySheet.status, 'PARTIAL');
      assert.strictEqual(res1.data.data.dailySheet.balanceRemainingPaise, 20000);
      assert.strictEqual(res1.data.data.dailySheet.excessPaidPaise, 0);
      const sheet1Id = res1.data.data.dailySheet.id;

      // Replay with identical idempotencyKey & parameters
      const res2 = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: date2,
        actualPaidPaise: 40000,
        idempotencyKey: idemKey,
      });
      assert.strictEqual(res2.status, 201);
      assert.strictEqual(res2.data.data.dailySheet.id, sheet1Id);
      process.stdout.write('  ✅ PASS: 12. Idempotent replay with matching key returns existing entry\n');
    }

    // Test 13: Conflicting idempotency key returns 409 Conflict
    {
      const date3 = '2026-10-06';
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: date3, // Different date with same idempotency key
        actualPaidPaise: 60000,
        idempotencyKey: idemKey,
      });
      assert.strictEqual(status, 409);
      assert.strictEqual(data?.error?.code, 'CONFLICT');
      process.stdout.write('  ✅ PASS: 13. Conflicting idempotency key returns 409 Conflict\n');
    }

    // Test 14: GET /api/v1/daily-sheets/:id returns 200
    {
      const { status, data } = await makeRequest(port, 'GET', `/api/v1/daily-sheets/${createdSheetId}`, adminCookie);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.dailySheet.id, createdSheetId);
      assert.strictEqual(data.data.dailySheet.memberNumber, activeMemberNum);
      process.stdout.write('  ✅ PASS: 14. GET /api/v1/daily-sheets/:id returns entry -> 200\n');
    }

    // Test 15: GET /api/v1/daily-sheets/:id for non-existent UUID returns 404
    {
      const { status, data } = await makeRequest(
        port,
        'GET',
        '/api/v1/daily-sheets/f0000000-0000-4000-a000-000000000000',
        adminCookie
      );
      assert.strictEqual(status, 404);
      assert.strictEqual(data?.error?.code, 'NOT_FOUND');

      // Malformed UUID returns 400
      const malformedRes = await makeRequest(port, 'GET', '/api/v1/daily-sheets/invalid-uuid-format', adminCookie);
      assert.strictEqual(malformedRes.status, 400);

      process.stdout.write('  ✅ PASS: 15. GET /api/v1/daily-sheets/:id for missing UUID returns 404 (malformed returns 400)\n');
    }

    // Test 16: GET /api/v1/daily-sheets returns paginated list
    {
      const { status, data } = await makeRequest(port, 'GET', '/api/v1/daily-sheets', adminCookie);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.data.items));
      assert.ok(data.data.pagination);
      assert.ok(data.data.pagination.total >= 2);
      process.stdout.write('  ✅ PASS: 16. GET /api/v1/daily-sheets returns paginated list -> 200\n');
    }

    // Test 17: Filter by business date
    {
      const { status, data } = await makeRequest(
        port,
        'GET',
        `/api/v1/daily-sheets?businessDate=${date1}`,
        adminCookie
      );
      assert.strictEqual(status, 200);
      assert.ok(data.data.items.length >= 1);
      assert.ok(data.data.items.every((item: { businessDate: string }) => item.businessDate === date1));
      process.stdout.write('  ✅ PASS: 17. Filter by business date returns matching records\n');
    }

    // Test 18: Filter by member number
    {
      const { status, data } = await makeRequest(
        port,
        'GET',
        `/api/v1/daily-sheets?memberNumber=${encodeURIComponent(activeMemberNum)}`,
        adminCookie
      );
      assert.strictEqual(status, 200);
      assert.ok(data.data.items.length >= 2);
      assert.ok(data.data.items.every((item: { memberNumber?: string }) => item.memberNumber === activeMemberNum));
      process.stdout.write('  ✅ PASS: 18. Filter by member number returns matching records\n');
    }

    // Test 19: GET /api/v1/daily-sheets/member/:memberNumber returns member history
    {
      const { status, data } = await makeRequest(
        port,
        'GET',
        `/api/v1/daily-sheets/member/${encodeURIComponent(activeMemberNum)}`,
        adminCookie
      );
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.data.items));
      assert.strictEqual(data.data.items.length, 2);
      process.stdout.write('  ✅ PASS: 19. Member daily sheet history endpoint returns 200 with items\n');
    }

    // Test 20: GET /api/v1/daily-sheets/member/:memberNumber for missing member returns 404
    {
      const { status, data } = await makeRequest(
        port,
        'GET',
        '/api/v1/daily-sheets/member/UNKNOWN_MEMBER_9999',
        adminCookie
      );
      assert.strictEqual(status, 404);
      assert.strictEqual(data?.error?.code, 'NOT_FOUND');
      process.stdout.write('  ✅ PASS: 20. Member history for missing member returns 404\n');
    }

    // Test 21: Safe error responses: no SQL errors or stack traces leaked
    {
      const { data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: 'invalid',
      });
      const serialized = JSON.stringify(data);
      assert.strictEqual(serialized.includes('SELECT'), false);
      assert.strictEqual(serialized.includes('INSERT'), false);
      assert.strictEqual(serialized.includes('node_modules'), false);
      assert.strictEqual(serialized.includes('stack'), false);
      process.stdout.write('  ✅ PASS: 21. Safe error sanitization: no SQL or internals exposed\n');
    }

    // Test 22: Excess payment resolves to PAID (NOT ADVANCE_PAID) and preserves excessPaidPaise
    {
      const date3 = '2026-10-06';
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: date3,
        actualPaidPaise: 80000, // ₹800 paid on ₹600 due
        paymentMode: 'CASH',
      });

      assert.strictEqual(status, 201);
      const sheet = data.data.dailySheet;
      assert.strictEqual(sheet.totalDuePaise, 60000);
      assert.strictEqual(sheet.actualPaidPaise, 80000);
      assert.strictEqual(sheet.balanceRemainingPaise, 0);
      assert.strictEqual(sheet.excessPaidPaise, 20000);
      // Confirmed rule: status is PAID, NOT ADVANCE_PAID
      assert.strictEqual(sheet.status, 'PAID');

      // Invariant: Unresolved future-day advance allocation is NOT automatically performed
      const futureCheck = await pool.query(
        'SELECT id FROM daily_sheets WHERE member_id = $1 AND business_date = $2;',
        [activeMemberId, '2026-10-07']
      );
      assert.strictEqual(futureCheck.rows.length, 0, 'No future date sheet should be auto-created by excess payment');
      process.stdout.write('  ✅ PASS: 22. Excess payment resolves to PAID (not ADVANCE_PAID) with preserved excessPaidPaise and no auto-allocation\n');
    }

    // Test 23: Zero payment (omitted actualPaidPaise) resolves to NOT_PAID
    {
      const date4 = '2026-10-07';
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: date4,
      });

      assert.strictEqual(status, 201);
      const sheet = data.data.dailySheet;
      assert.strictEqual(sheet.totalDuePaise, 60000);
      assert.strictEqual(sheet.actualPaidPaise, 0);
      assert.strictEqual(sheet.balanceRemainingPaise, 60000);
      assert.strictEqual(sheet.excessPaidPaise, 0);
      assert.strictEqual(sheet.status, 'NOT_PAID');
      process.stdout.write('  ✅ PASS: 23. Zero payment resolves to NOT_PAID with full balance remaining\n');
    }

    // Test 24: Explicit approved status supplied by client is preserved
    {
      const date5 = '2026-10-08';
      const { status, data } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
        memberNumber: activeMemberNum,
        businessDate: date5,
        actualPaidPaise: 80000,
        status: 'ADVANCE_PAID',
      });

      assert.strictEqual(status, 201);
      const sheet = data.data.dailySheet;
      assert.strictEqual(sheet.status, 'ADVANCE_PAID');
      assert.strictEqual(sheet.excessPaidPaise, 20000);
      process.stdout.write('  ✅ PASS: 24. Explicit caller status (ADVANCE_PAID) is honored\n');
    }

    // Test 25: Invariant: Unresolved ADVANCE_COVERED and OVERDUE are never automatically assigned
    {
      const allSheets = await pool.query<{ status: string }>(
        'SELECT status FROM daily_sheets WHERE member_id = $1;',
        [activeMemberId]
      );
      // Check that none of the auto-assigned sheets received ADVANCE_COVERED or OVERDUE
      const autoStatuses = allSheets.rows.map((r) => r.status).filter((s) => s !== 'ADVANCE_PAID');
      for (const st of autoStatuses) {
        assert.notStrictEqual(st, 'ADVANCE_COVERED');
        assert.notStrictEqual(st, 'OVERDUE');
      }
      process.stdout.write('  ✅ PASS: 25. Invariant: Unresolved ADVANCE_COVERED and OVERDUE are never automatically inferred\n');
    }

    // ========================================================
    // PHASE 6.6 TESTS: CORRECTION / UNDO & AUDIT TRAIL
    // ========================================================

    // Create a sheet to test correction workflow
    const correctionDate = '2026-10-09';
    const { data: createdToCorrect } = await makeRequest(port, 'POST', '/api/v1/daily-sheets', adminCookie, {
      memberNumber: activeMemberNum,
      businessDate: correctionDate,
      actualPaidPaise: 60000,
      paymentMode: 'CASH',
    });
    const sheetIdToCorrect = createdToCorrect.data.dailySheet.id as string;

    // Test 26: Cashier role is rejected with 403 Forbidden on correction
    {
      const { status, data } = await makeRequest(
        port,
        'POST',
        `/api/v1/daily-sheets/${sheetIdToCorrect}/correct`,
        cashierCookie,
        { reason: 'Cashier attempt to correct' }
      );
      assert.strictEqual(status, 403);
      assert.strictEqual(data?.error?.code, 'FORBIDDEN');
      process.stdout.write('  ✅ PASS: 26. Cashier role is rejected with 403 Forbidden on correction\n');
    }

    // Test 27: Correction requires non-empty reason
    {
      const { status: missingStatus } = await makeRequest(
        port,
        'POST',
        `/api/v1/daily-sheets/${sheetIdToCorrect}/correct`,
        adminCookie,
        {}
      );
      assert.strictEqual(missingStatus, 400);

      const { status: emptyStatus } = await makeRequest(
        port,
        'POST',
        `/api/v1/daily-sheets/${sheetIdToCorrect}/correct`,
        adminCookie,
        { reason: '   ' }
      );
      assert.strictEqual(emptyStatus, 400);

      const { status: unknownFieldStatus } = await makeRequest(
        port,
        'POST',
        `/api/v1/daily-sheets/${sheetIdToCorrect}/correct`,
        adminCookie,
        { reason: 'Valid reason', fakeField: 123 }
      );
      assert.strictEqual(unknownFieldStatus, 400);
      process.stdout.write('  ✅ PASS: 27. Correction requires valid non-empty reason and rejects unknown fields -> 400\n');
    }

    // Test 28: Authorized ADMIN successfully corrects entry: original record preserved, returns 200
    {
      const { status, data } = await makeRequest(
        port,
        'POST',
        `/api/v1/daily-sheets/${sheetIdToCorrect}/correct`,
        adminCookie,
        { reason: 'Incorrect payment entry by cashier' }
      );

      assert.strictEqual(status, 200);
      const sheet = data.data.dailySheet;
      const correction = data.data.correction;

      assert.strictEqual(sheet.id, sheetIdToCorrect);
      assert.strictEqual(sheet.isCorrected, true);
      assert.strictEqual(sheet.correctionReason, 'Incorrect payment entry by cashier');
      assert.ok(sheet.correctedAt, 'correctedAt should be set');
      assert.strictEqual(sheet.correctedByAdminId, adminUserId);

      assert.strictEqual(correction.originalDailySheetId, sheetIdToCorrect);
      assert.strictEqual(correction.originalActualPaidPaise, 60000);
      assert.strictEqual(correction.reason, 'Incorrect payment entry by cashier');
      assert.strictEqual(correction.correctedByAdminId, adminUserId);
      process.stdout.write('  ✅ PASS: 28. Authorized ADMIN successfully corrects entry with full audit trail\n');
    }

    // Test 29: Duplicate correction of same record returns 409 Conflict
    {
      const { status, data } = await makeRequest(
        port,
        'POST',
        `/api/v1/daily-sheets/${sheetIdToCorrect}/correct`,
        adminCookie,
        { reason: 'Second correction attempt' }
      );
      assert.strictEqual(status, 409);
      assert.strictEqual(data?.error?.code, 'CONFLICT');
      process.stdout.write('  ✅ PASS: 29. Duplicate correction of same record returns 409 Conflict\n');
    }

    // Test 30: Cash payment correction creates reversal DEBIT in cash_transactions
    {
      const cashTx = await pool.query(
        `SELECT id, direction, transaction_type, amount_paise, domain_entity_type, domain_entity_id
         FROM cash_transactions
         WHERE domain_entity_type = 'DAILY_SHEET_CORRECTION' AND domain_entity_id = $1;`,
        [sheetIdToCorrect]
      );
      assert.strictEqual(cashTx.rows.length, 1);
      assert.strictEqual(cashTx.rows[0].direction, 'DEBIT');
      assert.strictEqual(cashTx.rows[0].transaction_type, 'ADJUSTMENT');
      assert.strictEqual(Number(cashTx.rows[0].amount_paise), 60000);
      process.stdout.write('  ✅ PASS: 30. Cash correction creates offsetting DEBIT in cash ledger\n');
    }

    // Test 31: Physical DELETE is prevented by DB triggers on daily_sheets & daily_sheet_corrections
    {
      let deleteSheetFailed = false;
      try {
        await pool.query('DELETE FROM daily_sheets WHERE id = $1;', [sheetIdToCorrect]);
      } catch (err: unknown) {
        deleteSheetFailed = true;
        assert.ok(String(err).includes('DELETE operations are strictly prohibited'));
      }
      assert.strictEqual(deleteSheetFailed, true, 'Physical deletion of daily sheet must be prevented');

      let deleteCorrectionFailed = false;
      try {
        await pool.query('DELETE FROM daily_sheet_corrections WHERE original_daily_sheet_id = $1;', [sheetIdToCorrect]);
      } catch (err: unknown) {
        deleteCorrectionFailed = true;
        assert.ok(String(err).includes('DELETE operations are strictly prohibited'));
      }
      assert.strictEqual(deleteCorrectionFailed, true, 'Physical deletion of daily sheet correction must be prevented');
      process.stdout.write('  ✅ PASS: 31. DB triggers strictly prevent physical DELETE of daily sheets & corrections\n');
    }

  } finally {
    // Cleanup: temporarily disable delete trigger for test data cleanup
    try {
      if (activeMemberId || inactiveMemberId) {
        await pool.query('ALTER TABLE daily_sheet_corrections DISABLE TRIGGER trg_protect_daily_sheet_corrections_delete;');
        await pool.query(
          `DELETE FROM daily_sheet_corrections WHERE member_id IN ($1, $2);`,
          [activeMemberId || '00000000-0000-0000-0000-000000000000', inactiveMemberId || '00000000-0000-0000-0000-000000000000']
        );
        await pool.query('ALTER TABLE daily_sheet_corrections ENABLE TRIGGER trg_protect_daily_sheet_corrections_delete;');

        await pool.query('ALTER TABLE collections DISABLE TRIGGER trg_protect_collections_delete;');
        await pool.query(
          `DELETE FROM collections WHERE member_id IN ($1, $2) OR recorded_by_admin_id = $3 OR cash_transaction_id IN (SELECT id FROM cash_transactions WHERE recorded_by_admin_id = $3);`,
          [activeMemberId || '00000000-0000-0000-0000-000000000000', inactiveMemberId || '00000000-0000-0000-0000-000000000000', adminUserId || '00000000-0000-0000-0000-000000000000']
        );
        await pool.query('ALTER TABLE collections ENABLE TRIGGER trg_protect_collections_delete;');

        await pool.query('ALTER TABLE cash_transactions DISABLE TRIGGER trg_protect_cash_transactions_update_delete;');
        await pool.query(
          `DELETE FROM cash_transactions WHERE recorded_by_admin_id = $1;`,
          [adminUserId]
        );
        await pool.query('ALTER TABLE cash_transactions ENABLE TRIGGER trg_protect_cash_transactions_update_delete;');

        await pool.query('ALTER TABLE daily_sheets DISABLE TRIGGER trg_protect_daily_sheets_delete;');
        await pool.query(
          `DELETE FROM daily_sheets WHERE member_id IN ($1, $2);`,
          [activeMemberId || '00000000-0000-0000-0000-000000000000', inactiveMemberId || '00000000-0000-0000-0000-000000000000']
        );
        await pool.query('ALTER TABLE daily_sheets ENABLE TRIGGER trg_protect_daily_sheets_delete;');
      }

      await pool.query('ALTER TABLE members DISABLE TRIGGER trg_protect_members_delete;');
      await pool.query(`DELETE FROM members WHERE member_number LIKE $1;`, [`%${testSuffix}%`]);
      await pool.query('ALTER TABLE members ENABLE TRIGGER trg_protect_members_delete;');
    } catch (cleanupErr) {
      process.stderr.write(`Cleanup warning: ${cleanupErr}\n`);
    }

    if (adminUserId) {
      await pool.query('DELETE FROM admin_cash_accounts WHERE admin_id = $1;', [adminUserId]);
      await pool.query('DELETE FROM admin_users WHERE id = $1;', [adminUserId]);
    }
    await pool.query(`DELETE FROM admin_users WHERE username LIKE $1;`, [`%${testSuffix}%`]);
    server.close();
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 31 DAILY SHEET API INTEGRATION TESTS PASSED!       \n');
  process.stdout.write('========================================================\n\n');
}

runTests()
  .catch((err) => {
    process.stderr.write(`Daily Sheet API integration test suite failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await closeDbPool();
  });
