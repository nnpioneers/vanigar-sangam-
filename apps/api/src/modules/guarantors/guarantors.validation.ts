/**
 * Guarantors Validation (Phase 9.2)
 */

import type { ValidationResult } from '@vanigar/validation';
import type { FieldErrorDetail } from '@vanigar/shared-types';
import type { CreateGuarantorInput } from './guarantors.types.js';

export function validateCreateGuarantorBody(body: unknown): ValidationResult<CreateGuarantorInput> {
  const errors: FieldErrorDetail[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object', code: 'INVALID_BODY' }],
    };
  }

  const data = body as Record<string, unknown>;

  if (typeof data.memberNumber !== 'string' || data.memberNumber.trim() === '') {
    errors.push({ field: 'memberNumber', message: 'Guarantor member number is required', code: 'REQUIRED_FIELD' });
  }

  if (typeof data.responsibilityAmountPaise !== 'number' || !Number.isInteger(data.responsibilityAmountPaise) || data.responsibilityAmountPaise <= 0) {
    errors.push({ field: 'responsibilityAmountPaise', message: 'Amount must be a positive integer', code: 'INVALID_AMOUNT' });
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      memberNumber: (data.memberNumber as string).trim(),
      responsibilityAmountPaise: data.responsibilityAmountPaise as number,
    },
    errors: [],
  };
}
