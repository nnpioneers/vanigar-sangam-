/**
 * Guarantors Domain Types (Phase 9.1)
 *
 * Defines the strict, foundational types for the Guarantors module.
 */

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
