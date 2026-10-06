/**
 * Automated Test Suite for Authentication & Role Middleware (Task 2.5)
 *
 * Verifies:
 * 1. Missing cookie rejects with 401 UNAUTHENTICATED
 * 2. Invalid / non-existent session cookie rejects with 401 UNAUTHENTICATED
 * 3. Expired session cookie rejects with 401 SESSION_EXPIRED
 * 4. Inactive user session rejects with 403 ACCOUNT_INACTIVE
 * 5. Suspended user session rejects with 403 ACCOUNT_SUSPENDED
 * 6. Valid session attaches safe RequestAuthContext to req.auth and req.user
 * 7. requireRole allows authorized role
 * 8. requireRole rejects unauthorized role with 403 FORBIDDEN
 * 9. Session cookie parser extracts vs_session accurately
 */

import assert from 'node:assert';
import type { Request, Response, NextFunction } from 'express';
import { loadLocalEnv } from '@vanigar/config';
import { AUTH_ERROR_CODES } from '@vanigar/shared-types';
import { getDbPool, closeDbPool } from '../database/index.js';
import { hashPassword } from '../services/password.service.js';
import { createSession } from '../services/session.service.js';
import {
  extractSessionCookie,
  requireAuth,
  requireRole,
} from './auth.middleware.js';

loadLocalEnv();

interface JsonErrorPayload {
  error: {
    code: string;
    message: string;
  };
}

interface MockResponse {
  statusCode: number;
  jsonData: unknown;
  status(code: number): MockResponse;
  json(data: unknown): MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    jsonData: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
}

function getJsonError(res: MockResponse): JsonErrorPayload {
  return res.jsonData as JsonErrorPayload;
}

