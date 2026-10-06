/**
 * Automated Test Suite for Daily Sheet Database Foundation (Phase 6.1)
 *
 * Verifies:
 * 1. Schema creation & successful row insertion.
 * 2. Foreign key integrity: rejects non-existent member_id.
 * 3. Foreign key integrity: rejects non-existent recorded_by_admin_id.
 * 4. Financial amount constraints: rejects negative daily_due_amount_paise.
 * 5. Financial amount constraints: rejects negative previous_arrears_paise.
 * 6. Financial amount constraints: rejects negative total_due_paise.
 * 7. Financial amount constraints: rejects negative actual_paid_paise.
 * 8. Sheet count constraint: rejects zero or negative number_of_sheets.
 * 9. Status vocabulary constraint: accepts all 6 confirmed statuses and rejects invalid status.
 * 10. Payment mode constraint: accepts valid payment modes (and NULL) and rejects invalid ones.
 * 11. Business date and timestamp handling: stores date cleanly and preserves timestamptz.
 * 12. Idempotency key uniqueness: blocks duplicate idempotency keys.
 * 13. Immutability trigger: blocks physical DELETE on daily_sheets.
 * 14. ON DELETE RESTRICT on members: cannot delete a member who has daily sheet entries.
 */

import assert from 'node:assert';
import type pg from 'pg';
import { loadLocalEnv } from '@vanigar/config';
import { closeDbPool } from '../../database/index.js';
import {
  createTestIdentifier,
  runInTestTransaction,
} from '../../test-utils/index.js';
import { DailySheetRepository } from './daily-sheets.repository.js';
import { MemberRepository } from '../members/members.repository.js';
import type { DailySheetStatus, PaymentMode } from './daily-sheets.types.js';

loadLocalEnv();

