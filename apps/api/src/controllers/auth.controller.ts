/**
 * Authentication Controllers
 *
 * Implements HTTP handlers for:
 * - POST /api/v1/auth/login
 * - GET  /api/v1/auth/me
 * - POST /api/v1/auth/logout
 *
 * Uses standardized envelopes (ApiSuccessResponse / ApiErrorResponse).
 * Never exposes passwords, password hashes, or session tokens in JSON responses.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  AUTH_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type AuthSessionResponse,
  type CurrentUserResponse,
  type LogoutResponse,
  type AuthUser,
} from '@vanigar/shared-types';
import { validateLoginPayload } from '@vanigar/validation';
import {
  clearSessionCookie,
  extractSessionCookie,
  setSessionCookie,
} from '../middleware/auth.middleware.js';
import { loginUser, logoutUser } from '../services/auth.service.js';

/**
 * POST /api/v1/auth/login
 * Authenticates user credentials, generates server-side session,
 * sets HTTP-only cookie, and returns safe user profile.
 */
export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validation = validateLoginPayload(req.body);
    if (!validation.isValid || !validation.data) {
      res.status(400).json(
        createErrorResponse('INVALID_INPUT', 'Validation failed', {
          errors: validation.errors,
        })
      );
      return;
    }

    const { username, password } = validation.data;
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;

    const result = await loginUser({
      username,
      password,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      switch (result.reason) {
        case AUTH_ERROR_CODES.ACCOUNT_INACTIVE:
          res.status(403).json(createErrorResponse(result.reason, result.message));
          return;
        case AUTH_ERROR_CODES.ACCOUNT_SUSPENDED:
          res.status(403).json(createErrorResponse(result.reason, result.message));
          return;
        case AUTH_ERROR_CODES.INVALID_CREDENTIALS:
        default:
          res.status(401).json(createErrorResponse(result.reason, result.message));
          return;
      }
    }

    // Set secure HTTP-only cookie containing session ID
    setSessionCookie(res, result.sessionId);

    // Return safe user information (strictly excluding session ID, passwords, and hashes)
    const responsePayload: AuthSessionResponse = {
      user: result.user,
      sessionExpiresAt: result.sessionExpiresAt,
    };

    res.status(200).json(createSuccessResponse(responsePayload));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Retrieves current authenticated user context from session.
 * Requires `requireAuth` guard.
 */
export async function meController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json(createErrorResponse(AUTH_ERROR_CODES.UNAUTHENTICATED, 'Authentication required'));
      return;
    }

    const safeUser: AuthUser = {
      id: req.auth.id,
      username: req.auth.username,
      fullName: req.auth.fullName,
      role: req.auth.role,
      status: req.auth.status,
      createdAt: req.auth.createdAt,
    };

    const responsePayload: CurrentUserResponse = {
      user: safeUser,
    };

    res.status(200).json(createSuccessResponse(responsePayload));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Deletes server-side session and clears HTTP-only session cookie.
 */
export async function logoutController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = extractSessionCookie(req);
    await logoutUser(sessionId);

    clearSessionCookie(res);

    const responsePayload: LogoutResponse = {
      success: true,
    };

    res.status(200).json(createSuccessResponse(responsePayload));
  } catch (err) {
    next(err);
  }
}
