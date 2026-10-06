/**
 * Automated Test Suite for Request Context Middleware (Phase 3.1)
 *
 * Verifies:
 * 1. Generates unique UUID requestId when X-Request-Id is omitted
 * 2. Preserves incoming X-Request-Id when supplied by client or proxy
 * 3. Sets X-Request-Id on response header
 * 4. Records request startTime
 * 5. Calls next() correctly
 */

import assert from 'node:assert';
import type { Request, Response, NextFunction } from 'express';
import { requestContextMiddleware } from './request-context.middleware.js';

interface MockResponse {
  headers: Record<string, string>;
  setHeader(name: string, value: string): void;
}

function createMockResponse(): MockResponse {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
  };
}

function runTests(): void {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Request Context Middleware Tests (Phase 3.1)   \n');
  process.stdout.write('========================================================\n');

  // Test 1: Generates UUID when header omitted
  {
    const req = { headers: {} } as Request;
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    requestContextMiddleware(req, res as unknown as Response, next);

    assert.ok(req.id, 'req.id should be populated');
    assert.strictEqual(typeof req.id, 'string');
    // UUID v4 format: 8-4-4-4-12 hex characters
    assert.match(req.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.strictEqual(res.headers['x-request-id'], req.id);
    assert.ok(req.startTime && req.startTime > 0);
    assert.strictEqual(nextCalled, true);

    process.stdout.write('  ✅ PASS: 1. Generates UUID and populates req.id and response header\n');
  }

  // Test 2: Preserves incoming X-Request-Id
  {
    const incomingId = 'client-provided-correlation-id-999';
    const req = {
      headers: { 'x-request-id': incomingId },
    } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    requestContextMiddleware(req, res as unknown as Response, next);

    assert.strictEqual(req.id, incomingId);
    assert.strictEqual(res.headers['x-request-id'], incomingId);
    assert.strictEqual(nextCalled, true);

    process.stdout.write('  ✅ PASS: 2. Preserves incoming X-Request-Id from client or proxy\n');
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 2 REQUEST CONTEXT TESTS PASSED SUCCESSFULLY!       \n');
  process.stdout.write('========================================================\n\n');
}

runTests();
