/**
 * Guarantors Service (Phase 9.2)
 *
 * Coordinates business rules, validation, and guarantor lifecycle management.
 */

import { GuarantorsRepository } from './guarantors.repository.js';
import type { Guarantor, CreateGuarantorInput, GuaranteedLoan } from './guarantors.types.js';
import { MemberRepository } from '../members/members.repository.js';
import { LoansRepository } from '../loans/loans.repository.js';
import { NotFoundError, ConflictError, ValidationError } from '../../errors/app-error.js';
import { withTransaction } from '../../database/index.js';

export class GuarantorsService {
  constructor(
    private readonly repo: GuarantorsRepository,
    private readonly membersRepo: MemberRepository,
    private readonly loansRepo: LoansRepository
  ) {}

  async getGuarantorsForLoan(loanId: string): Promise<Guarantor[]> {
    const loan = await this.loansRepo.findById(loanId);
    if (!loan) throw new NotFoundError('Loan not found');
    return this.repo.findByLoanId(loanId);
  }

  async getGuaranteesByMemberNumber(
    memberNumber: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ items: GuaranteedLoan[]; total: number }> {
    const member = await this.membersRepo.findByMemberNumber(memberNumber);
    if (!member) throw new NotFoundError('Member not found');
    return this.repo.findGuaranteesByMemberNumber(memberNumber, page, pageSize);
  }

  async getGuarantor(id: string): Promise<Guarantor> {
    const guarantor = await this.repo.findById(id);
    if (!guarantor) throw new NotFoundError('Guarantor not found');
    return guarantor;
  }

  async addGuarantor(loanId: string, input: CreateGuarantorInput, adminId: string): Promise<Guarantor> {
    return withTransaction(async (tx) => {
      // 1. Loan exists (locked for concurrency protection)
      const loan = await this.loansRepo.findByIdForUpdate(loanId, tx);
      if (!loan) throw new NotFoundError('Loan not found');

      // 2. Structurally valid state (e.g., NEW or ACTIVE)
      if (!['NEW', 'ACTIVE'].includes(loan.status)) {
        throw new ConflictError('Guarantors can only be added to NEW or ACTIVE loans.');
      }

      // 3. Guarantor member exists
      const member = await this.membersRepo.findByMemberNumber(input.memberNumber, tx);
      if (!member) {
        throw new NotFoundError('Guarantor member not found');
      }

      // 4. Guarantor is not the borrower
      if (member.id === loan.memberId) {
        throw new ConflictError('A member cannot be a guarantor for their own loan.');
      }

      // 5. Not already attached
      const isAlreadyAttached = await this.repo.isGuarantorForLoan(loanId, member.id, tx);
      if (isAlreadyAttached) {
        throw new ConflictError('This member is already a guarantor for this loan.');
      }

      // 6. Max 3 guarantors
      const count = await this.repo.getGuarantorCountForLoan(loanId, tx);
      if (count >= 3) {
        throw new ConflictError('A loan can have a maximum of 3 guarantors.');
      }

      // 7. Amount > 0 (handled by zod, but double checking here)
      if (input.responsibilityAmountPaise <= 0) {
        throw new ValidationError('Responsibility amount must be positive.');
      }

      // 8. Amount <= loan amount
      if (input.responsibilityAmountPaise > loan.requestedAmountPaise) {
        throw new ValidationError('Responsibility amount cannot exceed the loan amount.');
      }

      // 9. Total responsibility <= loan amount
      const currentTotal = await this.repo.getTotalResponsibilityForLoan(loanId, tx);
      if (currentTotal + input.responsibilityAmountPaise > loan.requestedAmountPaise) {
        throw new ValidationError(
          `Total guarantor responsibility exceeds loan amount. Available to guarantee: ₹${(loan.requestedAmountPaise - currentTotal) / 100}`
        );
      }

      try {
        return await this.repo.create(loanId, member.id, input.responsibilityAmountPaise, adminId, tx);
      } catch (err: unknown) {
        // Concurrency protection: catch PostgreSQL unique violation
        const dbErr = err as { code?: string; constraint?: string };
        if (dbErr.code === '23505' && dbErr.constraint === 'uq_loan_guarantor') {
          throw new ConflictError('This member is already a guarantor for this loan.');
        }
        throw err;
      }
    });
  }
}


