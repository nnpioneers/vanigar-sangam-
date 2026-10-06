/**
 * Member Validation Contracts (Phase 5.2)
 *
 * Provides structurally enforced payload validation for member operations.
 * Rejects unknown or sensitive fields from accidentally entering the database.
 */

import type { ValidationResult } from '@vanigar/validation';
import { isNonEmptyString, validatePaginationQuery, type PaginationOptions } from '@vanigar/validation';
import type { FieldErrorDetail } from '@vanigar/shared-types';
import type { CreateMemberDto, UpdateMemberDto, RelationshipType, MemberStatus } from './members.types.js';

const VALID_RELATIONSHIPS = new Set<string>(['FATHER', 'MOTHER', 'HUSBAND', 'WIFE', 'SON', 'DAUGHTER', 'OTHER']);
const VALID_STATUSES = new Set<string>(['ACTIVE', 'INACTIVE']);

export function validateCreateMemberPayload(body: unknown): ValidationResult<CreateMemberDto> {
  const errors: FieldErrorDetail[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object', code: 'INVALID_BODY' }],
    };
  }

  const record = body as Record<string, unknown>;

  // Strict field extraction to prevent arbitrary fields
  const dto: Partial<CreateMemberDto> = {};

  if (isNonEmptyString(record.memberNumber)) {
    dto.memberNumber = record.memberNumber.trim();
  } else {
    errors.push({ field: 'memberNumber', message: 'Member number is required', code: 'REQUIRED' });
  }

  if (isNonEmptyString(record.memberName)) {
    dto.memberName = record.memberName.trim();
  } else {
    errors.push({ field: 'memberName', message: 'Member name is required', code: 'REQUIRED' });
  }

  if (isNonEmptyString(record.relatedPersonName)) {
    dto.relatedPersonName = record.relatedPersonName.trim();
  } else {
    errors.push({ field: 'relatedPersonName', message: 'Related person name is required', code: 'REQUIRED' });
  }

  if (isNonEmptyString(record.relatedPersonRelationship) && VALID_RELATIONSHIPS.has(record.relatedPersonRelationship)) {
    dto.relatedPersonRelationship = record.relatedPersonRelationship as RelationshipType;
  } else {
    errors.push({ field: 'relatedPersonRelationship', message: 'Related person relationship must be a valid option', code: 'INVALID_FORMAT' });
  }

  if (isNonEmptyString(record.address)) {
    dto.address = record.address.trim();
  } else {
    errors.push({ field: 'address', message: 'Address is required', code: 'REQUIRED' });
  }

  if (isNonEmptyString(record.mobileNumber)) {
    dto.mobileNumber = record.mobileNumber.trim();
  } else {
    errors.push({ field: 'mobileNumber', message: 'Mobile number is required', code: 'REQUIRED' });
  }

  if (typeof record.numberOfSheets === 'number' && Number.isInteger(record.numberOfSheets) && record.numberOfSheets > 0) {
    dto.numberOfSheets = record.numberOfSheets;
  } else {
    errors.push({ field: 'numberOfSheets', message: 'Number of sheets must be a positive integer', code: 'INVALID_FORMAT' });
  }

  // Optional fields
  if (record.shopName !== undefined && record.shopName !== null) {
    if (isNonEmptyString(record.shopName)) dto.shopName = record.shopName.trim();
    else if (typeof record.shopName === 'string') dto.shopName = '';
  }

  const optionalStringFields: (keyof CreateMemberDto)[] = [
    'shopCategory', 'shopContactNumber', 'shopEmail', 'tradeLicense',
    'successorName', 'successorRelationship', 'successorContactNumber',
    'successorAlternateContact', 'successorEmail', 'successorTakeoverDate',
    'successorResidentialAddress', 'successorRemarks'
  ];
  
  for (const field of optionalStringFields) {
    if (record[field] !== undefined && record[field] !== null) {
      if (isNonEmptyString(record[field])) (dto as any)[field] = (record[field] as string).trim();
      else if (typeof record[field] === 'string') (dto as any)[field] = '';
    }
  }

  if (record.dailyCollectionAmount !== undefined && record.dailyCollectionAmount !== null) {
    const amt = Number(record.dailyCollectionAmount);
    if (!isNaN(amt) && amt >= 0) dto.dailyCollectionAmount = amt;
  }
  
  if (isNonEmptyString(record.joinDate)) {
    const d = new Date(record.joinDate);
    if (!isNaN(d.getTime())) dto.joinDate = d;
  }

  if (record.nomineeName !== undefined && record.nomineeName !== null) {
    if (isNonEmptyString(record.nomineeName)) dto.nomineeName = record.nomineeName.trim();
    else if (typeof record.nomineeName === 'string') dto.nomineeName = '';
  }

  if (record.nomineeRelationship !== undefined && record.nomineeRelationship !== null) {
    if (isNonEmptyString(record.nomineeRelationship)) dto.nomineeRelationship = record.nomineeRelationship.trim();
    else if (typeof record.nomineeRelationship === 'string') dto.nomineeRelationship = '';
  }

  if (record.nomineePhone !== undefined && record.nomineePhone !== null) {
    if (isNonEmptyString(record.nomineePhone)) dto.nomineePhone = record.nomineePhone.trim();
    else if (typeof record.nomineePhone === 'string') dto.nomineePhone = '';
  }

  if (record.insuranceNumber !== undefined && record.insuranceNumber !== null) {
    if (isNonEmptyString(record.insuranceNumber)) dto.insuranceNumber = record.insuranceNumber.trim();
    else if (typeof record.insuranceNumber === 'string') dto.insuranceNumber = '';
  }

  if (record.status !== undefined && record.status !== null) {
    if (isNonEmptyString(record.status) && VALID_STATUSES.has(record.status)) {
      dto.status = record.status as MemberStatus;
    } else {
      errors.push({ field: 'status', message: 'Status must be ACTIVE or INACTIVE', code: 'INVALID_FORMAT' });
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], data: dto as CreateMemberDto };
}

