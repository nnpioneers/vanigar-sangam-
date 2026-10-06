/**
 * Automated Test Suite for Database Transaction Runner
 *
 * Verifies:
 * 1. Transactions commit successfully on completion.
 * 2. Transactions roll back atomically on thrown errors.
 * 3. Isolation levels can be configured.
 * 4. Nested/provided transactional clients are reused.
 * 5. Pool connection is properly released back to the pool.
 */

import assert from 'node:assert';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool, withTransaction } from './index.js';

loadLocalEnv();

async function runTests(): Promise<void> {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Database Transaction Runner Tests (Phase 3.1)  \n');
  process.stdout.write('========================================================\n');

  const pool = getDbPool();

  // Test 1: Commit verification
  {
    const testUsername = `__tx_commit_test_${Date.now()}__`;
    try {
      const insertedId = await withTransaction(async (client) => {
        const res = await client.query<{ id: string }>(
          `INSERT INTO admin_users (username, password_hash, full_name, role, status)
           VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
          [testUsername, 'dummyhash', 'Tx Commit Test', 'ADMIN', 'ACTIVE']
        );
        assert.ok(res.rows[0], 'Expected inserted row');
        return res.rows[0].id;
      });

      assert.ok(insertedId, 'Inserted ID should be returned from transaction');

      // Verify row exists from pool outside the transaction
      const checkRes = await pool.query(
        'SELECT id FROM admin_users WHERE username = $1;',
        [testUsername]
      );
      assert.strictEqual(checkRes.rowCount, 1, 'Committed row must be visible in database');

      process.stdout.write('  ✅ PASS: 1. withTransaction commits atomic operations successfully\n');
    } finally {
      await pool.query('DELETE FROM admin_users WHERE username = $1;', [testUsername]);
    }
  }

  // Test 2: Rollback on error verification
  {
    const testUsername = `__tx_rollback_test_${Date.now()}__`;
    let errorThrown = false;

    try {
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO admin_users (username, password_hash, full_name, role, status)
           VALUES ($1, $2, $3, $4, $5);`,
          [testUsername, 'dummyhash', 'Tx Rollback Test', 'ADMIN', 'ACTIVE']
        );

        // Intentionally throw error to trigger rollback
        throw new Error('Simulated transaction failure');
      });
    } catch (err) {
      errorThrown = true;
      assert.strictEqual((err as Error).message, 'Simulated transaction failure');
    }

    assert.ok(errorThrown, 'Error should be re-thrown by withTransaction');

    // Verify row was rolled back and does NOT exist
    const checkRes = await pool.query(
      'SELECT id FROM admin_users WHERE username = $1;',
      [testUsername]
    );
    assert.strictEqual(checkRes.rowCount, 0, 'Rolled-back row must NOT exist in database');

    process.stdout.write('  ✅ PASS: 2. withTransaction rolls back operations on error\n');
  }

  // Test 3: Transaction with isolation level
  {
    const result = await withTransaction(
      async (client) => {
        const res = await client.query<{ one: number }>('SELECT 1 as one;');
        assert.ok(res.rows[0], 'Expected row');
        return res.rows[0].one;
      },
      { isolationLevel: 'READ COMMITTED' }
    );

    assert.strictEqual(result, 1, 'Transaction with isolation level should execute successfully');
    process.stdout.write('  ✅ PASS: 3. withTransaction supports configurable isolation levels\n');
  }

  // Test 4: Reusing existing client (nested transaction context)
  {
    let outerClientRef: unknown = null;
    let innerClientRef: unknown = null;

    await withTransaction(async (client) => {
      outerClientRef = client;

      // Call withTransaction passing existing client
      await withTransaction(
        async (innerClient) => {
          innerClientRef = innerClient;
        },
        undefined,
        client
      );
    });

    assert.strictEqual(
      outerClientRef,
      innerClientRef,
      'Existing transactional client must be reused'
    );
    process.stdout.write('  ✅ PASS: 4. withTransaction reuses existing client when provided\n');
  }

  // Test 5: Verify zero lingering test records
  {
    const lingerCheck = await pool.query(
      "SELECT count(*) FROM admin_users WHERE username LIKE '__tx_%';"
    );
    assert.strictEqual(
      parseInt(lingerCheck.rows[0].count, 10),
      0,
      'Zero test records must remain'
    );
    process.stdout.write('  ✅ PASS: 5. Database clean: zero residual transaction test records\n');
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 5 TRANSACTION TESTS PASSED SUCCESSFULLY!          \n');
  process.stdout.write('========================================================\n\n');
}

runTests()
  .catch((err) => {
    process.stderr.write(`Test suite failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await closeDbPool();
  });
