/**
 * Automated Test Suite for Validation & API Contract Integration (Phase 3.4)
 *
 * Verifies:
 * 1. UUID path parameter validation (acceptance & rejection)
 * 2. Date parameter validation (YYYY-MM-DD calendar dates)
 * 3. Pagination query validation (defaults, parsing, bounds, rejection of negatives)
 * 4. Error sanitization (guarantees passwords/secrets are never echoed in errors)
 * 5. Functional assertValid() helper (throws ValidationError on invalid payload)
 * 6. Express validation middleware (validateBody, validateQuery, validateParams)
 * 7. Standardized API error envelope consistency
 */

import assert from 'node:assert';
import type { Request, Response, NextFunction } from 'express';
import {
  isValidUuid,
  validateUuidParam,
  isValidIsoDate,
  validateDateParam,
  validatePaginationQuery,
  sanitizeValidationErrors,
  type ValidationResult,
} from '@vanigar/validation';
import { API_ERROR_CODES, type ApiErrorResponse } from '@vanigar/shared-types';
import {
  assertValid,
  validateBody,
  validateQuery,
  validateParams,
} from './validation.middleware.js';
import { ValidationError } from '../errors/app-error.js';

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
  process.stdout.write(' Running Validation & API Contract Tests (Phase 3.4)    \n');
  process.stdout.write('========================================================\n');

  // Test 1: UUID path parameter validation
  {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    assert.strictEqual(isValidUuid(validUuid), true);

    const validRes = validateUuidParam(validUuid, 'memberId');
    assert.strictEqual(validRes.isValid, true);
    assert.strictEqual(validRes.data, validUuid);

    const invalidRes1 = validateUuidParam('not-a-uuid', 'memberId');
    assert.strictEqual(invalidRes1.isValid, false);
    assert.strictEqual(invalidRes1.errors[0]?.code, 'INVALID_FORMAT');

    const invalidRes2 = validateUuidParam('', 'memberId');
    assert.strictEqual(invalidRes2.isValid, false);
    assert.strictEqual(invalidRes2.errors[0]?.code, 'REQUIRED');

    process.stdout.write('  ✅ PASS: 1. UUID path parameter validation accepts valid UUIDs and rejects malformed IDs\n');
  }

  // Test 2: Calendar date parameter validation (YYYY-MM-DD)
  {
    assert.strictEqual(isValidIsoDate('2026-10-03'), true);
    assert.strictEqual(isValidIsoDate('2026-02-28'), true);
    assert.strictEqual(isValidIsoDate('2026-02-31'), false, 'Non-existent calendar date must be rejected');
    assert.strictEqual(isValidIsoDate('10-03-2026'), false, 'Wrong date format must be rejected');
    assert.strictEqual(isValidIsoDate('invalid-date'), false);

    const validDate = validateDateParam('2026-10-03', 'sheetDate');
    assert.strictEqual(validDate.isValid, true);
    assert.strictEqual(validDate.data, '2026-10-03');

    const invalidDate = validateDateParam('2026-13-45', 'sheetDate');
    assert.strictEqual(invalidDate.isValid, false);
    assert.strictEqual(invalidDate.errors[0]?.code, 'INVALID_DATE');

    process.stdout.write('  ✅ PASS: 2. Calendar date validation accepts YYYY-MM-DD and rejects non-calendar dates\n');
  }

  // Test 3: Pagination query validation
  {
    // Default pagination on empty query
    const defaultRes = validatePaginationQuery({});
    assert.strictEqual(defaultRes.isValid, true);
    assert.strictEqual(defaultRes.data?.page, 1);
    assert.strictEqual(defaultRes.data?.pageSize, 20);

    // Parsing string parameters from query string
    const parsedRes = validatePaginationQuery({ page: '3', pageSize: '50' });
    assert.strictEqual(parsedRes.isValid, true);
    assert.strictEqual(parsedRes.data?.page, 3);
    assert.strictEqual(parsedRes.data?.pageSize, 50);

    // Rejection of invalid page (< 1)
    const invalidPage = validatePaginationQuery({ page: '-5' });
    assert.strictEqual(invalidPage.isValid, false);
    assert.strictEqual(invalidPage.errors[0]?.code, 'INVALID_PAGINATION');

    // Rejection of excessive pageSize (> 100)
    const invalidPageSize = validatePaginationQuery({ pageSize: '500' });
    assert.strictEqual(invalidPageSize.isValid, false);
    assert.strictEqual(invalidPageSize.errors[0]?.code, 'INVALID_PAGINATION');

    process.stdout.write('  ✅ PASS: 3. Pagination query validation safely parses and enforces bounds\n');
  }

  // Test 4: Error sanitization (no passwords/secrets leaked)
  {
    const rawErrors = [
      { field: 'username', message: 'Username is required', code: 'REQUIRED' },
      { field: 'password', message: 'SecretP@ssw0rd! is invalid', code: 'INVALID' },
      { field: 'sessionToken', message: 'Token token_123 is expired', code: 'EXPIRED' },
    ];

    const sanitized = sanitizeValidationErrors(rawErrors);

    assert.strictEqual(sanitized[0]?.field, 'username');
    assert.strictEqual(sanitized[0]?.message, 'Username is required');

    // Sensitive fields are masked
    assert.strictEqual(sanitized[1]?.field, 'password');
    assert.strictEqual(sanitized[1]?.message.includes('SecretP@ssw0rd!'), false);

    assert.strictEqual(sanitized[2]?.field, 'sessionToken');
    assert.strictEqual(sanitized[2]?.message.includes('token_123'), false);

    process.stdout.write('  ✅ PASS: 4. Error sanitization ensures sensitive secrets are never echoed\n');
  }

  // Test 5: assertValid() helper
  {
    const validRes: ValidationResult<string> = { isValid: true, errors: [], data: 'valid_data' };
    const output = assertValid(validRes);
    assert.strictEqual(output, 'valid_data');

    const invalidRes: ValidationResult<string> = {
      isValid: false,
      errors: [{ field: 'name', message: 'Name required', code: 'REQUIRED' }],
    };

    assert.throws(
      () => assertValid(invalidRes),
      (err: unknown) => {
        return (
          err instanceof ValidationError &&
          err.statusCode === 400 &&
          err.code === API_ERROR_CODES.INVALID_INPUT
        );
      }
    );

    process.stdout.write('  ✅ PASS: 5. assertValid() returns typed data or throws operational ValidationError\n');
  }

  // Test 6: validateBody middleware
  {
    const dummyValidator = (body: unknown): ValidationResult<{ name: string }> => {
      const record = body as Record<string, unknown>;
      if (!record || typeof record.name !== 'string') {
        return { isValid: false, errors: [{ field: 'name', message: 'Name is required', code: 'REQUIRED' }] };
      }
      return { isValid: true, errors: [], data: { name: record.name } };
    };

    const middleware = validateBody(dummyValidator);

    // Invalid body test
    const reqFail = { body: {} } as Request;
    const resFail = createMockResponse();
    let nextCalled = false;
    const nextFail: NextFunction = () => { nextCalled = true; };

    middleware(reqFail, resFail as unknown as Response, nextFail);

    assert.strictEqual(resFail.statusCode, 400);
    assert.ok(resFail.jsonData);
    assert.strictEqual(resFail.jsonData.data, null);
    assert.strictEqual(resFail.jsonData.error.code, API_ERROR_CODES.INVALID_INPUT);
    assert.strictEqual(nextCalled, false, 'next() must NOT be called on validation failure');

    // Valid body test
    const reqPass = { body: { name: 'Valid Trader' } } as Request;
    const resPass = createMockResponse();
    let passNextCalled = false;
    const nextPass: NextFunction = () => { passNextCalled = true; };

    middleware(reqPass, resPass as unknown as Response, nextPass);

    assert.strictEqual(passNextCalled, true);
    assert.deepStrictEqual(reqPass.validatedBody, { name: 'Valid Trader' });

    process.stdout.write('  ✅ PASS: 6. validateBody middleware enforces 400 rejection and attaches typed body\n');
  }

  // Test 7: validateParams & validateQuery middleware
  {
    const queryValidator = (q: unknown) => validatePaginationQuery(q);
    const queryMiddleware = validateQuery(queryValidator);

    const reqQuery = { query: { page: '2', pageSize: '25' } } as unknown as Request;
    const resQuery = createMockResponse();
    let queryNextCalled = false;

    queryMiddleware(reqQuery, resQuery as unknown as Response, () => { queryNextCalled = true; });

    assert.strictEqual(queryNextCalled, true);
    assert.deepStrictEqual(reqQuery.validatedQuery, { page: 2, pageSize: 25 });

    const paramsValidator = (p: unknown) => {
      const rec = p as Record<string, unknown>;
      return validateUuidParam(rec.id, 'id');
    };
    const paramsMiddleware = validateParams(paramsValidator);

    const validId = '123e4567-e89b-12d3-a456-426614174000';
    const reqParams = { params: { id: validId } } as unknown as Request;
    const resParams = createMockResponse();
    let paramsNextCalled = false;

    paramsMiddleware(reqParams, resParams as unknown as Response, () => { paramsNextCalled = true; });

    assert.strictEqual(paramsNextCalled, true);
    assert.strictEqual(reqParams.validatedParams, validId);

    process.stdout.write('  ✅ PASS: 7. validateParams and validateQuery attach validated payloads to request\n');
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 7 VALIDATION & CONTRACT TESTS PASSED!              \n');
  process.stdout.write('========================================================\n\n');
}

runTests();
