/**
 * Safe Frontend Error Handling Utilities
 *
 * Enforces strict security & UX boundaries:
 * 1. Never exposes stack traces, SQL errors, or internal diagnostics to users.
 * 2. Never exposes session tokens, cookies, passwords, or sensitive fields.
 * 3. Maps known backend/network error codes to localized translation keys.
 * 4. Logs diagnostic details strictly to the console in non-production environments.
 */

import { ApiRequestError } from './api/client';

export interface SafeUserError {
  code: string;
  messageKey: string;
  defaultMessage: string;
  status?: number;
}

const SENSITIVE_PATTERNS = [
  /vs_session/i,
  /cookie/i,
  /token/i,
  /password/i,
  /secret/i,
  /postgres/i,
  /sql/i,
  /column/i,
  /relation/i,
  /select\s+/i,
  /insert\s+/i,
  /update\s+/i,
  /delete\s+/i,
  /\bat\s+.*\(/i, // Stack trace lines
  /node_modules/i,
];

/**
 * Checks if a string contains internal or sensitive debugging information.
 */
export function containsSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Transforms an unknown error into a sanitized, user-safe error representation.
 */
export function toSafeUserError(error: unknown): SafeUserError {
  if (process.env.NODE_ENV === 'development') {
    // Technical console logging for developers in development only
    console.error('[Vanigar Sangam Error Diagnostic]:', error);
  }

  // 1. ApiRequestError from client.ts
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case 'NETWORK':
        return {
          code: 'NETWORK',
          messageKey: 'feedback.networkError',
          defaultMessage: 'Unable to reach the server. Please check your network connection.',
          status: 0,
        };
      case 'UNAUTHENTICATED':
      case 'SESSION_EXPIRED':
        return {
          code: 'UNAUTHENTICATED',
          messageKey: 'feedback.sessionExpired',
          defaultMessage: 'Your session has expired. Please sign in again to continue.',
          status: 401,
        };
      case 'FORBIDDEN':
      case 'ACCOUNT_INACTIVE':
      case 'ACCOUNT_SUSPENDED':
        return {
          code: 'FORBIDDEN',
          messageKey: 'feedback.accessDenied',
          defaultMessage: 'Access Denied. You do not have permission to access this resource.',
          status: 403,
        };
      case 'NOT_FOUND':
        return {
          code: 'NOT_FOUND',
          messageKey: 'feedback.notFound',
          defaultMessage: 'The requested resource was not found.',
          status: 404,
        };
      case 'INVALID_INPUT':
        return {
          code: 'INVALID_INPUT',
          messageKey: 'feedback.invalidInput',
          defaultMessage: 'Please review the highlighted input fields.',
          status: 400,
        };
      case 'CONFLICT':
        return {
          code: 'CONFLICT',
          messageKey: 'members.memberNumberAlreadyExists',
          defaultMessage: 'Member Number already exists.',
          status: 409,
        };
      default:
        if (error.status === 409) {
          return {
            code: 'CONFLICT',
            messageKey: 'members.memberNumberAlreadyExists',
            defaultMessage: 'Member Number already exists.',
            status: 409,
          };
        }
        // Check if error.message is safe to display or if it has sensitive tokens
        if (error.message && !containsSensitiveData(error.message)) {
          return {
            code: error.code || 'API_ERROR',
            messageKey: 'feedback.operationFailed',
            defaultMessage: error.message,
            status: error.status,
          };
        }
        return {
          code: error.code || 'API_ERROR',
          messageKey: 'feedback.unexpectedError',
          defaultMessage: 'An unexpected error occurred. Please try again.',
          status: error.status,
        };
    }
  }

  // 2. Standard JS Error
  if (error instanceof Error) {
    if (error.message && !containsSensitiveData(error.message)) {
      return {
        code: 'ERROR',
        messageKey: 'feedback.somethingWentWrong',
        defaultMessage: error.message,
      };
    }
  }

  // 3. Unknown primitive or object
  return {
    code: 'UNKNOWN',
    messageKey: 'feedback.unexpectedError',
    defaultMessage: 'An unexpected error occurred. Please try again.',
  };
}

/**
 * Resolves a safe user-facing message string using the translation function if provided.
 */
export function getSafeErrorMessage(
  error: unknown,
  t?: (key: string) => string
): string {
  const safeError = toSafeUserError(error);
  if (t) {
    const translated = t(safeError.messageKey);
    // If translation key resolved to a valid string, return it
    if (translated && translated !== safeError.messageKey) {
      return translated;
    }
  }
  return safeError.defaultMessage;
}
