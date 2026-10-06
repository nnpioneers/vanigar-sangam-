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
  loanId: string;
  amountPaise: number;
  repaymentDate: string;
  paymentMode: string;
  referenceNumber?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface LoanOutstandingCalculation {
  principalAmountPaise: number;
  totalRepaidPaise: number;
  remainingPrincipalPaise: number;
}
