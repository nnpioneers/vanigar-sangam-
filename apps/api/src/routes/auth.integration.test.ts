/**
 * Automated HTTP Integration Test Suite for Auth API (Task 2.6)
 *
 * Verifies complete HTTP API flow over real HTTP server:
 *
 * LOGIN:
 * 1. Valid credentials succeed (HTTP 200)
 * 2. HTTP-only session cookie (vs_session) is set
 * 3. Response JSON strictly excludes session ID, password, and password_hash
 * 4. Invalid password returns 401 INVALID_CREDENTIALS
 * 5. Unknown username returns 401 INVALID_CREDENTIALS
 * 6. Inactive account returns 403 ACCOUNT_INACTIVE
 * 7. Suspended account returns 403 ACCOUNT_SUSPENDED
 * 8. Missing fields return 400 INVALID_INPUT
 *
 * CURRENT USER (/me):
 * 9. Authenticated request with session cookie succeeds (HTTP 200)
 * 10. Authenticated user DTO strictly excludes password_hash
 * 11. Request without cookie returns 401 UNAUTHENTICATED
 * 12. Request with forged/invalid cookie returns 401 UNAUTHENTICATED
 *
 * LOGOUT:
 * 13. Logout with valid cookie invalidates session in DB and clears cookie
 * 14. Subsequent /me request with previous cookie returns 401 UNAUTHENTICATED
 * 15. Idempotent logout (repeated logout without session) returns 200 success
 */

import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { loadLocalEnv } from '@vanigar/config';
import {
  AUTH_ERROR_CODES,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type AuthSessionResponse,
  type CurrentUserResponse,
  type LogoutResponse,
} from '@vanigar/shared-types';
import { createApp } from '../app.js';
import { getDbPool, closeDbPool } from '../database/index.js';
import { hashPassword } from '../services/password.service.js';
import { getSession } from '../services/session.service.js';

loadLocalEnv();

