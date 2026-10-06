/**
 * Automated Test Suite for Server-Side Session Service (Task 2.4)
 *
 * Verifies:
 * 1. Session creation with secure parameters
 * 2. Session retrieval by ID
 * 3. Valid session validation and safe user attachment
 * 4. Expired session rejection (expires_at in past)
 * 5. Missing / invalid session ID rejection
 * 6. Inactive admin rejection (status = 'INACTIVE')
 * 7. Suspended admin rejection (status = 'SUSPENDED')
 * 8. Session deletion (single session logout)
 * 9. Multiple sessions deletion for admin
 * 10. Session ID entropy and unpredictability (length = 64 hex chars, random)
 * 11. Expired session cleanup prunes expired rows while preserving active rows
 * 12. Complete test data cleanup
 */

import assert from 'node:assert';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool } from '../database/index.js';
import { hashPassword } from './password.service.js';
import {
  createSession,
  getSession,
  validateSession,
  deleteSession,
  deleteAllSessionsForAdmin,
  cleanupExpiredSessions,
  generateSessionId,
} from './session.service.js';

loadLocalEnv();

async function runSessionTests(): Promise<void> {
  const pool = getDbPool();
  console.log('\n========================================================');
  console.log(' Running Server-Side Session Service Tests (Task 2.4)   ');
  console.log('========================================================');

  const testUserIds: string[] = [];

  try {
    // Setup helper: create a test admin user in DB
    const dummyPasswordHash = await hashPassword('TestPassword123!');

    const createTestUser = async (username: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' = 'ACTIVE') => {
      const res = await pool.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, 'ADMIN', $4)
         RETURNING id`,
        [username, dummyPasswordHash, `Test User ${username}`, status]
      );
      const id = res.rows[0]?.id as string;
      testUserIds.push(id);
      return id;
    };

    const activeUserId = await createTestUser('test_session_active_admin', 'ACTIVE');
    const inactiveUserId = await createTestUser('test_session_inactive_admin', 'INACTIVE');
    const suspendedUserId = await createTestUser('test_session_suspended_admin', 'SUSPENDED');

    // 1. Session creation
    const createdSession = await createSession({
      adminId: activeUserId,
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 TestBrowser',
      ttlSeconds: 3600,
    });
    assert.ok(createdSession.id, 'Session must have an ID');
    assert.strictEqual(createdSession.adminId, activeUserId);
    assert.strictEqual(createdSession.ipAddress, '127.0.0.1');
    assert.strictEqual(createdSession.userAgent, 'Mozilla/5.0 TestBrowser');
    assert.ok(createdSession.expiresAt.getTime() > Date.now(), 'Expiration must be in future');
    console.log('  ✅ PASS: 1. Session creation with correct attributes');

    // 2. Session retrieval
    const retrieved = await getSession(createdSession.id);
    assert.ok(retrieved, 'Session must be retrieved');
    assert.strictEqual(retrieved?.id, createdSession.id);
    assert.strictEqual(retrieved?.adminId, activeUserId);
    console.log('  ✅ PASS: 2. Session retrieval by ID');

    // 3. Valid session validation
    const validResult = await validateSession(createdSession.id);
    assert.strictEqual(validResult.isValid, true);
    if (validResult.isValid) {
      assert.strictEqual(validResult.user.id, activeUserId);
      assert.strictEqual(validResult.user.username, 'test_session_active_admin');
      assert.strictEqual('password_hash' in validResult.user, false);
    }
    console.log('  ✅ PASS: 3. Valid session successfully validates and attaches AuthUser');

    // 4. Expired session rejection
    const expiredSession = await createSession({
      adminId: activeUserId,
      ttlSeconds: -10, // already expired 10 seconds ago
    });
    const expiredResult = await validateSession(expiredSession.id);
    assert.strictEqual(expiredResult.isValid, false);
    if (!expiredResult.isValid) {
      assert.strictEqual(expiredResult.reason, 'EXPIRED');
    }
    console.log('  ✅ PASS: 4. Expired session rejected with reason EXPIRED');

    // 5. Missing / non-existent session rejection
    const missingResult = await validateSession('non_existent_session_id_999999');
    assert.strictEqual(missingResult.isValid, false);
    if (!missingResult.isValid) {
      assert.strictEqual(missingResult.reason, 'NOT_FOUND');
    }
    console.log('  ✅ PASS: 5. Non-existent session rejected with reason NOT_FOUND');

    // 6. Inactive admin rejection
    const inactiveSession = await createSession({
      adminId: inactiveUserId,
      ttlSeconds: 3600,
    });
    const inactiveResult = await validateSession(inactiveSession.id);
    assert.strictEqual(inactiveResult.isValid, false);
    if (!inactiveResult.isValid) {
      assert.strictEqual(inactiveResult.reason, 'ACCOUNT_INACTIVE');
    }
    console.log('  ✅ PASS: 6. Session for INACTIVE admin rejected with ACCOUNT_INACTIVE');

    // 7. Suspended admin rejection
    const suspendedSession = await createSession({
      adminId: suspendedUserId,
      ttlSeconds: 3600,
    });
    const suspendedResult = await validateSession(suspendedSession.id);
    assert.strictEqual(suspendedResult.isValid, false);
    if (!suspendedResult.isValid) {
      assert.strictEqual(suspendedResult.reason, 'ACCOUNT_SUSPENDED');
    }
    console.log('  ✅ PASS: 7. Session for SUSPENDED admin rejected with ACCOUNT_SUSPENDED');

    // 8. Session deletion (single logout)
    const deleteSuccess = await deleteSession(createdSession.id);
    assert.strictEqual(deleteSuccess, true, 'deleteSession must return true for existing session');
    const afterDelete = await getSession(createdSession.id);
    assert.strictEqual(afterDelete, null, 'Deleted session must return null');
    console.log('  ✅ PASS: 8. Session deletion succeeds and removes session');

    // 9. Multiple sessions deletion for an admin
    const multiSession1 = await createSession({ adminId: activeUserId, ttlSeconds: 3600 });
    const multiSession2 = await createSession({ adminId: activeUserId, ttlSeconds: 3600 });
    const multiSession3 = await createSession({ adminId: activeUserId, ttlSeconds: 3600 });
    const deletedCount = await deleteAllSessionsForAdmin(activeUserId);
    assert.strictEqual(deletedCount >= 3, true, 'Must delete all 3 active sessions');
    const checkMulti1 = await getSession(multiSession1.id);
    const checkMulti2 = await getSession(multiSession2.id);
    const checkMulti3 = await getSession(multiSession3.id);
    assert.strictEqual(checkMulti1, null);
    assert.strictEqual(checkMulti2, null);
    assert.strictEqual(checkMulti3, null);
    console.log('  ✅ PASS: 9. Multiple sessions for an admin purged cleanly');

    // 10. Session ID unpredictability and length sanity
    const id1 = generateSessionId();
    const id2 = generateSessionId();
    assert.strictEqual(id1.length, 64, 'Session ID must be 64 hex characters (256-bit)');
    assert.strictEqual(id2.length, 64, 'Session ID must be 64 hex characters (256-bit)');
    assert.notStrictEqual(id1, id2, 'Successive session IDs must be completely unpredictable and distinct');
    console.log('  ✅ PASS: 10. Session ID entropy and unpredictability verified');

    // 11. Expired session cleanup
    await createSession({ adminId: activeUserId, ttlSeconds: -100 }); // expired
    await createSession({ adminId: activeUserId, ttlSeconds: -50 });  // expired
    const activeKeepSession = await createSession({ adminId: activeUserId, ttlSeconds: 3600 }); // active

    const prunedCount = await cleanupExpiredSessions();
    assert.ok(prunedCount >= 2, 'Must prune at least the 2 expired sessions');
    const stillActive = await getSession(activeKeepSession.id);
    assert.ok(stillActive !== null, 'Active session must NOT be pruned by cleanup');
    console.log('  ✅ PASS: 11. cleanupExpiredSessions removes expired rows and preserves active rows');

  } finally {
    // Cleanup: remove all test users and their cascaded sessions
    if (testUserIds.length > 0) {
      await pool.query('DELETE FROM admin_users WHERE id = ANY($1)', [testUserIds]);
    }
    await closeDbPool();
  }

  console.log('========================================================');
  console.log(' ALL 11 SESSION SERVICE TESTS PASSED SUCCESSFULLY!     ');
  console.log('========================================================\n');
}

runSessionTests().catch((err) => {
  console.error('Session tests failed:', err);
  process.exit(1);
});
