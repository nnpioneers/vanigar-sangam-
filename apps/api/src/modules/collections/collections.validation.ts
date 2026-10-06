/**
 * Collections Validation (Phase 6.8)
 *
 * Enforces strict input validation for Collections query parameters and internal models.
 */

import {
  isValidIsoDate,
  validatePaginationQuery,
  validateUuidParam,
} from '@vanigar/validation';
import type { FieldErrorDetail } from '@vanigar/shared-types';
import { PAYMENT_MODES, type PaymentMode } from '../daily-sheets/daily-sheets.types.js';
import type { CollectionListFilter, CreateCollectionInput } from './collections.types.js';

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

const ALLOWED_STATUS_FILTERS = ['COLLECTED', 'CORRECTED', 'ALL'] as const;

/**
 * Validates query parameters for GET /api/v1/collections.
 */
export function validateCollectionListQuery(
  query: unknown
): ValidationResult<CollectionListFilter> {
  const errors: FieldErrorDetail[] = [];

  if (!query || typeof query !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'query', message: 'Query parameters must be an object', code: 'INVALID_TYPE' }],
    };
  }

  const raw = query as Record<string, unknown>;

  // Check unknown query parameters
  const allowedKeys = [
    'businessDate',
    'startDate',
    'endDate',
    'memberNumber',
    'paymentMode',
    'status',
    'page',
    'pageSize',
  ];

  for (const key of Object.keys(raw)) {
    if (!allowedKeys.includes(key)) {
      errors.push({
        field: key,
        message: `Unknown query parameter "${key}" is not permitted`,
        code: 'UNKNOWN_FIELD',
      });
    }
  }

  // Validate businessDate (YYYY-MM-DD)
  let businessDate: string | undefined;
  if (raw.businessDate !== undefined && raw.businessDate !== null && raw.businessDate !== '') {
    if (typeof raw.businessDate !== 'string' || !isValidIsoDate(raw.businessDate)) {
      errors.push({
        field: 'businessDate',
        message: 'businessDate must be a valid calendar date in YYYY-MM-DD format',
        code: 'INVALID_FORMAT',
      });
    } else {
      businessDate = raw.businessDate;
    }
  }

  // Validate startDate (YYYY-MM-DD)
  let startDate: string | undefined;
  if (raw.startDate !== undefined && raw.startDate !== null && raw.startDate !== '') {
    if (typeof raw.startDate !== 'string' || !isValidIsoDate(raw.startDate)) {
      errors.push({
        field: 'startDate',
        message: 'startDate must be a valid calendar date in YYYY-MM-DD format',
        code: 'INVALID_FORMAT',
      });
    } else {
      startDate = raw.startDate;
    }
  }

  // Validate endDate (YYYY-MM-DD)
  let endDate: string | undefined;
  if (raw.endDate !== undefined && raw.endDate !== null && raw.endDate !== '') {
    if (typeof raw.endDate !== 'string' || !isValidIsoDate(raw.endDate)) {
      errors.push({
        field: 'endDate',
        message: 'endDate must be a valid calendar date in YYYY-MM-DD format',
        code: 'INVALID_FORMAT',
      });
    } else {
      endDate = raw.endDate;
    }
  }

  // Validate memberNumber
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

  // Validate paymentMode
  let paymentMode: PaymentMode | undefined;
  if (raw.paymentMode !== undefined && raw.paymentMode !== null && raw.paymentMode !== '') {
    if (typeof raw.paymentMode !== 'string' || !PAYMENT_MODES.includes(raw.paymentMode as PaymentMode)) {
      errors.push({
        field: 'paymentMode',
        message: `paymentMode must be one of: ${PAYMENT_MODES.join(', ')}`,
        code: 'INVALID_ENUM',
      });
    } else {
      paymentMode = raw.paymentMode as PaymentMode;
    }
  }

  // Validate status
  let status: 'COLLECTED' | 'CORRECTED' | 'ALL' | undefined;
  if (raw.status !== undefined && raw.status !== null && raw.status !== '') {
    if (
      typeof raw.status !== 'string' ||
      !ALLOWED_STATUS_FILTERS.includes(raw.status as (typeof ALLOWED_STATUS_FILTERS)[number])
    ) {
      errors.push({
        field: 'status',
        message: `status must be one of: ${ALLOWED_STATUS_FILTERS.join(', ')}`,
        code: 'INVALID_ENUM',
      });
    } else {
      status = raw.status as 'COLLECTED' | 'CORRECTED' | 'ALL';
    }
  }

  // Validate pagination
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
      startDate,
      endDate,
      memberNumber,
      paymentMode,
      status,
      page: paginationRes.data?.page,
      pageSize: paginationRes.data?.pageSize,
    },
  };
}

/**
 * Validates domain creation inputs for Collection records.
 */
export function validateCreateCollectionInput(
  input: unknown
): ValidationResult<CreateCollectionInput> {
  const errors: FieldErrorDetail[] = [];

  if (!input || typeof input !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'input', message: 'Input must be an object', code: 'INVALID_TYPE' }],
    };
  }

  const raw = input as Record<string, unknown>;

  // dailySheetId
  const dsRes = validateUuidParam(raw.dailySheetId, 'dailySheetId');
  if (!dsRes.isValid) {
    errors.push(...dsRes.errors);
  }

  // memberId
  const memberRes = validateUuidParam(raw.memberId, 'memberId');
  if (!memberRes.isValid) {
    errors.push(...memberRes.errors);
  }

  // amountPaise
  if (typeof raw.amountPaise !== 'number' || !Number.isInteger(raw.amountPaise) || raw.amountPaise <= 0) {
    errors.push({
      field: 'amountPaise',
      message: 'amountPaise must be a positive integer greater than 0',
      code: 'INVALID_AMOUNT',
    });
  }

  // paymentMode
  if (typeof raw.paymentMode !== 'string' || !PAYMENT_MODES.includes(raw.paymentMode as PaymentMode)) {
    errors.push({
      field: 'paymentMode',
      message: `paymentMode must be one of: ${PAYMENT_MODES.join(', ')}`,
      code: 'INVALID_ENUM',
    });
  }

  // businessDate
  if (typeof raw.businessDate !== 'string' || !isValidIsoDate(raw.businessDate)) {
    errors.push({
      field: 'businessDate',
      message: 'businessDate must be a valid calendar date in YYYY-MM-DD format',
      code: 'INVALID_FORMAT',
    });
  }

  // recordedByAdminId
  const adminRes = validateUuidParam(raw.recordedByAdminId, 'recordedByAdminId');
  if (!adminRes.isValid) {
    errors.push(...adminRes.errors);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      dailySheetId: raw.dailySheetId as string,
      memberId: raw.memberId as string,
      amountPaise: raw.amountPaise as number,
      paymentMode: raw.paymentMode as PaymentMode,
      cashTransactionId: (raw.cashTransactionId as string | undefined) ?? null,
      businessDate: raw.businessDate as string,
      recordedByAdminId: raw.recordedByAdminId as string,
      collectedAt: raw.collectedAt ? (raw.collectedAt as string | Date) : undefined,
    },
  };
}
