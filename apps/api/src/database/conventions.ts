/**
 * Database Conventions & Common Schema Helper Types
 *
 * Provides shared metadata contracts and PostgreSQL catalog inspection helpers.
 */

import type { Queryable } from './transaction.js';

/**
 * Standard audit timestamp columns present on mutable entities.
 */
export interface DbAuditColumns {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Base record contract for database entities.
 */
export interface DbEntityBase<TId = string> extends DbAuditColumns {
  id: TId;
}

/**
 * Schema column metadata returned from PostgreSQL `information_schema.columns`.
 */
export interface ColumnMetadata {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
}

/**
 * Table constraint metadata returned from PostgreSQL `information_schema.table_constraints`.
 */
export interface ConstraintMetadata {
  constraintName: string;
  constraintType: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  tableName: string;
}

/**
 * Inspects all columns of a specified table in PostgreSQL.
 */
export async function getTableColumns(
  tableName: string,
  executor: Queryable
): Promise<ColumnMetadata[]> {
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position ASC;
  `;

  const result = await executor.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(query, [tableName]);

  return result.rows.map((row) => ({
    columnName: row.column_name,
    dataType: row.data_type,
    isNullable: row.is_nullable === 'YES',
    columnDefault: row.column_default,
  }));
}

/**
 * Inspects all constraints on a specified table in PostgreSQL.
 */
export async function getTableConstraints(
  tableName: string,
  executor: Queryable
): Promise<ConstraintMetadata[]> {
  const query = `
    SELECT
      constraint_name,
      constraint_type,
      table_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY constraint_name ASC;
  `;

  const result = await executor.query<{
    constraint_name: string;
    constraint_type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
    table_name: string;
  }>(query, [tableName]);

  return result.rows.map((row) => ({
    constraintName: row.constraint_name,
    constraintType: row.constraint_type,
    tableName: row.table_name,
  }));
}

/**
 * Inspects all indexes for a table in PostgreSQL.
 */
export async function getTableIndexes(
  tableName: string,
  executor: Queryable
): Promise<string[]> {
  const query = `
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = $1
    ORDER BY indexname ASC;
  `;

  const result = await executor.query<{ indexname: string }>(query, [tableName]);
  return result.rows.map((r) => r.indexname);
}
