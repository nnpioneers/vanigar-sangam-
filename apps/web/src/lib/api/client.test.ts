/**
 * Focused Unit Tests for API Client URL Builder
 *
 * Verifies:
 * 1. Absolute API base URLs (http:// and https://)
 * 2. Relative browser base URLs (/api/v1) resolved against window.location.origin
 * 3. Path normalization (slashes on base and path)
 * 4. Query parameter serialization (omits null/undefined, preserves numbers/booleans)
 * 5. Non-browser fallback handling
 */

import assert from 'node:assert';
import { buildUrl } from './client.js';

function runTests(): void {
  process.stdout.write('\n--- Running API Client URL Builder Tests ---\n');

  // Preserve original window reference if present
  const originalWindow = globalThis.window;

  try {
    // 1. Absolute API base URLs
    {
      const res1 = buildUrl('http://localhost:4000/api/v1', '/auth/login');
      assert.strictEqual(res1, 'http://localhost:4000/api/v1/auth/login');

      const res2 = buildUrl('https://api.vanigarsangam.org/api/v1', '/health');
      assert.strictEqual(res2, 'https://api.vanigarsangam.org/api/v1/health');

      process.stdout.write('  ✓ Correctly builds absolute http/https base URLs\n');
    }

    // 2. Relative /api/v1 base URL resolved against window.location.origin
    {
      // Simulate browser environment with localhost:3000 origin
      (globalThis as unknown as { window: unknown }).window = {
        location: { origin: 'http://localhost:3000' },
      };

      const res1 = buildUrl('/api/v1', '/auth/login');
      assert.strictEqual(res1, 'http://localhost:3000/api/v1/auth/login');

      const res2 = buildUrl('/api/v1', '/auth/me');
      assert.strictEqual(res2, 'http://localhost:3000/api/v1/auth/me');

      // Simulate browser environment with custom port / hostname
      (globalThis as unknown as { window: unknown }).window = {
        location: { origin: 'http://127.0.0.1:8080' },
      };

      const res3 = buildUrl('/api/v1', '/auth/logout');
      assert.strictEqual(res3, 'http://127.0.0.1:8080/api/v1/auth/logout');

      process.stdout.write('  ✓ Resolves relative /api/v1 base URL against window.location.origin\n');
    }

    // 3. Path normalization
    {
      (globalThis as unknown as { window: unknown }).window = {
        location: { origin: 'http://localhost:3000' },
      };

      // Base with trailing slash + path with leading slash
      const res1 = buildUrl('/api/v1/', '/auth/login');
      assert.strictEqual(res1, 'http://localhost:3000/api/v1/auth/login');

      // Base with trailing slash + path without leading slash
      const res2 = buildUrl('/api/v1/', 'auth/login');
      assert.strictEqual(res2, 'http://localhost:3000/api/v1/auth/login');

      // Base without trailing slash + path without leading slash
      const res3 = buildUrl('/api/v1', 'auth/login');
      assert.strictEqual(res3, 'http://localhost:3000/api/v1/auth/login');

      // Multiple trailing slashes on base
      const res4 = buildUrl('/api/v1///', 'auth/login');
      assert.strictEqual(res4, 'http://localhost:3000/api/v1/auth/login');

      // Absolute URL normalization
      const res5 = buildUrl('http://localhost:4000/api/v1/', 'auth/login');
      assert.strictEqual(res5, 'http://localhost:4000/api/v1/auth/login');

      process.stdout.write('  ✓ Correctly normalizes leading and trailing slashes\n');
    }

    // 4. Query parameter serialization
    {
      (globalThis as unknown as { window: unknown }).window = {
        location: { origin: 'http://localhost:3000' },
      };

      // Simple query
      const res1 = buildUrl('/api/v1', '/items', { page: 1, pageSize: 20 });
      assert.strictEqual(res1, 'http://localhost:3000/api/v1/items?page=1&pageSize=20');

      // Filtering null and undefined values
      const res2 = buildUrl('/api/v1', '/items', {
        page: 2,
        search: undefined,
        filter: null,
        active: true,
      });
      assert.strictEqual(res2, 'http://localhost:3000/api/v1/items?page=2&active=true');

      // Query params with absolute URL
      const res3 = buildUrl('http://localhost:4000/api/v1', '/loans', { status: 'PENDING' });
      assert.strictEqual(res3, 'http://localhost:4000/api/v1/loans?status=PENDING');

      process.stdout.write('  ✓ Serializes query parameters and omits null/undefined\n');
    }

    // 5. Non-browser fallback handling
    {
      // Remove window to simulate SSR / Node environment
      delete (globalThis as Record<string, unknown>).window;

      const res = buildUrl('/api/v1', '/auth/login');
      assert.strictEqual(res, 'http://localhost/api/v1/auth/login');

      process.stdout.write('  ✓ Gracefully handles non-browser environment without crashing\n');
    }

    process.stdout.write('\nResults: 5/5 URL builder tests passed.\n\n');
  } finally {
    // Restore window
    if (originalWindow !== undefined) {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    } else {
      delete (globalThis as Record<string, unknown>).window;
    }
  }
}

runTests();
