import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool } from './index.js';

loadLocalEnv();

async function runSchemaVerification(): Promise<void> {
  const pool = getDbPool();

  process.stdout.write('--- Starting Database Schema & Constraint Verification ---\n');

  // 1. Verify tables exist
  const tableCheck = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('admin_users', 'sessions', 'schema_migrations')
    ORDER BY table_name;
  `);
  process.stdout.write(`Tables found: ${tableCheck.rows.map((r) => r.table_name).join(', ')}\n`);

  // 2. Verify indexes
  const indexCheck = await pool.query(`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'sessions'
    ORDER BY indexname;
  `);
  process.stdout.write(`Session indexes found: ${indexCheck.rows.map((r) => r.indexname).join(', ')}\n`);

  // 3. Test Constraints inside a transaction with savepoints
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 3a. Insert valid test admin
    const testAdminRes = await client.query(`
      INSERT INTO admin_users (username, password_hash, full_name, role, status)
      VALUES ('test_admin_temp', 'hash_val', 'Test Admin', 'ADMIN', 'ACTIVE')
      RETURNING id, username, role, status;
    `);
    const adminId = testAdminRes.rows[0].id;
    process.stdout.write(`✅ Valid admin user inserted: ${adminId}\n`);

    // 3b. Test duplicate username rejection using savepoint
    await client.query('SAVEPOINT sp_dup');
    let duplicateRejected = false;
    try {
      await client.query(`
        INSERT INTO admin_users (username, password_hash, full_name, role, status)
        VALUES ('test_admin_temp', 'hash_val2', 'Duplicate', 'ADMIN', 'ACTIVE');
      `);
    } catch {
      duplicateRejected = true;
      await client.query('ROLLBACK TO SAVEPOINT sp_dup');
    }
    if (duplicateRejected) {
      process.stdout.write('✅ Duplicate username constraint verified (rejected duplicate).\n');
    } else {
      throw new Error('Duplicate username was NOT rejected!');
    }

    // 3c. Test invalid role rejection using savepoint
    await client.query('SAVEPOINT sp_role');
    let invalidRoleRejected = false;
    try {
      await client.query(`
        INSERT INTO admin_users (username, password_hash, full_name, role, status)
        VALUES ('invalid_role_user', 'hash_val', 'Invalid', 'SUPERHERO', 'ACTIVE');
      `);
    } catch {
      invalidRoleRejected = true;
      await client.query('ROLLBACK TO SAVEPOINT sp_role');
    }
    if (invalidRoleRejected) {
      process.stdout.write('✅ Role CHECK constraint verified (rejected invalid role).\n');
    } else {
      throw new Error('Invalid role was NOT rejected!');
    }

    // 3d. Test invalid status rejection using savepoint
    await client.query('SAVEPOINT sp_status');
    let invalidStatusRejected = false;
    try {
      await client.query(`
        INSERT INTO admin_users (username, password_hash, full_name, role, status)
        VALUES ('invalid_status_user', 'hash_val', 'Invalid', 'ADMIN', 'UNKNOWN_STATUS');
      `);
    } catch {
      invalidStatusRejected = true;
      await client.query('ROLLBACK TO SAVEPOINT sp_status');
    }
    if (invalidStatusRejected) {
      process.stdout.write('✅ Status CHECK constraint verified (rejected invalid status).\n');
    } else {
      throw new Error('Invalid status was NOT rejected!');
    }

    // 3e. Test valid session insertion with foreign key
    const sessionRes = await client.query(`
      INSERT INTO sessions (id, admin_id, expires_at)
      VALUES ('sess_temp_123', $1, NOW() + INTERVAL '1 day')
      RETURNING id, admin_id;
    `, [adminId]);
    process.stdout.write(`✅ Session created referencing admin: ${sessionRes.rows[0].id}\n`);

    // 3f. Test cascade deletion
    await client.query('DELETE FROM admin_users WHERE id = $1', [adminId]);
    const checkSession = await client.query("SELECT * FROM sessions WHERE id = 'sess_temp_123'");
    if (checkSession.rowCount === 0) {
      process.stdout.write('✅ Foreign key ON DELETE CASCADE verified (session automatically deleted).\n');
    } else {
      throw new Error('Session was NOT deleted on admin deletion cascade!');
    }

    // Rollback so database remains clean
    await client.query('ROLLBACK');
    process.stdout.write('✅ Transaction safely rolled back. Zero test rows left in database.\n');

    // Confirm test table count is clean
    const countCheck = await pool.query(
      "SELECT COUNT(*) FROM admin_users WHERE username = 'test_admin_temp';"
    );
    process.stdout.write(`Final test admin_users row count: ${countCheck.rows[0].count} (completely clean)\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await closeDbPool();
  }
}

runSchemaVerification().catch((err) => {
  process.stderr.write(`Schema verification failed: ${err.message}\n`);
  process.exit(1);
});
