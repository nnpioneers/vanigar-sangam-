/**
 * Daily Sheet & Contribution Calculation Rules (Phase 6.2 & 6.3)
 *
 * Pure, deterministic business logic. Zero I/O, zero database queries, zero clock dependencies.
 *
 * Confirmed Business Rules:
 * 1. 1 sheet = ₹200 per day.
 * 2. Multiplier formula: daily_due_paise = number_of_sheets × 20,000 paise.
 * 3. Total due formula: total_due_paise = daily_due_paise + previous_arrears_paise.
 * 4. Actual paid amount is tracked independently.
 *
 * Explicitly Unresolved Rules (Must NOT be guessed):
 * - Advance payment allocation across future dates.
 * - Advance covered status transition rules.
 * - Overdue day-count classification.
 * - Excess payment distribution.
 * - Historical backdated payment policies.
 * - Monthly savings / Loan eligibility logic (Strictly forbidden in this phase).
 */

/** Confirmed numeric constants */
export const DAILY_RATE_PER_SHEET_RUPEES = 200;
export const DAILY_RATE_PER_SHEET_PAISE = 20_000; // 1 sheet = ₹200 = 20,000 paise

/**
 * Calculates daily due in paise based on number of sheets.
 *
 * @param numberOfSheets Positive integer count of sheets owned by the member
 * @returns Daily due amount in integer paise
 * @throws Error if numberOfSheets is not a positive integer
 */
export function calculateDailyDuePaise(numberOfSheets: number): number {
  if (!Number.isInteger(numberOfSheets) || numberOfSheets <= 0) {
    throw new Error('Number of sheets must be a positive integer greater than zero');
  }
  return numberOfSheets * DAILY_RATE_PER_SHEET_PAISE;
}

/**
 * Calculates total due in paise by combining daily due and previous arrears.
 *
 * Formula: total_due = daily_due + previous_arrears
 *
 * @param dailyDuePaise Non-negative integer paise for the current day's sheet due
 * @param previousArrearsPaise Non-negative integer paise for outstanding historical arrears
 * @returns Total due in integer paise
 * @throws Error if either input is invalid or negative
 */
export function calculateTotalDuePaise(
  dailyDuePaise: number,
  previousArrearsPaise = 0
): number {
  if (!Number.isInteger(dailyDuePaise) || dailyDuePaise < 0) {
    throw new Error('Daily due amount must be a non-negative integer paise');
  }
  if (!Number.isInteger(previousArrearsPaise) || previousArrearsPaise < 0) {
    throw new Error('Previous arrears amount must be a non-negative integer paise');
  }
  return dailyDuePaise + previousArrearsPaise;
}

/**
 * Balance calculation breakdown.
 */
export interface PaymentBalanceCalculation {
  totalDuePaise: number;
  actualPaidPaise: number;
  balanceRemainingPaise: number;
  excessPaidPaise: number;
}

/**
 * Pure arithmetic helper to compute balance remaining and excess payment.
 *
 * Preserves exact numerical values without making unconfirmed policy assumptions:
 * - Does NOT distribute excess into future dates.
 * - Does NOT apply unconfirmed penalties or overdue rules.
 *
 * @param totalDuePaise Non-negative total due in integer paise
 * @param actualPaidPaise Non-negative actual paid in integer paise
 */
export function calculatePaymentBalance(
  totalDuePaise: number,
  actualPaidPaise = 0
): PaymentBalanceCalculation {
  if (!Number.isInteger(totalDuePaise) || totalDuePaise < 0) {
    throw new Error('Total due amount must be a non-negative integer paise');
  }
  if (!Number.isInteger(actualPaidPaise) || actualPaidPaise < 0) {
    throw new Error('Actual paid amount must be a non-negative integer paise');
  }

  const balanceRemainingPaise = Math.max(0, totalDuePaise - actualPaidPaise);
  const excessPaidPaise = Math.max(0, actualPaidPaise - totalDuePaise);

  return {
    totalDuePaise,
    actualPaidPaise,
    balanceRemainingPaise,
    excessPaidPaise,
  };
}

/**
 * Resolves the confirmed daily sheet status based strictly on frozen arithmetic.
 *
 * Confirmed Business Rules:
 * - If caller provided an explicit approved status, that status is preserved.
 * - If totalDuePaise > 0 and actualPaidPaise === 0: 'NOT_PAID'.
 * - If 0 < actualPaidPaise < totalDuePaise: 'PARTIAL'.
 * - If actualPaidPaise >= totalDuePaise: 'PAID'.
 *
 * Explicit Boundaries & Invariants:
 * - When actualPaidPaise > totalDuePaise, the status is 'PAID' (NOT automatically 'ADVANCE_PAID').
 *   The excess amount is preserved numerically as `excessPaidPaise = actualPaidPaise - totalDuePaise`,
 *   and must NOT be assumed to be allocated to future dates.
 * - 'ADVANCE_COVERED' is NEVER automatically inferred or assigned without explicit business triggers.
 * - 'OVERDUE' is NEVER automatically inferred or assigned based on date diffs.
 *
 * @param totalDuePaise Non-negative total due in integer paise
 * @param actualPaidPaise Non-negative actual paid in integer paise
 * @param explicitStatus Optional explicit DailySheetStatus provided by caller
 */
export function resolveConfirmedDailySheetStatus<T extends string = string>(
  totalDuePaise: number,
  actualPaidPaise: number,
  explicitStatus?: T
): T | 'PAID' | 'PARTIAL' | 'NOT_PAID' {
  if (explicitStatus) {
    return explicitStatus;
  }
  if (!Number.isInteger(totalDuePaise) || totalDuePaise < 0) {
    throw new Error('Total due amount must be a non-negative integer paise');
  }
  if (!Number.isInteger(actualPaidPaise) || actualPaidPaise < 0) {
    throw new Error('Actual paid amount must be a non-negative integer paise');
  }
  if (totalDuePaise > 0 && actualPaidPaise === 0) {
    return 'NOT_PAID';
  }
  if (actualPaidPaise < totalDuePaise) {
    return 'PARTIAL';
  }
  return 'PAID';
}

