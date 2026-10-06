/**
 * Daily Sheet Validation Schemas & Guards (Phase 6.4)
 *
 * Enforces strict input validation:
 * - Whitelists allowable fields (rejects unknown properties).
 * - Prohibits client from dictating authoritative calculated totals (dailyDueAmountPaise, totalDuePaise, numberOfSheets).
 * - Enforces calendar date format (YYYY-MM-DD).
 * - Rejects negative financial amounts.
 * - Rejects invalid status or paymentMode values.
 */

import {
  isNonEmptyString,
  isValidIsoDate,
  validatePaginationQuery,
} from '@vanigar/validation';
import type { FieldErrorDetail } from '@vanigar/shared-types';
import {
  DAILY_SHEET_STATUSES,
  PAYMENT_MODES,
  type DailySheetStatus,
  type PaymentMode,
  type DailySheetListFilter,
} from './daily-sheets.types.js';

export interface ValidationSuccess<T> {
  isValid: true;
  errors: [];
  data: T;
}

export interface ValidationFailure {
  isValid: false;
  errors: FieldErrorDetail[];
  data?: undefined;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validated client payload for creating a daily sheet entry.
 */
export interface ValidatedCreateDailySheetPayload {
  memberNumber?: string;
  memberId?: string;
  businessDate: string; // YYYY-MM-DD
  actualPaidPaise?: number;
  paymentTime?: string | null;
  paymentMode?: PaymentMode | null;
  previousArrearsPaise?: number;
  status?: DailySheetStatus;
  notes?: string | null;
  idempotencyKey?: string | null;
}

const ALLOWED_CREATE_FIELDS = new Set([
  'memberNumber',
  'memberId',
  'businessDate',
  'actualPaidPaise',
  'paymentTime',
  'paymentMode',
  'previousArrearsPaise',
  'status',
  'notes',
  'idempotencyKey',
]);

const PROHIBITED_CALCULATED_FIELDS = new Set([
  'dailyDueAmountPaise',
  'dailyDue',
  'totalDuePaise',
  'totalDue',
  'numberOfSheets',
  'sheets',
]);

/**
 * Validates request payload for creating a daily sheet entry.
 */
export function validateCreateDailySheetPayload(
  payload: unknown
): ValidationResult<ValidatedCreateDailySheetPayload> {
  const errors: FieldErrorDetail[] = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object', code: 'INVALID_TYPE' }],
    };
  }

  const raw = payload as Record<string, unknown>;

  // 1. Check for prohibited client-supplied calculated totals
  for (const key of Object.keys(raw)) {
    if (PROHIBITED_CALCULATED_FIELDS.has(key)) {
      errors.push({
        field: key,
        message: `Field "${key}" is calculated authoritatively by the server and cannot be supplied by the client`,
        code: 'PROHIBITED_FIELD',
      });
    }
  }

  // 2. Strict field whitelisting
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_CREATE_FIELDS.has(key) && !PROHIBITED_CALCULATED_FIELDS.has(key)) {
      errors.push({
        field: key,
        message: `Unknown field "${key}" is not permitted`,
        code: 'UNKNOWN_FIELD',
      });
    }
  }

  // 3. Member identification: memberNumber or memberId is required
  const hasMemberNumber = isNonEmptyString(raw.memberNumber);
  const hasMemberId = isNonEmptyString(raw.memberId);

  if (!hasMemberNumber && !hasMemberId) {
    errors.push({
      field: 'memberNumber',
      message: 'Either memberNumber or memberId is required to identify the member',
      code: 'REQUIRED',
    });
  }

  // 4. Business Date (required, YYYY-MM-DD)
  if (!isNonEmptyString(raw.businessDate)) {
    errors.push({
      field: 'businessDate',
      message: 'businessDate is required in YYYY-MM-DD format',
      code: 'REQUIRED',
    });
  } else if (!isValidIsoDate(raw.businessDate.trim())) {
    errors.push({
      field: 'businessDate',
      message: 'businessDate must be a valid calendar date in YYYY-MM-DD format',
      code: 'INVALID_DATE',
    });
  }

  // 5. Actual Paid (optional, non-negative integer)
  let actualPaidPaise: number | undefined;
  if (raw.actualPaidPaise !== undefined && raw.actualPaidPaise !== null) {
    const val = Number(raw.actualPaidPaise);
    if (!Number.isInteger(val) || val < 0) {
      errors.push({
        field: 'actualPaidPaise',
        message: 'actualPaidPaise must be a non-negative integer paise',
        code: 'INVALID_AMOUNT',
      });
    } else {
      actualPaidPaise = val;
    }
  }

  // 6. Previous Arrears (optional, non-negative integer)
  let previousArrearsPaise: number | undefined;
  if (raw.previousArrearsPaise !== undefined && raw.previousArrearsPaise !== null) {
    const val = Number(raw.previousArrearsPaise);
    if (!Number.isInteger(val) || val < 0) {
      errors.push({
        field: 'previousArrearsPaise',
        message: 'previousArrearsPaise must be a non-negative integer paise',
        code: 'INVALID_AMOUNT',
      });
    } else {
      previousArrearsPaise = val;
    }
  }

  // 7. Payment Mode (optional, must be approved vocabulary)
  let paymentMode: PaymentMode | null = null;
  if (raw.paymentMode !== undefined && raw.paymentMode !== null && raw.paymentMode !== '') {
    if (typeof raw.paymentMode !== 'string' || !PAYMENT_MODES.includes(raw.paymentMode as PaymentMode)) {
      errors.push({
        field: 'paymentMode',
        message: `paymentMode must be one of: ${PAYMENT_MODES.join(', ')}`,
        code: 'INVALID_PAYMENT_MODE',
      });
    } else {
      paymentMode = raw.paymentMode as PaymentMode;
    }
  }

  // 8. Status (optional, must be approved vocabulary)
  let status: DailySheetStatus | undefined;
  if (raw.status !== undefined && raw.status !== null && raw.status !== '') {
    if (typeof raw.status !== 'string' || !DAILY_SHEET_STATUSES.includes(raw.status as DailySheetStatus)) {
      errors.push({
        field: 'status',
        message: `status must be one of: ${DAILY_SHEET_STATUSES.join(', ')}`,
        code: 'INVALID_STATUS',
      });
    } else {
      status = raw.status as DailySheetStatus;
    }
  }

  // 9. Payment Time (optional, ISO timestamp)
  let paymentTime: string | null = null;
  if (raw.paymentTime !== undefined && raw.paymentTime !== null && raw.paymentTime !== '') {
    if (typeof raw.paymentTime !== 'string' || isNaN(new Date(raw.paymentTime).getTime())) {
      errors.push({
        field: 'paymentTime',
        message: 'paymentTime must be a valid ISO-8601 date string',
        code: 'INVALID_TIMESTAMP',
      });
    } else {
      paymentTime = new Date(raw.paymentTime).toISOString();
    }
  }

  // 10. Notes (optional text)
  let notes: string | null = null;
  if (raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== 'string') {
      errors.push({
        field: 'notes',
        message: 'notes must be a string',
        code: 'INVALID_TYPE',
      });
    } else {
      notes = raw.notes.trim() || null;
    }
  }

  // 11. Idempotency Key (optional string)
  let idempotencyKey: string | null = null;
  if (raw.idempotencyKey !== undefined && raw.idempotencyKey !== null) {
    if (typeof raw.idempotencyKey !== 'string' || raw.idempotencyKey.trim().length === 0 || raw.idempotencyKey.length > 100) {
      errors.push({
        field: 'idempotencyKey',
        message: 'idempotencyKey must be a non-empty string of up to 100 characters',
        code: 'INVALID_IDEMPOTENCY_KEY',
      });
    } else {
      idempotencyKey = raw.idempotencyKey.trim();
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      memberNumber: hasMemberNumber ? (raw.memberNumber as string).trim() : undefined,
      memberId: hasMemberId ? (raw.memberId as string).trim() : undefined,
      businessDate: (raw.businessDate as string).trim(),
      actualPaidPaise,
      paymentTime,
      paymentMode,
      previousArrearsPaise,
      status,
      notes,
      idempotencyKey,
    },
  };
}

