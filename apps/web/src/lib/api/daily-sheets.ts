/**
 * Daily Sheet API Client (Phase 6.5)
 *
 * Provides typed HTTP communication with the Daily Sheet API endpoints.
 * Operates purely through `apiRequest` without direct database access.
 */

import { apiRequest, ApiRequestError } from './client';

export type DailySheetStatus =
  | 'PAID'
  | 'ADVANCE_PAID'
  | 'ADVANCE_COVERED'
  | 'PARTIAL'
  | 'NOT_PAID'
  | 'OVERDUE';

export type PaymentMode =
  | 'CASH'
  | 'ONLINE'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'OTHER';

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
  isCorrected?: boolean;
  correctionReason?: string | null;
  correctedAt?: string | null;
  correctedByAdminId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDailySheetInput {
  memberNumber?: string;
  memberId?: string;
  businessDate: string; // YYYY-MM-DD
  actualPaidPaise?: number;
  paymentMode?: PaymentMode | null;
  paymentTime?: string | null;
  previousArrearsPaise?: number;
  notes?: string | null;
  idempotencyKey?: string | null;
}

export interface DailySheetListResponse {
  items: DailySheet[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface FetchDailySheetsParams {
  businessDate?: string;
  memberNumber?: string;
  status?: DailySheetStatus;
  page?: number;
  pageSize?: number;
}

/**
 * Creates a new Daily Sheet entry with authoritative server-side financial calculations.
 *
 * Calls: POST /api/v1/daily-sheets
 */
export async function createDailySheet(input: CreateDailySheetInput): Promise<DailySheet> {
  const res = await apiRequest<{ data: { dailySheet: DailySheet } }>('/daily-sheets', {
    method: 'POST',
    body: input,
  });

  return res.data.dailySheet;
}

/**
 * Fetches a daily sheet record by UUID.
 *
 * Calls: GET /api/v1/daily-sheets/:id
 */
export async function getDailySheetById(id: string): Promise<DailySheet> {
  const trimmed = (id || '').trim();
  if (!trimmed) {
    throw new ApiRequestError({
      message: 'Daily Sheet ID is required',
      status: 400,
      code: 'INVALID_INPUT',
    });
  }

  const res = await apiRequest<{ data: { dailySheet: DailySheet } }>(
    `/daily-sheets/${encodeURIComponent(trimmed)}`,
    {
      method: 'GET',
    }
  );

  return res.data.dailySheet;
}

/**
 * Fetches a paginated and filtered list of daily sheet entries.
 *
 * Calls: GET /api/v1/daily-sheets
 */
export async function fetchDailySheets(
  params: FetchDailySheetsParams = {}
): Promise<DailySheetListResponse> {
  const query: Record<string, string | number | undefined> = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  };

  if (params.businessDate && params.businessDate.trim()) {
    query.businessDate = params.businessDate.trim();
  }
  if (params.memberNumber && params.memberNumber.trim()) {
    query.memberNumber = params.memberNumber.trim();
  }
  if (params.status && params.status.trim()) {
    query.status = params.status.trim();
  }

  const res = await apiRequest<{ data: DailySheetListResponse }>('/daily-sheets', {
    method: 'GET',
    query,
  });

  return res.data;
}

/**
 * Fetches daily sheet history for a member by their member number.
 *
 * Calls: GET /api/v1/daily-sheets/member/:memberNumber
 */
export async function fetchMemberDailySheetHistory(
  memberNumber: string,
  page = 1,
  pageSize = 20
): Promise<DailySheetListResponse> {
  const trimmed = (memberNumber || '').trim();
  if (!trimmed) {
    throw new ApiRequestError({
      message: 'Member number is required',
      status: 400,
      code: 'INVALID_INPUT',
    });
  }

  const res = await apiRequest<{ data: DailySheetListResponse }>(
    `/daily-sheets/member/${encodeURIComponent(trimmed)}`,
    {
      method: 'GET',
      query: { page, pageSize },
    }
  );

  return res.data;
}

/**
 * Corrects/voids an existing Daily Sheet record in an auditable manner (Phase 6.6).
 *
 * Calls: POST /api/v1/daily-sheets/:id/correct
 */
export async function correctDailySheet(
  id: string,
  reason: string
): Promise<{ dailySheet: DailySheet; correction: DailySheetCorrection }> {
  const trimmed = (id || '').trim();
  if (!trimmed) {
    throw new ApiRequestError({
      message: 'Daily Sheet ID is required',
      status: 400,
      code: 'INVALID_INPUT',
    });
  }

  const res = await apiRequest<{ data: { dailySheet: DailySheet; correction: DailySheetCorrection } }>(
    `/daily-sheets/${encodeURIComponent(trimmed)}/correct`,
    {
      method: 'POST',
      body: { reason },
    }
  );

  return res.data;
}

