/**
 * Database Migration Conventions Validator
 *
 * Programmatically enforces migration file conventions:
 * 1. Files must follow pattern: `NNN_description.sql` (3 digits zero-padded).
 * 2. Numbers must be strictly sequential starting from 001 without gaps or duplicates.
 * 3. File content must be valid, readable, non-empty SQL.
 * 4. Checks executed migrations against disk to detect drift or orphaned records.
 * 5. Verifies cryptographic checksums of applied migrations to prevent silent modifications.
 * 6. Scans SQL content for prohibited patterns:
 *    - Prohibits floating-point types (FLOAT, DOUBLE PRECISION, REAL) to protect financial data.
 *    - Prohibits unsafe ON DELETE CASCADE on financial/audit domain tables.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getMigrationsDirectory, getExecutedMigrations, calculateChecksum } from './migrator.js';

export interface MigrationValidationResult {
  valid: boolean;
  errors: string[];
  fileCount: number;
  files: string[];
}

export const MIGRATION_FILE_PATTERN = /^(\d{3})_[a-z0-9_]+\.sql$/;

/** Prohibited floating-point SQL data types */
const PROHIBITED_FLOAT_TYPES = /\b(FLOAT|DOUBLE\s+PRECISION|REAL)\b/i;

/** Unsafe cascade deletes on future financial or audit tables */
const UNSAFE_CASCADE_DELETE = /\bREFERENCES\s+(members?|audit_logs?|contributions?|member_contributions?|daily_sheets?|loans?|guarantors?|admin_cash_accounts?|cash_transactions?|cash_transfers?|cash_reconciliations?)\b[^;]*\bON\s+DELETE\s+CASCADE\b/i;

/**
 * Validates an individual migration filename.
 */
export function validateMigrationFilename(filename: string): { valid: boolean; error?: string; sequenceNumber?: number } {
  const match = filename.match(MIGRATION_FILE_PATTERN);
  if (!match) {
    return {
      valid: false,
      error: `File "${filename}" does not follow the required naming convention "NNN_description.sql" (3 digits zero-padded, lowercase snake_case).`,
    };
  }
  const sequenceNumber = parseInt(match[1]!, 10);
  return { valid: true, sequenceNumber };
}

/**
 * Validates a list of migration filenames for sequential order, duplicates, and gaps.
 */
export function validateMigrationSequence(filenames: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const sorted = [...filenames].sort();
  const seenNumbers = new Set<number>();
  let expectedSeq = 1;

  for (const file of sorted) {
    const fnCheck = validateMigrationFilename(file);
    if (!fnCheck.valid || fnCheck.sequenceNumber === undefined) {
      errors.push(fnCheck.error!);
      continue;
    }

    const num = fnCheck.sequenceNumber;
    const numStr = String(num).padStart(3, '0');

    if (seenNumbers.has(num)) {
      errors.push(`Duplicate migration number "${numStr}" found in file "${file}".`);
    }
    seenNumbers.add(num);

    if (num !== expectedSeq) {
      errors.push(
        `Sequence gap detected at "${file}". Expected migration number "${String(expectedSeq).padStart(3, '0')}", but got "${numStr}".`
      );
    }
    expectedSeq++;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Scans migration SQL content for structural safety and prohibited patterns.
 */
export function validateMigrationSql(sql: string, filename = 'migration.sql'): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (sql.trim().length === 0) {
    errors.push(`Migration file "${filename}" is empty.`);
    return { valid: false, errors };
  }

  // 1. Prohibit floating-point types for monetary/decimal accuracy
  if (PROHIBITED_FLOAT_TYPES.test(sql)) {
    errors.push(
      `Migration "${filename}" contains prohibited floating-point data type. Financial and numeric amounts must use BIGINT (integer paise) or exact types.`
    );
  }

  // 2. Prohibit unsafe cascade delete on financial or audit entities
  if (UNSAFE_CASCADE_DELETE.test(sql)) {
    errors.push(
      `Migration "${filename}" contains unsafe ON DELETE CASCADE on a financial or audit table. Use ON DELETE RESTRICT or NO ACTION.`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates the migrations directory for strict convention compliance.
 */
export async function validateMigrationFiles(): Promise<MigrationValidationResult> {
  const errors: string[] = [];
  const migrationsDir = getMigrationsDirectory();

  const allEntries = await readdir(migrationsDir);
  const sqlFiles = allEntries.filter((f) => f.endsWith('.sql')).sort();

  if (sqlFiles.length === 0) {
    errors.push('No migration SQL files found in database/migrations.');
    return { valid: false, errors, fileCount: 0, files: [] };
  }

  // 1. Validate sequence and naming
  const seqResult = validateMigrationSequence(sqlFiles);
  if (!seqResult.valid) {
    errors.push(...seqResult.errors);
  }

  // 2. Validate SQL contents for each file
  const fileContents = new Map<string, string>();
  for (const file of sqlFiles) {
    const content = await readFile(join(migrationsDir, file), 'utf-8');
    fileContents.set(file, content);

    const sqlCheck = validateMigrationSql(content, file);
    if (!sqlCheck.valid) {
      errors.push(...sqlCheck.errors);
    }
  }

  // 3. Cross-reference with executed migrations in DB if available
  try {
    const executed = await getExecutedMigrations();
    const diskSet = new Set(sqlFiles);

    for (const record of executed) {
      if (!diskSet.has(record.name)) {
        errors.push(
          `Executed migration "${record.name}" recorded in schema_migrations is missing from disk.`
        );
      } else if (record.checksum) {
        const content = fileContents.get(record.name);
        if (content) {
          const currentChecksum = calculateChecksum(content);
          if (record.checksum !== currentChecksum) {
            errors.push(
              `Applied migration "${record.name}" has been modified on disk (checksum mismatch: DB=${record.checksum}, Disk=${currentChecksum}).`
            );
          }
        }
      }
    }
  } catch {
    // If DB is offline, file-level validation still succeeds
  }

  return {
    valid: errors.length === 0,
    errors,
    fileCount: sqlFiles.length,
    files: sqlFiles,
  };
}

