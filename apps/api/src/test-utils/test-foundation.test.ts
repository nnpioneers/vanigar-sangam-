/**
 * Automated Test Suite for Service/Repository Transaction & Domain Test Foundation
 * (Phase 3.6)
 *
 * Verifies:
 * 1. Transaction Commit Test: operations persist when transaction commits
 * 2. Transaction Rollback Test: operations roll back completely upon error in runInTestTransaction
 * 3. Repository Transaction-Client Test: repositories route queries to supplied transaction client
 * 4. Service Error-Handling Test: domain services produce typed AppError instances
 * 5. Test Data Isolation & Cleanup: test data cleanup preserves persistent admin user
 */

import assert from 'node:assert';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool, withTransaction } from '../database/index.js';
import { AdminUserRepository } from '../repositories/admin-user.repository.js';
import {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  isAppError,
} from '../errors/app-error.js';
import {
  createTestIdentifier,
  runInTestTransaction,
  cleanupTestRecords,
  countTestRecords,
} from './transaction-test-helper.js';
import { createMockQueryable, InMemoryRepository } from './mock-repository.js';

loadLocalEnv();

// Simple mock entity for service testing
interface TestEntity {
  id: string;
  name: string;
  value: number;
}

// Example domain service to verify service error handling patterns
class DummyDomainService {
  constructor(private readonly repo: InMemoryRepository<TestEntity>) {}

  async getEntity(id: string): Promise<TestEntity> {
    const item = await this.repo.findById(id);
    if (!item) {
      throw new NotFoundError(`Entity with ID "${id}" was not found.`);
    }
    return item;
  }

  async createEntity(data: { id: string; name: string; value: number }): Promise<TestEntity> {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Entity name is required.');
    }
    const existing = await this.repo.findById(data.id);
    if (existing) {
      throw new ConflictError(`Entity with ID "${data.id}" already exists.`);
    }
    return this.repo.save(data);
  }

  async riskyOperation(): Promise<void> {
    try {
      // Simulate unexpected low-level database failure
      throw new Error('FATAL: connection terminated unexpectedly');
    } catch {
      throw new AppError('Operation failed due to an internal system error', 500, 'INTERNAL_ERROR', undefined, false);
    }
  }
}

