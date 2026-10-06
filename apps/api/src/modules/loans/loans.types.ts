/**
 * Loans Domain Types (Phase 8.2)
 *
 * Defines the strict, foundational types for the Loans module.
 */

export type LoanStatus = 'NEW' | 'ACTIVE' | 'PARTIALLY_REPAID' | 'CLOSED' | 'OVERDUE';

export interface Loan {
  id: string;
  memberId: string;
  memberNumber?: string;
  memberName?: string;
  shopName?: string | null;
  numberOfSheets?: number;
  requestedAmountPaise: number;
  approvedAmountPaise: number | null;
  status: LoanStatus;
  applicationDate: string;
  disbursementDate: string | null;
  maxDueDate: string | null;
  recordedByAdminId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLoanInput {
  memberNumber: string;
  requestedAmountPaise: number;
  applicationDate: string;
}

export interface LoanListFilter {
  memberNumber?: string;
  status?: LoanStatus;
  page?: number;
  pageSize?: number;
}
