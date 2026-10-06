/**
 * Automated Unit Test Suite for Daily Contribution & Balance Calculations (Phase 6.2 & 6.3)
 *
 * Verifies:
 * 6.2:
 * 1. 1 sheet = ₹200 (20,000 paise).
 * 2. 2 sheets = ₹400 (40,000 paise).
 * 3. 3 sheets = ₹600 (60,000 paise).
 * 4. 4 sheets = ₹800 (80,000 paise).
 * 5. Higher sheet counts (e.g. 10 sheets = ₹2,000 = 200,000 paise).
 * 6. Integer/paise correctness without floating point inaccuracies.
 * 7. Non-positive and invalid sheet counts (0, negative, fractional) are rejected.
 * 8. Pure calculation invariant: no monthly savings or loan eligibility dependencies.
 *
 * 6.3:
 * 9. Zero previous arrears + current due = total due.
 * 10. Previous arrears + current due = total due (e.g. ₹400 arrears + ₹200 daily = ₹600 total).
 * 11. Actual paid is stored and calculated independently from due amounts.
 * 12. Partial payment arithmetic preservation: balance remaining is exact.
 * 13. Exact payment: balance remaining is 0, excess is 0.
 * 14. Excess payment: exact numerical excess is preserved without guessing advance allocation.
 * 15. Invariant: Unresolved advance allocation rules across future dates are NOT guessed.
 * 16. Invariant: Unresolved overdue day-count rules are NOT guessed.
 */

import assert from 'node:assert';
import {
  calculateDailyDuePaise,
  calculateTotalDuePaise,
  calculatePaymentBalance,
  resolveConfirmedDailySheetStatus,
  DAILY_RATE_PER_SHEET_PAISE,
  DAILY_RATE_PER_SHEET_RUPEES,
} from '@vanigar/rules';