async function runMiddlewareTests(): Promise<void> {
  const pool = getDbPool();
  console.log('\n========================================================');
  console.log(' Running Auth & Role Middleware Tests (Task 2.5)        ');
  console.log('========================================================');

  const testUserIds: string[] = [];

  try {
    const dummyHash = await hashPassword('MiddlewarePass123!');

    const createAdmin = async (username: string, role: 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER', status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') => {
      const res = await pool.query<{ id: string }>(
        `INSERT INTO admin_users (username, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [username, dummyHash, `Name ${username}`, role, status]
      );
      const id = res.rows[0]?.id as string;
      testUserIds.push(id);
      return id;
    };

    const _cashierId = await createAdmin('test_mid_cashier', 'CASHIER', 'ACTIVE');
    const adminId = await createAdmin('test_mid_admin', 'ADMIN', 'ACTIVE');
    const inactiveId = await createAdmin('test_mid_inactive', 'ADMIN', 'INACTIVE');
    const suspendedId = await createAdmin('test_mid_suspended', 'ADMIN', 'SUSPENDED');

    // 1. Missing cookie rejects with 401 UNAUTHENTICATED
    const req1 = { headers: {} } as Request;
    const res1 = createMockResponse();
    let nextCalled1 = false;
    await requireAuth(req1, res1 as unknown as Response, (() => { nextCalled1 = true; }) as NextFunction);
    assert.strictEqual(nextCalled1, false);
    assert.strictEqual(res1.statusCode, 401);
    assert.strictEqual(getJsonError(res1).error.code, AUTH_ERROR_CODES.UNAUTHENTICATED);
    console.log('  ✅ PASS: 1. Missing cookie rejects with 401 UNAUTHENTICATED');

    // 2. Invalid session cookie rejects with 401 UNAUTHENTICATED
    const req2 = { headers: { cookie: 'vs_session=invalid_non_existent_token_123' } } as unknown as Request;
    const res2 = createMockResponse();
    let nextCalled2 = false;
    await requireAuth(req2, res2 as unknown as Response, (() => { nextCalled2 = true; }) as NextFunction);
    assert.strictEqual(nextCalled2, false);
    assert.strictEqual(res2.statusCode, 401);
    assert.strictEqual(getJsonError(res2).error.code, AUTH_ERROR_CODES.UNAUTHENTICATED);
    console.log('  ✅ PASS: 2. Invalid session token rejects with 401 UNAUTHENTICATED');

    // 3. Expired session rejects with 401 SESSION_EXPIRED
    const expiredSession = await createSession({ adminId, ttlSeconds: -10 });
    const req3 = { headers: { cookie: `vs_session=${expiredSession.id}` } } as unknown as Request;
    const res3 = createMockResponse();
    let nextCalled3 = false;
    await requireAuth(req3, res3 as unknown as Response, (() => { nextCalled3 = true; }) as NextFunction);
    assert.strictEqual(nextCalled3, false);
    assert.strictEqual(res3.statusCode, 401);
    assert.strictEqual(getJsonError(res3).error.code, AUTH_ERROR_CODES.SESSION_EXPIRED);
    console.log('  ✅ PASS: 3. Expired session rejects with 401 SESSION_EXPIRED');

    // 4. Inactive user session rejects with 403 ACCOUNT_INACTIVE
    const inactiveSession = await createSession({ adminId: inactiveId, ttlSeconds: 3600 });
    const req4 = { headers: { cookie: `vs_session=${inactiveSession.id}` } } as unknown as Request;
    const res4 = createMockResponse();
    let nextCalled4 = false;
    await requireAuth(req4, res4 as unknown as Response, (() => { nextCalled4 = true; }) as NextFunction);
    assert.strictEqual(nextCalled4, false);
    assert.strictEqual(res4.statusCode, 403);
    assert.strictEqual(getJsonError(res4).error.code, AUTH_ERROR_CODES.ACCOUNT_INACTIVE);
    console.log('  ✅ PASS: 4. Inactive user session rejects with 403 ACCOUNT_INACTIVE');

    // 5. Suspended user session rejects with 403 ACCOUNT_SUSPENDED
    const suspendedSession = await createSession({ adminId: suspendedId, ttlSeconds: 3600 });
    const req5 = { headers: { cookie: `vs_session=${suspendedSession.id}` } } as unknown as Request;
    const res5 = createMockResponse();
    let nextCalled5 = false;
    await requireAuth(req5, res5 as unknown as Response, (() => { nextCalled5 = true; }) as NextFunction);
    assert.strictEqual(nextCalled5, false);
    assert.strictEqual(res5.statusCode, 403);
    assert.strictEqual(getJsonError(res5).error.code, AUTH_ERROR_CODES.ACCOUNT_SUSPENDED);
    console.log('  ✅ PASS: 5. Suspended user session rejects with 403 ACCOUNT_SUSPENDED');

    // 6. Valid session attaches safe context to req.auth & req.user
    const validSession = await createSession({ adminId, ttlSeconds: 3600 });
    const req6 = { headers: { cookie: `other=123; vs_session=${validSession.id}; tracking=abc` } } as unknown as Request;
    const res6 = createMockResponse();
    let nextCalled6 = false;
    await requireAuth(req6, res6 as unknown as Response, (() => { nextCalled6 = true; }) as NextFunction);
    assert.strictEqual(nextCalled6, true);
    assert.ok(req6.auth);
    assert.strictEqual(req6.auth.id, adminId);
    assert.strictEqual(req6.auth.username, 'test_mid_admin');
    assert.strictEqual(req6.auth.role, 'ADMIN');
    assert.strictEqual(req6.auth.status, 'ACTIVE');
    assert.strictEqual(req6.user, req6.auth);
    console.log('  ✅ PASS: 6. Valid session successfully attaches safe RequestAuthContext');

    // 7. requireRole allows authorized role
    const guardAdmin = requireRole('ADMIN', 'SUPER_ADMIN');
    let nextRoleAllowed = false;
    const res7 = createMockResponse();
    guardAdmin(req6, res7 as unknown as Response, (() => { nextRoleAllowed = true; }) as NextFunction);
    assert.strictEqual(nextRoleAllowed, true);
    console.log('  ✅ PASS: 7. requireRole allows authorized role');

    // 8. requireRole rejects unauthorized role with 403 FORBIDDEN
    const guardSuperOnly = requireRole('SUPER_ADMIN');
    let nextRoleForbidden = false;
    const res8 = createMockResponse();
    guardSuperOnly(req6, res8 as unknown as Response, (() => { nextRoleForbidden = true; }) as NextFunction);
    assert.strictEqual(nextRoleForbidden, false);
    assert.strictEqual(res8.statusCode, 403);
    assert.strictEqual(getJsonError(res8).error.code, AUTH_ERROR_CODES.FORBIDDEN);
    console.log('  ✅ PASS: 8. requireRole rejects unauthorized role with 403 FORBIDDEN');

    // 9. extractSessionCookie parses cookie string correctly
    const cookieString = 'session=wrong; vs_session=secret_token_val_456; other=foo';
    const parsedToken = extractSessionCookie({ headers: { cookie: cookieString } } as Request);
    assert.strictEqual(parsedToken, 'secret_token_val_456');
    console.log('  ✅ PASS: 9. extractSessionCookie extracts token correctly from multiple cookies');

  } finally {
    if (testUserIds.length > 0) {
      await pool.query('DELETE FROM admin_users WHERE id = ANY($1)', [testUserIds]);
    }
    await closeDbPool();
  }

  console.log('========================================================');
  console.log(' ALL 9 AUTH & ROLE MIDDLEWARE TESTS PASSED!            ');
  console.log('========================================================\n');
}

runMiddlewareTests().catch((err) => {
  console.error('Middleware tests failed:', err);
  process.exit(1);
});
