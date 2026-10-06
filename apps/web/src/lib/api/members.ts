/**
 * Member API Client (Phase 5.4)
 *
 * Provides typed HTTP communication with the Member API endpoints.
 * Operates purely through `apiRequest` without direct database access.
 */

import { apiRequest, ApiRequestError } from './client';

export type RelationshipType =
  | 'FATHER'
  | 'MOTHER'
  | 'HUSBAND'
  | 'WIFE'
  | 'SON'
  | 'DAUGHTER'
  | 'OTHER';

export interface MemberListItem {
  id: string;
  memberNumber: string;
  memberName: string;
  relatedPersonName: string;
  relatedPersonRelationship: string;
  shopName: string | null;
  address: string;
  mobileNumber: string;
  numberOfSheets: number;
  nomineeName: string | null;
  nomineeRelationship: string | null;
  nomineePhone: string | null;
  insuranceNumber: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface MemberProfile {
  memberNumber: string;
  memberName: string;
  relatedPersonName: string;
  relatedPersonRelationship: RelationshipType;
  shopName: string | null;
  address: string;
  mobileNumber: string;
  numberOfSheets: number;
  nomineeName: string | null;
  nomineeRelationship: string | null;
  nomineePhone: string | null;
  insuranceNumber: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;

  // New fields
  joinDate?: string;
  dailyCollectionAmount?: number;
  shopCategory?: string;
  shopContactNumber?: string;
  shopEmail?: string;
  tradeLicense?: string;
  
  successorName?: string;
  successorRelationship?: string;
  successorContactNumber?: string;
  successorAlternateContact?: string;
  successorEmail?: string;
  successorTakeoverDate?: string;
  successorResidentialAddress?: string;
  successorRemarks?: string;
}

export interface MemberListResponse {
  members: MemberListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface FetchMembersParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
}

/**
 * Fetches a paginated and optionally filtered/searched list of association members.
 */
export async function fetchMembers(params: FetchMembersParams = {}): Promise<MemberListResponse> {
  const query: Record<string, string | number | undefined> = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 10,
  };

  if (params.q && params.q.trim()) {
    query.q = params.q.trim();
  }

  if (params.status && params.status.trim()) {
    query.status = params.status.trim();
  }

  const res = await apiRequest<{ data: MemberListResponse }>('/members', {
    method: 'GET',
    query,
  });

  return res.data;
}

/**
 * Fetches the verified read-only profile for a single member by their business member number.
 *
 * Calls: GET /api/v1/members/:memberNumber/profile
 */
export async function fetchMemberProfile(memberNumber: string): Promise<MemberProfile> {
  const trimmed = (memberNumber || '').trim();
  if (!trimmed) {
    throw new ApiRequestError({
      message: 'Member number is required',
      status: 400,
      code: 'INVALID_INPUT',
    });
  }

  const res = await apiRequest<{ data: { profile: MemberProfile } }>(
    `/members/${encodeURIComponent(trimmed)}/profile`,
    {
      method: 'GET',
    }
  );

  return res.data.profile;
}

export interface CreateMemberInput {
  memberNumber: string;
  memberName: string;
  mobileNumber: string;
  numberOfSheets: number;
  dailyCollectionAmount?: number;
  joinDate?: string;
  shopName?: string | null;
  shopCategory?: string;
  shopContactNumber?: string;
  shopEmail?: string;
  tradeLicense?: string;
  relatedPersonName: string;
  relatedPersonRelationship: RelationshipType;
  address: string;
  
  // Successor info
  successorName?: string;
  successorRelationship?: string;
  successorContactNumber?: string;
  successorAlternateContact?: string;
  successorEmail?: string;
  successorTakeoverDate?: string;
  successorResidentialAddress?: string;
  successorRemarks?: string;

  nomineeName?: string | null;
  nomineeRelationship?: string | null;
  nomineePhone?: string | null;
  insuranceNumber?: string | null;
}

/**
 * Creates a new association member.
 *
 * Calls: POST /api/v1/members
 */
export async function createMember(input: CreateMemberInput): Promise<MemberListItem> {
  const payload: Record<string, unknown> = {
    memberNumber: input.memberNumber.trim(),
    memberName: input.memberName.trim(),
    mobileNumber: input.mobileNumber.trim(),
    numberOfSheets: input.numberOfSheets,
    dailyCollectionAmount: input.dailyCollectionAmount,
    joinDate: input.joinDate,
    shopCategory: input.shopCategory?.trim(),
    shopContactNumber: input.shopContactNumber?.trim(),
    shopEmail: input.shopEmail?.trim(),
    tradeLicense: input.tradeLicense?.trim(),
    relatedPersonName: input.relatedPersonName.trim(),
    relatedPersonRelationship: input.relatedPersonRelationship,
    address: input.address.trim(),

    successorName: input.successorName?.trim(),
    successorRelationship: input.successorRelationship,
    successorContactNumber: input.successorContactNumber?.trim(),
    successorAlternateContact: input.successorAlternateContact?.trim(),
    successorEmail: input.successorEmail?.trim(),
    successorTakeoverDate: input.successorTakeoverDate?.trim(),
    successorResidentialAddress: input.successorResidentialAddress?.trim(),
    successorRemarks: input.successorRemarks?.trim(),
  };

  if (input.shopName && input.shopName.trim()) {
    payload.shopName = input.shopName.trim();
  }
  if (input.nomineeName && input.nomineeName.trim()) {
    payload.nomineeName = input.nomineeName.trim();
  }
  if (input.nomineeRelationship && input.nomineeRelationship.trim()) {
    payload.nomineeRelationship = input.nomineeRelationship.trim();
  }
  if (input.nomineePhone && input.nomineePhone.trim()) {
    payload.nomineePhone = input.nomineePhone.trim();
  }
  if (input.insuranceNumber && input.insuranceNumber.trim()) {
    payload.insuranceNumber = input.insuranceNumber.trim();
  }

  const res = await apiRequest<{ data: { member: MemberListItem } }>('/members', {
    method: 'POST',
    body: payload,
  });

  return res.data.member;
}

