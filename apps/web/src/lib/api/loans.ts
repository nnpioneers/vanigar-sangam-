/**
 * Loans API Client (Phase 8.5 & 8.6)
 */

import { apiRequest } from './client';

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

export interface LoanListFilter {
  memberNumber?: string;
  status?: LoanStatus | '';
  page?: number;
  pageSize?: number;
}

export interface PaginatedLoans {
  items: Loan[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchLoans(filter: LoanListFilter = {}): Promise<PaginatedLoans> {
  const params = new URLSearchParams();
  if (filter.memberNumber) params.append('memberNumber', filter.memberNumber);
  if (filter.status) params.append('status', filter.status);
  if (filter.page) params.append('page', filter.page.toString());
  if (filter.pageSize) params.append('pageSize', filter.pageSize.toString());

  const query = params.toString();
  const result = await apiRequest<{ data: PaginatedLoans }>(`/loans${query ? `?${query}` : ''}`);
  return result.data;
}

export async function fetchLoanById(id: string): Promise<Loan> {
  const result = await apiRequest<{ data: { loan: Loan } }>(`/loans/${id}`);
  return result.data.loan;
}

export async function fetchMemberLoans(memberNumber: string): Promise<Loan[]> {
  const result = await apiRequest<{ data: { loans: Loan[] } }>(`/loans/member/${memberNumber}`);
  return result.data.loans;
}

export interface CreateLoanInput {
  memberNumber: string;
  requestedAmountPaise: number;
  applicationDate: string;
}

export async function createLoan(input: CreateLoanInput): Promise<Loan> {
  const result = await apiRequest<{ data: { loan: Loan } }>('/loans', {
    method: 'POST',
    body: input,
  });
  return result.data.loan;
}

export async function fetchActiveLoanForMember(memberNumber: string): Promise<Loan | null> {
  const result = await apiRequest<{ data: { loan: Loan | null } }>(`/loans/member/${memberNumber}/active`);
  return result.data.loan;
}

// Phase 9: Guarantors
export type GuarantorStatus = 'ACTIVE' | 'RELEASED';

export interface Guarantor {
  id: string;
  loanId: string;
  guarantorMemberId: string;
  guarantorMemberNumber?: string;
  guarantorMemberName?: string;
  guarantorShopName?: string | null;
  responsibilityAmountPaise: number;
  status: GuarantorStatus;
  recordedByAdminId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuarantorInput {
  memberNumber: string;
  responsibilityAmountPaise: number;
}

export interface GuaranteedLoan {
  id: string;
  loanId: string;
  borrowerMemberNumber: string;
  borrowerMemberName: string;
  borrowerShopName?: string | null;
  loanAmountPaise: number;
  loanOutstandingPaise?: number | null;
  loanStatus: string;
  loanApplicationDate?: string | null;
  loanDisbursementDate?: string | null;
  responsibilityAmountPaise: number;
  guaranteeStatus: GuarantorStatus;
  createdAt: string;
}

export async function fetchGuarantorsForLoan(loanId: string): Promise<Guarantor[]> {
  const result = await apiRequest<{ items: Guarantor[] }>(`/loans/${loanId}/guarantors`);
  return result.items || [];
}

export async function fetchMemberGuarantees(
  memberNumber: string,
  page: number = 1,
  pageSize: number = 10
): Promise<{ items: GuaranteedLoan[]; total: number }> {
  const params = new URLSearchParams();
  if (page) params.append('page', page.toString());
  if (pageSize) params.append('pageSize', pageSize.toString());
  
  const query = params.toString();
  const result = await apiRequest<{ data: { items: GuaranteedLoan[]; total: number } }>(
    `/loans/member/${memberNumber}/guarantees${query ? `?${query}` : ''}`
  );
  return result.data || { items: [], total: 0 };
}

export async function addGuarantor(loanId: string, input: CreateGuarantorInput): Promise<Guarantor> {
  const result = await apiRequest<{ guarantor: Guarantor }>(`/loans/${loanId}/guarantors`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.guarantor;
}
