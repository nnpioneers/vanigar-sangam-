/**
 * Disbursements Validation (Phase 10.8)
 */

import type { ValidationResult } from '@vanigar/validation';
import type { FieldErrorDetail } from '@vanigar/shared-types';
import type { CreateDisbursementInput } from './disbursements.types.js';

export function validateCreateDisbursementBody(body: unknown): ValidationResult<CreateDisbursementInput> {
  const errors: FieldErrorDetail[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object', code: 'INVALID_BODY' }],
    };
  }

  const data = body as Record<string, unknown>;

  if (typeof data.disbursementDate !== 'string' || data.disbursementDate.trim() === '') {
    errors.push({ field: 'disbursementDate', message: 'Disbursement date is required', code: 'REQUIRED_FIELD' });
  } else {
    // Validate ISO date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.disbursementDate.trim())) {
      errors.push({ field: 'disbursementDate', message: 'Date must be in YYYY-MM-DD format', code: 'INVALID_FORMAT' });
    } else {
      const d = new Date(data.disbursementDate.trim());
      if (isNaN(d.getTime())) {
        errors.push({ field: 'disbursementDate', message: 'Invalid date value', code: 'INVALID_DATE' });
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      disbursementDate: (data.disbursementDate as string).trim(),
    },
    errors: [],
  };
}
