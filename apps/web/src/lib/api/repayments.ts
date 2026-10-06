import { apiRequest } from './client';

export interface LoanRepayment {
  id: string;
  loanId: string;
  amountPaise: number;
  repaymentDate: string;
  recordedByAdminId: string;
  paymentMode: string;
  referenceNumber?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRepaymentInput {
  amountPaise: number;
  repaymentDate: string;
  paymentMode: string;
  referenceNumber?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface LoanOutstanding {
  principalAmountPaise: number;
  totalRepaidPaise: number;
  remainingPrincipalPaise: number;
}

export async function getLoanRepayments(loanId: string): Promise<LoanRepayment[]> {
  const response = await apiRequest<{ data: { items: LoanRepayment[] } }>(`/loans/${loanId}/repayments`);
  return response.data?.items ?? [];
}

export async function createRepayment(loanId: string, data: CreateRepaymentInput): Promise<LoanRepayment> {
  const response = await apiRequest<{ data: { repayment: LoanRepayment } }>(`/loans/${loanId}/repayments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data?.repayment;
}

export async function getLoanOutstanding(loanId: string): Promise<LoanOutstanding> {
  const response = await apiRequest<{ data: LoanOutstanding }>(`/loans/${loanId}/outstanding`);
  return response.data;
}
