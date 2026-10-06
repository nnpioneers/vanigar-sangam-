/**
 * Base Repository
 *
 * Provides shared database interaction capabilities for all module repositories.
 * Strictly decoupled from HTTP, Express, and UI layers.
 * Accepts a `Queryable` executor (either `pg.Pool` or a transactional `pg.PoolClient`).
 */

import type pg from 'pg';
import { getDbPool, type Queryable } from '../database/index.js';

export abstract class BaseRepository {
  protected readonly defaultExecutor?: Queryable;

  constructor(defaultExecutor?: Queryable) {
    this.defaultExecutor = defaultExecutor;
  }

  /**
   * Resolves the active query executor: the provided transactional client,
   * or the repository's default executor (connection pool).
   */
  protected resolveExecutor(executor?: Queryable): Queryable {
    return executor ?? this.defaultExecutor ?? getDbPool();
  }

  /**
   * Executes a parameterized query and returns all matching rows.
   */
  protected async query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    queryText: string,
    params: unknown[] = [],
    executor?: Queryable
  ): Promise<R[]> {
    const client = this.resolveExecutor(executor);
    const result = await client.query<R>(queryText, params);
    return result.rows;
  }

  /**
   * Executes a parameterized query and returns the single matching row, or null if not found.
   */
  protected async queryOne<R extends pg.QueryResultRow = pg.QueryResultRow>(
    queryText: string,
    params: unknown[] = [],
    executor?: Queryable
  ): Promise<R | null> {
    const rows = await this.query<R>(queryText, params, executor);
    return rows[0] ?? null;
  }

  /**
   * Executes a parameterized query and returns the number of affected rows.
   */
  protected async execute(
    queryText: string,
    params: unknown[] = [],
    executor?: Queryable
  ): Promise<number> {
    const client = this.resolveExecutor(executor);
    const result = await client.query(queryText, params);
    return result.rowCount ?? 0;
  }

  /**
   * Checks whether a query returns at least one row.
   */
  protected async exists(
    queryText: string,
    params: unknown[] = [],
    executor?: Queryable
  ): Promise<boolean> {
    const count = await this.execute(queryText, params, executor);
    return count > 0;
  }
}
