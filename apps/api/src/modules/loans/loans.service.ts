/**
 * Loans Service (Phase 8.2, 8.6, 8.7, 8.8, 8.10)
 *
 * Coordinates business rules, validation, and loan lifecycle management.
 */

import { ConflictError, NotFoundError, ValidationError } from '../../errors/app-error.js';
import type { ServiceContext } from '../module.types.js';
import type { LoansRepository } from './loans.repository.js';
import type { MemberRepository } from '../members/members.repository.js';
import { getMaximumLoanAmountForSheets, validateLoanStatusTransition } from './loans.rules.js';
import { evaluateFirstMonthEligibility } from './loans.eligibility.js';
import type { Loan, CreateLoanInput, LoanListFilter, LoanStatus } from './loans.types.js';

export class LoansService {
  constructor(
    private readonly loansRepo: LoansRepository,
    private readonly memberRepo: MemberRepository
  ) {}

  async getLoanById(id: string, context?: ServiceContext): Promise<Loan> {
    const loan = await this.loansRepo.findById(id, context?.tx);
    if (!loan) {
      throw new NotFoundError(`Loan with ID "${id}" not found`);
    }
    return loan;
  }

  async getLoansByMemberNumber(memberNumber: string, context?: ServiceContext): Promise<Loan[]> {
    const member = await this.memberRepo.findByMemberNumber(memberNumber, context?.tx);
    if (!member) {
      throw new NotFoundError(`Member with number "${memberNumber}" not found`);
    }
    return this.loansRepo.findByMemberId(member.id, context?.tx);
  }

  async getActiveLoanByMemberNumber(memberNumber: string, context?: ServiceContext): Promise<Loan | null> {
    const member = await this.memberRepo.findByMemberNumber(memberNumber, context?.tx);
    if (!member) {
      throw new NotFoundError(`Member with number "${memberNumber}" not found`);
    }
    return this.loansRepo.findActiveLoanByMemberId(member.id, context?.tx);
  }

  async listLoans(
    filter: LoanListFilter,
    context?: ServiceContext
  ): Promise<{ items: Loan[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;

    const result = await this.loansRepo.findMany(filter, context?.tx);

    return {
      items: result.items,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    };
  }

  async transitionLoanStatus(
    id: string,
    targetStatus: LoanStatus,
    adminId: string,
    context?: ServiceContext
  ): Promise<Loan> {
    const loan = await this.getLoanById(id, context);

    // Validate structural lifecycle transition using pure rules engine
    validateLoanStatusTransition(loan.status, targetStatus);

    return this.loansRepo.updateStatus(id, targetStatus, context?.tx);
  }

  async createLoan(
    input: CreateLoanInput,
    adminId: string,
    context?: ServiceContext
  ): Promise<Loan> {
    if (input.requestedAmountPaise <= 0) {
      throw new ValidationError('Requested amount must be greater than zero.');
    }

    if (input.requestedAmountPaise > 50000000) {
      throw new ValidationError('Requested amount cannot exceed absolute limit of ₹5,00,000.');
    }

    // Authoritative server-side member resolution
    const member = await this.memberRepo.findByMemberNumber(input.memberNumber, context?.tx);
    if (!member) {
      throw new NotFoundError(`Member with number "${input.memberNumber}" not found`);
    }
    
    if (member.status !== 'ACTIVE') {
      throw new ConflictError('Cannot create a loan for an inactive member.');
    }

    // Phase 8.8: First-month completion gate
    // Must be evaluated from actual Daily Sheet history.
    // Unresolved counting details isolated in evaluateFirstMonthEligibility.
    const dailySheetCount = await this.loansRepo.getMemberDailySheetCount(member.id, context?.tx);
    const eligibility = evaluateFirstMonthEligibility(dailySheetCount);
    if (!eligibility.isEligible) {
      throw new ConflictError(eligibility.reason || 'Member has not fully completed their first month.');
    }

    // Phase 8.8: Amount gate against sheet slab
    const maxAllowedPaise = getMaximumLoanAmountForSheets(member.numberOfSheets);
    if (input.requestedAmountPaise > maxAllowedPaise) {
      throw new ValidationError(`Requested amount exceeds maximum limit of ₹${maxAllowedPaise / 100} for ${member.numberOfSheets} sheets.`);
    }

    // Phase 8.8: Overdue beyond 100 days gate.
    //
    // A member with an OVERDUE loan whose application_date is older than 100 days
    // cannot create a new loan until the overdue loan is manually settled (CLOSED).
    //
    // This is a STRUCTURAL check only: it uses application_date from the database,
    // not repayment calculations or outstanding balances.
    // OVERDUE status is set manually by admin via PATCH /loans/:id/status.
    // No automatic overdue calculation occurs here.
    //
    // This gate fires BEFORE the generic active-loan gate so it produces a specific,
    // actionable error message for long-outstanding overdue cases.
    const isBlockedByOverdue = await this.loansRepo.hasOverdueLoanBeyondDays(
      member.id,
      100,
      context?.tx
    );
    if (isBlockedByOverdue) {
      throw new ConflictError(
        'Member has an overdue loan that is more than 100 days old. New loans are blocked until the overdue loan is settled.'
      );
    }

    // Phase 8.8: Only ONE active loan gate (NEW, ACTIVE, PARTIALLY_REPAID, OVERDUE)
    const hasActive = await this.loansRepo.hasActiveLoan(member.id, context?.tx);
    if (hasActive) {
      throw new ConflictError('Member already has an active loan. Only one active loan is allowed.');
    }

    try {
      return await this.loansRepo.create(member.id, input, adminId, context?.tx);
    } catch (err: unknown) {
      // Concurrency protection: catch PostgreSQL unique violation on idx_loans_single_active_per_member
      const dbErr = err as { code?: string; constraint?: string };
      if (dbErr.code === '23505' && dbErr.constraint === 'idx_loans_single_active_per_member') {
        throw new ConflictError('Member already has an active loan. Only one active loan is allowed.');
      }
      throw err;
    }
  }
}
