/**
 * Disbursements Domain Types (Phase 10.6)
 */

export type DisbursementStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface LoanDisbursement {
  id: string;
  loanId: string;
  amountPaise: number;
  disbursementDate: string;
  cashAccountId: string | null;
  status: DisbursementStatus;
  recordedByAdminId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDisbursementInput {
  disbursementDate: string;
}
