/**
 * Member Controller (Phase 5.1)
 *
 * Exposes structural HTTP endpoints for managing members.
 */

import type { Request, Response } from 'express';
import { MemberService } from './members.service.js';
import { sendSuccess } from '../../controllers/base.controller.js';
import type { Member, CreateMemberDto, UpdateMemberDto } from './members.types.js';
import type { MemberSearchQuery } from './members.validation.js';

let memberServiceInstance: MemberService | null = null;
function getMemberService(): MemberService {
  if (!memberServiceInstance) {
    memberServiceInstance = new MemberService();
  }
  return memberServiceInstance;
}

function formatMemberResponse(m: Member) {
  return {
    id: m.id,
    memberNumber: m.memberNumber,
    memberName: m.memberName,
    relatedPersonName: m.relatedPersonName,
    relatedPersonRelationship: m.relatedPersonRelationship,
    shopName: m.shopName,
    address: m.address,
    mobileNumber: m.mobileNumber,
    numberOfSheets: m.numberOfSheets,
    nomineeName: m.nomineeName,
    nomineeRelationship: m.nomineeRelationship,
    nomineePhone: m.nomineePhone,
    insuranceNumber: m.insuranceNumber,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export async function createMemberController(req: Request, res: Response): Promise<void> {
  const service = getMemberService();
  const payload = req.validatedBody as CreateMemberDto;
  const member = await service.createMember(payload, { requestId: req.id });
  sendSuccess(res, { member: formatMemberResponse(member) }, 201);
}

export async function getMemberByNumberController(req: Request, res: Response): Promise<void> {
  const service = getMemberService();
  const memberNumber = req.params.memberNumber as string;
  const member = await service.getMemberByNumber(memberNumber, { requestId: req.id });
  sendSuccess(res, { member: formatMemberResponse(member) });
}

export async function getMemberProfileController(req: Request, res: Response): Promise<void> {
  const service = getMemberService();
  const params = req.validatedParams as { memberNumber: string } | undefined;
  const memberNumber = params?.memberNumber ?? (req.params.memberNumber as string);
  const profile = await service.getMemberProfile(memberNumber, { requestId: req.id });
  sendSuccess(res, { profile });
}

export async function updateMemberController(req: Request, res: Response): Promise<void> {
  const service = getMemberService();
  const id = req.params.id as string;
  const payload = req.validatedBody as UpdateMemberDto;
  const member = await service.updateMember(id, payload, { requestId: req.id });
  sendSuccess(res, { member: formatMemberResponse(member) });
}

export async function updateMemberByNumberController(req: Request, res: Response): Promise<void> {
  const service = getMemberService();
  const params = req.validatedParams as { memberNumber: string } | undefined;
  const memberNumber = params?.memberNumber ?? (req.params.memberNumber as string);
  const payload = req.validatedBody as UpdateMemberDto;
  const member = await service.updateMemberByNumber(memberNumber, payload, { requestId: req.id });
  sendSuccess(res, { member: formatMemberResponse(member) });
}

export async function deactivateMemberController(req: Request, res: Response): Promise<void> {
  const service = getMemberService();
  const id = req.params.id as string;
  const member = await service.deactivateMember(id, { requestId: req.id });
  sendSuccess(res, { member: formatMemberResponse(member) });
}

export async function deactivateMemberByNumberController(req: Request, res: Response): Promise<void> {
  const service = getMemberService();
  const params = req.validatedParams as { memberNumber: string } | undefined;
  const memberNumber = params?.memberNumber ?? (req.params.memberNumber as string);
  const member = await service.deactivateMemberByNumber(memberNumber, { requestId: req.id });
  sendSuccess(res, { member: formatMemberResponse(member) });
}

export async function activateMemberController(req: Request, res: Response): Promise<void> {
  const service = getMemberService();
  const id = req.params.id as string;
  const member = await service.activateMember(id, { requestId: req.id });
  sendSuccess(res, { member: formatMemberResponse(member) });
}

export async function activateMemberByNumberController(req: Request, res: Response): Promise<void> {
  const service = getMemberService();
  const params = req.validatedParams as { memberNumber: string } | undefined;
  const memberNumber = params?.memberNumber ?? (req.params.memberNumber as string);
  const member = await service.activateMemberByNumber(memberNumber, { requestId: req.id });
  sendSuccess(res, { member: formatMemberResponse(member) });
}

export async function listMembersController(req: Request, res: Response): Promise<void> {
  const service = getMemberService();
  const query = req.validatedQuery as MemberSearchQuery;
  const result = await service.listMembers(query, { requestId: req.id });
  sendSuccess(res, {
    members: result.members.map(formatMemberResponse),
    totalCount: result.totalCount,
    page: query.page,
    pageSize: query.pageSize,
  });
}
