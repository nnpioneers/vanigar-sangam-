/**
 * Unit Tests for Navigation Configuration and Role-Based Filtering
 */

import assert from 'node:assert/strict';
import { getFilteredNavigation } from './navigation.config.js';

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

console.log('\n--- Running Navigation Role-Filtering Tests ---');

runTest('Undefined role returns empty navigation', () => {
  const nav = getFilteredNavigation(undefined);
  assert.equal(nav.length, 0);
});

runTest('SUPER_ADMIN has access to all groups including audit', () => {
  const nav = getFilteredNavigation('SUPER_ADMIN');
  const allItemIds = nav.flatMap((g) => g.items.map((i) => i.id));

  assert.ok(allItemIds.includes('dashboard'));
  assert.ok(allItemIds.includes('members'));
  assert.ok(allItemIds.includes('daily-sheet'));
  assert.ok(allItemIds.includes('collections'));
  assert.ok(allItemIds.includes('loans'));
  assert.ok(allItemIds.includes('guarantors'));
  assert.ok(allItemIds.includes('cash'));
  assert.ok(allItemIds.includes('reports'));
  assert.ok(allItemIds.includes('audit'));
});

runTest('ADMIN has access to business operations but not audit', () => {
  const nav = getFilteredNavigation('ADMIN');
  const allItemIds = nav.flatMap((g) => g.items.map((i) => i.id));

  assert.ok(allItemIds.includes('dashboard'));
  assert.ok(allItemIds.includes('members'));
  assert.ok(allItemIds.includes('daily-sheet'));
  assert.ok(allItemIds.includes('collections'));
  assert.ok(allItemIds.includes('loans'));
  assert.ok(allItemIds.includes('reports'));
  assert.equal(allItemIds.includes('audit'), false);
});

runTest('CASHIER is restricted to daily operations and cash only', () => {
  const nav = getFilteredNavigation('CASHIER');
  const allItemIds = nav.flatMap((g) => g.items.map((i) => i.id));

  assert.ok(allItemIds.includes('dashboard'));
  assert.ok(allItemIds.includes('daily-sheet'));
  assert.ok(allItemIds.includes('collections'));
  assert.ok(allItemIds.includes('cash'));
  assert.equal(allItemIds.includes('members'), false);
  assert.equal(allItemIds.includes('loans'), false);
  assert.equal(allItemIds.includes('reports'), false);
  assert.equal(allItemIds.includes('audit'), false);
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
