/**
 * Base Controller Helpers
 *
 * Provides standardized response helpers for HTTP controllers.
 * Ensures consistent serialization adhering to `@vanigar/shared-types` contracts:
 * `{ data: T, error: null }` for success
 * `{ data: null, error: { code, message, details } }` for errors
 */

import type { Response } from 'express';
import {
  createSuccessResponse,
  createErrorResponse,
  type PaginationMeta,
  type PaginatedData,
} from '@vanigar/shared-types';

/**
 * Sends a successful JSON response with HTTP 200 (or custom status).
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json(createSuccessResponse(data));
}

/**
 * Sends a successful resource creation response with HTTP 201.
 */
export function sendCreated<T>(res: Response, data: T): void {
  res.status(201).json(createSuccessResponse(data));
}

/**
 * Sends an error JSON response with the given status code.
 */
export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: unknown
): void {
  res.status(statusCode).json(createErrorResponse(code, message, details));
}

/**
 * Sends a paginated JSON response with standard envelope and pagination metadata.
 */
export function sendPaginated<T>(
  res: Response,
  items: T[],
  pagination: PaginationMeta,
  statusCode = 200
): void {
  const payload: PaginatedData<T> = { items, pagination };
  res.status(statusCode).json(createSuccessResponse(payload));
}
