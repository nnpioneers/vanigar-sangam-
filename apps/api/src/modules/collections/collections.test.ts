/**
 * Automated Test Suite for Collections Integration (Phase 6.8)
 *
 * Verifies:
 * 1. Collection created from valid Daily Sheet payment.
 * 2. Correct Member linkage.
 * 3. Correct Daily Sheet linkage.
 * 4. Correct amount.
 * 5. Correct payment mode.
 * 6. Correct business date.
 * 7. Correct recorded admin.
 * 8. Correlation/transaction linkage preserved (cash transaction created for CASH).
 * 9. Non-cash payment mode creates collection without physical cash movement.
 * 10. Daily sheet with zero paid creates zero collection records.
 * 11. Database uniqueness prevents duplicate collection event for same daily sheet.
 * 12. Immutability trigger strictly prohibits physical DELETE on collections.
 * 13. Transaction rollback works atomically.
 * 14. Unauthenticated access rejected with 401.
 * 15. GET /api/v1/collections returns paginated results with financial recap summary.
 * 16. Date filtering works.
 * 17. Member Number filtering works.
 * 18. Payment mode filtering works.
 * 19. Correction integration: corrected payment shows status CORRECTED and does not double count in active totals.
 * 20. GET /api/v1/collections/:id returns collection by UUID (and 404 for missing).
 * 21. Query validation: unknown fields, invalid dates, invalid modes rejected with 400.
 * 22. Safe cleanup and test data isolation.
 */

