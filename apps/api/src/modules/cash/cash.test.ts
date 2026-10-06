/**
 * Automated Test Suite for Admin & Minimal Cash Foundation Schema (Phase 4.1)
 *
 * Verifies:
 * 1. Admin cash account references existing admin user (FK constraint)
 * 2. Duplicate holder/account protection (UNIQUE admin_id constraint)
 * 3. Cash transaction amount uses BIGINT paise (CHECK amount_paise > 0)
 * 4. Transaction direction and type validation (CHECK direction & transaction_type)
 * 5. Append-only financial record protection (Trigger prohibits UPDATE & DELETE)
 * 6. Derived cash balance calculation (Balance = SUM(CREDIT) - SUM(DEBIT))
 * 7. FK protection against deleting an admin with cash history (ON DELETE RESTRICT)
 * 8. Transaction-scoped repository behavior (participates atomically in transactions)
 * 9. Test data isolation & cleanup (preserves persistent SUPER_ADMIN 'admin')
 */

import assert from 'node:assert';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool, withTransaction } from '../../database/index.js';
import {
  createTestIdentifier,
  runInTestTransaction,
} from '../../test-utils/index.js';
import { CashRepository } from './cash.repository.js';
import { CashService } from './cash.service.js';
import { isAppError } from '../../errors/app-error.js';

loadLocalEnv();

