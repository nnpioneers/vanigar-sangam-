/**
 * Member Service (Phase 5.1)
 *
 * Implements business orchestration for Association Members.
 * Enforces transactional execution via ServiceContext where needed.
 */

import { MemberRepository } from './members.repository.js';
import type { ServiceContext } from '../module.types.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../../errors/app-error.js';
import type {
  Member,
  CreateMemberDto,
  UpdateMemberDto,
  MemberProfile,
} from './members.types.js';

const VALID_RELATIONSHIPS = new Set(['FATHER', 'MOTHER', 'HUSBAND', 'WIFE', 'SON', 'DAUGHTER', 'OTHER']);

export class MemberService {
  constructor(private readonly repo: MemberRepository = new MemberRepository()) {}

  /**
   * Creates a new member with validation.
   */
  async createMember(dto: CreateMemberDto, ctx?: ServiceContext): Promise<Member> {
    if (!dto.memberNumber || dto.memberNumber.trim() === '') {
      throw new ValidationError('Member number is required.');
    }
    if (!dto.memberName || dto.memberName.trim() === '') {
      throw new ValidationError('Member name is required.');
    }
    if (!dto.relatedPersonName || dto.relatedPersonName.trim() === '') {
      throw new ValidationError('Related person name is required.');
    }
    if (!VALID_RELATIONSHIPS.has(dto.relatedPersonRelationship)) {
      throw new ValidationError(`Invalid relationship: ${dto.relatedPersonRelationship}. Must be one of FATHER, MOTHER, HUSBAND, WIFE, SON, DAUGHTER, OTHER.`);
    }
    if (!dto.address || dto.address.trim() === '') {
      throw new ValidationError('Address is required.');
    }
    if (!dto.mobileNumber || dto.mobileNumber.trim() === '') {
      throw new ValidationError('Mobile number is required.');
    }
    if (typeof dto.numberOfSheets !== 'number' || dto.numberOfSheets <= 0) {
      throw new ValidationError('Number of sheets must be a positive integer.');
    }

    // Check duplicate member number explicitly for better error message
    const existing = await this.repo.findByMemberNumber(dto.memberNumber, ctx?.tx);
    if (existing) {
      throw new ConflictError(`Member number "${dto.memberNumber}" is already in use.`);
    }

    try {
      return await this.repo.create(dto, ctx?.tx);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError(`Member number "${dto.memberNumber}" is already in use.`);
      }
      throw err;
    }
  }

  /**
   * Gets a member by their member number.
   */
  async getMemberByNumber(memberNumber: string, ctx?: ServiceContext): Promise<Member> {
    const member = await this.repo.findByMemberNumber(memberNumber, ctx?.tx);
    if (!member) {
      throw new NotFoundError(`Member with number "${memberNumber}" not found.`);
    }
    return member;
  }

  /**
   * Retrieves read-only profile for a member by their member number (Phase 5.3).
   * Throws NotFoundError if member is absent.
   * Preserves historical identity for both ACTIVE and INACTIVE members.
   * Performs no financial calculations or state modifications.
   */
  async getMemberProfile(memberNumber: string, ctx?: ServiceContext): Promise<MemberProfile> {
    if (!memberNumber || typeof memberNumber !== 'string' || memberNumber.trim() === '') {
      throw new ValidationError('Member number is required.');
    }

    const profile = await this.repo.getProfileByMemberNumber(memberNumber.trim(), ctx?.tx);
    if (!profile) {
      throw new NotFoundError(`Member with number "${memberNumber.trim()}" not found.`);
    }

    return profile;
  }

  /**
   * Gets a member by their internal ID.
   */
  async getMemberById(id: string, ctx?: ServiceContext): Promise<Member> {
    const member = await this.repo.findById(id, ctx?.tx);
    if (!member) {
      throw new NotFoundError(`Member not found.`);
    }
    return member;
  }

  /**
   * Updates a member.
   */
  async updateMember(id: string, dto: UpdateMemberDto, ctx?: ServiceContext): Promise<Member> {
    // Basic validation on updates if provided
    if (dto.relatedPersonRelationship && !VALID_RELATIONSHIPS.has(dto.relatedPersonRelationship)) {
      throw new ValidationError(`Invalid relationship: ${dto.relatedPersonRelationship}.`);
    }
    if (dto.numberOfSheets !== undefined && (typeof dto.numberOfSheets !== 'number' || dto.numberOfSheets <= 0)) {
      throw new ValidationError('Number of sheets must be a positive integer.');
    }

    const member = await this.repo.findById(id, ctx?.tx);
    if (!member) {
      throw new NotFoundError('Member not found.');
    }

    const updated = await this.repo.update(id, dto, ctx?.tx);
    if (!updated) {
      throw new NotFoundError('Member not found during update.');
    }
    return updated;
  }

  /**
   * Updates an existing member by their business member number.
   * Preserves immutable memberNumber and validates domain fields.
   */
  async updateMemberByNumber(memberNumber: string, dto: UpdateMemberDto, ctx?: ServiceContext): Promise<Member> {
    if (!memberNumber || typeof memberNumber !== 'string' || memberNumber.trim() === '') {
      throw new ValidationError('Member number is required.');
    }
    const member = await this.repo.findByMemberNumber(memberNumber.trim(), ctx?.tx);
    if (!member) {
      throw new NotFoundError(`Member with number "${memberNumber.trim()}" not found.`);
    }
    return this.updateMember(member.id, dto, ctx);
  }

  /**
   * Deactivates a member without deleting historical data.
   */
  async deactivateMember(id: string, ctx?: ServiceContext): Promise<Member> {
    return this.updateMember(id, { status: 'INACTIVE' }, ctx);
  }

  /**
   * Deactivates a member by member number without deleting historical data.
   */
  async deactivateMemberByNumber(memberNumber: string, ctx?: ServiceContext): Promise<Member> {
    if (!memberNumber || typeof memberNumber !== 'string' || memberNumber.trim() === '') {
      throw new ValidationError('Member number is required.');
    }
    const member = await this.repo.findByMemberNumber(memberNumber.trim(), ctx?.tx);
    if (!member) {
      throw new NotFoundError(`Member with number "${memberNumber.trim()}" not found.`);
    }
    return this.deactivateMember(member.id, ctx);
  }

  /**
   * Activates / reactivates an inactive member without altering historical data.
   * Throws ConflictError if member is already active.
   */
  async activateMember(id: string, ctx?: ServiceContext): Promise<Member> {
    const member = await this.repo.findById(id, ctx?.tx);
    if (!member) {
      throw new NotFoundError('Member not found.');
    }
    if (member.status === 'ACTIVE') {
      throw new ConflictError('Member is already active.');
    }
    return this.updateMember(id, { status: 'ACTIVE' }, ctx);
  }

  /**
   * Activates / reactivates an inactive member by business member number.
   * Throws ConflictError if member is already active.
   */
  async activateMemberByNumber(memberNumber: string, ctx?: ServiceContext): Promise<Member> {
    if (!memberNumber || typeof memberNumber !== 'string' || memberNumber.trim() === '') {
      throw new ValidationError('Member number is required.');
    }
    const member = await this.repo.findByMemberNumber(memberNumber.trim(), ctx?.tx);
    if (!member) {
      throw new NotFoundError(`Member with number "${memberNumber.trim()}" not found.`);
    }
    if (member.status === 'ACTIVE') {
      throw new ConflictError(`Member "${memberNumber.trim()}" is already active.`);
    }
    return this.activateMember(member.id, ctx);
  }

  /**
   * Lists members with pagination and safe search.
   */
  async listMembers(params: { status?: string; q?: string; page: number; pageSize: number }, ctx?: ServiceContext): Promise<{ members: Member[]; totalCount: number }> {
    return this.repo.listPaginated(params, ctx?.tx);
  }
}