async function runTests(): Promise<void> {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Service/Repository Test Foundation (Phase 3.6) \n');
  process.stdout.write('========================================================\n');

  const pool = getDbPool();

  // Test 1: Transaction Commit Test
  {
    const testUsername = createTestIdentifier('commit');
    try {
      const insertedId = await withTransaction(async (client) => {
        const res = await client.query<{ id: string }>(
          `INSERT INTO admin_users (username, password_hash, full_name, role, status)
           VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
          [testUsername, 'dummy_hash_val', 'Commit Test User', 'ADMIN', 'ACTIVE']
        );
        return res.rows[0]?.id;
      });

      assert.ok(insertedId, 'Committed transaction should return inserted entity ID');

      // Verify the record is visible from the pool
      const checkRes = await pool.query(
        'SELECT id, username FROM admin_users WHERE username = $1;',
        [testUsername]
      );
      assert.strictEqual(checkRes.rowCount, 1, 'Committed row must be visible in database');

      process.stdout.write('  ✅ PASS: 1. Transaction Commit Test: operations commit and persist\n');
    } finally {
      await pool.query('DELETE FROM admin_users WHERE username = $1;', [testUsername]);
    }
  }

  // Test 2: Transaction Rollback Test
  {
    const testUsername = createTestIdentifier('rollback');
    let caughtError = false;

    try {
      await runInTestTransaction(async (client) => {
        await client.query(
          `INSERT INTO admin_users (username, password_hash, full_name, role, status)
           VALUES ($1, $2, $3, $4, $5);`,
          [testUsername, 'dummy_hash_val', 'Rollback Test User', 'CASHIER', 'ACTIVE']
        );

        // Verify row exists inside the transaction
        const inTx = await client.query(
          'SELECT username FROM admin_users WHERE username = $1;',
          [testUsername]
        );
        assert.strictEqual(inTx.rowCount, 1, 'Row must exist within transaction before rollback');

        // Intentionally throw error to trigger rollback
        throw new Error('Intentional test transaction failure');
      });
    } catch (err) {
      caughtError = true;
      assert.strictEqual((err as Error).message, 'Intentional test transaction failure');
    }

    assert.strictEqual(caughtError, true, 'Error must be caught by caller');

    // Verify row was rolled back and does not exist in the database
    const afterRes = await pool.query(
      'SELECT username FROM admin_users WHERE username = $1;',
      [testUsername]
    );
    assert.strictEqual(afterRes.rowCount, 0, 'Rolled-back row must not exist in database');

    process.stdout.write('  ✅ PASS: 2. Transaction Rollback Test: operations roll back cleanly upon failure\n');
  }

  // Test 3: Repository Transaction-Client Test
  {
    const adminRepo = new AdminUserRepository();
    const testUsername = createTestIdentifier('repo_tx');

    await runInTestTransaction(async (client) => {
      // Insert user within the transaction client
      const res = await client.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
        [testUsername, 'dummy_hash', 'Repo Tx Test', 'ADMIN', 'ACTIVE']
      );
      const userId = res.rows[0]!.id;

      // Pass the transactional client to repository methods
      const existsInTx = await adminRepo.existsByUsername(testUsername, client);
      assert.strictEqual(existsInTx, true, 'Repository must see uncommitted row via tx client');

      const foundInTx = await adminRepo.findById(userId, client);
      assert.ok(foundInTx, 'Repository must find uncommitted row via tx client');
      assert.strictEqual(foundInTx.username, testUsername);

      // Verify that repository querying default pool (outside tx) does NOT see uncommitted row
      const existsOutsideTx = await adminRepo.existsByUsername(testUsername);
      assert.strictEqual(existsOutsideTx, false, 'Repository on default pool must not see uncommitted row');
    });

    // Outside transaction, record is gone (auto-rolled back)
    const existsAfter = await adminRepo.existsByUsername(testUsername);
    assert.strictEqual(existsAfter, false, 'Auto-rolled back record does not persist in DB');

    // Also verify mock Queryable helper records queries and returns mock rows
    const mockQueryable = createMockQueryable(async () => [{ exists: true }]);
    const mockRes = await mockQueryable.query<{ exists: boolean }>('SELECT 1;');
    assert.strictEqual(mockRes.rows[0]?.exists, true);
    assert.strictEqual(mockQueryable.getQueries().length, 1);

    process.stdout.write('  ✅ PASS: 3. Repository Transaction-Client Test: repository accepts and routes through tx client\n');
  }

  // Test 4: Service Error-Handling Test (Domain errors remain typed AppError)
  {
    const memRepo = new InMemoryRepository<TestEntity>();
    const service = new DummyDomainService(memRepo);

    // 4a. NotFoundError verification
    let notFoundCaught = false;
    try {
      await service.getEntity('non_existent_123');
    } catch (err) {
      notFoundCaught = true;
      assert.ok(isAppError(err));
      assert.strictEqual(err.statusCode, 404);
      assert.strictEqual(err.code, 'NOT_FOUND');
    }
    assert.strictEqual(notFoundCaught, true);

    // 4b. ValidationError verification
    let valErrorCaught = false;
    try {
      await service.createEntity({ id: 'e1', name: '', value: 100 });
    } catch (err) {
      valErrorCaught = true;
      assert.ok(isAppError(err));
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, 'INVALID_INPUT');
    }
    assert.strictEqual(valErrorCaught, true);

    // 4c. ConflictError verification
    await service.createEntity({ id: 'e1', name: 'Original', value: 100 });
    let conflictCaught = false;
    try {
      await service.createEntity({ id: 'e1', name: 'Duplicate', value: 200 });
    } catch (err) {
      conflictCaught = true;
      assert.ok(isAppError(err));
      assert.strictEqual(err.statusCode, 409);
      assert.strictEqual(err.code, 'CONFLICT');
    }
    assert.strictEqual(conflictCaught, true);

    // 4d. Unexpected internal error masking
    let internalCaught = false;
    try {
      await service.riskyOperation();
    } catch (err) {
      internalCaught = true;
      assert.ok(isAppError(err));
      assert.strictEqual(err.statusCode, 500);
      assert.strictEqual(err.code, 'INTERNAL_ERROR');
      assert.strictEqual((err as Error).message.includes('FATAL'), false, 'Internal details must be masked');
    }
    assert.strictEqual(internalCaught, true);

    process.stdout.write('  ✅ PASS: 4. Service Error-Handling Test: typed AppErrors and internal error masking verified\n');
  }

  // Test 5: Test Data Isolation & Cleanup Test
  {
    const prefix = '__test_iso_';
    const testUsername1 = `${prefix}1_${Date.now()}`;
    const testUsername2 = `${prefix}2_${Date.now()}`;

    // Insert 2 test records directly
    await pool.query(
      `INSERT INTO admin_users (username, password_hash, full_name, role, status)
       VALUES ($1, 'hash', 'Test 1', 'CASHIER', 'ACTIVE'),
              ($2, 'hash', 'Test 2', 'CASHIER', 'ACTIVE');`,
      [testUsername1, testUsername2]
    );

    // Verify count before cleanup
    const countBefore = await countTestRecords('admin_users', 'username', `${prefix}%`);
    assert.strictEqual(countBefore, 2, 'Two test records should exist before cleanup');

    // Run cleanup
    const deletedCount = await cleanupTestRecords('admin_users', 'username', `${prefix}%`);
    assert.strictEqual(deletedCount, 2, 'Cleanup should report 2 deleted rows');

    // Verify count after cleanup
    const countAfter = await countTestRecords('admin_users', 'username', `${prefix}%`);
    assert.strictEqual(countAfter, 0, 'Zero test records should remain after cleanup');

    // Verify that persistent development admin is untouched!
    const adminCheck = await pool.query(
      "SELECT username, role, status FROM admin_users WHERE username = 'admin';"
    );
    assert.strictEqual(adminCheck.rowCount, 1, 'Development admin must remain untouched');
    assert.strictEqual(adminCheck.rows[0].username, 'admin');
    assert.strictEqual(adminCheck.rows[0].status, 'ACTIVE');

    process.stdout.write('  ✅ PASS: 5. Test Data Isolation & Cleanup: isolates test data and preserves persistent admin\n');
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 5 SERVICE/REPOSITORY TEST FOUNDATION TESTS PASSED! \n');
  process.stdout.write('========================================================\n\n');
}

runTests()
  .catch((err) => {
    process.stderr.write(`Test foundation suite failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await closeDbPool();
  });
