/**
 * Automated Test Suite for Database Schema & Migration Conventions (Phase 3.2)
 *
 * Verifies:
 * 1. Migration file naming, sequential numbering, and lack of gaps/duplicates
 * 2. Real PostgreSQL catalog data types (UUID, TIMESTAMPTZ, etc.)
 * 3. Table constraints (PRIMARY KEY, UNIQUE, CHECK, FOREIGN KEY)
 * 4. Foreign key index coverage
 * 5. Exact monetary math (Paise <-> Rupee conversions without floating-point error)
 * 6. Clean database state (zero residual test rows)
 */

import assert from 'node:assert';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool } from './index.js';
import {
  getTableColumns,
  getTableConstraints,
  getTableIndexes,
} from './conventions.js';
import {
  rupeesToPaise,
  paiseToRupees,
  formatCurrencyRupees,
  safeAddPaise,
  safeSubtractPaise,
} from './money.js';
import { validateMigrationFiles } from './migration-validator.js';

loadLocalEnv();

async function runTests(): Promise<void> {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Database Schema & Migration Conventions Tests   \n');
  process.stdout.write(' (Phase 3.2)                                            \n');
  process.stdout.write('========================================================\n');

  const pool = getDbPool();

  // Test 1: Migration file conventions
  {
    const valResult = await validateMigrationFiles();
    assert.strictEqual(
      valResult.valid,
      true,
      `Migration validation errors: ${valResult.errors.join(', ')}`
    );
    assert.ok(valResult.fileCount >= 2, 'Expected at least 2 migration files');
    assert.strictEqual(valResult.files[0], '001_init_schema_migrations.sql');
    assert.strictEqual(valResult.files[1], '002_create_admin_users_and_sessions.sql');

    process.stdout.write('  ✅ PASS: 1. Migration files follow strict NNN_snake_case.sql numbering\n');
  }

  // Test 2: Column data types in PostgreSQL catalog
  {
    const adminColumns = await getTableColumns('admin_users', pool);
    const colMap = new Map(adminColumns.map((c) => [c.columnName, c]));

    // Verify UUID PK
    const idCol = colMap.get('id');
    assert.ok(idCol);
    assert.strictEqual(idCol.dataType, 'uuid');
    assert.strictEqual(idCol.isNullable, false);

    // Verify TIMESTAMPTZ
    const createdAtCol = colMap.get('created_at');
    assert.ok(createdAtCol);
    assert.strictEqual(createdAtCol.dataType, 'timestamp with time zone');
    assert.strictEqual(createdAtCol.isNullable, false);

    const updatedAtCol = colMap.get('updated_at');
    assert.ok(updatedAtCol);
    assert.strictEqual(updatedAtCol.dataType, 'timestamp with time zone');

    // Verify Sessions timestamps
    const sessionColumns = await getTableColumns('sessions', pool);
    const sessionColMap = new Map(sessionColumns.map((c) => [c.columnName, c]));
    assert.strictEqual(
      sessionColMap.get('expires_at')?.dataType,
      'timestamp with time zone'
    );
    assert.strictEqual(
      sessionColMap.get('created_at')?.dataType,
      'timestamp with time zone'
    );
    assert.strictEqual(
      sessionColMap.get('last_activity_at')?.dataType,
      'timestamp with time zone'
    );

    process.stdout.write('  ✅ PASS: 2. PostgreSQL catalog confirms UUID PK and TIMESTAMPTZ convention\n');
  }

  // Test 3: Constraint enforcement
  {
    const adminConstraints = await getTableConstraints('admin_users', pool);
    const types = new Set(adminConstraints.map((c) => c.constraintType));

    assert.ok(types.has('PRIMARY KEY'), 'admin_users must have PRIMARY KEY');
    assert.ok(types.has('UNIQUE'), 'admin_users must have UNIQUE constraint (username)');
    assert.ok(types.has('CHECK'), 'admin_users must have CHECK constraints (role, status)');

    const sessionConstraints = await getTableConstraints('sessions', pool);
    const sessionTypes = new Set(sessionConstraints.map((c) => c.constraintType));
    assert.ok(sessionTypes.has('PRIMARY KEY'), 'sessions must have PRIMARY KEY');
    assert.ok(sessionTypes.has('FOREIGN KEY'), 'sessions must have FOREIGN KEY referencing admin_users');

    process.stdout.write('  ✅ PASS: 3. Table constraints verified (PRIMARY KEY, UNIQUE, CHECK, FOREIGN KEY)\n');
  }

  // Test 4: Foreign key index coverage
  {
    const sessionIndexes = await getTableIndexes('sessions', pool);
    assert.ok(
      sessionIndexes.includes('idx_sessions_admin_id'),
      'Foreign key admin_id must have an explicit index'
    );
    assert.ok(
      sessionIndexes.includes('idx_sessions_expires_at'),
      'Expiration timestamp must have an explicit index'
    );

    process.stdout.write('  ✅ PASS: 4. Foreign key index coverage verified\n');
  }

  // Test 5: Monetary precision & integer paise math (zero floating-point drift)
  {
    assert.strictEqual(rupeesToPaise(1500), 150000n);
    assert.strictEqual(rupeesToPaise('1500.50'), 150050n);
    assert.strictEqual(rupeesToPaise('0.75'), 75n);
    assert.strictEqual(rupeesToPaise(0), 0n);
    assert.strictEqual(rupeesToPaise('-50.25'), -5025n);

    assert.strictEqual(paiseToRupees(150050n), '1500.50');
    assert.strictEqual(paiseToRupees(75n), '0.75');
    assert.strictEqual(paiseToRupees(0n), '0.00');
    assert.strictEqual(paiseToRupees(-5025n), '-50.25');

    // Elimination of classic IEEE 754 floating point rounding drift:
    // In JavaScript: 0.1 + 0.2 === 0.30000000000000004
    // In safe paise math:
    const p1 = rupeesToPaise('0.10');
    const p2 = rupeesToPaise('0.20');
    const sum = safeAddPaise(p1, p2);
    assert.strictEqual(sum, 30n);
    assert.strictEqual(paiseToRupees(sum), '0.30');

    // Safe subtraction
    const sub = safeSubtractPaise(10000n, 2550n);
    assert.strictEqual(sub, 7450n);
    assert.strictEqual(paiseToRupees(sub), '74.50');

    // Currency formatting
    const formatted = formatCurrencyRupees(150050n);
    assert.ok(formatted.includes('1,500.50'));

    process.stdout.write('  ✅ PASS: 5. Exact integer paise math eliminates floating-point rounding errors\n');
  }

  // Test 6: Database cleanliness verification (zero residual test rows)
  {
    const testAdminCount = await pool.query(
      "SELECT count(*) FROM admin_users WHERE username LIKE 'test_%' OR username LIKE 'conv_%';"
    );
    const testSessionCount = await pool.query(
      "SELECT count(*) FROM sessions WHERE id LIKE 'test_%' OR id LIKE 'sess_temp_%' OR id LIKE 'conv_%';"
    );

    assert.strictEqual(
      parseInt(testAdminCount.rows[0].count, 10),
      0,
      'admin_users table must have zero residual test records'
    );
    assert.strictEqual(
      parseInt(testSessionCount.rows[0].count, 10),
      0,
      'sessions table must have zero residual test records'
    );

    process.stdout.write('  ✅ PASS: 6. Database remains completely clean with zero residual test records\n');
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 6 CONVENTIONS TESTS PASSED SUCCESSFULLY!          \n');
  process.stdout.write('========================================================\n\n');
}

runTests()
  .catch((err) => {
    process.stderr.write(`Convention test suite failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await closeDbPool();
  });
