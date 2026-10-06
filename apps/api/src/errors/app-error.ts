/**
 * Application Error Hierarchy
 *
 * Provides typed, operational error classes for domain, service, and repository layers.
 * These errors carry HTTP status codes, machine-readable error codes, and optional structured details,
 * allowing services to throw domain errors without depending on Express `res` or `req` objects.
 */

/**
 * Base application error.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 404 Not Found error.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details, true);
  }
}

/**
 * 400 Bad Request error.
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details, true);
  }
}

/**
 * 400 Validation/Invalid Input error.
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'INVALID_INPUT', details, true);
  }
}

/**
 * 401 Unauthorized / Unauthenticated error.
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(message, 401, 'UNAUTHENTICATED', details, true);
  }
}

/**
 * 403 Forbidden / Access Denied error.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied: insufficient permissions', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details, true);
  }
}

/**
 * 409 Conflict error (e.g. duplicate key, state transition conflict).
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource state conflict', details?: unknown) {
    super(message, 409, 'CONFLICT', details, true);
  }
}

/**
 * 500 Internal Server Error (non-operational unexpected system error).
 */
export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred', details?: unknown) {
    super(message, 500, 'INTERNAL_ERROR', details, false);
  }
}

/**
 * Type guard to check if an unknown value is an instance of `AppError`.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
