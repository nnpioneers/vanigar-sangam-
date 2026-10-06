/**
 * Agreements Service (Phase 10.2)
 */

import { AgreementsRepository } from './agreements.repository.js';
import type { LoanAgreement, CreateAgreementInput } from './agreements.types.js';
import { LoansRepository } from '../loans/loans.repository.js';
import { NotFoundError, ConflictError } from '../../errors/app-error.js';
import { withTransaction } from '../../database/index.js';

export class AgreementsService {
  constructor(
    private readonly repo: AgreementsRepository,
    private readonly loansRepo: LoansRepository
  ) {}

  async getAgreementForLoan(loanId: string): Promise<LoanAgreement | null> {
    const loan = await this.loansRepo.findById(loanId);
    if (!loan) throw new NotFoundError('Loan not found');
    return this.repo.findByLoanId(loanId);
  }

  async createAgreement(loanId: string, input: CreateAgreementInput, adminId: string): Promise<LoanAgreement> {
    return withTransaction(async (tx) => {
      // 1. Check if loan exists
      const loan = await this.loansRepo.findById(loanId, tx);
      if (!loan) throw new NotFoundError('Loan not found');

      // 2. Check if loan is in a structurally valid state for agreement
      if (loan.status !== 'NEW' && loan.status !== 'ACTIVE') {
        throw new ConflictError('Loan must be NEW or ACTIVE to create an agreement');
      }

      // 3. Prevent duplicate active agreement for this loan
      const existing = await this.repo.findByLoanId(loanId, tx);
      if (existing) {
        throw new ConflictError('Loan already has an agreement');
      }

      // 4. Create the agreement safely
      return this.repo.create(loanId, input.agreementDate, adminId, tx);
    });
  }
}
