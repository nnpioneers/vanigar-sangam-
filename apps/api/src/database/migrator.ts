import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool } from './index.js';

export interface MigrationRecord {
  id: number;
  name: string;
  executed_at: Date;
  execution_time_ms: number;
  checksum?: string | null;
}

export interface MigrationStatus {
  filename: string;
  applied: boolean;
  executedAt?: Date;
  executionTimeMs?: number;
  checksum?: string | null;
  currentChecksum?: string;
  isModified?: boolean;
}

/**
 * Calculates a deterministic SHA-256 checksum for migration file contents.
 * Normalizes CRLF -> LF and trims to prevent OS-specific line-ending mismatches.
 */
export function calculateChecksum(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  return createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

/**
 * Ensures the `schema_migrations` tracking table exists in PostgreSQL
 * and has the `checksum` column for immutability verification.
 */
export async function ensureMigrationsTable(): Promise<void> {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_time_ms INTEGER NOT NULL,
      checksum VARCHAR(64) NULL
    );
  `);

  // Ensure checksum column exists if table was previously created without it
  await pool.query(`
    ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum VARCHAR(64) NULL;
  `);

  // Backfill checksums for existing records where checksum is null
  try {
    const migrationsDir = getMigrationsDirectory();
    const rows = await pool.query<{ id: number; name: string }>(
      'SELECT id, name FROM schema_migrations WHERE checksum IS NULL;'
    );
    for (const row of rows.rows) {
      const filePath = join(migrationsDir, row.name);
      if (existsSync(filePath)) {
        const content = await readFile(filePath, 'utf-8');
        const checksum = calculateChecksum(content);
        await pool.query(
          'UPDATE schema_migrations SET checksum = $1 WHERE id = $2;',
          [checksum, row.id]
        );
      }
    }
  } catch {
    // Graceful fallback if migrations directory cannot be read
  }
}

/**
 * Resolves the absolute directory path to `database/migrations/`.
 * Traverses parent directories if called from a child workspace.
 */
export function getMigrationsDirectory(): string {
  let currentDir = process.cwd();
  let targetDir = resolve(currentDir, 'database/migrations');

  while (!existsSync(targetDir)) {
    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) {
      return resolve(process.cwd(), 'database/migrations');
    }
    currentDir = parentDir;
    targetDir = resolve(currentDir, 'database/migrations');
  }

  return targetDir;
}

/**
 * Fetches all executed migration records from `schema_migrations`.
 */
export async function getExecutedMigrations(): Promise<MigrationRecord[]> {
  loadLocalEnv();
  await ensureMigrationsTable();
  const pool = getDbPool();
  const result = await pool.query<MigrationRecord>(
    'SELECT id, name, executed_at, execution_time_ms, checksum FROM schema_migrations ORDER BY id ASC;'
  );
  return result.rows;
}

/**
 * Returns detailed status of all migration files (applied vs pending, checksum verification).
 */
export async function getMigrationStatus(): Promise<MigrationStatus[]> {
  loadLocalEnv();
  const migrationsDir = getMigrationsDirectory();
  const executed = await getExecutedMigrations();
  const executedMap = new Map(executed.map((m) => [m.name, m]));

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const statuses: MigrationStatus[] = [];

  for (const file of files) {
    const record = executedMap.get(file);
    const filePath = join(migrationsDir, file);
    const content = await readFile(filePath, 'utf-8');
    const currentChecksum = calculateChecksum(content);
    const isModified = Boolean(record && record.checksum && record.checksum !== currentChecksum);

    statuses.push({
      filename: file,
      applied: Boolean(record),
      executedAt: record?.executed_at,
      executionTimeMs: record?.execution_time_ms,
      checksum: record?.checksum ?? null,
      currentChecksum,
      isModified,
    });
  }

  return statuses;
}

/**
 * Discovers and executes pending `.sql` migration files in deterministic order.
 * 
 * Safety invariants:
 * 1. Checks that no previously applied migrations have been modified on disk.
 * 2. Each migration file executes inside an isolated database transaction.
 * 3. Any error rolls back the entire migration transaction atomically.
 * 4. Records execution duration and cryptographic SHA-256 checksum upon success.
 */
export async function runPendingMigrations(): Promise<{ executedCount: number; status: MigrationStatus[] }> {
  loadLocalEnv();
  await ensureMigrationsTable();
  const migrationsDir = getMigrationsDirectory();
  const executed = await getExecutedMigrations();
  const executedMap = new Map(executed.map((m) => [m.name, m]));

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  // 1. Verify immutability of already applied migrations
  for (const file of files) {
    const record = executedMap.get(file);
    if (record) {
      const filePath = join(migrationsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const currentChecksum = calculateChecksum(content);
      if (record.checksum && record.checksum !== currentChecksum) {
        throw new Error(
          `Migration integrity violation: applied migration "${file}" has been modified on disk. Applied migrations are immutable. (DB checksum: ${record.checksum}, Disk checksum: ${currentChecksum})`
        );
      }
    }
  }

  const pending = files.filter((file) => !executedMap.has(file));

  if (pending.length === 0) {
    const status = await getMigrationStatus();
    return { executedCount: 0, status };
  }

  const pool = getDbPool();

  for (const file of pending) {
    const filePath = join(migrationsDir, file);
    const sql = await readFile(filePath, 'utf-8');
    const checksum = calculateChecksum(sql);
    const startTime = Date.now();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      const executionTimeMs = Date.now() - startTime;
      await client.query(
        'INSERT INTO schema_migrations (name, execution_time_ms, checksum) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum, execution_time_ms = EXCLUDED.execution_time_ms;',
        [file, executionTimeMs, checksum]
      );
      await client.query('COMMIT');
      process.stdout.write(`[migration] Applied: ${file} (${executionTimeMs}ms, checksum: ${checksum.slice(0, 8)}...)\n`);
    } catch (err) {
      await client.query('ROLLBACK');
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[migration error] Failed applying ${file}: ${msg}\n`);
      throw new Error(`Migration ${file} failed: ${msg}`);
    } finally {
      client.release();
    }
  }

  const status = await getMigrationStatus();
  return { executedCount: pending.length, status };
}