export interface UpdateMemberInput {
  memberName?: string;
  relatedPersonName?: string;
  relatedPersonRelationship?: RelationshipType;
  address?: string;
  mobileNumber?: string;
  numberOfSheets?: number;
  shopName?: string | null;
  nomineeName?: string | null;
  nomineeRelationship?: string | null;
  nomineePhone?: string | null;
  insuranceNumber?: string | null;
}

/**
 * Updates an existing association member by their business member number.
 * Note: Member Number is immutable and is never included in the payload.
 *
 * Calls: PATCH /api/v1/members/number/:memberNumber
 */
export async function updateMember(
  memberNumber: string,
  input: UpdateMemberInput
): Promise<MemberListItem> {
  const trimmed = (memberNumber || '').trim();
  if (!trimmed) {
    throw new ApiRequestError({
      message: 'Member number is required',
      status: 400,
      code: 'INVALID_INPUT',
    });
  }

  const payload: Record<string, unknown> = {};

  if (input.memberName !== undefined) payload.memberName = input.memberName.trim();
  if (input.relatedPersonName !== undefined) payload.relatedPersonName = input.relatedPersonName.trim();
  if (input.relatedPersonRelationship !== undefined) payload.relatedPersonRelationship = input.relatedPersonRelationship;
  if (input.address !== undefined) payload.address = input.address.trim();
  if (input.mobileNumber !== undefined) payload.mobileNumber = input.mobileNumber.trim();
  if (input.numberOfSheets !== undefined) payload.numberOfSheets = input.numberOfSheets;

  if (input.shopName !== undefined) payload.shopName = input.shopName ? input.shopName.trim() : null;
  if (input.nomineeName !== undefined) payload.nomineeName = input.nomineeName ? input.nomineeName.trim() : null;
  if (input.nomineeRelationship !== undefined) payload.nomineeRelationship = input.nomineeRelationship ? input.nomineeRelationship.trim() : null;
  if (input.nomineePhone !== undefined) payload.nomineePhone = input.nomineePhone ? input.nomineePhone.trim() : null;
  if (input.insuranceNumber !== undefined) payload.insuranceNumber = input.insuranceNumber ? input.insuranceNumber.trim() : null;

  const res = await apiRequest<{ data: { member: MemberListItem } }>(
    `/members/number/${encodeURIComponent(trimmed)}`,
    {
      method: 'PATCH',
      body: payload,
    }
  );

  return res.data.member;
}

/**
 * Deactivates an existing member (Phase 5.8 Soft Deactivation).
 * Marks member status as INACTIVE while preserving historical records.
 *
 * Calls: POST /api/v1/members/number/:memberNumber/deactivate (or /members/:id/deactivate)
 */
export async function deactivateMember(
  memberNumberOrId: string
): Promise<MemberListItem> {
  const trimmed = (memberNumberOrId || '').trim();
  if (!trimmed) {
    throw new ApiRequestError({
      message: 'Member identifier is required',
      status: 400,
      code: 'INVALID_INPUT',
    });
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
  const endpoint = isUuid
    ? `/members/${encodeURIComponent(trimmed)}/deactivate`
    : `/members/number/${encodeURIComponent(trimmed)}/deactivate`;

  const res = await apiRequest<{ data: { member: MemberListItem } }>(
    endpoint,
    {
      method: 'POST',
    }
  );

  return res.data.member;
}

/**
 * Activates / reactivates an inactive member (Phase 5.8.1 Soft Reactivation).
 * Changes member status from INACTIVE to ACTIVE while preserving all records.
 *
 * Calls: POST /api/v1/members/number/:memberNumber/activate (or /members/:id/activate)
 */
export async function activateMember(
  memberNumberOrId: string
): Promise<MemberListItem> {
  const trimmed = (memberNumberOrId || '').trim();
  if (!trimmed) {
    throw new ApiRequestError({
      message: 'Member identifier is required',
      status: 400,
      code: 'INVALID_INPUT',
    });
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
  const endpoint = isUuid
    ? `/members/${encodeURIComponent(trimmed)}/activate`
    : `/members/number/${encodeURIComponent(trimmed)}/activate`;

  const res = await apiRequest<{ data: { member: MemberListItem } }>(
    endpoint,
    {
      method: 'POST',
    }
  );

  return res.data.member;
}

