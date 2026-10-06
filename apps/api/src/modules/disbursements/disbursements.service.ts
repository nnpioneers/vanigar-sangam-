/**
 * Disbursements Service (Phase 10.7, 10.8)
 */

import { DisbursementsRepository } from './disbursements.repository.js';
import type { LoanDisbursement, CreateDisbursementInput } from './disbursements.types.js';
import { LoansRepository } from '../loans/loans.repository.js';
import { AgreementsRepository } from '../agreements/agreements.repository.js';
import { NotFoundError, ConflictError } from '../../errors/app-error.js';
import { withTransaction } from '../../database/index.js';

export class DisbursementsService {
  constructor(
    private readonly repo: DisbursementsRepository,
    private readonly loansRepo: LoansRepository,
    private readonly agreementsRepo: AgreementsRepository
  ) {}

  async getDisbursementForLoan(loanId: string): Promise<LoanDisbursement | null> {
    const loan = await this.loansRepo.findById(loanId);
    if (!loan) throw new NotFoundError('Loan not found');
    return this.repo.findByLoanId(loanId);
  }

  async createDisbursement(loanId: string, input: CreateDisbursementInput, adminId: string): Promise<LoanDisbursement> {
    return withTransaction(async (tx) => {
      // 1. Check if loan exists
      const loan = await this.loansRepo.findById(loanId, tx);
      if (!loan) throw new NotFoundError('Loan not found');

      // 2. Check loan structural state
      if (loan.status !== 'ACTIVE' && loan.status !== 'NEW') {
        throw new ConflictError('Loan must be NEW or ACTIVE to request disbursement');
      }

      // 3. Agreement must exist for disbursement (Architectural safety)
      const agreement = await this.agreementsRepo.findByLoanId(loanId, tx);
      if (!agreement) {
        throw new ConflictError('An agreement must be recorded before loan disbursement.');
      }

      // 4. Prevent duplicate disbursement initiation
      const existing = await this.repo.findByLoanId(loanId, tx);
      if (existing) {
        throw new ConflictError('A disbursement record already exists for this loan.');
      }

      // 5. Create structural record in PENDING state because cash account policy is unresolved
      // Do NOT silently select an account. Leave it as PENDING and block cash ledger transaction.
      const disbursement = await this.repo.createPendingDisbursement(
        loanId,
        loan.requestedAmountPaise,
        input.disbursementDate,
        adminId,
        tx
      );

      // We do NOT create the cash transaction because cashAccountId is strictly unresolved.
      // The requirement dictates to allow the structural record to remain pending until policy is explicitly resolved.
      
      return disbursement;
    });
  }
}
