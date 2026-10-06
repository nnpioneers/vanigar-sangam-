/**
 * Loans Domain Rules (Phase 8.3)
 *
 * Pure functions implementing business rules for loans.
 */

import { ValidationError } from '../../errors/app-error.js';
import type { LoanStatus } from './loans.types.js';

export function getMaximumLoanAmountForSheets(numberOfSheets: number): number {
  if (!Number.isInteger(numberOfSheets) || numberOfSheets <= 0) {
    throw new ValidationError('Number of sheets must be a positive integer.');
  }

  // Values in paise
  if (numberOfSheets === 1) return 21000000; // ₹2,10,000
  if (numberOfSheets === 2) return 30000000; // ₹3,00,000
  if (numberOfSheets === 3) return 40000000; // ₹4,00,000
  return 50000000; // ₹5,00,000 (4+ sheets)
}

/**
 * Allowed structural status transitions (Phase 8.7).
 *
 * Allowed:
 * NEW → ACTIVE
 * ACTIVE → PARTIALLY_REPAID
 * PARTIALLY_REPAID → CLOSED
 * ACTIVE → CLOSED
 * ACTIVE → OVERDUE
 */
export const ALLOWED_LOAN_STATUS_TRANSITIONS: Readonly<Record<LoanStatus, readonly LoanStatus[]>> = {
  NEW: ['ACTIVE'],
  ACTIVE: ['PARTIALLY_REPAID', 'CLOSED', 'OVERDUE'],
  PARTIALLY_REPAID: ['CLOSED'],
  CLOSED: [],
  OVERDUE: [],
};

export function isValidLoanStatusTransition(fromStatus: LoanStatus, toStatus: LoanStatus): boolean {
  if (fromStatus === toStatus) return false;
  const allowed = ALLOWED_LOAN_STATUS_TRANSITIONS[fromStatus];
  return allowed ? allowed.includes(toStatus) : false;
}

export function validateLoanStatusTransition(fromStatus: LoanStatus, toStatus: LoanStatus): void {
  if (!isValidLoanStatusTransition(fromStatus, toStatus)) {
    const allowed = ALLOWED_LOAN_STATUS_TRANSITIONS[fromStatus];
    const allowedStr = allowed && allowed.length > 0 ? allowed.join(', ') : 'none';
    throw new ValidationError(
      `Invalid loan status transition from "${fromStatus}" to "${toStatus}". Allowed transitions: ${allowedStr}.`
    );
  }
}

