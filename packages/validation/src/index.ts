/**
 * `@vanigar/validation`
 *
 * Purpose: Reusable structural validation helpers shared across the API
 * (shape checks, non-empty strings, payload structural validation).
 *
 * Business validation (amounts, limits, eligibility, statuses, settlement
 * order) belongs in `@vanigar/rules` and application services.
 */

import type { FieldErrorDetail, LoginRequest } from '@vanigar/shared-types';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@vanigar/shared-types';

export const VALIDATION_PACKAGE_NAME = '@vanigar/validation';

/**
 * Checks if a value is a non-empty string (after trimming).
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates a username structurally (3-50 characters, alphanumeric, underscores, hyphens).
 */
export function isValidUsername(username: unknown): boolean {
  if (typeof username !== 'string') {
    return false;
  }
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 50) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Validates password structurally (string, minimum 8 characters, maximum 72 bytes).
 * Never logs or echoes the password.
 */
export function isValidPassword(password: unknown): boolean {
  if (typeof password !== 'string') {
    return false;
  }
  if (password.length < 8) {
    return false;
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return false;
  }
  return true;
}

/**
 * Checks whether an unknown value is a structurally valid UUID (v1-v5).
 */
export function isValidUuid(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

/**
 * Validates a path or query UUID identifier.
 */
export function validateUuidParam(paramValue: unknown, paramName = 'id'): ValidationResult<string> {
  if (!isNonEmptyString(paramValue)) {
    return {
      isValid: false,
      errors: [{ field: paramName, message: `${paramName} is required`, code: 'REQUIRED' }],
    };
  }
  const trimmed = paramValue.trim();
  if (!isValidUuid(trimmed)) {
    return {
      isValid: false,
      errors: [{ field: paramName, message: `${paramName} must be a valid UUID`, code: 'INVALID_FORMAT' }],
    };
  }
  return { isValid: true, errors: [], data: trimmed };
}

/**
 * Checks whether a value is a valid calendar date string in YYYY-MM-DD format.
 */
export function isValidIsoDate(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }
  const date = new Date(trimmed);
  return !isNaN(date.getTime()) && date.toISOString().startsWith(trimmed);
}

/**
 * Validates a calendar date parameter (YYYY-MM-DD).
 */
export function validateDateParam(value: unknown, fieldName = 'date'): ValidationResult<string> {
  if (!isNonEmptyString(value)) {
    return {
      isValid: false,
      errors: [{ field: fieldName, message: `${fieldName} is required`, code: 'REQUIRED' }],
    };
  }
  const trimmed = value.trim();
  if (!isValidIsoDate(trimmed)) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be a valid calendar date in YYYY-MM-DD format`,
          code: 'INVALID_DATE',
        },
      ],
    };
  }
  return { isValid: true, errors: [], data: trimmed };
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

/**
 * Validates and safely bounds pagination query parameters (page and pageSize).
 */
export function validatePaginationQuery(query: unknown): ValidationResult<PaginationOptions> {
  const errors: FieldErrorDetail[] = [];
  let page = DEFAULT_PAGE;
  let pageSize = DEFAULT_PAGE_SIZE;

  if (query && typeof query === 'object' && !Array.isArray(query)) {
    const record = query as Record<string, unknown>;

    if (record.page !== undefined && record.page !== null && record.page !== '') {
      const parsedPage = Number(record.page);
      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        errors.push({
          field: 'page',
          message: 'page must be a positive integer greater than or equal to 1',
          code: 'INVALID_PAGINATION',
        });
      } else {
        page = parsedPage;
      }
    }

    if (record.pageSize !== undefined && record.pageSize !== null && record.pageSize !== '') {
      const parsedPageSize = Number(record.pageSize);
      if (!Number.isInteger(parsedPageSize) || parsedPageSize < 1 || parsedPageSize > MAX_PAGE_SIZE) {
        errors.push({
          field: 'pageSize',
          message: `pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}`,
          code: 'INVALID_PAGINATION',
        });
      } else {
        pageSize = parsedPageSize;
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: { page, pageSize },
  };
}

/**
 * Sanitizes an array of validation errors to ensure sensitive fields never echo secrets or internal data.
 */
export function sanitizeValidationErrors(errors: FieldErrorDetail[]): FieldErrorDetail[] {
  return errors.map((err) => {
    const isSensitive = /password|secret|token|session|cookie/i.test(err.field);
    return {
      field: err.field,
      message: isSensitive ? 'Field value does not meet security requirements' : err.message,
      code: err.code,
    };
  });
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors: FieldErrorDetail[];
  data?: T;
}

/**
 * Validates login request payload structurally without logging sensitive credentials.
 */
export function validateLoginPayload(body: unknown): ValidationResult<LoginRequest> {
  const errors: FieldErrorDetail[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: [
        {
          field: 'body',
          message: 'Request body must be a valid JSON object',
          code: 'INVALID_BODY',
        },
      ],
    };
  }

  const record = body as Record<string, unknown>;

  if (typeof record.username !== 'string' || record.username.trim().length === 0) {
    errors.push({
      field: 'username',
      message: 'Username is required',
      code: 'REQUIRED',
    });
  } else if (!isValidUsername(record.username)) {
    errors.push({
      field: 'username',
      message: 'Username must be between 3 and 50 alphanumeric characters (or underscore, hyphen)',
      code: 'INVALID_FORMAT',
    });
  }

  if (typeof record.password !== 'string' || record.password.length === 0) {
    errors.push({
      field: 'password',
      message: 'Password is required',
      code: 'REQUIRED',
    });
  } else if (!isValidPassword(record.password)) {
    errors.push({
      field: 'password',
      message: 'Password must be at least 8 characters (maximum 72 bytes)',
      code: 'INVALID_LENGTH',
    });
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      username: (record.username as string).trim(),
      password: record.password as string,
    },
  };
}