/**
 * Validates query parameters for listing daily sheets.
 */
export function validateDailySheetListQuery(query: unknown): ValidationResult<DailySheetListFilter> {
  const errors: FieldErrorDetail[] = [];
  const raw = (query && typeof query === 'object' && !Array.isArray(query))
    ? (query as Record<string, unknown>)
    : {};

  let businessDate: string | undefined;
  if (raw.businessDate !== undefined && raw.businessDate !== null && raw.businessDate !== '') {
    if (typeof raw.businessDate !== 'string' || !isValidIsoDate(raw.businessDate.trim())) {
      errors.push({
        field: 'businessDate',
        message: 'businessDate query must be a valid calendar date in YYYY-MM-DD format',
        code: 'INVALID_DATE',
      });
    } else {
      businessDate = raw.businessDate.trim();
    }
  }

  let status: DailySheetStatus | undefined;
  if (raw.status !== undefined && raw.status !== null && raw.status !== '') {
    if (typeof raw.status !== 'string' || !DAILY_SHEET_STATUSES.includes(raw.status as DailySheetStatus)) {
      errors.push({
        field: 'status',
        message: `status query must be one of: ${DAILY_SHEET_STATUSES.join(', ')}`,
        code: 'INVALID_STATUS',
      });
    } else {
      status = raw.status as DailySheetStatus;
    }
  }

  let memberNumber: string | undefined;
  if (raw.memberNumber !== undefined && raw.memberNumber !== null && raw.memberNumber !== '') {
    if (typeof raw.memberNumber !== 'string') {
      errors.push({
        field: 'memberNumber',
        message: 'memberNumber query must be a string',
        code: 'INVALID_TYPE',
      });
    } else {
      memberNumber = raw.memberNumber.trim();
    }
  }

  const paginationRes = validatePaginationQuery(query);
  if (!paginationRes.isValid) {
    errors.push(...paginationRes.errors);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      businessDate,
      status,
      memberNumber,
      page: paginationRes.data?.page,
      pageSize: paginationRes.data?.pageSize,
    },
  };
}

export interface ValidatedCorrectDailySheetPayload {
  reason: string;
}

/**
 * Validates request payload for correcting a daily sheet entry.
 */
export function validateCorrectDailySheetPayload(
  payload: unknown
): ValidationResult<ValidatedCorrectDailySheetPayload> {
  const errors: FieldErrorDetail[] = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object', code: 'INVALID_TYPE' }],
    };
  }

  const raw = payload as Record<string, unknown>;

  // Check unknown fields
  for (const key of Object.keys(raw)) {
    if (key !== 'reason') {
      errors.push({
        field: key,
        message: `Unknown field "${key}" is not permitted`,
        code: 'UNKNOWN_FIELD',
      });
    }
  }

  // Reason (required, non-empty, up to 500 chars)
  if (!raw.reason || typeof raw.reason !== 'string' || !raw.reason.trim()) {
    errors.push({
      field: 'reason',
      message: 'Reason for correction is required',
      code: 'REQUIRED',
    });
  } else if (raw.reason.trim().length > 500) {
    errors.push({
      field: 'reason',
      message: 'Reason cannot exceed 500 characters',
      code: 'MAX_LENGTH_EXCEEDED',
    });
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      reason: (raw.reason as string).trim(),
    },
  };
}

