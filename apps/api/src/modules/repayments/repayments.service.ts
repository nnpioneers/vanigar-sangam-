import { withTransaction } from '../../database/index.js';
import { AppError } from '../../errors/app-error.js';
import { LoansRepository } from '../loans/loans.repository.js';
import {
  createRepaymentWithAudit,
  getRepaymentByIdempotencyKey,
  listRepaymentsByLoanId,
  getRepaymentById,
} from './repayments.repository.js';
import type { LoanRepayment, CreateRepaymentInput, LoanOutstandingCalculation } from './repayments.types.js';
interface RequestContext {
  adminId: string;
  timestamp: string;
}

export async function createRepayment(
  ctx: RequestContext,
  input: CreateRepaymentInput
): Promise<LoanRepayment> {
  const { adminId } = ctx;

  if (input.idempotencyKey) {
    const existing = await getRepaymentByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;
  }

  if (input.amountPaise <= 0) {
    throw new AppError('Repayment amount must be strictly greater than zero.', 400, 'INVALID_INPUT');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.repaymentDate) || isNaN(Date.parse(input.repaymentDate))) {
    throw new AppError('Invalid repayment date format.', 400, 'INVALID_INPUT');
  }

  const loansRepo = new LoansRepository();
  const loan = await loansRepo.findById(input.loanId);
  if (!loan) {
    throw new AppError('Loan not found.', 404, 'NOT_FOUND');
  }

  if (loan.status === 'CLOSED') {
    throw new AppError('Cannot record repayment against a CLOSED loan.', 400, 'INVALID_STATE');
  }

  const outstanding = await calculateLoanOutstanding(input.loanId);
  if (outstanding.remainingPrincipalPaise - input.amountPaise < 0) {
    throw new AppError(
      'Repayment exceeds authoritative outstanding principal. Overpayment policy is currently unresolved.',
      400,
      'PENDING_BUSINESS_RULE'
    );
  }

  try {
    return await withTransaction(async (client) => {
    // Re-fetch loan with lock if necessary, but standard transaction is fine for now since we rely on append-only logic.
    const repayment = await createRepaymentWithAudit(client, adminId, input);

    // If loan is NEW or ACTIVE, transition to PARTIALLY_REPAID.
    // NOTE: We intentionally DO NOT auto-transition to CLOSED because overpayment/day-count settlement 
    // business rules are explicitly marked as unresolved pending policy.
    if (loan.status === 'NEW' || loan.status === 'ACTIVE') {
      await loansRepo.updateStatus(loan.id, 'PARTIALLY_REPAID', client);
    }

    // NOTE: Financial Ledger / Cash integration is intentionally omitted pending unresolved cash account policy.
    // Currently, there is no rule specifying which admin cash account should receive the repayment, 
    // nor if multiple accounts are allowed.

    return repayment;
  });
  } catch (err: any) {
    if (err.code === '23505' && err.constraint === 'loan_repayments_idempotency_key_key') {
      const existing = await getRepaymentByIdempotencyKey(input.idempotencyKey!);
      if (existing) return existing;
      throw new AppError('Concurrent idempotency conflict.', 409, 'CONFLICT');
    }
    throw err;
  }
}

export async function getRepayment(id: string): Promise<LoanRepayment> {
  const repayment = await getRepaymentById(id);
  if (!repayment) {
    throw new AppError('Repayment not found.', 404, 'NOT_FOUND');
  }
  return repayment;
}

export async function getLoanRepayments(loanId: string): Promise<LoanRepayment[]> {
  const loansRepo = new LoansRepository();
  const loan = await loansRepo.findById(loanId);
  if (!loan) {
    throw new AppError('Loan not found.', 404, 'NOT_FOUND');
  }
  return await listRepaymentsByLoanId(loanId);
}

/**
 * Derives the current outstanding principal deterministically from authoritative financial transactions.
 * NOTE: This is purely principal calculation. Unresolved rules like interest, penalties, or service fees
 * are strictly omitted.
 */
export async function calculateLoanOutstanding(loanId: string): Promise<LoanOutstandingCalculation> {
  const loansRepo = new LoansRepository();
  const loan = await loansRepo.findById(loanId);
  if (!loan) {
    throw new AppError('Loan not found.', 404, 'NOT_FOUND');
  }

  const authoritativeAmount = loan.approvedAmountPaise || loan.requestedAmountPaise;
  const repayments = await listRepaymentsByLoanId(loanId);

  const totalRepaidPaise = repayments.reduce((sum, r) => sum + r.amountPaise, 0);
  
  // NOTE: Overpayment behavior (where remaining < 0) is unresolved.
  // We simply calculate the mathematical difference.
  const remainingPrincipalPaise = authoritativeAmount - totalRepaidPaise;

  return {
    principalAmountPaise: authoritativeAmount,
    totalRepaidPaise,
    remainingPrincipalPaise,
  };
}
