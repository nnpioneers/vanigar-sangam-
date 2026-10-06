/**
 * Request Validation Middleware & Assertion Utilities
 *
 * Enforces standardized validation boundaries on HTTP requests (params, query, body):
 * - Seamlessly converts ValidationResult failures into standardized 400 envelopes
 * - Sanitizes field errors to guarantee no secrets, tokens, or internal details leak
 * - Attaches validated, typed payloads to Express Request
 * - Provides assertValid() for controller-level functional validation
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createErrorResponse } from '@vanigar/shared-types';
import { sanitizeValidationErrors, type ValidationResult } from '@vanigar/validation';
import { ValidationError } from '../errors/app-error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validatedBody?: unknown;
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

/**
 * Asserts that a validation result is valid.
 * If valid, returns the typed data.
 * If invalid, throws an operational `ValidationError` carrying sanitized field errors.
 */
export function assertValid<T>(result: ValidationResult<T>): T {
  if (!result.isValid || result.data === undefined) {
    const sanitized = sanitizeValidationErrors(result.errors);
    throw new ValidationError('Validation failed', { errors: sanitized });
  }
  return result.data;
}

/**
 * Express middleware factory to validate the request body before reaching the controller.
 */
export function validateBody<T>(validator: (body: unknown) => ValidationResult<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validator(req.body);
    if (!result.isValid || result.data === undefined) {
      const sanitized = sanitizeValidationErrors(result.errors);
      res.status(400).json(
        createErrorResponse('INVALID_INPUT', 'Validation failed', { errors: sanitized })
      );
      return;
    }
    req.validatedBody = result.data;
    next();
  };
}

/**
 * Express middleware factory to validate query parameters before reaching the controller.
 */
export function validateQuery<T>(validator: (query: unknown) => ValidationResult<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validator(req.query);
    if (!result.isValid || result.data === undefined) {
      const sanitized = sanitizeValidationErrors(result.errors);
      res.status(400).json(
        createErrorResponse('INVALID_INPUT', 'Validation failed', { errors: sanitized })
      );
      return;
    }
    req.validatedQuery = result.data;
    next();
  };
}

/**
 * Express middleware factory to validate URL path parameters before reaching the controller.
 */
export function validateParams<T>(validator: (params: unknown) => ValidationResult<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validator(req.params);
    if (!result.isValid || result.data === undefined) {
      const sanitized = sanitizeValidationErrors(result.errors);
      res.status(400).json(
        createErrorResponse('INVALID_INPUT', 'Validation failed', { errors: sanitized })
      );
      return;
    }
    req.validatedParams = result.data;
    next();
  };
}
