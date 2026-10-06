/**
 * `@vanigar/rules`
 *
 * Purpose: the single, pure business-rule engine. No I/O, no database, no
 * clock reads — inputs in, decisions out.
 *
 * Phase 1.1 status: package boundary and export mechanism only.
 *
 * NOT implemented in this phase (they belong to later phases and/or are
 * blocked by unresolved requirements):
 *
 *   - loan eligibility (including first-month and re-loan rules)
 *   - daily sheet status resolution
 *   - advance payment behaviour
 *   - arrears settlement order
 *   - loan repayment rules
 *   - guarantor eligibility
 *   - overdue / max due date calculation
 *   - cash policy
 *   - year-end service deduction execution
 *
 * Confirmed numeric rules (contribution, loan limits, year-end slabs) are
 * introduced in a later phase together with their regression tests.
 */
export const RULES_PACKAGE_NAME = '@vanigar/rules';

export * from './daily-sheet-calculations.js';