async function runTests(): Promise<void> {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Admin & Minimal Cash Foundation Tests (Phase 4.1) \n');
  process.stdout.write('========================================================\n');

  const pool = getDbPool();
  const repo = new CashRepository();
  const service = new CashService(repo);

  // Test 1: Admin cash account references existing admin user
  {
    await runInTestTransaction(async (client) => {
      const testUsername = createTestIdentifier('cash_holder');

      // 1a. Insert valid admin user
      const adminRes = await client.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
        [testUsername, 'dummy_hash', 'Cash Holder Admin', 'ADMIN', 'ACTIVE']
      );
      const adminId = adminRes.rows[0]!.id;

      // 1b. Create cash account referencing valid admin -> SUCCEEDS
      const account = await repo.createAccount(
        {
          adminId,
          accountName: 'Cash in Hand - Primary',
          status: 'ACTIVE',
        },
        client
      );
      assert.ok(account.id, 'Account ID must be generated');
      assert.strictEqual(account.adminId, adminId);
      assert.strictEqual(account.status, 'ACTIVE');

      // 1c. Create cash account referencing nonexistent admin -> FAILS with FK violation
      await client.query('SAVEPOINT sp_fk_err');
      const fakeAdminId = '00000000-0000-0000-0000-000000000099';
      let fkFailed = false;
      try {
        await repo.createAccount(
          {
            adminId: fakeAdminId,
            accountName: 'Orphaned Cash Account',
          },
          client
        );
      } catch (err: unknown) {
        fkFailed = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_fk_err');
        // PostgreSQL foreign key violation code: 23503
        assert.strictEqual((err as { code: string }).code, '23503');
      }
      assert.strictEqual(fkFailed, true, 'Nonexistent admin ID must violate foreign key constraint');
    });

    process.stdout.write('  ✅ PASS: 1. Admin cash account references existing admin user (FK constraint)\n');
  }

  // Test 2: Duplicate holder/account protection
  {
    await runInTestTransaction(async (client) => {
      const testUsername = createTestIdentifier('single_holder');

      const adminRes = await client.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
        [testUsername, 'dummy_hash', 'Single Holder Admin', 'ADMIN', 'ACTIVE']
      );
      const adminId = adminRes.rows[0]!.id;

      // First account succeeds
      await repo.createAccount(
        {
          adminId,
          accountName: 'Account 1',
        },
        client
      );

      // Second account for same admin fails with unique violation (23505)
      await client.query('SAVEPOINT sp_dup_repo');
      let duplicateFailed = false;
      try {
        await repo.createAccount(
          {
            adminId,
            accountName: 'Account 2',
          },
          client
        );
      } catch (err: unknown) {
        duplicateFailed = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_dup_repo');
        assert.strictEqual((err as { code: string }).code, '23505');
      }
      assert.strictEqual(duplicateFailed, true, 'Duplicate cash account for admin must be rejected');

      // Service layer throws typed ConflictError on duplicate
      await client.query('SAVEPOINT sp_dup_service');
      let serviceDuplicateCaught = false;
      try {
        await service.createAccount(
          {
            adminId,
            accountName: 'Account 3',
          },
          { tx: client }
        );
      } catch (err) {
        serviceDuplicateCaught = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_dup_service');
        assert.ok(isAppError(err));
        assert.strictEqual(err.statusCode, 409);
      }
      assert.strictEqual(serviceDuplicateCaught, true, 'Service must translate duplicate account to ConflictError');
    });

    process.stdout.write('  ✅ PASS: 2. Duplicate holder/account protection (UNIQUE admin_id constraint)\n');
  }

  // Test 3: Cash transaction amount uses BIGINT paise (positive constraint)
  {
    await runInTestTransaction(async (client) => {
      const testUsername = createTestIdentifier('amount_check');
      const adminRes = await client.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
        [testUsername, 'dummy_hash', 'Amount Check Admin', 'ADMIN', 'ACTIVE']
      );
      const adminId = adminRes.rows[0]!.id;

      const account = await repo.createAccount(
        { adminId, accountName: 'Cash Account' },
        client
      );

      // 3a. Valid positive amount in paise persists and reads back as BigInt
      const validTx = await repo.recordTransaction(
        {
          accountId: account.id,
          amountPaise: 250000n, // ₹2,500.00
          direction: 'CREDIT',
          transactionType: 'OPENING_BALANCE',
          recordedByAdminId: adminId,
        },
        client
      );
      assert.strictEqual(validTx.amountPaise, 250000n);
      assert.strictEqual(typeof validTx.amountPaise, 'bigint');

      // 3b. Amount <= 0 violates CHECK (amount_paise > 0)
      await client.query('SAVEPOINT sp_zero_amt');
      let zeroAmountFailed = false;
      try {
        await client.query(
          `INSERT INTO cash_transactions (account_id, amount_paise, direction, transaction_type, recorded_by_admin_id)
           VALUES ($1, $2, $3, $4, $5);`,
          [account.id, '0', 'CREDIT', 'OPENING_BALANCE', adminId]
        );
      } catch (err: unknown) {
        zeroAmountFailed = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_zero_amt');
        // Check constraint violation: 23514
        assert.strictEqual((err as { code: string }).code, '23514');
      }
      assert.strictEqual(zeroAmountFailed, true, 'Zero amount must violate check constraint');

      // 3c. Negative amount violates CHECK
      await client.query('SAVEPOINT sp_neg_amt');
      let negativeAmountFailed = false;
      try {
        await client.query(
          `INSERT INTO cash_transactions (account_id, amount_paise, direction, transaction_type, recorded_by_admin_id)
           VALUES ($1, $2, $3, $4, $5);`,
          [account.id, '-5000', 'CREDIT', 'OPENING_BALANCE', adminId]
        );
      } catch (err: unknown) {
        negativeAmountFailed = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_neg_amt');
        assert.strictEqual((err as { code: string }).code, '23514');
      }
      assert.strictEqual(negativeAmountFailed, true, 'Negative amount must violate check constraint');
    });

    process.stdout.write('  ✅ PASS: 3. Cash transaction amount uses BIGINT paise (CHECK amount_paise > 0)\n');
  }

  // Test 4: Transaction direction and type validation
  {
    await runInTestTransaction(async (client) => {
      const testUsername = createTestIdentifier('direction_check');
      const adminRes = await client.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
        [testUsername, 'dummy_hash', 'Direction Admin', 'ADMIN', 'ACTIVE']
      );
      const adminId = adminRes.rows[0]!.id;

      const account = await repo.createAccount(
        { adminId, accountName: 'Cash Account' },
        client
      );

      // 4a. CREDIT direction succeeds
      const creditTx = await repo.recordTransaction(
        {
          accountId: account.id,
          amountPaise: 100000n,
          direction: 'CREDIT',
          transactionType: 'COLLECTION_DEPOSIT',
          recordedByAdminId: adminId,
        },
        client
      );
      assert.strictEqual(creditTx.direction, 'CREDIT');

      // 4b. DEBIT direction succeeds
      const debitTx = await repo.recordTransaction(
        {
          accountId: account.id,
          amountPaise: 50000n,
          direction: 'DEBIT',
          transactionType: 'EXPENSE',
          recordedByAdminId: adminId,
        },
        client
      );
      assert.strictEqual(debitTx.direction, 'DEBIT');

      // 4c. Invalid direction fails
      await client.query('SAVEPOINT sp_inv_dir');
      let invalidDirectionFailed = false;
      try {
        await client.query(
          `INSERT INTO cash_transactions (account_id, amount_paise, direction, transaction_type, recorded_by_admin_id)
           VALUES ($1, $2, $3, $4, $5);`,
          [account.id, '10000', 'INWARD', 'COLLECTION_DEPOSIT', adminId]
        );
      } catch (err: unknown) {
        invalidDirectionFailed = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_inv_dir');
        assert.strictEqual((err as { code: string }).code, '23514');
      }
      assert.strictEqual(invalidDirectionFailed, true, 'Invalid direction must violate check constraint');

      // 4d. Invalid transaction type fails
      await client.query('SAVEPOINT sp_inv_type');
      let invalidTypeFailed = false;
      try {
        await client.query(
          `INSERT INTO cash_transactions (account_id, amount_paise, direction, transaction_type, recorded_by_admin_id)
           VALUES ($1, $2, $3, $4, $5);`,
          [account.id, '10000', 'CREDIT', 'MAGIC_MONEY', adminId]
        );
      } catch (err: unknown) {
        invalidTypeFailed = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_inv_type');
        assert.strictEqual((err as { code: string }).code, '23514');
      }
      assert.strictEqual(invalidTypeFailed, true, 'Invalid transaction type must violate check constraint');
    });

    process.stdout.write('  ✅ PASS: 4. Transaction direction and type validation (CHECK constraints)\n');
  }

  // Test 5: Append-only financial record protection (Trigger prohibits UPDATE & DELETE)
  {
    await runInTestTransaction(async (client) => {
      const testUsername = createTestIdentifier('append_only');
      const adminRes = await client.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
        [testUsername, 'dummy_hash', 'Append Only Admin', 'ADMIN', 'ACTIVE']
      );
      const adminId = adminRes.rows[0]!.id;

      const account = await repo.createAccount(
        { adminId, accountName: 'Cash Account' },
        client
      );

      const tx = await repo.recordTransaction(
        {
          accountId: account.id,
          amountPaise: 75000n,
          direction: 'CREDIT',
          transactionType: 'OPENING_BALANCE',
          recordedByAdminId: adminId,
        },
        client
      );

      // 5a. Attempt UPDATE on cash_transactions -> Trigger MUST raise exception
      await client.query('SAVEPOINT sp_update_block');
      let updateBlocked = false;
      try {
        await client.query(
          `UPDATE cash_transactions SET amount_paise = 999999 WHERE id = $1;`,
          [tx.id]
        );
      } catch (err: unknown) {
        updateBlocked = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_update_block');
        assert.ok(
          (err as Error).message.includes('append-only ledger: UPDATE and DELETE operations are strictly prohibited')
        );
      }
      assert.strictEqual(updateBlocked, true, 'UPDATE on cash_transactions must be blocked by trigger');

      // 5b. Attempt DELETE on cash_transactions -> Trigger MUST raise exception
      await client.query('SAVEPOINT sp_delete_block');
      let deleteBlocked = false;
      try {
        await client.query(
          `DELETE FROM cash_transactions WHERE id = $1;`,
          [tx.id]
        );
      } catch (err: unknown) {
        deleteBlocked = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_delete_block');
        assert.ok(
          (err as Error).message.includes('append-only ledger: UPDATE and DELETE operations are strictly prohibited')
        );
      }
      assert.strictEqual(deleteBlocked, true, 'DELETE on cash_transactions must be blocked by trigger');
    });

    process.stdout.write('  ✅ PASS: 5. Append-only financial record protection (Trigger blocks UPDATE & DELETE)\n');
  }

  // Test 6: Derived cash balance calculation (Balance = SUM(CREDIT) - SUM(DEBIT))
  {
    await runInTestTransaction(async (client) => {
      const testUsername = createTestIdentifier('balance_calc');
      const adminRes = await client.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
        [testUsername, 'dummy_hash', 'Balance Calc Admin', 'ADMIN', 'ACTIVE']
      );
      const adminId = adminRes.rows[0]!.id;

      const account = await repo.createAccount(
        { adminId, accountName: 'Cash in Hand' },
        client
      );

      // Initial balance with 0 transactions
      const initialBalance = await repo.getDerivedBalance(account.id, client);
      assert.ok(initialBalance);
      assert.strictEqual(initialBalance.totalCreditPaise, 0n);
      assert.strictEqual(initialBalance.totalDebitPaise, 0n);
      assert.strictEqual(initialBalance.balancePaise, 0n);
      assert.strictEqual(initialBalance.transactionCount, 0);

      // Entry 1: CREDIT ₹5,000 (500000 paise)
      await repo.recordTransaction(
        {
          accountId: account.id,
          amountPaise: 500000n,
          direction: 'CREDIT',
          transactionType: 'OPENING_BALANCE',
          recordedByAdminId: adminId,
        },
        client
      );

      const bal1 = await repo.getDerivedBalance(account.id, client);
      assert.ok(bal1);
      assert.strictEqual(bal1.totalCreditPaise, 500000n);
      assert.strictEqual(bal1.totalDebitPaise, 0n);
      assert.strictEqual(bal1.balancePaise, 500000n);
      assert.strictEqual(bal1.transactionCount, 1);

      // Entry 2: CREDIT ₹2,500 (250000 paise) -> Balance = ₹7,500 (750000 paise)
      await repo.recordTransaction(
        {
          accountId: account.id,
          amountPaise: 250000n,
          direction: 'CREDIT',
          transactionType: 'COLLECTION_DEPOSIT',
          recordedByAdminId: adminId,
        },
        client
      );

      const bal2 = await repo.getDerivedBalance(account.id, client);
      assert.ok(bal2);
      assert.strictEqual(bal2.totalCreditPaise, 750000n);
      assert.strictEqual(bal2.totalDebitPaise, 0n);
      assert.strictEqual(bal2.balancePaise, 750000n);
      assert.strictEqual(bal2.transactionCount, 2);

      // Entry 3: DEBIT ₹1,500 (150000 paise) -> Balance = ₹6,000 (600000 paise)
      await repo.recordTransaction(
        {
          accountId: account.id,
          amountPaise: 150000n,
          direction: 'DEBIT',
          transactionType: 'EXPENSE',
          recordedByAdminId: adminId,
        },
        client
      );

      const bal3 = await repo.getDerivedBalance(account.id, client);
      assert.ok(bal3);
      assert.strictEqual(bal3.totalCreditPaise, 750000n);
      assert.strictEqual(bal3.totalDebitPaise, 150000n);
      assert.strictEqual(bal3.balancePaise, 600000n); // 750000 - 150000 = 600000 paise (₹6,000.00)
      assert.strictEqual(bal3.transactionCount, 3);

      // Also verify via Service layer
      const serviceBal = await service.getDerivedBalance(account.id, { tx: client });
      assert.strictEqual(serviceBal.balancePaise, 600000n);
    });

    process.stdout.write('  ✅ PASS: 6. Derived cash balance calculation (Balance = SUM(CREDIT) - SUM(DEBIT))\n');
  }

  // Test 7: FK protection against deleting an admin with cash history (ON DELETE RESTRICT)
  {
    await runInTestTransaction(async (client) => {
      const testUsername = createTestIdentifier('fk_restrict');
      const adminRes = await client.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
        [testUsername, 'dummy_hash', 'Protected Admin', 'ADMIN', 'ACTIVE']
      );
      const adminId = adminRes.rows[0]!.id;

      const account = await repo.createAccount(
        { adminId, accountName: 'Cash Account' },
        client
      );

      await repo.recordTransaction(
        {
          accountId: account.id,
          amountPaise: 100000n,
          direction: 'CREDIT',
          transactionType: 'OPENING_BALANCE',
          recordedByAdminId: adminId,
        },
        client
      );

      // Attempting to delete the admin MUST fail with foreign key violation (23001 or 23503)
      await client.query('SAVEPOINT sp_del_admin');
      let deleteAdminFailed = false;
      try {
        await client.query('DELETE FROM admin_users WHERE id = $1;', [adminId]);
      } catch (err: unknown) {
        deleteAdminFailed = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_del_admin');
        const code = (err as { code: string }).code;
        assert.ok(code === '23001' || code === '23503', `Expected 23001 or 23503, got ${code}`);
      }
      assert.strictEqual(deleteAdminFailed, true, 'Deleting admin with cash history must be prohibited by FK RESTRICT');
    });

    process.stdout.write('  ✅ PASS: 7. FK protection against deleting an admin with cash history (ON DELETE RESTRICT)\n');
  }

  // Test 8: Transaction-scoped repository behavior (Atomic coordination)
  {
    const testUsername = createTestIdentifier('tx_scope');
    let adminId = '';
    let accountId = '';

    // Intentionally fail a coordinated operation inside a transaction
    let caughtErr = false;
    try {
      await withTransaction(async (client) => {
        const adminRes = await client.query<{ id: string }>(
          `INSERT INTO admin_users (username, password_hash, full_name, role, status)
           VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
          [testUsername, 'dummy_hash', 'Tx Scope Admin', 'ADMIN', 'ACTIVE']
        );
        adminId = adminRes.rows[0]!.id;

        const acc = await repo.createAccount(
          { adminId, accountName: 'Coord Account' },
          client
        );
        accountId = acc.id;

        await repo.recordTransaction(
          {
            accountId: acc.id,
            amountPaise: 50000n,
            direction: 'CREDIT',
            transactionType: 'OPENING_BALANCE',
            recordedByAdminId: adminId,
            correlationId: 'coord_tx_123',
          },
          client
        );

        // Simulated downstream domain failure
        throw new Error('Simulated atomic coordination failure');
      });
    } catch (err) {
      caughtErr = true;
      assert.strictEqual((err as Error).message, 'Simulated atomic coordination failure');
    }
    assert.strictEqual(caughtErr, true);

    // Verify complete rollback: neither admin, account, nor transaction exists in DB
    const adminCheck = await pool.query('SELECT id FROM admin_users WHERE id = $1;', [adminId]);
    assert.strictEqual(adminCheck.rowCount, 0, 'Admin row must be rolled back');

    const accCheck = await pool.query('SELECT id FROM admin_cash_accounts WHERE id = $1;', [accountId]);
    assert.strictEqual(accCheck.rowCount, 0, 'Cash account row must be rolled back');

    const txCheck = await pool.query('SELECT id FROM cash_transactions WHERE correlation_id = $1;', ['coord_tx_123']);
    assert.strictEqual(txCheck.rowCount, 0, 'Cash transaction row must be rolled back');

    process.stdout.write('  ✅ PASS: 8. Transaction-scoped repository behavior (Atomic coordination & rollback)\n');
  }

  // Test 9: Test data isolation & persistent admin protection
  {
    // Verify that persistent development SUPER_ADMIN account 'admin' is intact
    const adminRes = await pool.query<{ id: string; username: string; role: string; status: string }>(
      `SELECT id, username, role, status FROM admin_users WHERE username = 'admin';`
    );
    assert.strictEqual(adminRes.rowCount, 1, "Persistent development admin account 'admin' must exist");
    assert.strictEqual(adminRes.rows[0]?.role, 'SUPER_ADMIN');
    assert.strictEqual(adminRes.rows[0]?.status, 'ACTIVE');

    // Verify zero residual test records in admin_cash_accounts or cash_transactions with test prefixes
    const residualAccounts = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM admin_cash_accounts a
       JOIN admin_users u ON a.admin_id = u.id
       WHERE u.username LIKE '__test_%';`
    );
    assert.strictEqual(parseInt(residualAccounts.rows[0]?.count ?? '0', 10), 0, 'Zero residual test accounts');

    process.stdout.write('  ✅ PASS: 9. Test data isolation: persistent SUPER_ADMIN preserved & zero residual test records\n');
  }

  // Test 10: Idempotency of Admin Cash Transfers
  {
    await runInTestTransaction(async (client) => {
      const sourceUser = createTestIdentifier('src_admin');
      const destUser = createTestIdentifier('dst_admin');

      const srcRes = await client.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status) VALUES ($1, 'hash', 'Src', 'ADMIN', 'ACTIVE') RETURNING id;`,
        [sourceUser]
      );
      const destRes = await client.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status) VALUES ($1, 'hash', 'Dst', 'ADMIN', 'ACTIVE') RETURNING id;`,
        [destUser]
      );

      const srcId = srcRes.rows[0]!.id;
      const dstId = destRes.rows[0]!.id;

      const srcAccount = await repo.createAccount({ adminId: srcId, accountName: 'Src Acc' }, client);
      const dstAccount = await repo.createAccount({ adminId: dstId, accountName: 'Dst Acc' }, client);

      const idempotencyKey = 'transfer_idemp_key_123';

      const transfer1 = await service.transferCash({
        sourceAccountId: srcAccount.id,
        destinationAccountId: dstAccount.id,
        amountPaise: 50000n,
        idempotencyKey,
        notes: 'Test Transfer',
        initiatedByAdminId: srcId,
      }, { tx: client });

      const transfer2 = await service.transferCash({
        sourceAccountId: srcAccount.id,
        destinationAccountId: dstAccount.id,
        amountPaise: 50000n,
        idempotencyKey,
        notes: 'Test Transfer',
        initiatedByAdminId: srcId,
      }, { tx: client });

      assert.strictEqual(transfer1.id, transfer2.id, 'Idempotent calls must return the same transfer record');

      // Check balances: src should be -50000, dst should be 50000
      const srcBal = await service.getDerivedBalance(srcAccount.id, { tx: client });
      const dstBal = await service.getDerivedBalance(dstAccount.id, { tx: client });

      assert.strictEqual(srcBal.balancePaise, -50000n, 'Source account balance should be -50000 (negative allowed by foundation)');
      assert.strictEqual(dstBal.balancePaise, 50000n, 'Destination account balance should be 50000');
    });

    process.stdout.write('  ✅ PASS: 10. Admin Cash Transfers idempotency mechanism (idempotency_key UNIQUE constraint)\n');
  }

  // Test 11: Immutability of Physical Cash Reconciliation Records
  {
    await runInTestTransaction(async (client) => {
      const testUsername = createTestIdentifier('rec_admin');
      const adminRes = await client.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status) VALUES ($1, 'hash', 'Rec', 'ADMIN', 'ACTIVE') RETURNING id;`,
        [testUsername]
      );
      const adminId = adminRes.rows[0]!.id;

      const account = await repo.createAccount({ adminId, accountName: 'Rec Acc' }, client);

      const reconciliation = await service.recordReconciliation({
        accountId: account.id,
        expectedBalancePaise: 0n,
        actualBalancePaise: 1000n,
        notes: 'Test Reconciliation',
        performedByAdminId: adminId,
      }, { tx: client });

      assert.strictEqual(reconciliation.discrepancyPaise, 1000n);

      // Attempt UPDATE on core financial fields -> Trigger MUST raise exception
      await client.query('SAVEPOINT sp_rec_update');
      let updateBlocked = false;
      try {
        await client.query(
          `UPDATE cash_reconciliations SET actual_balance_paise = 2000 WHERE id = $1;`,
          [reconciliation.id]
        );
      } catch (err: unknown) {
        updateBlocked = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_rec_update');
        assert.ok(
          (err as Error).message.includes('core financial fields are immutable: UPDATE operations on balances and accounts are strictly prohibited')
        );
      }
      assert.strictEqual(updateBlocked, true, 'UPDATE on financial fields of cash_reconciliations must be blocked by trigger');

      // Attempt DELETE -> Trigger MUST raise exception
      await client.query('SAVEPOINT sp_rec_delete');
      let deleteBlocked = false;
      try {
        await client.query(
          `DELETE FROM cash_reconciliations WHERE id = $1;`,
          [reconciliation.id]
        );
      } catch (err: unknown) {
        deleteBlocked = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_rec_delete');
        assert.ok(
          (err as Error).message.includes('history is immutable: DELETE operations are strictly prohibited')
        );
      }
      assert.strictEqual(deleteBlocked, true, 'DELETE on cash_reconciliations must be blocked by trigger');
    });

    process.stdout.write('  ✅ PASS: 11. Physical Cash Reconciliation Immutability (Trigger prohibits UPDATE & DELETE)\n');
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 11 ADMIN & CASH FOUNDATION TESTS PASSED!           \n');
  process.stdout.write('========================================================\n\n');
}

runTests()
  .catch((err) => {
    process.stderr.write(`Cash test suite failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await closeDbPool();
  });
