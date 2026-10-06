/**
 * Mock Repository & Service Testing Helpers (Phase 3.6)
 *
 * Provides utilities for testing service-layer logic with in-memory or mocked repositories
 * without requiring active PostgreSQL database connections.
 */

import type pg from 'pg';
import type { Queryable } from '../database/index.js';

export interface RecordedQuery {
  sql: string;
  params?: unknown[];
}

/**
 * Creates a mock Queryable executor that tracks queries and returns canned responses.
 */
export function createMockQueryable(
  handler?: (sql: string, params?: unknown[]) => Promise<unknown[]>
): Queryable & { getQueries(): RecordedQuery[]; clearQueries(): void } {
  const recordedQueries: RecordedQuery[] = [];

  return {
    getQueries() {
      return [...recordedQueries];
    },
    clearQueries() {
      recordedQueries.length = 0;
    },
    async query<R extends pg.QueryResultRow = pg.QueryResultRow>(
      queryTextOrConfig: string | pg.QueryConfig,
      values?: unknown[]
    ): Promise<pg.QueryResult<R>> {
      const sql = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      const params = typeof queryTextOrConfig === 'string' ? values : queryTextOrConfig.values;

      recordedQueries.push({ sql, params });

      const rows = handler ? ((await handler(sql, params)) as R[]) : [];

      return {
        rows,
        command: 'SELECT',
        rowCount: rows.length,
        oid: 0,
        fields: [],
      };
    },
  };
}

/**
 * Generic in-memory repository base for unit testing services without PostgreSQL.
 */
export class InMemoryRepository<T extends { id: string }> {
  protected items = new Map<string, T>();

  async findById(id: string): Promise<T | null> {
    return this.items.get(id) ?? null;
  }

  async save(item: T): Promise<T> {
    this.items.set(item.id, { ...item });
    return item;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async getAll(): Promise<T[]> {
    return Array.from(this.items.values());
  }

  clear(): void {
    this.items.clear();
  }
}
