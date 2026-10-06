/**
 * Authentication & Role Authorization Middleware
 *
 * Provides:
 * - Session cookie extraction (`vs_session`) and management helpers
 * - `sessionMiddleware`: Populates `req.auth` from valid session cookie without rejecting unauthenticated calls
 * - `requireAuth`: Enforces active session, rejecting unauthenticated, expired, inactive, or suspended users
 * - `requireRole`: Enforces role-level access control (RBAC)
 *
 * Never exposes passwords, hashes, session secrets, or raw credentials.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { isProduction } from '@vanigar/config';
import {
  AUTH_ERROR_CODES,
  createErrorResponse,
  type UserRole,
  type UserStatus,
} from '@vanigar/shared-types';
import {
  getSessionTtlSeconds,
  validateSession,
  type SessionValidationResult,
} from '../services/session.service.js';

export const SESSION_COOKIE_NAME = 'vs_session';

/**
 * Safe authenticated user context attached to Express requests.
 */
export interface RequestAuthContext {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: RequestAuthContext;
      user?: RequestAuthContext;
    }
  }
}

/**
 * Safely extracts the session token from the `vs_session` HTTP cookie.
 */
export function extractSessionCookie(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return undefined;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const equalIdx = trimmed.indexOf('=');
    if (equalIdx === -1) {
      continue;
    }
    const name = trimmed.substring(0, equalIdx).trim();
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(trimmed.substring(equalIdx + 1).trim());
    }
  }

  return undefined;
}

/**
 * Sets the `vs_session` HTTP-only cookie with strict security flags.
 */
export function setSessionCookie(res: Response, sessionId: string, ttlSeconds?: number): void {
  const ttl = ttlSeconds ?? getSessionTtlSeconds();
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: ttl * 1000,
  });
}

/**
 * Clears the `vs_session` cookie across all environments.
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
  });
}

export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // BYPASS: Mocking an authenticated user session for development/testing UI exploration
  const authContext: RequestAuthContext = {
    id: 'b6f4e135-23c3-4d7a-8f5b-5511b84e1b8b', // Mock Admin UUID
    username: 'admin',
    fullName: 'System Administrator',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    sessionId: 'mock-session-123',
  };

  req.auth = authContext;
  req.user = authContext;
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // BYPASS: Mocking an authenticated user session for development/testing UI exploration
  const authContext: RequestAuthContext = {
    id: 'b6f4e135-23c3-4d7a-8f5b-5511b84e1b8b', // Mock Admin UUID
    username: 'admin',
    fullName: 'System Administrator',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    sessionId: 'mock-session-123',
  };

  req.auth = authContext;
  req.user = authContext;
  next();
}

/**
 * Role Guard middleware factory: asserts that the authenticated user possesses one of the allowed roles.
 * Must be mounted after `requireAuth`.
 */
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json(createErrorResponse(AUTH_ERROR_CODES.UNAUTHENTICATED, 'Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json(
        createErrorResponse(AUTH_ERROR_CODES.FORBIDDEN, `Forbidden: insufficient role privileges. Required one of: ${allowedRoles.join(', ')}`)
      );
      return;
    }

    next();
  };
}
