/**
 * Agreements Domain Types (Phase 10.2)
 */

export type AgreementStatus = 'DRAFT' | 'SIGNED' | 'CANCELLED';

export interface LoanAgreement {
  id: string;
  loanId: string;
  agreementNumber: string | null;
  agreementDate: string;
  status: AgreementStatus;
  recordedByAdminId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgreementInput {
  agreementDate: string;
}
