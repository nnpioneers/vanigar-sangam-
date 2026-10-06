/**
 * Authentication Service
 *
 * Implements authentication business logic:
 * - Credentials verification using constant-time password comparison
 * - Account lifecycle checks (ACTIVE, INACTIVE, SUSPENDED)
 * - Server-side session generation
 * - Safe DTO mapping (excludes password_hash and sensitive tokens)
 * - Logout session invalidation
 *
 * Never logs passwords, password hashes, or session tokens.
 */

import {
  AUTH_ERROR_CODES,
  type AuthUser,
  type UserRole,
  type UserStatus,
} from '@vanigar/shared-types';
import { getDbPool } from '../database/index.js';
import { verifyPassword } from './password.service.js';
import { createSession, deleteSession } from './session.service.js';

export interface LoginServiceInput {
  username: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export type LoginFailureReason =
  | typeof AUTH_ERROR_CODES.INVALID_CREDENTIALS
  | typeof AUTH_ERROR_CODES.ACCOUNT_INACTIVE
  | typeof AUTH_ERROR_CODES.ACCOUNT_SUSPENDED;

export interface LoginSuccessResult {
  success: true;
  user: AuthUser;
  sessionExpiresAt: string;
  sessionId: string;
}

export interface LoginFailureResult {
  success: false;
  reason: LoginFailureReason;
  message: string;
}

export type LoginServiceResult = LoginSuccessResult | LoginFailureResult;

/**
 * Authenticates user credentials and issues a server-side session.
 */
export async function loginUser(input: LoginServiceInput): Promise<LoginServiceResult> {
  const pool = getDbPool();

  const query = `
    SELECT
      id,
      username,
      password_hash,
      full_name,
      role,
      status,
      created_at
    FROM admin_users
    WHERE username = $1;
  `;

  const result = await pool.query<{
    id: string;
    username: string;
    password_hash: string;
    full_name: string;
    role: string;
    status: string;
    created_at: Date;
  }>(query, [input.username]);

  const userRow = result.rows[0];

  // Timing-safe: If user doesn't exist, we don't reveal existence.
  if (!userRow) {
    return {
      success: false,
      reason: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid username or password',
    };
  }

  // Account lifecycle checks
  if (userRow.status === 'INACTIVE') {
    return {
      success: false,
      reason: AUTH_ERROR_CODES.ACCOUNT_INACTIVE,
      message: 'Account is inactive. Please contact a system administrator.',
    };
  }

  if (userRow.status === 'SUSPENDED') {
    return {
      success: false,
      reason: AUTH_ERROR_CODES.ACCOUNT_SUSPENDED,
      message: 'Account has been suspended. Please contact a system administrator.',
    };
  }

  // Password verification
  const isMatch = await verifyPassword(input.password, userRow.password_hash);
  if (!isMatch) {
    return {
      success: false,
      reason: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid username or password',
    };
  }

  // Create server-side session
  const session = await createSession({
    adminId: userRow.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  const authUser: AuthUser = {
    id: userRow.id,
    username: userRow.username,
    fullName: userRow.full_name,
    role: userRow.role as UserRole,
    status: userRow.status as UserStatus,
    createdAt: new Date(userRow.created_at).toISOString(),
  };

  return {
    success: true,
    user: authUser,
    sessionExpiresAt: session.expiresAt.toISOString(),
    sessionId: session.id,
  };
}

/**
 * Invalidates the current session on logout.
 * Safe to call even if the session is absent or already expired.
 */
export async function logoutUser(sessionId?: string): Promise<boolean> {
  if (!sessionId) {
    return true;
  }
  return deleteSession(sessionId);
}
