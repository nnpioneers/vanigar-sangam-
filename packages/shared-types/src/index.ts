/**
 * `@vanigar/shared-types`
 *
 * Purpose: Reusable TypeScript type contracts shared between `@vanigar/api`
 * and `@vanigar/web` (Wire formats, API response envelopes, DTO structures,
 * authentication contracts).
 */

export const SHARED_TYPES_PACKAGE_NAME = '@vanigar/shared-types';

// ============================================================================
// 1. API RESPONSE ENVELOPES & PAGINATION CONTRACTS
// ============================================================================

/**
 * Standard API error detail structure.
 */
export interface ApiErrorDetail {
  /** Machine-readable error code (e.g., 'INVALID_INPUT', 'NOT_FOUND', 'UNAUTHORIZED') */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional structured detail payload (e.g. field errors array) */
  details?: unknown;
}

/**
 * Standard API success response envelope.
 */
export interface ApiSuccessResponse<T> {
  data: T;
  error: null;
}

/**
 * Standard API error response envelope.
 */
export interface ApiErrorResponse {
  data: null;
  error: ApiErrorDetail;
}

/**
 * Discriminated union of all API responses (Success or Error).
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Standard pagination metadata for lists.
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Standard query parameters for paginated list requests.
 */
export interface PaginationQuery {
  page?: number | string;
  pageSize?: number | string;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Container for paginated list payloads.
 */
export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Paginated API success response contract.
 */
export type PaginatedSuccessResponse<T> = ApiSuccessResponse<PaginatedData<T>>;

/**
 * Paginated API response union contract.
 */
export type PaginatedApiResponse<T> = PaginatedSuccessResponse<T> | ApiErrorResponse;

/**
 * Structured validation/field error detail entry.
 */
export interface FieldErrorDetail {
  field: string;
  message: string;
  code?: string;
}

/**
 * Standard payload for validation error response details.
 */
export interface ValidationErrorPayload {
  errors: FieldErrorDetail[];
}

/**
 * Factory helper for creating an ApiSuccessResponse object.
 */
export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return { data, error: null };
}

/**
 * Factory helper for creating an ApiErrorResponse object.
 */
export function createErrorResponse(code: string, message: string, details?: unknown): ApiErrorResponse {
  return {
    data: null,
    error: { code, message, details },
  };
}

/**
 * Type guard for success API response.
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.error === null && response.data !== null;
}

/**
 * Type guard for error API response.
 */
export function isErrorResponse<T>(response: ApiResponse<T>): response is ApiErrorResponse {
  return response.error !== null;
}

// ============================================================================
// 2. AUTHENTICATION CONTRACTS & ROLE DEFINITIONS
// ============================================================================

/**
 * Administrator roles for Role-Based Access Control (RBAC).
 */
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER';

/**
 * User account lifecycle status.
 */
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/**
 * Safe authenticated user object returned to frontend applications.
 * Password hash and sensitive tokens are strictly excluded.
 */
export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

/**
 * Login payload for `POST /api/v1/auth/login`.
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Successful authentication session payload returned upon login.
 */
export interface AuthSessionResponse {
  user: AuthUser;
  sessionExpiresAt: string;
}

/**
 * Response payload for `GET /api/v1/auth/me`.
 */
export interface CurrentUserResponse {
  user: AuthUser;
}

/**
 * Response payload for `POST /api/v1/auth/logout`.
 */
export interface LogoutResponse {
  success: boolean;
}

/**
 * Standard machine-readable authentication error codes.
 */
export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

// ============================================================================
// 3. COMMON API ERROR CODES
// ============================================================================

/**
 * Standard machine-readable application error codes.
 */
export const API_ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
