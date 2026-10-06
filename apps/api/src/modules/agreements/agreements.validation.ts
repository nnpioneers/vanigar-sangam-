/**
 * Agreements Validation (Phase 10.2)
 */

import type { ValidationResult } from '@vanigar/validation';
import type { FieldErrorDetail } from '@vanigar/shared-types';
import type { CreateAgreementInput } from './agreements.types.js';

export function validateCreateAgreementBody(body: unknown): ValidationResult<CreateAgreementInput> {
  const errors: FieldErrorDetail[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object', code: 'INVALID_BODY' }],
    };
  }

  const data = body as Record<string, unknown>;

  if (typeof data.agreementDate !== 'string' || data.agreementDate.trim() === '') {
    errors.push({ field: 'agreementDate', message: 'Agreement date is required', code: 'REQUIRED_FIELD' });
  } else {
    // Validate ISO date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.agreementDate.trim())) {
      errors.push({ field: 'agreementDate', message: 'Date must be in YYYY-MM-DD format', code: 'INVALID_FORMAT' });
    } else {
      const d = new Date(data.agreementDate.trim());
      if (isNaN(d.getTime())) {
        errors.push({ field: 'agreementDate', message: 'Invalid date value', code: 'INVALID_DATE' });
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      agreementDate: (data.agreementDate as string).trim(),
    },
    errors: [],
  };
}
