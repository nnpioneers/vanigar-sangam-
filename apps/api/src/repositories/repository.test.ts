/**
 * Automated Test Suite for Repositories Layer (Phase 3.1)
 *
 * Verifies:
 * 1. BaseRepository query and execution helper methods
 * 2. Repository decoupling: accepts Queryable pool and transactional client
 * 3. AdminUserRepository findByUsername, findById, existsByUsername, updateStatus
 * 4. Repository coordination within transactions
 * 5. Zero residual test records
 */

import assert from 'node:assert';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool, withTransaction, type Queryable } from '../database/index.js';
import { BaseRepository } from './base.repository.js';
import { AdminUserRepository } from './admin-user.repository.js';

loadLocalEnv();

// Concrete test subclass to verify BaseRepository protected methods
class TestRepository extends BaseRepository {
  async testQuery<T extends { val: number }>(sql: string, params: unknown[] = [], executor?: Queryable) {
    return this.query<T>(sql, params, executor);
  }

  async testQueryOne<T extends { val: number }>(sql: string, params: unknown[] = [], executor?: Queryable) {
    return this.queryOne<T>(sql, params, executor);
  }

  async testExecute(sql: string, params: unknown[] = [], executor?: Queryable) {
    return this.execute(sql, params, executor);
  }

  async testExists(sql: string, params: unknown[] = [], executor?: Queryable) {
    return this.exists(sql, params, executor);
  }
}

async function runTests(): Promise<void> {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Repositories Layer Tests (Phase 3.1)           \n');
  process.stdout.write('========================================================\n');

  const pool = getDbPool();
  const testRepo = new TestRepository();
  const adminUserRepo = new AdminUserRepository();

  // Test 1: BaseRepository query methods with Pool
  {
    const rows = await testRepo.testQuery<{ val: number }>('SELECT 42 as val;');
    assert.strictEqual(rows.length, 1);
    assert.ok(rows[0]);
    assert.strictEqual(rows[0].val, 42);

    const one = await testRepo.testQueryOne<{ val: number }>('SELECT 100 as val;');
    assert.ok(one);
    assert.strictEqual(one.val, 100);

    const none = await testRepo.testQueryOne('SELECT 1 WHERE 1 = 0;');
    assert.strictEqual(none, null);

    const exists = await testRepo.testExists('SELECT 1;');
    assert.strictEqual(exists, true);

    const notExists = await testRepo.testExists('SELECT 1 WHERE 1 = 0;');
    assert.strictEqual(notExists, false);

    process.stdout.write('  ✅ PASS: 1. BaseRepository query helpers execute correctly on pool\n');
  }

  // Test 2: AdminUserRepository existsByUsername for non-existent user
  {
    const exists = await adminUserRepo.existsByUsername('__definitely_nonexistent_user_xyz__');
    assert.strictEqual(exists, false, 'Non-existent user must return false');

    const user = await adminUserRepo.findByUsername('__definitely_nonexistent_user_xyz__');
    assert.strictEqual(user, null, 'Non-existent user must return null');

    process.stdout.write('  ✅ PASS: 2. AdminUserRepository handles missing entities safely\n');
  }

  // Test 3: AdminUserRepository inside withTransaction (atomic entity retrieval and updates)
  {
    const testUsername = `__repo_test_${Date.now()}__`;
    try {
      await withTransaction(async (client) => {
        // Insert admin user via transactional client
        const insertRes = await client.query<{ id: string }>(
          `INSERT INTO admin_users (username, password_hash, full_name, role, status)
           VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
          [testUsername, 'hashed_pw', 'Repository Test User', 'ADMIN', 'ACTIVE']
        );
        assert.ok(insertRes.rows[0]);
        const userId = insertRes.rows[0].id;

        // Verify repository methods work with transactional client passed as executor
        const existsInTx = await adminUserRepo.existsByUsername(testUsername, client);
        assert.strictEqual(existsInTx, true);

        const foundByUsername = await adminUserRepo.findByUsername(testUsername, client);
        assert.ok(foundByUsername);
        assert.strictEqual(foundByUsername.id, userId);
        assert.strictEqual(foundByUsername.username, testUsername);
        assert.strictEqual(foundByUsername.fullName, 'Repository Test User');
        assert.strictEqual(foundByUsername.role, 'ADMIN');
        assert.strictEqual(foundByUsername.status, 'ACTIVE');

        const foundById = await adminUserRepo.findById(userId, client);
        assert.ok(foundById);
        assert.strictEqual(foundById.username, testUsername);

        // Test updateStatus in transaction
        const updated = await adminUserRepo.updateStatus(userId, 'SUSPENDED', client);
        assert.strictEqual(updated, true);

        const checkStatus = await adminUserRepo.findById(userId, client);
        assert.strictEqual(checkStatus?.status, 'SUSPENDED');
      });

      process.stdout.write('  ✅ PASS: 3. AdminUserRepository participates seamlessly in transactions\n');
    } finally {
      await pool.query('DELETE FROM admin_users WHERE username = $1;', [testUsername]);
    }
  }

  // Test 4: Repository with transaction rollback
  {
    const testUsername = `__repo_rb_${Date.now()}__`;
    let threw = false;

    try {
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO admin_users (username, password_hash, full_name, role, status)
           VALUES ($1, $2, $3, $4, $5);`,
          [testUsername, 'hash', 'Rollback User', 'CASHIER', 'ACTIVE']
        );

        assert.strictEqual(await adminUserRepo.existsByUsername(testUsername, client), true);
        throw new Error('Trigger rollback');
      });
    } catch {
      threw = true;
    }

    assert.ok(threw);
    assert.strictEqual(
      await adminUserRepo.existsByUsername(testUsername),
      false,
      'Rolled-back record must not exist in database'
    );

    process.stdout.write('  ✅ PASS: 4. Repository updates rollback cleanly on transaction failure\n');
  }

  // Test 5: Clean database check
  {
    const check = await pool.query(
      "SELECT count(*) FROM admin_users WHERE username LIKE '__repo_%';"
    );
    assert.strictEqual(parseInt(check.rows[0].count, 10), 0);
    process.stdout.write('  ✅ PASS: 5. Database clean: zero residual repository test records\n');
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 5 REPOSITORY TESTS PASSED SUCCESSFULLY!           \n');
  process.stdout.write('========================================================\n\n');
}

runTests()
  .catch((err) => {
    process.stderr.write(`Repository test suite failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await closeDbPool();
  });