import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool, withTransaction } from '../../database/index.js';
import { createTestIdentifier } from '../../test-utils/index.js';
import { createApp } from '../../app.js';
import { MemberService } from '../members/members.service.js';
import { createSession } from '../../services/session.service.js';
import { CollectionsRepository } from './collections.repository.js';
import { DailySheetService } from '../daily-sheets/daily-sheets.service.js';
import { DailySheetRepository } from '../daily-sheets/daily-sheets.repository.js';
import { MemberRepository } from '../members/members.repository.js';

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
  process.stdout.write(' Running Collections Integration Tests (Phase 6.8)      \n');
  process.stdout.write('========================================================\n');

  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;

  const pool = getDbPool();
  const testSuffix = createTestIdentifier('col68');
  let adminUserId = '';
  let adminCookie = '';

  const memberNum1 = `m1_${testSuffix}`;
  const memberNum2 = `m2_${testSuffix}`;
  let memberId1 = '';
  let memberId2 = '';

  const collectionsRepo = new CollectionsRepository();
  const dailySheetService = new DailySheetService(new DailySheetRepository(), new MemberRepository());

  try {
    // 1. Provision test admin and session
    const adminUsername = `col_admin_${testSuffix}`;
    const adminRes = await pool.query<{ id: string }>(
      `INSERT INTO admin_users (username, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id;`,
      [adminUsername, 'dummyhash', 'Collections Admin', 'ADMIN', 'ACTIVE']
    );
    adminUserId = adminRes.rows[0]?.id as string;

    // Provision admin cash account
    await pool.query(
      `INSERT INTO admin_cash_accounts (admin_id, account_name, status)
       VALUES ($1, $2, 'ACTIVE')
       ON CONFLICT (admin_id) DO NOTHING;`,
      [adminUserId, `Cash Account ${testSuffix}`]
    );

    const session = await createSession({
      adminId: adminUserId,
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
    adminCookie = `vs_session=${session.id}`;

    // 2. Provision test members (2 sheets = ₹400/day, 1 sheet = ₹200/day)
    const memberService = new MemberService();
    const m1 = await memberService.createMember(
      {
        memberNumber: memberNum1,
        memberName: 'Collection Member One',
        relatedPersonName: 'Father One',
        relatedPersonRelationship: 'FATHER',
        address: '123 Sangam St',
        mobileNumber: '9876543210',
        numberOfSheets: 2,
      }
    );
    memberId1 = m1.id;

    const m2 = await memberService.createMember(
      {
        memberNumber: memberNum2,
        memberName: 'Collection Member Two',
        relatedPersonName: 'Father Two',
        relatedPersonRelationship: 'FATHER',
        address: '456 Sangam St',
        mobileNumber: '9876543211',
        numberOfSheets: 1,
      }
    );
    memberId2 = m2.id;

    // Test 1: Collection created from valid Daily Sheet payment (CASH)
    const bDate1 = '2026-10-01';
    const sheet1 = await dailySheetService.createDailySheet(
      {
        memberNumber: memberNum1,
        businessDate: bDate1,
        actualPaidPaise: 40000,
        paymentMode: 'CASH',
      },
      adminUserId
    );

    const col1 = await collectionsRepo.findByDailySheetId(sheet1.id);
    assert.ok(col1, 'Collection record should exist for daily sheet payment');
    process.stdout.write('  ✅ PASS: 1. Collection created from valid Daily Sheet payment\n');

    // Test 2: Correct Member linkage
    assert.strictEqual(col1.memberId, memberId1);
    assert.strictEqual(col1.memberNumber, memberNum1);
    assert.strictEqual(col1.memberName, 'Collection Member One');
    process.stdout.write('  ✅ PASS: 2. Correct Member linkage\n');

    // Test 3: Correct Daily Sheet linkage
    assert.strictEqual(col1.dailySheetId, sheet1.id);
    process.stdout.write('  ✅ PASS: 3. Correct Daily Sheet linkage\n');

    // Test 4: Correct amount
    assert.strictEqual(col1.amountPaise, 40000);
    process.stdout.write('  ✅ PASS: 4. Correct amount (40,000 paise = ₹400)\n');

    // Test 5: Correct payment mode
    assert.strictEqual(col1.paymentMode, 'CASH');
    process.stdout.write('  ✅ PASS: 5. Correct payment mode (CASH)\n');

    // Test 6: Correct business date
    assert.strictEqual(col1.businessDate, bDate1);
    process.stdout.write('  ✅ PASS: 6. Correct business date\n');

    // Test 7: Correct recorded admin
    assert.strictEqual(col1.recordedByAdminId, adminUserId);
    assert.strictEqual(col1.recordedByAdminName, 'Collections Admin');
    process.stdout.write('  ✅ PASS: 7. Correct recorded admin\n');

    // Test 8: Correlation/transaction linkage preserved for CASH
    assert.ok(col1.cashTransactionId, 'CASH payment should link to cash transaction');
    const cashTxRes = await pool.query<{
      direction: string;
      transaction_type: string;
      amount_paise: string;
    }>(`SELECT direction, transaction_type, amount_paise::text FROM cash_transactions WHERE id = $1;`, [
      col1.cashTransactionId,
    ]);
    const cashRow = cashTxRes.rows[0];
    assert.ok(cashRow, 'Expected cash transaction row to exist');
    assert.strictEqual(cashRow.direction, 'CREDIT');
    assert.strictEqual(cashRow.transaction_type, 'COLLECTION_DEPOSIT');
    assert.strictEqual(cashRow.amount_paise, '40000');
    process.stdout.write('  ✅ PASS: 8. Correlation/cash transaction linkage preserved (CREDIT COLLECTION_DEPOSIT)\n');

    // Test 9: Non-cash payment mode (ONLINE) preserves mode and does not create physical cash movement
    const bDate2 = '2026-10-02';
    const sheet2 = await dailySheetService.createDailySheet(
      {
        memberNumber: memberNum2,
        businessDate: bDate2,
        actualPaidPaise: 20000,
        paymentMode: 'ONLINE',
      },
      adminUserId
    );
    const col2 = await collectionsRepo.findByDailySheetId(sheet2.id);
    assert.ok(col2);
    assert.strictEqual(col2.paymentMode, 'ONLINE');
    assert.strictEqual(col2.cashTransactionId, null, 'Non-cash payment mode should have null cashTransactionId');
    process.stdout.write('  ✅ PASS: 9. Non-cash payment mode (ONLINE) preserves mode without physical cash transaction\n');

    // Test 10: Daily sheet with zero payment (NOT_PAID) does NOT create a collection record
    const bDate3 = '2026-10-03';
    const sheet3 = await dailySheetService.createDailySheet(
      {
        memberNumber: memberNum1,
        businessDate: bDate3,
        actualPaidPaise: 0,
      },
      adminUserId
    );
    const col3 = await collectionsRepo.findByDailySheetId(sheet3.id);
    assert.strictEqual(col3, null, 'Zero payment daily sheet should not create a collection record');
    process.stdout.write('  ✅ PASS: 10. Daily sheet with zero paid creates zero collection records\n');

    // Test 11: Database uniqueness prevents duplicate collection event for same daily sheet
    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO collections (
            daily_sheet_id, member_id, amount_paise, payment_mode, business_date, recorded_by_admin_id
          ) VALUES ($1, $2, $3, $4, $5, $6);`,
          [sheet1.id, memberId1, 40000, 'CASH', bDate1, adminUserId]
        );
      },
      (err: Error) => {
        assert.ok(err.message.includes('unique') || err.message.includes('duplicate'));
        return true;
      }
    );
    process.stdout.write('  ✅ PASS: 11. Database uniqueness prevents duplicate collection event (daily_sheet_id UNIQUE)\n');

    // Test 12: Immutability trigger strictly prohibits physical DELETE on collections
    await assert.rejects(
      async () => {
        await pool.query(`DELETE FROM collections WHERE id = $1;`, [col1.id]);
      },
      (err: Error) => {
        assert.ok(err.message.includes('collections history is immutable') || err.message.includes('DELETE'));
        return true;
      }
    );
    process.stdout.write('  ✅ PASS: 12. Immutability trigger prohibits physical DELETE on collections\n');

    // Test 13: Transaction rollback works atomically
    let rolledBack = false;
    try {
      await withTransaction(async (tx) => {
        await tx.query(
          `INSERT INTO collections (
            daily_sheet_id, member_id, amount_paise, payment_mode, business_date, recorded_by_admin_id
          ) VALUES ($1, $2, $3, $4, $5, $6);`,
          [sheet3.id, memberId1, 10000, 'CASH', bDate3, adminUserId]
        );
        // Force error to trigger rollback
        throw new Error('Simulated atomic failure');
      });
    } catch {
      rolledBack = true;
    }
    assert.strictEqual(rolledBack, true);
    const colAfterRollback = await collectionsRepo.findByDailySheetId(sheet3.id);
    assert.strictEqual(colAfterRollback, null, 'Rolled back collection should not exist');
    process.stdout.write('  ✅ PASS: 13. Transaction rollback works atomically\n');

    // Test 14: Unauthenticated access rejected with 401
    const unauthRes = await makeRequest(port, 'GET', '/api/v1/collections');
    assert.strictEqual(unauthRes.status, 401);
    process.stdout.write('  ✅ PASS: 14. Unauthenticated access rejected with 401\n');

    // Test 15: GET /api/v1/collections returns paginated results with financial recap summary
    const listRes = await makeRequest(port, 'GET', '/api/v1/collections', adminCookie);
    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listRes.data.data.items));
    assert.strictEqual(listRes.data.data.items.length >= 2, true);
    const summary = listRes.data.data.summary;
    assert.ok(summary);
    assert.strictEqual(summary.totalCount >= 2, true);
    assert.strictEqual(summary.activeCount >= 2, true);
    assert.strictEqual(summary.totalAmountPaise >= 60000, true); // 40000 + 20000
    assert.strictEqual(summary.cashAmountPaise >= 40000, true);
    assert.strictEqual(summary.digitalAmountPaise >= 20000, true);
    process.stdout.write('  ✅ PASS: 15. GET /api/v1/collections returns paginated items with financial recap summary\n');

    // Test 16: Date filtering works
    const dateFilterRes = await makeRequest(
      port,
      'GET',
      `/api/v1/collections?businessDate=${bDate1}`,
      adminCookie
    );
    assert.strictEqual(dateFilterRes.status, 200);
    assert.strictEqual(dateFilterRes.data.data.items.length, 1);
    assert.strictEqual(dateFilterRes.data.data.items[0].businessDate, bDate1);
    process.stdout.write('  ✅ PASS: 16. Date filtering works\n');

    // Test 17: Member Number filtering works
    const memFilterRes = await makeRequest(
      port,
      'GET',
      `/api/v1/collections?memberNumber=${memberNum2}`,
      adminCookie
    );
    assert.strictEqual(memFilterRes.status, 200);
    assert.strictEqual(memFilterRes.data.data.items.length, 1);
    assert.strictEqual(memFilterRes.data.data.items[0].memberNumber, memberNum2);
    process.stdout.write('  ✅ PASS: 17. Member Number filtering works\n');

    // Test 18: Payment mode filtering works
    const modeFilterRes = await makeRequest(
      port,
      'GET',
      `/api/v1/collections?paymentMode=ONLINE`,
      adminCookie
    );
    assert.strictEqual(modeFilterRes.status, 200);
    for (const item of modeFilterRes.data.data.items) {
      assert.strictEqual(item.paymentMode, 'ONLINE');
    }
    process.stdout.write('  ✅ PASS: 18. Payment mode filtering works\n');

    // Test 19: Correction integration: corrected daily sheet shows status CORRECTED and excluded from active totals
    const corrRes = await makeRequest(
      port,
      'POST',
      `/api/v1/daily-sheets/${sheet1.id}/correct`,
      adminCookie,
      { reason: 'Entry error correction' }
    );
    assert.strictEqual(corrRes.status, 200);

    const afterCorrList = await makeRequest(
      port,
      'GET',
      `/api/v1/collections?businessDate=${bDate1}`,
      adminCookie
    );
    assert.strictEqual(afterCorrList.status, 200);
    const correctedItem = afterCorrList.data.data.items[0];
    assert.strictEqual(correctedItem.status, 'CORRECTED');
    assert.strictEqual(correctedItem.isCorrected, true);
    assert.strictEqual(correctedItem.correctionReason, 'Entry error correction');
    assert.ok(correctedItem.correctedAt);

    // Active summary should not double count or include corrected amount
    const corrSummary = afterCorrList.data.data.summary;
    assert.strictEqual(corrSummary.activeCount, 0);
    assert.strictEqual(corrSummary.correctedCount, 1);
    assert.strictEqual(corrSummary.totalAmountPaise, 0); // Active total is 0
    assert.strictEqual(corrSummary.totalGrossAmountPaise, 40000);
    assert.strictEqual(corrSummary.correctedAmountPaise, 40000);
    process.stdout.write('  ✅ PASS: 19. Correction integration: status CORRECTED and excluded from active totals\n');

    // Test 20: GET /api/v1/collections/:id returns single collection by UUID
    const singleRes = await makeRequest(
      port,
      'GET',
      `/api/v1/collections/${col1.id}`,
      adminCookie
    );
    assert.strictEqual(singleRes.status, 200);
    assert.strictEqual(singleRes.data.data.collection.id, col1.id);

    const missingRes = await makeRequest(
      port,
      'GET',
      `/api/v1/collections/f0000000-0000-4000-a000-000000000000`,
      adminCookie
    );
    assert.strictEqual(missingRes.status, 404);
    assert.strictEqual(missingRes.data?.error?.code, 'NOT_FOUND');

    const malformedRes = await makeRequest(
      port,
      'GET',
      `/api/v1/collections/invalid-uuid-format`,
      adminCookie
    );
    assert.strictEqual(malformedRes.status, 400);

    process.stdout.write('  ✅ PASS: 20. GET /api/v1/collections/:id returns record (and 404 for missing, 400 for malformed)\n');

    // Test 21: Query validation: unknown fields, invalid dates, invalid modes rejected with 400
    const unknownRes = await makeRequest(port, 'GET', '/api/v1/collections?hacked=true', adminCookie);
    assert.strictEqual(unknownRes.status, 400);

    const badDateRes = await makeRequest(port, 'GET', '/api/v1/collections?businessDate=bad-date', adminCookie);
    assert.strictEqual(badDateRes.status, 400);

    const badModeRes = await makeRequest(port, 'GET', '/api/v1/collections?paymentMode=BITCOIN', adminCookie);
    assert.strictEqual(badModeRes.status, 400);
    process.stdout.write('  ✅ PASS: 21. Query validation rejects unknown fields, invalid dates, invalid modes with 400\n');

    // Test 22: GET /api/v1/collections/export returns CSV data (Phase 7.7)
    // Since fetch's res.json() will fail for CSV, we use raw fetch instead of makeRequest.
    const rawExportRes = await fetch(`http://127.0.0.1:${port}/api/v1/collections/export`, {
      headers: { Cookie: adminCookie }
    });
    assert.strictEqual(rawExportRes.status, 200);
    assert.ok(rawExportRes.headers.get('content-type')?.includes('text/csv'));
    const csvText = await rawExportRes.text();
    assert.ok(csvText.includes('Date,Member Number,Member Name,Daily Sheet ID')); // headers
    assert.ok(csvText.includes(memberNum1)); // data row
    assert.ok(csvText.includes(memberNum2)); // data row
    
    // Test export with filter
    const rawFilteredExportRes = await fetch(`http://127.0.0.1:${port}/api/v1/collections/export?paymentMode=ONLINE`, {
      headers: { Cookie: adminCookie }
    });
    const filteredCsvText = await rawFilteredExportRes.text();
    assert.ok(filteredCsvText.includes(memberNum2));
    assert.strictEqual(filteredCsvText.includes(memberNum1), false, 'Should filter out CASH payments');
    
    process.stdout.write('  ✅ PASS: 22. GET /api/v1/collections/export returns valid filtered CSV data\n');

  } finally {
    // Clean up test data safely in reverse dependency order
    try {
      if (memberId1 && memberId2) {
        await pool.query(`ALTER TABLE daily_sheet_corrections DISABLE TRIGGER trg_protect_daily_sheet_corrections_delete;`);
        await pool.query(
          `DELETE FROM daily_sheet_corrections WHERE original_daily_sheet_id IN (
            SELECT id FROM daily_sheets WHERE member_id IN ($1, $2)
          );`,
          [memberId1, memberId2]
        );
        await pool.query(`ALTER TABLE daily_sheet_corrections ENABLE TRIGGER trg_protect_daily_sheet_corrections_delete;`);
        // To bypass collections delete trigger during test cleanup:
        await pool.query(`ALTER TABLE collections DISABLE TRIGGER trg_protect_collections_delete;`);
        await pool.query(`DELETE FROM collections WHERE member_id IN ($1, $2);`, [memberId1, memberId2]);
        await pool.query(`ALTER TABLE collections ENABLE TRIGGER trg_protect_collections_delete;`);

        // To bypass daily sheets delete trigger:
        await pool.query(`ALTER TABLE daily_sheets DISABLE TRIGGER trg_protect_daily_sheets_delete;`);
        await pool.query(`DELETE FROM daily_sheets WHERE member_id IN ($1, $2);`, [memberId1, memberId2]);
        await pool.query(`ALTER TABLE daily_sheets ENABLE TRIGGER trg_protect_daily_sheets_delete;`);

        await pool.query(`ALTER TABLE members DISABLE TRIGGER trg_protect_members_delete;`);
        await pool.query(`DELETE FROM members WHERE id IN ($1, $2);`, [memberId1, memberId2]);
        await pool.query(`ALTER TABLE members ENABLE TRIGGER trg_protect_members_delete;`);
      }
      if (adminUserId) {
        await pool.query(`ALTER TABLE cash_transactions DISABLE TRIGGER trg_protect_cash_transactions_update_delete;`);
        await pool.query(`DELETE FROM cash_transactions WHERE recorded_by_admin_id = $1;`, [adminUserId]);
        await pool.query(`ALTER TABLE cash_transactions ENABLE TRIGGER trg_protect_cash_transactions_update_delete;`);
        await pool.query(`DELETE FROM admin_cash_accounts WHERE admin_id = $1;`, [adminUserId]);
        await pool.query(`DELETE FROM sessions WHERE admin_id = $1;`, [adminUserId]);
        await pool.query(`DELETE FROM admin_users WHERE id = $1;`, [adminUserId]);
      }
    } catch (cleanupErr) {
      console.error('Test cleanup error (non-fatal):', cleanupErr);
    }

    server.close();
    await closeDbPool();
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 22 COLLECTIONS INTEGRATION TESTS PASSED!          \n');
  process.stdout.write('========================================================\n\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
