/**
 * Authentication API Client
 *
 * Dedicated typed functions for interacting with backend authentication endpoints:
 * - POST /api/v1/auth/login
 * - GET  /api/v1/auth/me
 * - POST /api/v1/auth/logout
 *
 * Relies exclusively on server-side HTTP-only cookies (`vs_session`).
 * Never handles, stores, or reads session IDs in JavaScript.
 */

import type {
  ApiSuccessResponse,
  AuthSessionResponse,
  CurrentUserResponse,
  LoginRequest,
  LogoutResponse,
} from '@vanigar/shared-types';
import { apiRequest } from './client';

/**
 * Submits administrator credentials to establish a server-side session.
 * The backend sets the `vs_session` HTTP-only cookie automatically.
 */
export async function login(
  credentials: LoginRequest
): Promise<ApiSuccessResponse<AuthSessionResponse>> {
  return apiRequest<ApiSuccessResponse<AuthSessionResponse>>('/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

/**
 * Retrieves the currently authenticated administrator profile from the active session.
 */
export async function getCurrentUser(): Promise<ApiSuccessResponse<CurrentUserResponse>> {
  return apiRequest<ApiSuccessResponse<CurrentUserResponse>>('/auth/me', {
    method: 'GET',
  });
}

/**
 * Terminates the active session and requests the server to clear the session cookie.
 */
export async function logout(): Promise<ApiSuccessResponse<LogoutResponse>> {
  return apiRequest<ApiSuccessResponse<LogoutResponse>>('/auth/logout', {
    method: 'POST',
  });
}
