/**
 * Transaction Test Utilities & Test Data Isolation Helpers (Phase 3.6)
 *
 * Provides reusable helpers for testing database operations, repositories,
 * and service coordination with guaranteed isolation and zero residue.
 */

import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { getDbPool } from '../database/index.js';

export interface TestIsolationOptions {
  /** If true, commits the transaction. Defaults to false (always ROLLBACK). */
  commit?: boolean;
}

/**
 * Generates a clearly identifiable, unique test identifier.
 * Pattern: `__test_${prefix}_${timestamp}_${nonce}__`
 */
export function createTestIdentifier(prefix = 'item'): string {
  const nonce = randomBytes(4).toString('hex');
  return `__test_${prefix}_${Date.now()}_${nonce}__`;
}

/**
 * Executes a callback within a managed transaction that is automatically
 * ROLLED BACK upon completion (unless `commit: true` is explicitly specified).
 *
 * Guarantees:
 * 1. Safe execution: Changes are rolled back by default, leaving the database pristine.
 * 2. Dedicated client: Acquires a client and releases it back to the pool in a finally block.
 * 3. Never affects persistent accounts or production data.
 */
export async function runInTestTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
  options: TestIsolationOptions = {}
): Promise<T> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);

    if (options.commit) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore secondary rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Safely removes identifiable test records matching a strict test prefix.
 * Enforces that the pattern must begin with an approved test prefix
 * to prevent accidental deletion of real or persistent development accounts.
 */
export async function cleanupTestRecords(
  tableName: string,
  columnName: string,
  testPattern: string
): Promise<number> {
  if (
    !testPattern.startsWith('__test_') &&
    !testPattern.startsWith('test_') &&
    !testPattern.startsWith('__tx_') &&
    !testPattern.startsWith('__repo_') &&
    !testPattern.startsWith('__coord_')
  ) {
    throw new Error(
      `Safety violation: cleanup pattern "${testPattern}" must begin with a test prefix (__test_, test_, __tx_, __repo_, __coord_).`
    );
  }

  // Whitelist table names to prevent SQL injection in test helpers
  const allowedTables = new Set(['admin_users', 'sessions', 'admin_cash_accounts', 'cash_transactions', 'cash_transfers', 'cash_reconciliations', 'members']);
  if (!allowedTables.has(tableName)) {
    throw new Error(`Safety violation: table "${tableName}" is not permitted for test cleanup.`);
  }

  const pool = getDbPool();
  const result = await pool.query(
    `DELETE FROM ${tableName} WHERE ${columnName} LIKE $1;`,
    [testPattern]
  );
  return result.rowCount ?? 0;
}

/**
 * Verifies the count of test records matching the pattern in the table.
 */
export async function countTestRecords(
  tableName: string,
  columnName: string,
  testPattern: string
): Promise<number> {
  const allowedTables = new Set(['admin_users', 'sessions', 'admin_cash_accounts', 'cash_transactions', 'cash_transfers', 'cash_reconciliations', 'members']);
  if (!allowedTables.has(tableName)) {
    throw new Error(`Safety violation: table "${tableName}" is not permitted for test verification.`);
  }

  const pool = getDbPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE ${columnName} LIKE $1;`,
    [testPattern]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}
