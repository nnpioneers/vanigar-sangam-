/**
 * Loans Eligibility Engine (Phase 8.8)
 *
 * Implements authoritative business rules for loan eligibility.
 * 
 * NOTE: The exact business convention for:
 * - what constitutes "first month fully completed"
 * - exact day counting (e.g. 30 distinct business days vs 1 calendar month)
 * - how missing, partial, or advance days affect that condition
 * is NOT fully resolved by committee.
 * 
 * In accordance with Phase 8.8 specifications:
 * - We do NOT invent a final convention.
 * - We isolate the unresolved condition behind this clearly named boundary.
 * - We strictly do NOT calculate or check monthly savings, 3x savings, or ₹18,000 limits.
 */

export interface FirstMonthEligibilityResult {
  isEligible: boolean;
  reason?: string;
  unresolvedConventionNote?: string;
}

/**
 * Evaluates whether a member has satisfied the preliminary first-month requirement.
 *
 * Confirmed rule: Member must have completed their first month before becoming eligible for a loan.
 * Provisional safe rule: If the member has 0 daily sheets on record, they have not started/completed their first month.
 */
export function evaluateFirstMonthEligibility(
  dailySheetCount: number
): FirstMonthEligibilityResult {
  if (dailySheetCount <= 0) {
    return {
      isEligible: false,
      reason: 'Member has no recorded daily sheet history. First month must be fully completed before loan eligibility.',
    };
  }

  return {
    isEligible: true,
    unresolvedConventionNote: 'Exact first-month completion rules (e.g. 30 calendar vs business days, handling of partial payments) are pending committee confirmation.',
  };
}
