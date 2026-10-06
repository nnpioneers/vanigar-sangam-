/**
 * Automated Test Suite for Error Handling & Boundaries (Phase 3.1)
 *
 * Verifies:
 * 1. AppError and domain subclass status codes and error codes
 * 2. isAppError type guard precision
 * 3. notFoundHandler standardized 404 envelope
 * 4. globalErrorHandler maps AppError to status code and envelope
 * 5. globalErrorHandler sanitizes unexpected errors to 500 without stack leakage
 */

import assert from 'node:assert';
import type { Request, Response, NextFunction } from 'express';
import {
  AppError,
  NotFoundError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalError,
  isAppError,
} from './app-error.js';
import type { ApiErrorResponse } from '@vanigar/shared-types';
import { notFoundHandler, globalErrorHandler } from '../middleware/error.middleware.js';

interface MockResponse {
  statusCode: number;
  jsonData: ApiErrorResponse | null;
  status(code: number): MockResponse;
  json(data: ApiErrorResponse): MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    jsonData: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: ApiErrorResponse) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
}

function runTests(): void {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Application Error & Boundary Tests (Phase 3.1) \n');
  process.stdout.write('========================================================\n');

  // Test 1: Class hierarchy and properties
  {
    const notFound = new NotFoundError('Member not found');
    assert.strictEqual(notFound.statusCode, 404);
    assert.strictEqual(notFound.code, 'NOT_FOUND');
    assert.strictEqual(notFound.message, 'Member not found');
    assert.strictEqual(notFound.isOperational, true);

    const badReq = new BadRequestError('Invalid sheet date');
    assert.strictEqual(badReq.statusCode, 400);
    assert.strictEqual(badReq.code, 'BAD_REQUEST');

    const valErr = new ValidationError('Payload invalid', [{ field: 'amount', message: 'Required' }]);
    assert.strictEqual(valErr.statusCode, 400);
    assert.strictEqual(valErr.code, 'INVALID_INPUT');
    assert.deepStrictEqual(valErr.details, [{ field: 'amount', message: 'Required' }]);

    const unauth = new UnauthorizedError();
    assert.strictEqual(unauth.statusCode, 401);
    assert.strictEqual(unauth.code, 'UNAUTHENTICATED');

    const forbid = new ForbiddenError();
    assert.strictEqual(forbid.statusCode, 403);
    assert.strictEqual(forbid.code, 'FORBIDDEN');

    const conflict = new ConflictError('Sheet already open');
    assert.strictEqual(conflict.statusCode, 409);
    assert.strictEqual(conflict.code, 'CONFLICT');

    const internal = new InternalError('Fatal connection crash');
    assert.strictEqual(internal.statusCode, 500);
    assert.strictEqual(internal.code, 'INTERNAL_ERROR');
    assert.strictEqual(internal.isOperational, false);

    process.stdout.write('  ✅ PASS: 1. AppError subclasses construct with expected codes and statuses\n');
  }

  // Test 2: isAppError type guard
  {
    assert.strictEqual(isAppError(new NotFoundError()), true);
    assert.strictEqual(isAppError(new AppError('Custom', 418, 'TEAPOT')), true);
    assert.strictEqual(isAppError(new Error('Standard Error')), false);
    assert.strictEqual(isAppError('A string error'), false);
    assert.strictEqual(isAppError(null), false);
    assert.strictEqual(isAppError({ statusCode: 400 }), false);

    process.stdout.write('  ✅ PASS: 2. isAppError accurately identifies operational domain errors\n');
  }

  // Test 3: notFoundHandler outputs standardized envelope
  {
    const req = {} as Request;
    const res = createMockResponse();

    const next: NextFunction = () => {};
    notFoundHandler(req, res as unknown as Response, next);

    assert.strictEqual(res.statusCode, 404);
    assert.ok(res.jsonData);
    assert.strictEqual(res.jsonData.data, null);
    assert.strictEqual(res.jsonData.error.code, 'NOT_FOUND');
    assert.strictEqual(res.jsonData.error.message, 'Route not found');

    process.stdout.write('  ✅ PASS: 3. notFoundHandler returns standard { data: null, error: ... } envelope\n');
  }

  // Test 4: globalErrorHandler handles operational AppError
  {
    const req = { id: 'test-req-123' } as Request;
    const res = createMockResponse();
    const next: NextFunction = () => {};

    const error = new ConflictError('Loan already active for member', { memberId: 'm-123' });
    globalErrorHandler(error, req, res as unknown as Response, next);

    assert.strictEqual(res.statusCode, 409);
    assert.ok(res.jsonData);
    assert.strictEqual(res.jsonData.data, null);
    assert.strictEqual(res.jsonData.error.code, 'CONFLICT');
    assert.strictEqual(res.jsonData.error.message, 'Loan already active for member');
    assert.deepStrictEqual(res.jsonData.error.details, { memberId: 'm-123' });

    process.stdout.write('  ✅ PASS: 4. globalErrorHandler formats operational AppError accurately\n');
  }

  // Test 5: globalErrorHandler sanitizes unexpected programmer errors
  {
    const req = { id: 'test-req-456' } as Request;
    const res = createMockResponse();
    const next: NextFunction = () => {};

    // Simulate unexpected database crash containing sensitive query text
    const sensitiveError = new Error('SELECT * FROM admin_users WHERE password_hash = "secret" FAILED: syntax error');
    globalErrorHandler(sensitiveError, req, res as unknown as Response, next);

    assert.strictEqual(res.statusCode, 500);
    assert.ok(res.jsonData);
    assert.strictEqual(res.jsonData.data, null);
    assert.strictEqual(res.jsonData.error.code, 'INTERNAL_ERROR');
    assert.strictEqual(res.jsonData.error.message, 'An unexpected error occurred');
    assert.strictEqual(res.jsonData.error.details, undefined, 'No details leaked to client');
    assert.strictEqual(
      JSON.stringify(res.jsonData).includes('password_hash'),
      false,
      'Sensitive info must never be returned to client'
    );

    process.stdout.write('  ✅ PASS: 5. globalErrorHandler masks internal errors and prevents info leakage\n');
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 5 ERROR & BOUNDARY TESTS PASSED SUCCESSFULLY!     \n');
  process.stdout.write('========================================================\n\n');
}

runTests();