async function runAuthApiTests(): Promise<void> {
  const pool = getDbPool();
  console.log('\n========================================================');
  console.log(' Running Auth API HTTP Integration Tests (Task 2.6)     ');
  console.log('========================================================');

  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const testUserIds: string[] = [];
  const testPassword = 'SecureApiPassword123!';

  try {
    const passwordHash = await hashPassword(testPassword);

    const createTestUser = async (
      username: string,
      role: 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER',
      status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
    ) => {
      const res = await pool.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [username, passwordHash, `Name for ${username}`, role, status]
      );
      const id = res.rows[0]?.id as string;
      testUserIds.push(id);
      return id;
    };

    const activeAdminId = await createTestUser('api_test_active_admin', 'ADMIN', 'ACTIVE');
    await createTestUser('api_test_inactive_admin', 'ADMIN', 'INACTIVE');
    await createTestUser('api_test_suspended_admin', 'ADMIN', 'SUSPENDED');

    // ------------------------------------------------------------------------
    // LOGIN TESTS
    // ------------------------------------------------------------------------

    // 1. Valid credentials succeed
    const loginRes1 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'api_test_active_admin',
        password: testPassword,
      }),
    });

    assert.strictEqual(loginRes1.status, 200, 'Valid login should return HTTP 200');
    const loginBody1 = (await loginRes1.json()) as ApiSuccessResponse<AuthSessionResponse>;
    assert.strictEqual(loginBody1.error, null);
    assert.ok(loginBody1.data.user);
    assert.strictEqual(loginBody1.data.user.id, activeAdminId);
    assert.strictEqual(loginBody1.data.user.username, 'api_test_active_admin');
    assert.strictEqual(loginBody1.data.user.role, 'ADMIN');
    assert.strictEqual(loginBody1.data.user.status, 'ACTIVE');
    console.log('  ✅ PASS: 1. Valid credentials succeed with HTTP 200');

    // 2. HTTP-only session cookie (vs_session) is set
    const setCookieHeader = loginRes1.headers.get('set-cookie');
    assert.ok(setCookieHeader, 'Set-Cookie header must be present');
    assert.ok(setCookieHeader.includes('vs_session='), 'Must set vs_session cookie');
    assert.ok(setCookieHeader.toLowerCase().includes('httponly'), 'Cookie must be HttpOnly');
    assert.ok(setCookieHeader.toLowerCase().includes('samesite=lax'), 'Cookie must be SameSite=Lax');
    console.log('  ✅ PASS: 2. Set-Cookie sets vs_session with HttpOnly and SameSite=Lax');

    // 3. Response JSON strictly excludes session ID, password, and password_hash
    assert.strictEqual('sessionId' in loginBody1.data, false, 'sessionId must not be in response JSON');
    assert.strictEqual('password' in loginBody1.data.user, false, 'password must not be in response JSON');
    assert.strictEqual('password_hash' in loginBody1.data.user, false, 'password_hash must not be in response JSON');
    console.log('  ✅ PASS: 3. Response JSON strictly excludes session ID and password fields');

    // Extract cookie value for subsequent requests
    assert.ok(setCookieHeader);
    const match = setCookieHeader.match(/vs_session=([^;]+)/);
    assert.ok(match && match[1], 'Failed to extract vs_session from header');
    const validSessionCookie = `vs_session=${match[1]}`;
    const rawSessionId = match[1];

    // Verify session actually exists in database
    const dbSession = await getSession(rawSessionId);
    assert.ok(dbSession, 'Session row must exist in PostgreSQL sessions table');
    assert.strictEqual(dbSession.adminId, activeAdminId);

    // 4. Invalid password returns 401 INVALID_CREDENTIALS
    const loginRes2 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'api_test_active_admin',
        password: 'WrongPassword999!',
      }),
    });
    assert.strictEqual(loginRes2.status, 401);
    const loginBody2 = (await loginRes2.json()) as ApiErrorResponse;
    assert.strictEqual(loginBody2.error.code, AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    console.log('  ✅ PASS: 4. Invalid password returns 401 INVALID_CREDENTIALS');

    // 5. Unknown username returns 401 INVALID_CREDENTIALS
    const loginRes3 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'non_existent_username_xyz',
        password: testPassword,
      }),
    });
    assert.strictEqual(loginRes3.status, 401);
    const loginBody3 = (await loginRes3.json()) as ApiErrorResponse;
    assert.strictEqual(loginBody3.error.code, AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    console.log('  ✅ PASS: 5. Unknown username returns 401 INVALID_CREDENTIALS without revealing existence');

    // 6. Inactive account returns 403 ACCOUNT_INACTIVE
    const loginRes4 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'api_test_inactive_admin',
        password: testPassword,
      }),
    });
    assert.strictEqual(loginRes4.status, 403);
    const loginBody4 = (await loginRes4.json()) as ApiErrorResponse;
    assert.strictEqual(loginBody4.error.code, AUTH_ERROR_CODES.ACCOUNT_INACTIVE);
    console.log('  ✅ PASS: 6. Inactive account returns 403 ACCOUNT_INACTIVE');

    // 7. Suspended account returns 403 ACCOUNT_SUSPENDED
    const loginRes5 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'api_test_suspended_admin',
        password: testPassword,
      }),
    });
    assert.strictEqual(loginRes5.status, 403);
    const loginBody5 = (await loginRes5.json()) as ApiErrorResponse;
    assert.strictEqual(loginBody5.error.code, AUTH_ERROR_CODES.ACCOUNT_SUSPENDED);
    console.log('  ✅ PASS: 7. Suspended account returns 403 ACCOUNT_SUSPENDED');

    // 8. Missing / invalid structural fields return 400 INVALID_INPUT
    const loginRes6 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '',
        password: '',
      }),
    });
    assert.strictEqual(loginRes6.status, 400);
    const loginBody6 = (await loginRes6.json()) as ApiErrorResponse;
    assert.strictEqual(loginBody6.error.code, 'INVALID_INPUT');
    console.log('  ✅ PASS: 8. Missing or malformed credentials return 400 INVALID_INPUT');

    // ------------------------------------------------------------------------
    // CURRENT USER (/me) TESTS
    // ------------------------------------------------------------------------

    // 9. Authenticated request with session cookie succeeds (HTTP 200)
    const meRes1 = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: validSessionCookie },
    });
    assert.strictEqual(meRes1.status, 200);
    const meBody1 = (await meRes1.json()) as ApiSuccessResponse<CurrentUserResponse>;
    assert.strictEqual(meBody1.error, null);
    assert.strictEqual(meBody1.data.user.id, activeAdminId);
    assert.strictEqual(meBody1.data.user.username, 'api_test_active_admin');
    console.log('  ✅ PASS: 9. GET /api/v1/auth/me with valid session cookie succeeds');

    // 10. Authenticated user DTO strictly excludes password_hash
    assert.strictEqual('password_hash' in meBody1.data.user, false);
    assert.strictEqual('password' in meBody1.data.user, false);
    console.log('  ✅ PASS: 10. GET /api/v1/auth/me strictly excludes password_hash');

    // 11. Request without cookie returns 401 UNAUTHENTICATED
    const meRes2 = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert.strictEqual(meRes2.status, 401);
    const meBody2 = (await meRes2.json()) as ApiErrorResponse;
    assert.strictEqual(meBody2.error.code, AUTH_ERROR_CODES.UNAUTHENTICATED);
    console.log('  ✅ PASS: 11. GET /api/v1/auth/me without cookie returns 401 UNAUTHENTICATED');

    // 12. Request with forged cookie returns 401 UNAUTHENTICATED
    const meRes3 = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: 'vs_session=completely_forged_session_token_12345' },
    });
    assert.strictEqual(meRes3.status, 401);
    const meBody3 = (await meRes3.json()) as ApiErrorResponse;
    assert.strictEqual(meBody3.error.code, AUTH_ERROR_CODES.UNAUTHENTICATED);
    console.log('  ✅ PASS: 12. GET /api/v1/auth/me with forged cookie returns 401 UNAUTHENTICATED');

    // ------------------------------------------------------------------------
    // LOGOUT TESTS
    // ------------------------------------------------------------------------

    // 13. Logout with valid cookie invalidates session in DB and clears cookie
    const logoutRes1 = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Cookie: validSessionCookie },
    });
    assert.strictEqual(logoutRes1.status, 200);
    const logoutBody1 = (await logoutRes1.json()) as ApiSuccessResponse<LogoutResponse>;
    assert.strictEqual(logoutBody1.data.success, true);

    const logoutCookie = logoutRes1.headers.get('set-cookie');
    assert.ok(logoutCookie, 'Logout must send Set-Cookie header to clear cookie');
    assert.ok(
      logoutCookie.includes('Max-Age=0') || logoutCookie.includes('Expires=Thu, 01 Jan 1970'),
      'Cookie must be expired immediately'
    );

    const sessionAfterLogout = await getSession(rawSessionId);
    assert.strictEqual(sessionAfterLogout, null, 'Session must be deleted from database after logout');
    console.log('  ✅ PASS: 13. POST /api/v1/auth/logout invalidates session in DB and clears cookie');

    // 14. Subsequent /me request with previous cookie returns 401 UNAUTHENTICATED
    const meRes4 = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: validSessionCookie },
    });
    assert.strictEqual(meRes4.status, 401);
    console.log('  ✅ PASS: 14. Subsequent GET /api/v1/auth/me fails after logout');

    // 15. Idempotent logout (repeated logout without session) returns 200 success
    const logoutRes2 = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
    });
    assert.strictEqual(logoutRes2.status, 200);
    const logoutBody2 = (await logoutRes2.json()) as ApiSuccessResponse<LogoutResponse>;
    assert.strictEqual(logoutBody2.data.success, true);
    console.log('  ✅ PASS: 15. Idempotent logout without active session succeeds safely');

  } finally {
    server.close();
    if (testUserIds.length > 0) {
      await pool.query('DELETE FROM admin_users WHERE id = ANY($1)', [testUserIds]);
    }
    await closeDbPool();
  }

  console.log('========================================================');
  console.log(' ALL 15 AUTH API INTEGRATION TESTS PASSED!              ');
  console.log('========================================================\n');
}

runAuthApiTests().catch((err) => {
  console.error('Auth API integration tests failed:', err);
  process.exit(1);
});
