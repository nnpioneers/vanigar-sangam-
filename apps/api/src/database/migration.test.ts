/**
 * Automated Test Suite for Migration Infrastructure & Hardening (Phase 3.5)
 *
 * Verifies:
 * 1. Migration filename format and sequence ordering
 * 2. Duplicate migration sequence number detection
 * 3. Sequence gap detection
 * 4. Migration status detection and checksum reporting
 * 5. Applied migration checksum verification & immutability
 * 6. Transactional DDL failure & atomic rollback behavior
 * 7. Prevention of floating-point types (FLOAT/DOUBLE PRECISION/REAL) in migration SQL
 * 8. Rejection of unsafe ON DELETE CASCADE on financial/audit domain tables
 */

import assert from 'node:assert';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool } from './index.js';
import {
  getMigrationStatus,
  calculateChecksum,
  ensureMigrationsTable,
} from './migrator.js';
import {
  validateMigrationFilename,
  validateMigrationSequence,
  validateMigrationSql,
  validateMigrationFiles,
} from './migration-validator.js';

loadLocalEnv();

async function runTests(): Promise<void> {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Database Migration & Hardening Tests           \n');
  process.stdout.write(' (Phase 3.5)                                            \n');
  process.stdout.write('========================================================\n');

  const pool = getDbPool();

  // Test 1: Migration filename format & sequential ordering
  {
    assert.strictEqual(validateMigrationFilename('001_init.sql').valid, true);
    assert.strictEqual(validateMigrationFilename('002_create_users.sql').valid, true);
    assert.strictEqual(validateMigrationFilename('003_add_members.sql').valid, true);

    // Invalid format
    assert.strictEqual(validateMigrationFilename('1_init.sql').valid, false);
    assert.strictEqual(validateMigrationFilename('001-init.sql').valid, false);
    assert.strictEqual(validateMigrationFilename('001_Init_CamelCase.sql').valid, false);
    assert.strictEqual(validateMigrationFilename('random.sql').valid, false);

    // Valid sequence
    const validSeq = validateMigrationSequence(['001_a.sql', '002_b.sql', '003_c.sql']);
    assert.strictEqual(validSeq.valid, true);

    process.stdout.write('  ✅ PASS: 1. Migration filename pattern and sequential ordering verified\n');
  }

  // Test 2: Duplicate migration number detection
  {
    const dupResult = validateMigrationSequence(['001_first.sql', '002_second.sql', '002_another_second.sql']);
    assert.strictEqual(dupResult.valid, false);
    assert.ok(dupResult.errors.some((e) => e.includes('Duplicate migration number "002"')));

    process.stdout.write('  ✅ PASS: 2. Duplicate migration sequence numbers detected and rejected\n');
  }

  // Test 3: Sequence gap detection
  {
    const gapResult = validateMigrationSequence(['001_first.sql', '003_third.sql']);
    assert.strictEqual(gapResult.valid, false);
    assert.ok(gapResult.errors.some((e) => e.includes('Sequence gap detected')));

    process.stdout.write('  ✅ PASS: 3. Migration sequence gaps detected and rejected\n');
  }

  // Test 4: Migration status detection
  {
    await ensureMigrationsTable();
    const status = await getMigrationStatus();
    assert.ok(status.length >= 2, 'Expected at least 2 migrations tracked');

    const m1 = status.find((s) => s.filename === '001_init_schema_migrations.sql');
    assert.ok(m1);
    assert.strictEqual(m1.applied, true);
    assert.ok(m1.checksum, 'Applied migration must have a recorded checksum');
    assert.strictEqual(m1.isModified, false);

    const m2 = status.find((s) => s.filename === '002_create_admin_users_and_sessions.sql');
    assert.ok(m2);
    assert.strictEqual(m2.applied, true);
    assert.ok(m2.checksum, 'Applied migration must have a recorded checksum');
    assert.strictEqual(m2.isModified, false);

    process.stdout.write('  ✅ PASS: 4. Migration status detection confirms applied migrations with checksums\n');
  }

  // Test 5: Checksum immutability and drift detection
  {
    const originalSql = 'CREATE TABLE test_table (id UUID PRIMARY KEY);';
    const checksum1 = calculateChecksum(originalSql);
    const checksum2 = calculateChecksum(originalSql);
    assert.strictEqual(checksum1, checksum2, 'Identical content must produce identical checksum');

    // Windows CRLF vs Linux LF normalization
    const crlfSql = 'CREATE TABLE test_table (id UUID PRIMARY KEY);\r\n';
    const lfSql = 'CREATE TABLE test_table (id UUID PRIMARY KEY);\n';
    assert.strictEqual(
      calculateChecksum(crlfSql),
      calculateChecksum(lfSql),
      'CRLF and LF differences must normalize to identical checksum'
    );

    // Modified content produces different checksum
    const alteredSql = 'CREATE TABLE test_table (id UUID PRIMARY KEY, name TEXT);';
    assert.notStrictEqual(calculateChecksum(alteredSql), checksum1);

    process.stdout.write('  ✅ PASS: 5. Checksum calculation is deterministic, cross-platform, and detects modification\n');
  }

  // Test 6: Transactional DDL failure & atomic rollback
  {
    const client = await pool.connect();
    const tableName = 'test_tx_rollback_ddl_table';

    try {
      // Clean up in case of stale prior run
      await client.query(`DROP TABLE IF EXISTS ${tableName};`);

      // Begin transaction
      await client.query('BEGIN');
      await client.query(`CREATE TABLE ${tableName} (id SERIAL PRIMARY KEY, val TEXT);`);

      // Confirm table exists within transaction
      const existsInTx = await client.query(
        "SELECT to_regclass($1) AS tbl;",
        [`public.${tableName}`]
      );
      assert.ok(existsInTx.rows[0].tbl !== null, 'Table should exist within transaction before rollback');

      // Intentional failure and rollback
      await client.query('ROLLBACK');

      // Confirm table does NOT exist after rollback
      const existsAfter = await pool.query(
        "SELECT to_regclass($1) AS tbl;",
        [`public.${tableName}`]
      );
      assert.strictEqual(
        existsAfter.rows[0].tbl,
        null,
        'Table must not exist after transaction rollback'
      );

      process.stdout.write('  ✅ PASS: 6. PostgreSQL transactional DDL failure cleanly rolls back schema changes\n');
    } finally {
      client.release();
    }
  }

  // Test 7: Prohibition of floating-point data types (financial data safety)
  {
    const safeSql = `
      CREATE TABLE member_contributions (
        id UUID PRIMARY KEY,
        amount_paise BIGINT NOT NULL,
        entry_date DATE NOT NULL
      );
    `;
    const safeCheck = validateMigrationSql(safeSql, 'safe.sql');
    assert.strictEqual(safeCheck.valid, true);

    const floatSql = `
      CREATE TABLE bad_table (
        id UUID PRIMARY KEY,
        amount FLOAT NOT NULL
      );
    `;
    const floatCheck = validateMigrationSql(floatSql, 'float.sql');
    assert.strictEqual(floatCheck.valid, false);
    assert.ok(floatCheck.errors.some((e) => e.includes('prohibited floating-point data type')));

    const doubleSql = `
      CREATE TABLE bad_table2 (
        id UUID PRIMARY KEY,
        balance DOUBLE PRECISION NOT NULL
      );
    `;
    const doubleCheck = validateMigrationSql(doubleSql, 'double.sql');
    assert.strictEqual(doubleCheck.valid, false);

    process.stdout.write('  ✅ PASS: 7. Prohibited floating-point types (FLOAT/DOUBLE PRECISION) rejected\n');
  }

  // Test 8: Rejection of unsafe ON DELETE CASCADE on financial/audit domain tables
  {
    const unsafeSql = `
      CREATE TABLE payment_records (
        id UUID PRIMARY KEY,
        loan_id UUID REFERENCES loans(id) ON DELETE CASCADE
      );
    `;
    const unsafeCheck = validateMigrationSql(unsafeSql, 'unsafe.sql');
    assert.strictEqual(unsafeCheck.valid, false);
    assert.ok(unsafeCheck.errors.some((e) => e.includes('unsafe ON DELETE CASCADE')));

    const safeFkSql = `
      CREATE TABLE payment_records (
        id UUID PRIMARY KEY,
        loan_id UUID REFERENCES loans(id) ON DELETE RESTRICT
      );
    `;
    const safeFkCheck = validateMigrationSql(safeFkSql, 'safe_fk.sql');
    assert.strictEqual(safeFkCheck.valid, true);

    process.stdout.write('  ✅ PASS: 8. Unsafe ON DELETE CASCADE on financial/audit tables rejected\n');
  }

  // Test 9: Full validation of current repository migration files
  {
    const fullValidation = await validateMigrationFiles();
    assert.strictEqual(
      fullValidation.valid,
      true,
      `Current migrations validation failed: ${fullValidation.errors.join(', ')}`
    );
    assert.ok(fullValidation.fileCount >= 2);

    process.stdout.write('  ✅ PASS: 9. Current repository migrations pass all validation invariants\n');
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 9 MIGRATION HARDENING TESTS PASSED!                \n');
  process.stdout.write('========================================================\n\n');
}

runTests()
  .catch((err) => {
    process.stderr.write(`Migration test suite failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await closeDbPool();
  });
