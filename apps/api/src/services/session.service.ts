/**
 * Server-Side Session Service
 *
 * Responsible for complete lifecycle management of server-side sessions:
 * - Cryptographic session token generation (256-bit entropy)
 * - Session creation, retrieval, validation, and deletion
 * - Active admin verification (rejects INACTIVE and SUSPENDED accounts)
 * - Expired session cleanup
 *
 * Never logs session tokens or credentials.
 */

import { randomBytes } from 'node:crypto';
import { readIntEnv } from '@vanigar/config';
import type { AuthUser, UserRole, UserStatus } from '@vanigar/shared-types';
import { getDbPool } from '../database/index.js';

export interface SessionRecord {
  id: string;
  adminId: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface CreateSessionInput {
  adminId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  ttlSeconds?: number;
}

export type SessionValidationFailureReason =
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'ACCOUNT_INACTIVE'
  | 'ACCOUNT_SUSPENDED'
  | 'INVALID_STATUS';

export interface SessionValidationSuccess {
  isValid: true;
  user: AuthUser;
  session: SessionRecord;
}

export interface SessionValidationFailure {
  isValid: false;
  reason: SessionValidationFailureReason;
}

export type SessionValidationResult = SessionValidationSuccess | SessionValidationFailure;

/** Default session time-to-live: 24 hours (86,400 seconds) */
export const DEFAULT_SESSION_TTL_SECONDS = 86400;

/**
 * Reads the configured session TTL in seconds from `SESSION_TTL_SECONDS`
 * environment variable or falls back to default 86,400 (24h).
 */
export function getSessionTtlSeconds(): number {
  return readIntEnv('SESSION_TTL_SECONDS', DEFAULT_SESSION_TTL_SECONDS);
}

/**
 * Generates an unpredictable, cryptographically secure 256-bit random session ID (64 hex characters).
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Creates and persists a new server-side session in PostgreSQL.
 * Uses parameterized SQL only and computes expiration from TTL.
 */
export async function createSession(input: CreateSessionInput): Promise<SessionRecord> {
  const pool = getDbPool();
  const sessionId = generateSessionId();
  const ttl = input.ttlSeconds ?? getSessionTtlSeconds();
  const expiresAt = new Date(Date.now() + ttl * 1000);

  const query = `
    INSERT INTO sessions (
      id,
      admin_id,
      ip_address,
      user_agent,
      expires_at,
      created_at,
      last_activity_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING
      id,
      admin_id,
      ip_address,
      user_agent,
      expires_at,
      created_at,
      last_activity_at;
  `;

  const values = [
    sessionId,
    input.adminId,
    input.ipAddress ?? null,
    input.userAgent ?? null,
    expiresAt.toISOString(),
  ];

  const result = await pool.query<{
    id: string;
    admin_id: string;
    ip_address: string | null;
    user_agent: string | null;
    expires_at: Date;
    created_at: Date;
    last_activity_at: Date;
  }>(query, values);

  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create session record.');
  }

  return {
    id: row.id,
    adminId: row.admin_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at),
    lastActivityAt: new Date(row.last_activity_at),
  };
}

/**
 * Retrieves a session record by its session ID.
 */
export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  if (!sessionId || typeof sessionId !== 'string') {
    return null;
  }

  const pool = getDbPool();
  const query = `
    SELECT
      id,
      admin_id,
      ip_address,
      user_agent,
      expires_at,
      created_at,
      last_activity_at
    FROM sessions
    WHERE id = $1;
  `;

  const result = await pool.query<{
    id: string;
    admin_id: string;
    ip_address: string | null;
    user_agent: string | null;
    expires_at: Date;
    created_at: Date;
    last_activity_at: Date;
  }>(query, [sessionId]);

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    adminId: row.admin_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at),
    lastActivityAt: new Date(row.last_activity_at),
  };
}