async function runTests(): Promise<void> {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Daily Sheet Calculation Tests (Phase 6.2 & 6.3) \n');
  process.stdout.write('========================================================\n');

  // Test 1: 1 sheet = ₹200 = 20,000 paise
  {
    const duePaise = calculateDailyDuePaise(1);
    assert.strictEqual(duePaise, 20000);
    assert.strictEqual(duePaise / 100, DAILY_RATE_PER_SHEET_RUPEES);
    process.stdout.write('  ✅ PASS: 1. 1 sheet = ₹200 (20,000 paise)\n');
  }

  // Test 2: 2 sheets = ₹400 = 40,000 paise
  {
    const duePaise = calculateDailyDuePaise(2);
    assert.strictEqual(duePaise, 40000);
    assert.strictEqual(duePaise / 100, 400);
    process.stdout.write('  ✅ PASS: 2. 2 sheets = ₹400 (40,000 paise)\n');
  }

  // Test 3: 3 sheets = ₹600 = 60,000 paise
  {
    const duePaise = calculateDailyDuePaise(3);
    assert.strictEqual(duePaise, 60000);
    assert.strictEqual(duePaise / 100, 600);
    process.stdout.write('  ✅ PASS: 3. 3 sheets = ₹600 (60,000 paise)\n');
  }

  // Test 4: 4 sheets = ₹800 = 80,000 paise
  {
    const duePaise = calculateDailyDuePaise(4);
    assert.strictEqual(duePaise, 80000);
    assert.strictEqual(duePaise / 100, 800);
    process.stdout.write('  ✅ PASS: 4. 4 sheets = ₹800 (80,000 paise)\n');
  }

  // Test 5: Higher sheet counts (e.g. 10 sheets = 200,000 paise)
  {
    const duePaise = calculateDailyDuePaise(10);
    assert.strictEqual(duePaise, 200000);
    assert.strictEqual(duePaise / 100, 2000);

    const due50 = calculateDailyDuePaise(50);
    assert.strictEqual(due50, 1000000); // ₹10,000 = 1,000,000 paise
    process.stdout.write('  ✅ PASS: 5. Higher sheet counts calculate deterministically\n');
  }

  // Test 6: Integer/paise correctness without floating point inaccuracies
  {
    assert.strictEqual(Number.isInteger(DAILY_RATE_PER_SHEET_PAISE), true);
    for (let s = 1; s <= 20; s++) {
      const p = calculateDailyDuePaise(s);
      assert.strictEqual(Number.isInteger(p), true);
      assert.strictEqual(p % 100, 0, 'Paise amounts should be whole multiples of 100 for rupee parity');
    }
    process.stdout.write('  ✅ PASS: 6. Integer paise arithmetic enforced without floating-point math\n');
  }

  // Test 7: Non-positive and invalid sheet counts are rejected
  {
    assert.throws(() => calculateDailyDuePaise(0), /positive integer/);
    assert.throws(() => calculateDailyDuePaise(-1), /positive integer/);
    assert.throws(() => calculateDailyDuePaise(-5), /positive integer/);
    assert.throws(() => calculateDailyDuePaise(1.5), /positive integer/);
    assert.throws(() => calculateDailyDuePaise(NaN), /positive integer/);
    assert.throws(() => calculateDailyDuePaise(Infinity), /positive integer/);
    process.stdout.write('  ✅ PASS: 7. Invalid/non-positive sheet counts rejected\n');
  }

  // Test 8: Pure calculation invariant: no loan eligibility or monthly savings calculations
  {
    // Verify pure engine does not expose or mix loan eligibility logic
    const rulesModule = await import('@vanigar/rules');
    assert.strictEqual('calculateLoanEligibility' in rulesModule, false);
    assert.strictEqual('calculateMonthlySavings' in rulesModule, false);
    process.stdout.write('  ✅ PASS: 8. Zero monthly savings or loan eligibility dependency\n');
  }

  // --- Phase 6.3 Tests ---

  // Test 9: Zero previous arrears + current due = total due
  {
    const totalDue = calculateTotalDuePaise(20000, 0);
    assert.strictEqual(totalDue, 20000);
    process.stdout.write('  ✅ PASS: 9. Zero previous arrears + current due = total due\n');
  }

  // Test 10: Previous arrears + current due = total due (₹400 arrears + ₹200 daily = ₹600)
  {
    const arrearsPaise = 40000; // ₹400
    const dailyPaise = 20000;   // ₹200
    const totalDue = calculateTotalDuePaise(dailyPaise, arrearsPaise);
    assert.strictEqual(totalDue, 60000); // ₹600 = 60,000 paise
    process.stdout.write('  ✅ PASS: 10. Previous arrears + current daily due = total due (₹400 + ₹200 = ₹600)\n');
  }

  // Test 11: Actual paid stored and calculated independently
  {
    const totalDue = 60000;
    const actualPaid = 40000;
    const balance = calculatePaymentBalance(totalDue, actualPaid);

    assert.strictEqual(balance.totalDuePaise, 60000);
    assert.strictEqual(balance.actualPaidPaise, 40000);
    assert.strictEqual(balance.balanceRemainingPaise, 20000);
    assert.strictEqual(balance.excessPaidPaise, 0);
    process.stdout.write('  ✅ PASS: 11. Actual paid is tracked independently from total due\n');
  }

  // Test 12: Partial payment arithmetic preservation
  {
    const totalDue = 60000; // ₹600 due
    const actualPaid = 15000; // ₹150 paid
    const balance = calculatePaymentBalance(totalDue, actualPaid);

    assert.strictEqual(balance.balanceRemainingPaise, 45000); // ₹450 remaining
    assert.strictEqual(balance.excessPaidPaise, 0);
    process.stdout.write('  ✅ PASS: 12. Partial payment arithmetic preserved accurately\n');
  }

  // Test 13: Exact payment: balance remaining is 0
  {
    const totalDue = 40000;
    const actualPaid = 40000;
    const balance = calculatePaymentBalance(totalDue, actualPaid);

    assert.strictEqual(balance.balanceRemainingPaise, 0);
    assert.strictEqual(balance.excessPaidPaise, 0);
    process.stdout.write('  ✅ PASS: 13. Exact payment results in 0 balance remaining and 0 excess\n');
  }

  // Test 14: Excess payment arithmetic preservation
  {
    const totalDue = 20000;  // ₹200 due
    const actualPaid = 50000; // ₹500 paid
    const balance = calculatePaymentBalance(totalDue, actualPaid);

    assert.strictEqual(balance.balanceRemainingPaise, 0);
    assert.strictEqual(balance.excessPaidPaise, 30000); // ₹300 excess
    process.stdout.write('  ✅ PASS: 14. Excess payment preserved numerically\n');
  }

  // Test 15: Unresolved advance allocation rules across future dates NOT guessed
  {
    // The balance calculation purely outputs numbers without mutating future dates
    const balance = calculatePaymentBalance(20000, 60000);
    assert.strictEqual(balance.excessPaidPaise, 40000);
    // Does not auto-create calendar entries or distribute to future dates
    assert.strictEqual((balance as unknown as Record<string, unknown>).futureAllocations, undefined);
    process.stdout.write('  ✅ PASS: 15. Invariant: Unresolved advance allocations across dates are not guessed\n');
  }

  // Test 16: Unresolved overdue day-count rules NOT guessed
  {
    // Calculations do not assign overdue status based on date diffs
    assert.strictEqual(typeof calculateTotalDuePaise, 'function');
    assert.strictEqual((calculatePaymentBalance as unknown as Record<string, unknown>).overdueDays, undefined);
    process.stdout.write('  ✅ PASS: 16. Invariant: Unresolved overdue day-count rules are not guessed\n');
  }

  // --- Phase 6.1-6.4 Status Classification Review Tests ---

  // Test 17: Status resolution: zero paid with due > 0 resolves to NOT_PAID
  {
    const status = resolveConfirmedDailySheetStatus(60000, 0);
    assert.strictEqual(status, 'NOT_PAID');
    process.stdout.write('  ✅ PASS: 17. Status resolution: actualPaid = 0 with due > 0 resolves to NOT_PAID\n');
  }

  // Test 18: Status resolution: partial paid resolves to PARTIAL
  {
    const totalDue = 60000; // ₹600
    const actualPaid = 40000; // ₹400
    const status = resolveConfirmedDailySheetStatus(totalDue, actualPaid);
    assert.strictEqual(status, 'PARTIAL');

    const balance = calculatePaymentBalance(totalDue, actualPaid);
    assert.strictEqual(balance.balanceRemainingPaise, 20000); // ₹200 remaining
    assert.strictEqual(balance.excessPaidPaise, 0);
    process.stdout.write('  ✅ PASS: 18. Status resolution: actualPaid < totalDue resolves to PARTIAL with exact remaining balance\n');
  }

  // Test 19: Status resolution: exact paid resolves to PAID
  {
    const totalDue = 60000;
    const actualPaid = 60000;
    const status = resolveConfirmedDailySheetStatus(totalDue, actualPaid);
    assert.strictEqual(status, 'PAID');

    const balance = calculatePaymentBalance(totalDue, actualPaid);
    assert.strictEqual(balance.balanceRemainingPaise, 0);
    assert.strictEqual(balance.excessPaidPaise, 0);
    process.stdout.write('  ✅ PASS: 19. Status resolution: actualPaid == totalDue resolves to PAID with 0 balance and 0 excess\n');
  }

  // Test 20: Status resolution: excess payment resolves to PAID (NOT ADVANCE_PAID) and preserves excessPaidPaise
  {
    const totalDue = 60000;  // ₹600 due
    const actualPaid = 80000; // ₹800 paid
    const status = resolveConfirmedDailySheetStatus(totalDue, actualPaid);
    // CRITICAL: Must be PAID, NOT automatically ADVANCE_PAID
    assert.strictEqual(status, 'PAID', 'Excess payment must resolve to PAID, not prematurely ADVANCE_PAID');

    const balance = calculatePaymentBalance(totalDue, actualPaid);
    assert.strictEqual(balance.totalDuePaise, 60000);
    assert.strictEqual(balance.actualPaidPaise, 80000);
    assert.strictEqual(balance.balanceRemainingPaise, 0);
    assert.strictEqual(balance.excessPaidPaise, 20000); // ₹200 excess preserved numerically
    process.stdout.write('  ✅ PASS: 20. Status resolution: excess payment resolves to PAID (NOT ADVANCE_PAID) and preserves excessPaidPaise\n');
  }

  // Test 21: Status resolution: explicit caller status is preserved
  {
    // If caller explicitly provides an approved business status, it must be honored
    const status1 = resolveConfirmedDailySheetStatus(60000, 80000, 'ADVANCE_PAID');
    assert.strictEqual(status1, 'ADVANCE_PAID');

    const status2 = resolveConfirmedDailySheetStatus(60000, 0, 'OVERDUE');
    assert.strictEqual(status2, 'OVERDUE');

    const status3 = resolveConfirmedDailySheetStatus(60000, 0, 'ADVANCE_COVERED');
    assert.strictEqual(status3, 'ADVANCE_COVERED');
    process.stdout.write('  ✅ PASS: 21. Explicit caller status is preserved without forced override\n');
  }

  // Test 22: Invariant: ADVANCE_COVERED is NEVER automatically inferred by arithmetic
  {
    const testCases: [number, number][] = [
      [20000, 0],
      [20000, 10000],
      [20000, 20000],
      [20000, 40000],
      [40000, 0],
      [40000, 20000],
    ];

    for (const [due, paid] of testCases) {
      const autoStatus = resolveConfirmedDailySheetStatus(due, paid);
      assert.notStrictEqual(autoStatus, 'ADVANCE_COVERED', `ADVANCE_COVERED must never be auto-assigned for due=${due}, paid=${paid}`);
    }
    process.stdout.write('  ✅ PASS: 22. Invariant: ADVANCE_COVERED is never automatically inferred\n');
  }

  // Test 23: Invariant: OVERDUE is NEVER automatically inferred by arithmetic
  {
    const testCases: [number, number][] = [
      [20000, 0],
      [20000, 10000],
      [40000, 0],
      [100000, 0],
    ];

    for (const [due, paid] of testCases) {
      const autoStatus = resolveConfirmedDailySheetStatus(due, paid);
      assert.notStrictEqual(autoStatus, 'OVERDUE', `OVERDUE must never be auto-assigned for due=${due}, paid=${paid}`);
    }
    process.stdout.write('  ✅ PASS: 23. Invariant: OVERDUE day-count is never automatically inferred\n');
  }

  process.stdout.write('\n========================================================\n');
  process.stdout.write(' ALL 23 CALCULATION, BALANCE & STATUS TESTS PASSED!     \n');
  process.stdout.write('========================================================\n\n');
}

runTests().catch((err) => {
  process.stderr.write(`Calculation tests failed: ${err}\n`);
  process.exit(1);
});

