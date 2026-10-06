/**
 * Database Transaction & Queryable Abstraction
 *
 * Provides a robust boundary for executing atomic database transactions
 * and defines the Queryable contract satisfied by both `pg.Pool` and `pg.PoolClient`.
 *
 * Essential for future atomic business modules (Daily Sheet, Collections, Loans, Cash Transfers).
 */

import type pg from 'pg';
import { getDbPool } from './index.js';

/**
 * Common query interface implemented by both `pg.Pool` and `pg.PoolClient`.
 * Allows repositories to execute queries without coupling directly to a pool or a single client.
 */
export interface Queryable {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    queryTextOrConfig: string | pg.QueryConfig,
    values?: unknown[]
  ): Promise<pg.QueryResult<R>>;
}

/**
 * Supported PostgreSQL transaction isolation levels.
 */
export type TransactionIsolationLevel =
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

/**
 * Options for configuring a PostgreSQL transaction.
 */
export interface TransactionOptions {
  /**
   * Transaction isolation level. Default is PostgreSQL server default ('READ COMMITTED').
   */
  isolationLevel?: TransactionIsolationLevel;

  /**
   * Whether the transaction is strictly read-only.
   */
  readOnly?: boolean;
}

/**
 * Callback function executed within a managed transaction.
 */
export type TransactionCallback<T> = (client: pg.PoolClient) => Promise<T>;

/**
 * Executes a callback within a managed PostgreSQL database transaction.
 *
 * Guarantees:
 * 1. Acquires a dedicated client from the pool (or reuses `existingClient` if provided).
 * 2. Emits `BEGIN` with specified isolation level or read-only mode.
 * 3. Commits the transaction if the callback completes successfully.
 * 4. Automatically rolls back the transaction if any error is thrown.
 * 5. Safely releases the client back to the pool in a `finally` block.
 * 6. Catches and logs secondary rollback errors to avoid masking the primary error.
 *
 * @param callback Async function receiving the transactional `pg.PoolClient`.
 * @param options Optional transaction options (isolation level, read-only).
 * @param existingClient Optional already-acquired client (for nested or inherited transactions).
 */
export async function withTransaction<T>(
  callback: TransactionCallback<T>,
  options?: TransactionOptions,
  existingClient?: pg.PoolClient
): Promise<T> {
  // If already running inside an active transaction client, reuse it directly.
  if (existingClient) {
    return callback(existingClient);
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    let beginSql = 'BEGIN';
    if (options?.isolationLevel) {
      beginSql += ` ISOLATION LEVEL ${options.isolationLevel}`;
    }
    if (options?.readOnly) {
      beginSql += ' READ ONLY';
    }

    await client.query(beginSql);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      const rollbackMsg = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
      process.stderr.write(`[transaction] rollback failed: ${rollbackMsg}\n`);
    }
    throw err;
  } finally {
    client.release();
  }
}