/**
 * Validates a session by ID against PostgreSQL:
 * 1. Checks session existence.
 * 2. Checks absolute expiration (`expires_at > NOW()`).
 * 3. Checks that the admin user exists.
 * 4. Strictly validates admin status is 'ACTIVE' (rejects 'INACTIVE' and 'SUSPENDED').
 * 5. Updates `last_activity_at` on successful validation.
 */
export async function validateSession(sessionId: string): Promise<SessionValidationResult> {
  if (!sessionId || typeof sessionId !== 'string') {
    return { isValid: false, reason: 'NOT_FOUND' };
  }

  const pool = getDbPool();
  const query = `
    SELECT
      s.id AS session_id,
      s.admin_id,
      s.ip_address,
      s.user_agent,
      s.expires_at,
      s.created_at AS session_created_at,
      s.last_activity_at,
      u.id AS user_id,
      u.username,
      u.full_name,
      u.role,
      u.status,
      u.created_at AS user_created_at
    FROM sessions s
    JOIN admin_users u ON s.admin_id = u.id
    WHERE s.id = $1;
  `;

  const result = await pool.query<{
    session_id: string;
    admin_id: string;
    ip_address: string | null;
    user_agent: string | null;
    expires_at: Date;
    session_created_at: Date;
    last_activity_at: Date;
    user_id: string;
    username: string;
    full_name: string;
    role: string;
    status: string;
    user_created_at: Date;
  }>(query, [sessionId]);

  const row = result.rows[0];
  if (!row) {
    return { isValid: false, reason: 'NOT_FOUND' };
  }

  const now = Date.now();
  const expiresAtMs = new Date(row.expires_at).getTime();

  if (expiresAtMs <= now) {
    return { isValid: false, reason: 'EXPIRED' };
  }

  if (row.status === 'INACTIVE') {
    return { isValid: false, reason: 'ACCOUNT_INACTIVE' };
  }

  if (row.status === 'SUSPENDED') {
    return { isValid: false, reason: 'ACCOUNT_SUSPENDED' };
  }

  if (row.status !== 'ACTIVE') {
    return { isValid: false, reason: 'INVALID_STATUS' };
  }

  // Throttle updates: only update last_activity_at if it's older than 60 seconds
  // Atomic PostgreSQL condition prevents concurrent requests from causing row-lock traffic jams.
  const lastActivityMs = new Date(row.last_activity_at).getTime();
  if (now - lastActivityMs > 60000) {
    try {
      await pool.query(
        "UPDATE sessions SET last_activity_at = NOW() WHERE id = $1 AND last_activity_at < NOW() - INTERVAL '60 seconds'",
        [sessionId]
      );
    } catch (err) {
      process.stderr.write(`[sessionService] failed to update last_activity_at: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  const user: AuthUser = {
    id: row.user_id,
    username: row.username,
    fullName: row.full_name,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    createdAt: new Date(row.user_created_at).toISOString(),
  };

  const session: SessionRecord = {
    id: row.session_id,
    adminId: row.admin_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.session_created_at),
    lastActivityAt: new Date(row.last_activity_at),
  };

  return {
    isValid: true,
    user,
    session,
  };
}

/**
 * Deletes a session by session ID.
 * Returns true if a row was deleted, false if not found.
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }

  const pool = getDbPool();
  const query = 'DELETE FROM sessions WHERE id = $1;';
  const result = await pool.query(query, [sessionId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Deletes all active sessions for a given administrator (e.g. upon password reset or admin revoke).
 * Returns the number of sessions deleted.
 */
export async function deleteAllSessionsForAdmin(adminId: string): Promise<number> {
  if (!adminId || typeof adminId !== 'string') {
    return 0;
  }

  const pool = getDbPool();
  const query = 'DELETE FROM sessions WHERE admin_id = $1;';
  const result = await pool.query(query, [adminId]);
  return result.rowCount ?? 0;
}

/**
 * Removes expired sessions whose `expires_at` is in the past.
 * Returns the number of pruned sessions.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const pool = getDbPool();
  const query = 'DELETE FROM sessions WHERE expires_at <= NOW();';
  const result = await pool.query(query);
  return result.rowCount ?? 0;
}