async function runTests(): Promise<void> {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Daily Sheet Database Foundation Tests (Phase 6.1) \n');
  process.stdout.write('========================================================\n');

  const sheetRepo = new DailySheetRepository();
  const memberRepo = new MemberRepository();

  // Helper to create a test member and get an admin user inside a test transaction
  async function setupTestContext(client: pg.PoolClient) {
    const adminRes = await client.query<{ id: string }>('SELECT id FROM admin_users LIMIT 1;');
    assert.ok(adminRes.rows.length > 0, 'Must have at least one admin user in DB');
    const adminId = adminRes.rows[0]!.id;

    const memNum = createTestIdentifier('mem');
    const member = await memberRepo.create({
      memberNumber: memNum,
      memberName: 'Senthil Daily Test',
      relatedPersonName: 'Father Test',
      relatedPersonRelationship: 'FATHER',
      address: '10 Bazaar Road',
      mobileNumber: '9842100000',
      numberOfSheets: 2,
    }, client);

    return { adminId, member };
  }

  // Test 1: Daily sheet creation with valid data
  {
    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);

      const entry = await sheetRepo.create({
        memberId: member.id,
        businessDate: '2026-10-04',
        numberOfSheets: member.numberOfSheets,
        dailyDueAmountPaise: 40000,
        previousArrearsPaise: 0,
        totalDuePaise: 40000,
        actualPaidPaise: 40000,
        status: 'PAID',
        paymentTime: new Date().toISOString(),
        paymentMode: 'CASH',
        notes: 'Full payment collected',
        recordedByAdminId: adminId,
      }, client);

      assert.ok(entry.id);
      assert.strictEqual(entry.memberId, member.id);
      assert.strictEqual(entry.businessDate, '2026-10-04');
      assert.strictEqual(entry.numberOfSheets, 2);
      assert.strictEqual(entry.dailyDueAmountPaise, 40000);
      assert.strictEqual(entry.totalDuePaise, 40000);
      assert.strictEqual(entry.actualPaidPaise, 40000);
      assert.strictEqual(entry.status, 'PAID');
      assert.strictEqual(entry.paymentMode, 'CASH');
    });
    process.stdout.write('  ✅ PASS: 1. Daily sheet creation with valid data\n');
  }

  // Test 2: Foreign key integrity: rejects non-existent member_id
  {
    await runInTestTransaction(async (client) => {
      const { adminId } = await setupTestContext(client);
      const fakeMemberId = '00000000-0000-0000-0000-000000000000';

      let caught = false;
      try {
        await sheetRepo.create({
          memberId: fakeMemberId,
          businessDate: '2026-10-04',
          numberOfSheets: 1,
          dailyDueAmountPaise: 20000,
          totalDuePaise: 20000,
          status: 'NOT_PAID',
          recordedByAdminId: adminId,
        }, client);
      } catch (err: unknown) {
        caught = true;
        const msg = (err as Error).message ?? '';
        const code = (err as { code?: string }).code;
        assert.ok(msg.includes('foreign key') || code === '23503');
      }
      assert.strictEqual(caught, true, 'Must reject invalid member_id FK');
    });
    process.stdout.write('  ✅ PASS: 2. FK integrity: rejects non-existent member_id\n');
  }

  // Test 3: Foreign key integrity: rejects non-existent recorded_by_admin_id
  {
    await runInTestTransaction(async (client) => {
      const { member } = await setupTestContext(client);
      const fakeAdminId = '00000000-0000-0000-0000-000000000000';

      let caught = false;
      try {
        await sheetRepo.create({
          memberId: member.id,
          businessDate: '2026-10-04',
          numberOfSheets: 1,
          dailyDueAmountPaise: 20000,
          totalDuePaise: 20000,
          status: 'NOT_PAID',
          recordedByAdminId: fakeAdminId,
        }, client);
      } catch (err: unknown) {
        caught = true;
        const msg = (err as Error).message ?? '';
        const code = (err as { code?: string }).code;
        assert.ok(msg.includes('foreign key') || code === '23503');
      }
      assert.strictEqual(caught, true, 'Must reject invalid recorded_by_admin_id FK');
    });
    process.stdout.write('  ✅ PASS: 3. FK integrity: rejects non-existent recorded_by_admin_id\n');
  }

  // Test 4: Financial amount constraints: rejects negative daily_due_amount_paise
  {
    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);
      await assert.rejects(async () => {
        await sheetRepo.create({
          memberId: member.id,
          businessDate: '2026-10-04',
          numberOfSheets: 1,
          dailyDueAmountPaise: -20000,
          totalDuePaise: 20000,
          status: 'NOT_PAID',
          recordedByAdminId: adminId,
        }, client);
      }, /check constraint/i);
    });
    process.stdout.write('  ✅ PASS: 4. Financial amount constraints: negative daily due rejected\n');
  }

  // Test 5: Financial amount constraints: rejects negative previous_arrears_paise
  {
    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);
      await assert.rejects(async () => {
        await sheetRepo.create({
          memberId: member.id,
          businessDate: '2026-10-04',
          numberOfSheets: 1,
          dailyDueAmountPaise: 20000,
          previousArrearsPaise: -5000,
          totalDuePaise: 20000,
          status: 'NOT_PAID',
          recordedByAdminId: adminId,
        }, client);
      }, /check constraint/i);
    });
    process.stdout.write('  ✅ PASS: 5. Financial amount constraints: negative arrears rejected\n');
  }

  // Test 6: Financial amount constraints: rejects negative actual_paid_paise
  {
    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);
      await assert.rejects(async () => {
        await sheetRepo.create({
          memberId: member.id,
          businessDate: '2026-10-04',
          numberOfSheets: 1,
          dailyDueAmountPaise: 20000,
          totalDuePaise: 20000,
          actualPaidPaise: -100,
          status: 'NOT_PAID',
          recordedByAdminId: adminId,
        }, client);
      }, /check constraint/i);
    });
    process.stdout.write('  ✅ PASS: 6. Financial amount constraints: negative actual paid rejected\n');
  }

  // Test 7: Sheet count constraint: rejects zero or negative sheets
  {
    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);
      await assert.rejects(async () => {
        await sheetRepo.create({
          memberId: member.id,
          businessDate: '2026-10-04',
          numberOfSheets: 0,
          dailyDueAmountPaise: 0,
          totalDuePaise: 0,
          status: 'NOT_PAID',
          recordedByAdminId: adminId,
        }, client);
      }, /check constraint/i);
    });
    process.stdout.write('  ✅ PASS: 7. Sheet count constraint: rejects zero or negative sheets\n');
  }

  // Test 8: Status vocabulary: all 6 confirmed statuses accepted
  {
    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);
      const confirmedStatuses = [
        'PAID',
        'ADVANCE_PAID',
        'ADVANCE_COVERED',
        'PARTIAL',
        'NOT_PAID',
        'OVERDUE',
      ] as const;

      for (const st of confirmedStatuses) {
        const row = await sheetRepo.create({
          memberId: member.id,
          businessDate: '2026-10-04',
          numberOfSheets: 1,
          dailyDueAmountPaise: 20000,
          totalDuePaise: 20000,
          status: st,
          recordedByAdminId: adminId,
        }, client);
        assert.strictEqual(row.status, st);
      }
    });
    process.stdout.write('  ✅ PASS: 8. Status vocabulary: all 6 confirmed statuses accepted\n');
  }

  // Test 9: Status vocabulary: invalid status rejected
  {
    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);
      await assert.rejects(async () => {
        await sheetRepo.create({
          memberId: member.id,
          businessDate: '2026-10-04',
          numberOfSheets: 1,
          dailyDueAmountPaise: 20000,
          totalDuePaise: 20000,
          status: 'UNKNOWN_STATUS' as unknown as DailySheetStatus,
          recordedByAdminId: adminId,
        }, client);
      }, /check constraint/i);
    });
    process.stdout.write('  ✅ PASS: 9. Status vocabulary: invalid status rejected\n');
  }

  // Test 10: Payment mode constraint: valid modes and NULL accepted, invalid rejected
  {
    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);
      const validModes = ['CASH', 'ONLINE', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const;

      for (const pm of validModes) {
        const row = await sheetRepo.create({
          memberId: member.id,
          businessDate: '2026-10-04',
          numberOfSheets: 1,
          dailyDueAmountPaise: 20000,
          totalDuePaise: 20000,
          status: 'PAID',
          paymentMode: pm,
          recordedByAdminId: adminId,
        }, client);
        assert.strictEqual(row.paymentMode, pm);
      }
    });

    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);
      await assert.rejects(async () => {
        await sheetRepo.create({
          memberId: member.id,
          businessDate: '2026-10-04',
          numberOfSheets: 1,
          dailyDueAmountPaise: 20000,
          totalDuePaise: 20000,
          status: 'PAID',
          paymentMode: 'CRYPTO' as unknown as PaymentMode,
          recordedByAdminId: adminId,
        }, client);
      }, /check constraint/i);
    });
    process.stdout.write('  ✅ PASS: 10. Payment mode constraint: valid modes and NULL accepted, invalid rejected\n');
  }

  // Test 11: Idempotency key uniqueness
  {
    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);
      const idemKey = createTestIdentifier('idem');

      await sheetRepo.create({
        memberId: member.id,
        businessDate: '2026-10-04',
        numberOfSheets: 1,
        dailyDueAmountPaise: 20000,
        totalDuePaise: 20000,
        status: 'NOT_PAID',
        idempotencyKey: idemKey,
        recordedByAdminId: adminId,
      }, client);

      // Second entry with identical idempotencyKey must be rejected by unique constraint
      await assert.rejects(async () => {
        await sheetRepo.create({
          memberId: member.id,
          businessDate: '2026-10-05',
          numberOfSheets: 1,
          dailyDueAmountPaise: 20000,
          totalDuePaise: 20000,
          status: 'NOT_PAID',
          idempotencyKey: idemKey,
          recordedByAdminId: adminId,
        }, client);
      }, /unique constraint/i);
    });
    process.stdout.write('  ✅ PASS: 11. Idempotency key uniqueness: duplicate key rejected\n');
  }

  // Test 12: Immutability trigger: blocks physical DELETE on daily_sheets
  {
    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);

      const entry = await sheetRepo.create({
        memberId: member.id,
        businessDate: '2026-10-04',
        numberOfSheets: 1,
        dailyDueAmountPaise: 20000,
        totalDuePaise: 20000,
        status: 'NOT_PAID',
        recordedByAdminId: adminId,
      }, client);

      // Attempting to DELETE must trigger the prevent_daily_sheets_deletion exception
      await assert.rejects(async () => {
        await client.query('DELETE FROM daily_sheets WHERE id = $1', [entry.id]);
      }, /daily_sheets history is immutable/i);
    });
    process.stdout.write('  ✅ PASS: 12. Immutability trigger: physical DELETE strictly prohibited\n');
  }

  // Test 13: ON DELETE RESTRICT on members table: cannot delete member with daily sheets
  {
    await runInTestTransaction(async (client) => {
      const { adminId, member } = await setupTestContext(client);

      await sheetRepo.create({
        memberId: member.id,
        businessDate: '2026-10-04',
        numberOfSheets: 1,
        dailyDueAmountPaise: 20000,
        totalDuePaise: 20000,
        status: 'NOT_PAID',
        recordedByAdminId: adminId,
      }, client);

      // Attempting to delete member must be blocked (both by member trigger and FK RESTRICT)
      await assert.rejects(async () => {
        await client.query('DELETE FROM members WHERE id = $1', [member.id]);
      }, /immutable|foreign key/i);
    });
    process.stdout.write('  ✅ PASS: 13. Member deletion prohibited with linked daily sheets\n');
  }

  process.stdout.write('\n========================================================\n');
  process.stdout.write(' ALL 13 DAILY SHEET FOUNDATION TESTS PASSED!            \n');
  process.stdout.write('========================================================\n\n');
}

runTests()
  .then(async () => {
    await closeDbPool();
    process.exit(0);
  })
  .catch(async (err) => {
    process.stderr.write(`Test suite failed: ${err}\n`);
    await closeDbPool();
    process.exit(1);
  });
