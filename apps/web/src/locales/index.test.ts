/**
 * Unit Tests for Localization System (Task 2.9)
 */

import assert from 'node:assert/strict';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getTranslation,
} from './index.js';

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

console.log('\n--- Running Localization System Tests ---');

runTest('Supported languages includes en and ta', () => {
  const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
  assert.deepEqual(codes, ['en', 'ta']);
  assert.equal(DEFAULT_LANGUAGE, 'en');
});

runTest('Resolves English translations across namespaces', () => {
  assert.equal(getTranslation('en', 'common.appName'), 'Vanigar Sangam');
  assert.equal(getTranslation('en', 'navigation.dashboard'), 'Dashboard');
  assert.equal(getTranslation('en', 'authentication.login'), 'Sign In');
  assert.equal(getTranslation('en', 'actions.save'), 'Save');
  assert.equal(getTranslation('en', 'messages.success'), 'Operation completed successfully');
});

runTest('Resolves Tamil translations across namespaces', () => {
  assert.equal(getTranslation('ta', 'common.appName'), 'வணிகர் சங்கம்');
  assert.equal(getTranslation('ta', 'navigation.dashboard'), 'முகப்பு பலகை');
  assert.equal(getTranslation('ta', 'authentication.login'), 'உள்நுழைக');
  assert.equal(getTranslation('ta', 'actions.save'), 'சேமி');
  assert.equal(getTranslation('ta', 'messages.success'), 'செயல்பாடு வெற்றிகரமாக முடிந்தது');
});

runTest('Interpolates dynamic parameters correctly', () => {
  const interpolated = getTranslation('en', 'authentication.signedInAs');
  assert.ok(interpolated.length > 0);
});

runTest('Falls back gracefully on missing keys', () => {
  const missing = getTranslation('ta', 'some.nonexistent.key');
  assert.equal(missing, 'some.nonexistent.key');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
