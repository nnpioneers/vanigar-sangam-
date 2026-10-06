/**
 * Daily Sheet Domain & DTO Types (Phase 6.1 — 6.4)
 */

export const DAILY_SHEET_STATUSES = [
  'PAID',
  'ADVANCE_PAID',
  'ADVANCE_COVERED',
  'PARTIAL',
  'NOT_PAID',
  'OVERDUE',
] as const;

export type DailySheetStatus = (typeof DAILY_SHEET_STATUSES)[number];

export const PAYMENT_MODES = [
  'CASH',
  'ONLINE',
  'BANK_TRANSFER',
  'CHEQUE',
  'OTHER',
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];

/**
 * Raw database row shape for daily_sheets table.
 */
export interface DailySheetRow {
  id: string;
  member_id: string;
  business_date: string | Date;
  number_of_sheets: number | string;
  daily_due_amount_paise: string | number;
  previous_arrears_paise: string | number;
  total_due_paise: string | number;
  actual_paid_paise: string | number;
  status: DailySheetStatus;
  payment_time: Date | string | null;
  payment_mode: PaymentMode | null;
  notes: string | null;
  idempotency_key: string | null;
  recorded_by_admin_id: string;
  created_at: Date | string;
  updated_at: Date | string;
  // Correction join fields
  correction_id?: string | null;
  correction_reason?: string | null;
  corrected_at?: Date | string | null;
  corrected_by_admin_id?: string | null;
}

/**
 * Enriched row shape with member metadata (e.g. from JOIN).
 */
export interface DailySheetWithMemberRow extends DailySheetRow {
  member_number: string;
  member_name: string;
}

/**
 * Domain entity model for Daily Sheet.
 */
export interface DailySheet {
  id: string;
  memberId: string;
  memberNumber?: string;
  memberName?: string;
  businessDate: string; // YYYY-MM-DD
  numberOfSheets: number;
  dailyDueAmountPaise: number;
  previousArrearsPaise: number;
  totalDuePaise: number;
  actualPaidPaise: number;
  balanceRemainingPaise: number;
  excessPaidPaise: number;
  status: DailySheetStatus;
  paymentTime: string | null;
  paymentMode: PaymentMode | null;
  notes: string | null;
  idempotencyKey: string | null;
  recordedByAdminId: string;
  isCorrected: boolean;
  correctionReason: string | null;
  correctedAt: string | null;
  correctedByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw database row shape for daily_sheet_corrections table.
 */
export interface DailySheetCorrectionRow {
  id: string;
  original_daily_sheet_id: string;
  member_id: string;
  business_date: string | Date;
  original_actual_paid_paise: string | number;
  original_status: DailySheetStatus;
  reason: string;
  reversal_cash_transaction_id: string | null;
  corrected_by_admin_id: string;
  created_at: Date | string;
}

/**
 * Domain entity model for Daily Sheet Correction.
 */
export interface DailySheetCorrection {
  id: string;
  originalDailySheetId: string;
  memberId: string;
  businessDate: string;
  originalActualPaidPaise: number;
  originalStatus: DailySheetStatus;
  reason: string;
  reversalCashTransactionId: string | null;
  correctedByAdminId: string;
  createdAt: string;
}

/**
 * Input DTO for creating a daily sheet correction.
 */
export interface CreateDailySheetCorrectionDto {
  originalDailySheetId: string;
  memberId: string;
  businessDate: string;
  originalActualPaidPaise: number;
  originalStatus: DailySheetStatus;
  reason: string;
  reversalCashTransactionId?: string | null;
  correctedByAdminId: string;
}

/**
 * Input DTO for creating a daily sheet entry via Repository.
 */
export interface CreateDailySheetDto {
  memberId: string;
  businessDate: string; // YYYY-MM-DD
  numberOfSheets: number;
  dailyDueAmountPaise: number;
  previousArrearsPaise?: number;
  totalDuePaise: number;
  actualPaidPaise?: number;
  status: DailySheetStatus;
  paymentTime?: string | null;
  paymentMode?: PaymentMode | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  recordedByAdminId: string;
}

/**
 * Filter query options for listing daily sheets.
 */
export interface DailySheetListFilter {
  businessDate?: string;
  memberNumber?: string;
  status?: DailySheetStatus;
  page?: number;
  pageSize?: number;
}
