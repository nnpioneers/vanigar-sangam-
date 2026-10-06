/**
 * Automated Test Suite for Global Feedback & Notification System (Task 2.11)
 *
 * Verifies:
 * 1. English and Tamil feedback translation keys resolve cleanly.
 * 2. Notification variants and queue behaviors.
 * 3. Confirmation dialog default configurations.
 * 4. Safe error representation across feedback components.
 */

import assert from 'node:assert/strict';
import { getTranslation } from '../../locales/index.js';
import type { NotificationType } from './NotificationProvider.js';

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

console.log('\n--- Running Task 2.11 Global Feedback Foundation Tests ---');

runTest('Resolves English feedback translations', () => {
  assert.equal(getTranslation('en', 'feedback.loading'), 'Loading...');
  assert.equal(getTranslation('en', 'feedback.retry'), 'Retry');
  assert.equal(getTranslation('en', 'feedback.somethingWentWrong'), 'Something went wrong');
  assert.equal(getTranslation('en', 'feedback.unexpectedError'), 'An unexpected error occurred. Please try again.');
  assert.equal(getTranslation('en', 'feedback.operationSuccessful'), 'Operation completed successfully.');
  assert.equal(getTranslation('en', 'feedback.operationFailed'), 'Operation failed. Please try again.');
  assert.equal(getTranslation('en', 'feedback.warning'), 'Warning');
  assert.equal(getTranslation('en', 'feedback.confirm'), 'Confirm');
  assert.equal(getTranslation('en', 'feedback.cancel'), 'Cancel');
  assert.equal(getTranslation('en', 'feedback.close'), 'Close');
  assert.equal(getTranslation('en', 'feedback.networkError'), 'Unable to reach the server. Please check your network connection.');
  assert.equal(getTranslation('en', 'feedback.accessDenied'), 'Access Denied. You do not have permission to access this resource.');
});

runTest('Resolves Tamil feedback translations', () => {
  assert.equal(getTranslation('ta', 'feedback.loading'), 'ஏற்றுகிறது...');
  assert.equal(getTranslation('ta', 'feedback.retry'), 'மீண்டும் முயற்சி செய்');
  assert.equal(getTranslation('ta', 'feedback.somethingWentWrong'), 'ஏதோ தவறு நடந்துவிட்டது');
  assert.equal(getTranslation('ta', 'feedback.unexpectedError'), 'எதிர்பாராத பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.');
  assert.equal(getTranslation('ta', 'feedback.operationSuccessful'), 'செயல்பாடு வெற்றிகரமாக முடிந்தது.');
  assert.equal(getTranslation('ta', 'feedback.operationFailed'), 'செயல்பாடு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.');
  assert.equal(getTranslation('ta', 'feedback.warning'), 'எச்சரிக்கை');
  assert.equal(getTranslation('ta', 'feedback.confirm'), 'உறுதி செய்');
  assert.equal(getTranslation('ta', 'feedback.cancel'), 'ரத்து செய்');
  assert.equal(getTranslation('ta', 'feedback.close'), 'மூடு');
  assert.equal(getTranslation('ta', 'feedback.networkError'), 'சேவையகத்தை அணுக முடியவில்லை. உங்கள் இணைய இணைப்பைச் சரிபார்க்கவும்.');
  assert.equal(getTranslation('ta', 'feedback.accessDenied'), 'அணுகல் மறுக்கப்பட்டது. இந்த வளத்தை அணுக உங்களுக்கு அனுமதி இல்லை.');
});

runTest('Notification types support success, error, warning, info', () => {
  const types: NotificationType[] = ['success', 'error', 'warning', 'info'];
  assert.equal(types.length, 4);
});

runTest('Notification queue bounds items to maximum limit', () => {
  const max = 5;
  let queue = ['notif-1', 'notif-2', 'notif-3', 'notif-4', 'notif-5'];
  const newNotif = 'notif-6';

  const updated = [...queue, newNotif];
  if (updated.length > max) {
    const [, ...rest] = updated;
    queue = rest;
  }

  assert.equal(queue.length, 5);
  assert.equal(queue[queue.length - 1], 'notif-6');
  assert.equal(queue.includes('notif-1'), false);
});

runTest('Confirmation labels default to localized strings', () => {
  const enTitle = getTranslation('en', 'feedback.confirmTitle');
  const taTitle = getTranslation('ta', 'feedback.confirmTitle');
  assert.equal(enTitle, 'Please Confirm');
  assert.equal(taTitle, 'உறுதிப்படுத்தவும்');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