export function validateUpdateMemberPayload(body: unknown): ValidationResult<UpdateMemberDto> {
  const errors: FieldErrorDetail[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object', code: 'INVALID_BODY' }],
    };
  }

  const record = body as Record<string, unknown>;

  // Check for attempt to modify immutable field memberNumber
  if ('memberNumber' in record) {
    errors.push({ field: 'memberNumber', message: 'Member number cannot be modified during update', code: 'FORBIDDEN' });
  }

  const dto: UpdateMemberDto = {};
  let hasUpdates = false;

  if (record.memberName !== undefined) {
    if (isNonEmptyString(record.memberName)) {
      dto.memberName = record.memberName.trim();
      hasUpdates = true;
    } else {
      errors.push({ field: 'memberName', message: 'Member name cannot be empty if provided', code: 'INVALID_FORMAT' });
    }
  }

  if (record.relatedPersonName !== undefined) {
    if (isNonEmptyString(record.relatedPersonName)) {
      dto.relatedPersonName = record.relatedPersonName.trim();
      hasUpdates = true;
    } else {
      errors.push({ field: 'relatedPersonName', message: 'Related person name cannot be empty if provided', code: 'INVALID_FORMAT' });
    }
  }

  if (record.relatedPersonRelationship !== undefined) {
    if (isNonEmptyString(record.relatedPersonRelationship) && VALID_RELATIONSHIPS.has(record.relatedPersonRelationship)) {
      dto.relatedPersonRelationship = record.relatedPersonRelationship as RelationshipType;
      hasUpdates = true;
    } else {
      errors.push({ field: 'relatedPersonRelationship', message: 'Related person relationship must be a valid option', code: 'INVALID_FORMAT' });
    }
  }

  if (record.shopName !== undefined) {
    if (typeof record.shopName === 'string') {
      dto.shopName = record.shopName.trim();
      hasUpdates = true;
    } else if (record.shopName === null) {
      dto.shopName = null;
      hasUpdates = true;
    }
  }

  if (record.address !== undefined) {
    if (isNonEmptyString(record.address)) {
      dto.address = record.address.trim();
      hasUpdates = true;
    } else {
      errors.push({ field: 'address', message: 'Address cannot be empty if provided', code: 'INVALID_FORMAT' });
    }
  }

  if (record.mobileNumber !== undefined) {
    if (isNonEmptyString(record.mobileNumber)) {
      dto.mobileNumber = record.mobileNumber.trim();
      hasUpdates = true;
    } else {
      errors.push({ field: 'mobileNumber', message: 'Mobile number cannot be empty if provided', code: 'INVALID_FORMAT' });
    }
  }

  if (record.numberOfSheets !== undefined) {
    if (typeof record.numberOfSheets === 'number' && Number.isInteger(record.numberOfSheets) && record.numberOfSheets > 0) {
      dto.numberOfSheets = record.numberOfSheets;
      hasUpdates = true;
    } else {
      errors.push({ field: 'numberOfSheets', message: 'Number of sheets must be a positive integer', code: 'INVALID_FORMAT' });
    }
  }

  if (record.nomineeName !== undefined) {
    if (typeof record.nomineeName === 'string') {
      dto.nomineeName = record.nomineeName.trim();
      hasUpdates = true;
    } else if (record.nomineeName === null) {
      dto.nomineeName = null;
      hasUpdates = true;
    }
  }

  if (record.nomineeRelationship !== undefined) {
    if (typeof record.nomineeRelationship === 'string') {
      dto.nomineeRelationship = record.nomineeRelationship.trim();
      hasUpdates = true;
    } else if (record.nomineeRelationship === null) {
      dto.nomineeRelationship = null;
      hasUpdates = true;
    }
  }

  if (record.nomineePhone !== undefined) {
    if (typeof record.nomineePhone === 'string') {
      dto.nomineePhone = record.nomineePhone.trim();
      hasUpdates = true;
    } else if (record.nomineePhone === null) {
      dto.nomineePhone = null;
      hasUpdates = true;
    }
  }

  if (record.insuranceNumber !== undefined) {
    if (typeof record.insuranceNumber === 'string') {
      dto.insuranceNumber = record.insuranceNumber.trim();
      hasUpdates = true;
    } else if (record.insuranceNumber === null) {
      dto.insuranceNumber = null;
      hasUpdates = true;
    }
  }

  if (record.status !== undefined) {
    if (isNonEmptyString(record.status) && VALID_STATUSES.has(record.status)) {
      dto.status = record.status as MemberStatus;
      hasUpdates = true;
    } else {
      errors.push({ field: 'status', message: 'Status must be ACTIVE or INACTIVE', code: 'INVALID_FORMAT' });
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  if (!hasUpdates) {
    return { isValid: false, errors: [{ field: 'body', message: 'At least one field must be provided for update', code: 'REQUIRED' }] };
  }

  return { isValid: true, errors: [], data: dto };
}

export interface MemberSearchQuery extends PaginationOptions {
  status?: string;
  q?: string;
}

export function validateMemberSearchQuery(query: unknown): ValidationResult<MemberSearchQuery> {
  const errors: FieldErrorDetail[] = [];
  
  const pageResult = validatePaginationQuery(query);
  if (!pageResult.isValid) {
    errors.push(...pageResult.errors);
  }
  
  const result: Partial<MemberSearchQuery> = pageResult.data || { page: 1, pageSize: 20 };

  if (query && typeof query === 'object' && !Array.isArray(query)) {
    const record = query as Record<string, unknown>;

    if (record.status !== undefined && record.status !== '') {
      if (typeof record.status === 'string' && VALID_STATUSES.has(record.status)) {
        result.status = record.status;
      } else {
        errors.push({ field: 'status', message: 'Status must be ACTIVE or INACTIVE', code: 'INVALID_FORMAT' });
      }
    }

    if (record.q !== undefined && record.q !== '') {
      if (typeof record.q === 'string') {
        result.q = record.q.trim();
      }
    }
  }
  
  if (errors.length > 0) return { isValid: false, errors };
  return { isValid: true, errors: [], data: result as MemberSearchQuery };
}

/**
 * Validates memberNumber URL parameter structurally.
 * Ensures non-empty string and reasonable character boundaries.
 */
export function validateMemberNumberParam(params: unknown): ValidationResult<{ memberNumber: string }> {
  const errors: FieldErrorDetail[] = [];

  if (!params || typeof params !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'memberNumber', message: 'Parameters must be a valid object', code: 'INVALID_INPUT' }],
    };
  }

  const record = params as Record<string, unknown>;
  const memberNumber = record.memberNumber;

  if (typeof memberNumber !== 'string' || memberNumber.trim() === '') {
    errors.push({
      field: 'memberNumber',
      message: 'Member number parameter must be a non-empty string',
      code: 'REQUIRED',
    });
  } else if (memberNumber.trim().length > 50) {
    errors.push({
      field: 'memberNumber',
      message: 'Member number parameter cannot exceed 50 characters',
      code: 'INVALID_FORMAT',
    });
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: { memberNumber: (memberNumber as string).trim() },
  };
}

