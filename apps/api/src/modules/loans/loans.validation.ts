/**
 * Loans Validation (Phase 8.2 & 8.4)
 *
 * Provides structurally enforced payload validation for loan operations.
 */

import type { ValidationResult } from '@vanigar/validation';
import { isNonEmptyString, validatePaginationQuery } from '@vanigar/validation';
import type { FieldErrorDetail } from '@vanigar/shared-types';
import type { CreateLoanInput, LoanListFilter, LoanStatus } from './loans.types.js';

const VALID_LOAN_STATUSES = new Set<string>(['NEW', 'ACTIVE', 'PARTIALLY_REPAID', 'CLOSED', 'OVERDUE']);

export function validateCreateLoanBody(body: unknown): ValidationResult<CreateLoanInput> {
  const errors: FieldErrorDetail[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object', code: 'INVALID_BODY' }],
    };
  }

  const record = body as Record<string, unknown>;
  const dto: Partial<CreateLoanInput> = {};

  if (isNonEmptyString(record.memberNumber)) {
    dto.memberNumber = record.memberNumber.trim();
  } else {
    errors.push({ field: 'memberNumber', message: 'Member number is required', code: 'REQUIRED' });
  }

  if (typeof record.requestedAmountPaise === 'number' && Number.isInteger(record.requestedAmountPaise) && record.requestedAmountPaise > 0) {
    if (record.requestedAmountPaise > 50000000) {
      errors.push({ field: 'requestedAmountPaise', message: 'Requested amount cannot exceed ₹5,00,000', code: 'INVALID_FORMAT' });
    } else {
      dto.requestedAmountPaise = record.requestedAmountPaise;
    }
  } else {
    errors.push({ field: 'requestedAmountPaise', message: 'Requested amount must be a positive integer in paise', code: 'INVALID_FORMAT' });
  }

  if (isNonEmptyString(record.applicationDate)) {
    const d = new Date(record.applicationDate);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'applicationDate', message: 'Application date must be a valid ISO date', code: 'INVALID_FORMAT' });
    } else {
      dto.applicationDate = d.toISOString().split('T')[0]!;
    }
  } else {
    errors.push({ field: 'applicationDate', message: 'Application date is required', code: 'REQUIRED' });
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], data: dto as CreateLoanInput };
}

export function validateLoanListQuery(query: unknown): ValidationResult<LoanListFilter> {
  const errors: FieldErrorDetail[] = [];
  
  const pageResult = validatePaginationQuery(query);
  if (!pageResult.isValid) {
    errors.push(...pageResult.errors);
  }
  
  const result: Partial<LoanListFilter> = pageResult.data || { page: 1, pageSize: 20 };

  if (query && typeof query === 'object' && !Array.isArray(query)) {
    const record = query as Record<string, unknown>;

    if (record.status !== undefined && record.status !== '') {
      if (typeof record.status === 'string' && VALID_LOAN_STATUSES.has(record.status)) {
        result.status = record.status as LoanStatus;
      } else {
        errors.push({ field: 'status', message: 'Invalid loan status filter', code: 'INVALID_FORMAT' });
      }
    }

    if (record.memberNumber !== undefined && record.memberNumber !== '') {
      if (isNonEmptyString(record.memberNumber)) {
        result.memberNumber = record.memberNumber.trim();
      }
    }
  }
  
  if (errors.length > 0) return { isValid: false, errors };
  return { isValid: true, errors: [], data: result as LoanListFilter };
}

export function validateUpdateLoanStatusBody(body: unknown): ValidationResult<{ status: LoanStatus }> {
  const errors: FieldErrorDetail[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object', code: 'INVALID_BODY' }],
    };
  }

  const record = body as Record<string, unknown>;

  if (typeof record.status === 'string' && VALID_LOAN_STATUSES.has(record.status)) {
    return { isValid: true, errors: [], data: { status: record.status as LoanStatus } };
  } else {
    errors.push({
      field: 'status',
      message: `Invalid loan status. Must be one of: ${Array.from(VALID_LOAN_STATUSES).join(', ')}`,
      code: 'INVALID_STATUS',
    });
    return { isValid: false, errors };
  }
}

