/**
 * Global Error & 404 Handling Middleware
 *
 * Implements centralized error response processing:
 * - Maps `AppError` operational instances to their corresponding HTTP status codes and payloads
 * - Handles unexpected programmer/runtime errors with a standardized 500 envelope
 * - Strictly prevents leakage of stack traces, secrets, SQL statements, or database credentials
 * - Formats all error responses using `@vanigar/shared-types` `createErrorResponse`
 */

import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { createErrorResponse } from '@vanigar/shared-types';
import { SERVICE_NAME } from '../app-info.js';
import { isAppError } from '../errors/app-error.js';

/**
 * 404 Route Not Found handler.
 */
export const notFoundHandler: RequestHandler = (_req: Request, res: Response): void => {
  res.status(404).json(createErrorResponse('NOT_FOUND', 'Route not found'));
};

/**
 * Centralized Express global error handling middleware.
 */
export const globalErrorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const reqId = req.id ? `[${req.id}]` : '';

  // Operational domain/application error thrown intentionally by services
  if (isAppError(err) && err.isOperational) {
    res.status(err.statusCode).json(
      createErrorResponse(err.code, err.message, err.details)
    );
    return;
  }

  // Unexpected system / database / programming error
  const errorMessage = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[${SERVICE_NAME}] ${reqId} unhandled internal error: ${errorMessage}\n`);

  res.status(500).json(
    createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred')
  );
};
