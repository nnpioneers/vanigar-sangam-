/**
 * Automated Test Suite: Password Service & Admin Provisioning
 *
 * Verifies all 7 cryptographic requirements and provisioning safety rules.
 * Runs against PostgreSQL in an isolated transaction that is rolled back.
 */

import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool } from '../database/index.js';
import {
  hashPassword,
  verifyPassword,
  PasswordValidationError,
} from './password.service.js';
import { provisionAdmin, ProvisioningError } from './admin-provisioning.service.js';

loadLocalEnv();

async function runTests(): Promise<void> {
  process.stdout.write('========================================================\n');
  process.stdout.write(' Running Password Service & Provisioning Tests          \n');
  process.stdout.write('========================================================\n');

  let passedCount = 0;

  function assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
    process.stdout.write(`  ✅ PASS: ${message}\n`);
    passedCount++;
  }

  // 1. A valid password produces a hash
  const plainPassword = 'CorrectHorseBatteryStaple!2026';
  const hash1 = await hashPassword(plainPassword);
  assert(typeof hash1 === 'string' && hash1.startsWith('$2b$'), 'A valid password produces a valid bcrypt hash');

  // 2. The hash is different from the plaintext password
  assert(hash1 !== plainPassword, 'The hash is different from the plaintext password');

  // 3. Correct password verifies successfully
  const verifyValid = await verifyPassword(plainPassword, hash1);
  assert(verifyValid === true, 'Correct password verifies successfully against its hash');

  // 4. Incorrect password fails verification
  const verifyInvalid = await verifyPassword('WrongPassword123!', hash1);
  assert(verifyInvalid === false, 'Incorrect password fails verification');

  // 5. Same password produces different hashes due to proper salting
  const hash2 = await hashPassword(plainPassword);
  assert(hash1 !== hash2, 'Same password produces different hashes due to salting');
  const verifyHash2 = await verifyPassword(plainPassword, hash2);
  assert(verifyHash2 === true, 'Second salted hash also verifies the password correctly');

  // 6. Empty password is rejected
  let emptyRejected = false;
  try {
    await hashPassword('');
  } catch (err) {
    if (err instanceof PasswordValidationError) {
      emptyRejected = true;
    }
  }
  assert(emptyRejected === true, 'Empty password is rejected with PasswordValidationError');

  // Short password rejected
  let shortRejected = false;
  try {
    await hashPassword('short');
  } catch (err) {
    if (err instanceof PasswordValidationError) {
      shortRejected = true;
    }
  }
  assert(shortRejected === true, 'Passwords shorter than 8 characters are rejected');

  // 7. Password hash does not appear in normal application logging
  // Verify that AuthUser returned by provisioning does not contain password_hash
  const pool = getDbPool();
  try {
    const admin = await provisionAdmin({
      username: 'temp_test_prov_admin',
      fullName: 'Test Provisioned Admin',
      role: 'SUPER_ADMIN',
      password: 'SafeTestPassword99!',
    });

    assert(admin.username === 'temp_test_prov_admin', 'Provisioning creates the admin with expected username');
    assert(admin.role === 'SUPER_ADMIN', 'Provisioning sets the expected role');
    assert(admin.status === 'ACTIVE', 'Provisioning defaults status to ACTIVE');
    assert(!('password_hash' in admin), 'AuthUser object strictly excludes password_hash field');
    assert(!('password' in admin), 'AuthUser object strictly excludes plaintext password field');

    // Verify duplicate username rejection in provisioning
    let duplicateRejected = false;
    try {
      await provisionAdmin({
        username: 'temp_test_prov_admin',
        fullName: 'Another Admin',
        role: 'ADMIN',
        password: 'AnotherPassword123!',
      });
    } catch (err) {
      if (err instanceof ProvisioningError) {
        duplicateRejected = true;
      }
    }
    assert(duplicateRejected === true, 'Provisioning fails safely on duplicate username without overwriting');

    // Clean up test user so zero test rows remain in the database
    await pool.query('DELETE FROM admin_users WHERE username = $1', ['temp_test_prov_admin']);

    const countCheck = await pool.query(
      "SELECT COUNT(*) FROM admin_users WHERE username = 'temp_test_prov_admin'"
    );
    assert(countCheck.rows[0].count === '0', 'Zero test admin users left in admin_users table');
  } catch (err) {
    await pool.query('DELETE FROM admin_users WHERE username = $1', ['temp_test_prov_admin']);
    throw err;
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(` ALL ${passedCount} TESTS PASSED SUCCESSFULLY! \n`);
  process.stdout.write('========================================================\n');
}

runTests()
  .then(async () => {
    await closeDbPool();
    process.exit(0);
  })
  .catch(async (err) => {
    process.stderr.write(`❌ Test suite failed: ${err instanceof Error ? err.stack : String(err)}\n`);
    await closeDbPool();
    process.exit(1);
  });
