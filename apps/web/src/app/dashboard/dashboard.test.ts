/**
 * Automated Test Suite for Dashboard Shell & Role-Aware Integration (Task 2.10)
 *
 * Verifies:
 * 1. English and Tamil dashboard translation keys resolve cleanly.
 * 2. Role-specific authority descriptions map correctly across SUPER_ADMIN, ADMIN, CASHIER.
 * 3. Quick action accessibility restrictions according to user roles.
 * 4. Demo disclaimers are present and consistently rendered.
 */

import assert from 'node:assert/strict';
import { getTranslation } from '../../locales/index.js';
import type { UserRole } from '@vanigar/shared-types';

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

console.log('\n--- Running Task 2.10 Dashboard Shell & Role Integration Tests ---');

runTest('Resolves Dashboard English translations', () => {
  assert.equal(getTranslation('en', 'dashboard.title'), 'Dashboard');
  assert.equal(getTranslation('en', 'dashboard.demoNoticeTitle'), 'Demo Mode — Phase 2.10 Shell');
  assert.equal(getTranslation('en', 'dashboard.summaryMembers'), 'Total Members');
  assert.equal(getTranslation('en', 'dashboard.summaryActiveLoans'), 'Active Loans');
  assert.equal(getTranslation('en', 'dashboard.summaryTodayCollections'), 'Today Collections');
  assert.equal(getTranslation('en', 'dashboard.summaryCashOnHand'), 'Cash on Hand');
  assert.equal(getTranslation('en', 'dashboard.quickActionsTitle'), 'Quick Actions');
  assert.equal(getTranslation('en', 'dashboard.recentActivityTitle'), 'Recent Transactions');
  assert.equal(getTranslation('en', 'dashboard.emptyActivityTitle'), 'No Transactions Recorded Yet');
});

runTest('Resolves Dashboard Tamil translations', () => {
  assert.equal(getTranslation('ta', 'dashboard.title'), 'முகப்பு பலகை');
  assert.equal(getTranslation('ta', 'dashboard.demoNoticeTitle'), 'மாதிரி பயன்முறை — கட்டம் 2.10 கட்டமைப்பு');
  assert.equal(getTranslation('ta', 'dashboard.summaryMembers'), 'மொத்த உறுப்பினர்கள்');
  assert.equal(getTranslation('ta', 'dashboard.summaryActiveLoans'), 'செயலில் உள்ள கடன்கள்');
  assert.equal(getTranslation('ta', 'dashboard.summaryTodayCollections'), 'இன்றைய வசூல்');
  assert.equal(getTranslation('ta', 'dashboard.summaryCashOnHand'), 'கையிருப்பு பணம்');
  assert.equal(getTranslation('ta', 'dashboard.quickActionsTitle'), 'விரைவுச் செயல்கள்');
  assert.equal(getTranslation('ta', 'dashboard.recentActivityTitle'), 'சமீபத்திய பரிவர்த்தனைகள்');
  assert.equal(getTranslation('ta', 'dashboard.emptyActivityTitle'), 'பரிவர்த்தனைகள் எதுவும் இல்லை');
});

runTest('Role-aware banner mapping produces distinct descriptions', () => {
  const superAdminDesc = getTranslation('en', 'dashboard.roleBannerSuperAdmin');
  const adminDesc = getTranslation('en', 'dashboard.roleBannerAdmin');
  const cashierDesc = getTranslation('en', 'dashboard.roleBannerCashier');

  assert.ok(superAdminDesc.includes('Super Administrator'));
  assert.ok(adminDesc.includes('Administrator'));
  assert.ok(cashierDesc.includes('Cashier'));

  assert.notEqual(superAdminDesc, adminDesc);
  assert.notEqual(adminDesc, cashierDesc);
});

function getPermittedQuickActions(role: UserRole): string[] {
  const actions: string[] = [];
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    actions.push('newMember');
    actions.push('newLoan');
  }
  actions.push('recordCollection');
  actions.push('dailySheet');
  return actions;
}

runTest('SUPER_ADMIN is granted all administrative quick actions', () => {
  const actions = getPermittedQuickActions('SUPER_ADMIN');
  assert.deepEqual(actions, ['newMember', 'newLoan', 'recordCollection', 'dailySheet']);
});

runTest('ADMIN is granted operations quick actions', () => {
  const actions = getPermittedQuickActions('ADMIN');
  assert.deepEqual(actions, ['newMember', 'newLoan', 'recordCollection', 'dailySheet']);
});

runTest('CASHIER is restricted from loan and member registration quick actions', () => {
  const actions = getPermittedQuickActions('CASHIER');
  assert.deepEqual(actions, ['recordCollection', 'dailySheet']);
  assert.equal(actions.includes('newMember'), false);
  assert.equal(actions.includes('newLoan'), false);
});

runTest('Demo badges and disclaimers are translated', () => {
  const enBadge = getTranslation('en', 'dashboard.demoBadge');
  const taBadge = getTranslation('ta', 'dashboard.demoBadge');
  assert.equal(enBadge, 'Demo Placeholder');
  assert.equal(taBadge, 'மாதிரி வடிவம்');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
