import assert from 'node:assert/strict';
import {
  toSafeUserError,
  getSafeErrorMessage,
  containsSensitiveData,
} from './error-utils.js';
import { ApiRequestError } from './api/client.js';
import { getTranslation } from '../locales/index.js';

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n--- Running Error Utility & Sanitization Tests ---');

runTest('containsSensitiveData detects secrets, sql, and cookies', () => {
  assert.equal(containsSensitiveData('Invalid vs_session cookie value'), true);
  assert.equal(containsSensitiveData('PostgreSQL syntax error at or near SELECT'), true);
  assert.equal(containsSensitiveData('Password does not match hash'), true);
  assert.equal(containsSensitiveData('Error in node_modules/pg/lib/connection.js'), true);
  assert.equal(containsSensitiveData('at Query.handlePacket (/app/node_modules/pg)'), true);
  assert.equal(containsSensitiveData('Unable to load loan details'), false);
});

runTest('Sanitizes ApiRequestError with NETWORK status 0', () => {
  const err = new ApiRequestError({
    status: 0,
    code: 'NETWORK',
    message: 'Failed to fetch',
  });
  const safe = toSafeUserError(err);
  assert.equal(safe.code, 'NETWORK');
  assert.equal(safe.messageKey, 'feedback.networkError');
});

runTest('Sanitizes ApiRequestError with UNAUTHENTICATED status 401', () => {
  const err = new ApiRequestError({
    status: 401,
    code: 'UNAUTHENTICATED',
    message: 'Missing or expired session',
  });
  const safe = toSafeUserError(err);
  assert.equal(safe.code, 'UNAUTHENTICATED');
  assert.equal(safe.messageKey, 'feedback.sessionExpired');
});

runTest('Sanitizes ApiRequestError with FORBIDDEN status 403', () => {
  const err = new ApiRequestError({
    status: 403,
    code: 'FORBIDDEN',
    message: 'Role CASHIER cannot access audit logs',
  });
  const safe = toSafeUserError(err);
  assert.equal(safe.code, 'FORBIDDEN');
  assert.equal(safe.messageKey, 'feedback.accessDenied');
});

runTest('Blocks sensitive internal database messages in ApiRequestError', () => {
  const err = new ApiRequestError({
    status: 500,
    code: 'DB_ERROR',
    message: 'Postgres connection failed: relation admin_users does not exist',
  });
  const safe = toSafeUserError(err);
  assert.equal(safe.messageKey, 'feedback.unexpectedError');
  assert.equal(safe.defaultMessage.includes('Postgres'), false);
  assert.equal(safe.defaultMessage.includes('admin_users'), false);
});

runTest('Blocks stack trace leaks in standard Error objects', () => {
  const err = new Error('at pg.connect (node_modules/pg/client.js:45:10)');
  const safe = toSafeUserError(err);
  assert.equal(safe.messageKey, 'feedback.unexpectedError');
  assert.equal(safe.defaultMessage.includes('node_modules'), false);
});

runTest('Handles unknown primitives gracefully', () => {
  const safe = toSafeUserError(null);
  assert.equal(safe.code, 'UNKNOWN');
  assert.equal(safe.messageKey, 'feedback.unexpectedError');
});

runTest('getSafeErrorMessage resolves localized translations', () => {
  const err = new ApiRequestError({
    status: 0,
    code: 'NETWORK',
    message: 'Failed to fetch',
  });

  const enMsg = getSafeErrorMessage(err, (k) => getTranslation('en', k));
  const taMsg = getSafeErrorMessage(err, (k) => getTranslation('ta', k));

  assert.ok(enMsg.includes('internet connection') || enMsg.includes('network'));
  assert.ok(taMsg.includes('இணைய') || taMsg.includes('சேவையகத்தை'));
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
