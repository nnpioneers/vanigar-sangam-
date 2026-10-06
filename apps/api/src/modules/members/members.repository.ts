/**
 * Member Repository (Phase 5.1)
 *
 * Implements database operations for the association members.
 * Extends BaseRepository to support optional transactional execution clients.
 */

import { BaseRepository } from '../../repositories/base.repository.js';
import type { Queryable } from '../../database/index.js';
import type { Member, MemberRow, CreateMemberDto, UpdateMemberDto, MemberProfile, MemberProfileRow } from './members.types.js';

export class MemberRepository extends BaseRepository {
  /**
   * Maps a database row to a Member domain entity.
   */
  private mapRow(row: MemberRow): Member {
    return {
      id: row.id,
      memberNumber: row.member_number,
      memberName: row.member_name,
      relatedPersonName: row.related_person_name,
      relatedPersonRelationship: row.related_person_relationship,
      shopName: row.shop_name,
      address: row.address,
      mobileNumber: row.mobile_number,
      numberOfSheets: typeof row.number_of_sheets === 'number' ? row.number_of_sheets : parseInt(row.number_of_sheets as unknown as string, 10),
      nomineeName: row.nominee_name,
      nomineeRelationship: row.nominee_relationship,
      nomineePhone: row.nominee_phone,
      insuranceNumber: row.insurance_number,
      status: row.status,
      joinDate: row.join_date,
      dailyCollectionAmount: row.daily_collection_amount ? Number(row.daily_collection_amount) : undefined,
      shopCategory: row.shop_category,
      shopContactNumber: row.shop_contact_number,
      shopEmail: row.shop_email,
      tradeLicense: row.trade_license,
      successorName: row.successor_name,
      successorRelationship: row.successor_relationship,
      successorContactNumber: row.successor_contact_number,
      successorAlternateContact: row.successor_alternate_contact,
      successorEmail: row.successor_email_address,
      successorTakeoverDate: row.successor_expected_takeover_date,
      successorResidentialAddress: row.successor_residential_address,
      successorRemarks: row.successor_remarks,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Maps a database profile row to a MemberProfile contract.
   * Serializes timestamps to ISO-8601 strings and casts number_of_sheets.
   */
  private mapProfileRow(row: MemberProfileRow): MemberProfile {
    return {
      memberNumber: row.member_number,
      memberName: row.member_name,
      relatedPersonName: row.related_person_name,
      relatedPersonRelationship: row.related_person_relationship,
      shopName: row.shop_name,
      address: row.address,
      mobileNumber: row.mobile_number,
      numberOfSheets: typeof row.number_of_sheets === 'number' ? row.number_of_sheets : parseInt(row.number_of_sheets as unknown as string, 10),
      nomineeName: row.nominee_name,
      nomineeRelationship: row.nominee_relationship,
      nomineePhone: row.nominee_phone,
      insuranceNumber: row.insurance_number,
      status: row.status,
      joinDate: row.join_date ? (row.join_date instanceof Date ? row.join_date.toISOString().split('T')[0] : new Date(row.join_date).toISOString().split('T')[0]) : undefined,
      dailyCollectionAmount: row.daily_collection_amount ? Number(row.daily_collection_amount) : undefined,
      shopCategory: row.shop_category,
      shopContactNumber: row.shop_contact_number,
      shopEmail: row.shop_email,
      tradeLicense: row.trade_license,
      successorName: row.successor_name,
      successorRelationship: row.successor_relationship,
      successorContactNumber: row.successor_contact_number,
      successorAlternateContact: row.successor_alternate_contact,
      successorEmail: row.successor_email_address,
      successorTakeoverDate: row.successor_expected_takeover_date,
      successorResidentialAddress: row.successor_residential_address,
      successorRemarks: row.successor_remarks,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
    };
  }

  /**
   * Retrieves a read-only member profile by unique member number using explicit column selection.
   * Avoids SELECT * to protect internal database metadata from leaking.
   */
  async getProfileByMemberNumber(memberNumber: string, executor?: Queryable): Promise<MemberProfile | null> {
    const query = `
      SELECT
        m.member_number,
        m.member_name,
        m.related_person_name,
        m.related_person_relationship,
        m.shop_name,
        m.address,
        m.mobile_number,
        m.number_of_sheets,
        m.nominee_name,
        m.nominee_relationship,
        m.nominee_phone,
        m.insurance_number,
        m.status,
        m.created_at,
        m.updated_at,
        m.join_date,
        m.daily_collection_amount,
        m.shop_category,
        m.shop_contact_number,
        m.shop_email,
        m.trade_license,
        ms.successor_name,
        ms.relationship AS successor_relationship,
        ms.contact_number AS successor_contact_number,
        ms.alternate_contact AS successor_alternate_contact,
        ms.email_address AS successor_email_address,
        ms.expected_takeover_date AS successor_expected_takeover_date,
        ms.residential_address AS successor_residential_address,
        ms.remarks AS successor_remarks
      FROM members m
      LEFT JOIN member_successors ms ON m.id = ms.member_id AND ms.is_primary = true
      WHERE m.member_number = $1;
    `;
    const row = await this.queryOne<MemberProfileRow>(query, [memberNumber], executor);
    return row ? this.mapProfileRow(row) : null;
  }

  /**
   * Finds a member by their internal primary key (UUID).
   */
  async findById(id: string, executor?: Queryable): Promise<Member | null> {
    const row = await this.queryOne<MemberRow>(
      `SELECT * FROM members WHERE id = $1;`,
      [id],
      executor
    );
    return row ? this.mapRow(row) : null;
  }

  /**
   * Finds a member by their unique member number.
   */
  async findByMemberNumber(memberNumber: string, executor?: Queryable): Promise<Member | null> {
    const row = await this.queryOne<MemberRow>(
      `SELECT * FROM members WHERE member_number = $1;`,
      [memberNumber],
      executor
    );
    return row ? this.mapRow(row) : null;
  }

  /**
   * Creates a new member record.
   */
  async create(dto: CreateMemberDto, executor?: Queryable): Promise<Member> {
    const status = dto.status ?? 'ACTIVE';
    const row = await this.queryOne<MemberRow>(
      `INSERT INTO members (
         member_number, member_name, related_person_name, related_person_relationship,
         shop_name, address, mobile_number, number_of_sheets,
         nominee_name, nominee_relationship, nominee_phone, insurance_number, status,
         join_date, daily_collection_amount, shop_category, shop_contact_number, shop_email, trade_license
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *;`,
      [
        dto.memberNumber,
        dto.memberName,
        dto.relatedPersonName,
        dto.relatedPersonRelationship,
        dto.shopName ?? null,
        dto.address,
        dto.mobileNumber,
        dto.numberOfSheets,
        dto.nomineeName ?? null,
        dto.nomineeRelationship ?? null,
        dto.nomineePhone ?? null,
        dto.insuranceNumber ?? null,
        status,
        dto.joinDate ?? null,
        dto.dailyCollectionAmount ?? null,
        dto.shopCategory ?? null,
        dto.shopContactNumber ?? null,
        dto.shopEmail ?? null,
        dto.tradeLicense ?? null,
      ],
      executor
    );
    if (!row) throw new Error('Failed to create member record');

    if (dto.successorName && row.id) {
       await this.query(
         `INSERT INTO member_successors (
            member_id, successor_name, relationship, contact_number, alternate_contact,
            email_address, expected_takeover_date, residential_address, remarks, is_primary
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            row.id,
            dto.successorName,
            dto.successorRelationship ?? 'OTHER',
            dto.successorContactNumber ?? '',
            dto.successorAlternateContact ?? null,
            dto.successorEmail ?? null,
            dto.successorTakeoverDate ?? null,
            dto.successorResidentialAddress ?? null,
            dto.successorRemarks ?? null,
            true
          ],
          executor
       );
    }

    return this.mapRow(row);
  }

  /**
   * Updates an existing member record.
   */
  async update(id: string, dto: UpdateMemberDto, executor?: Queryable): Promise<Member | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Helper to add a field to update
    const addField = (colName: string, val: unknown) => {
      fields.push(`${colName} = $${paramIndex}`);
      values.push(val);
      paramIndex++;
    };

    if (dto.memberName !== undefined) addField('member_name', dto.memberName);
    if (dto.relatedPersonName !== undefined) addField('related_person_name', dto.relatedPersonName);
    if (dto.relatedPersonRelationship !== undefined) addField('related_person_relationship', dto.relatedPersonRelationship);
    if (dto.shopName !== undefined) addField('shop_name', dto.shopName);
    if (dto.address !== undefined) addField('address', dto.address);
    if (dto.mobileNumber !== undefined) addField('mobile_number', dto.mobileNumber);
    if (dto.numberOfSheets !== undefined) addField('number_of_sheets', dto.numberOfSheets);
    if (dto.nomineeName !== undefined) addField('nominee_name', dto.nomineeName);
    if (dto.nomineeRelationship !== undefined) addField('nominee_relationship', dto.nomineeRelationship);
    if (dto.nomineePhone !== undefined) addField('nominee_phone', dto.nomineePhone);
    if (dto.insuranceNumber !== undefined) addField('insurance_number', dto.insuranceNumber);
    if (dto.status !== undefined) addField('status', dto.status);

    if (fields.length === 0) {
      return this.findById(id, executor); // Nothing to update
    }

    addField('updated_at', new Date());

    values.push(id);
    const idParam = paramIndex;

    const row = await this.queryOne<MemberRow>(
      `UPDATE members SET ${fields.join(', ')} WHERE id = $${idParam} RETURNING *;`,
      values,
      executor
    );

    return row ? this.mapRow(row) : null;
  }

  /**
   * Lists all members, optionally filtering by status.
   * Returns a paginated list of members.
   */
  async listPaginated(params: { status?: string; q?: string; page: number; pageSize: number }, executor?: Queryable): Promise<{ members: Member[]; totalCount: number }> {
    let whereClause = '';
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    
    if (params.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(params.status);
      paramIndex++;
    }

    if (params.q) {
      // Safe substring search by member number
      conditions.push(`member_number ILIKE $${paramIndex}`);
      values.push(`%${params.q}%`);
      paramIndex++;
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const countRow = await this.queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM members ${whereClause};`,
      values,
      executor
    );
    const totalCount = countRow ? parseInt(countRow.count, 10) : 0;

    const offset = (params.page - 1) * params.pageSize;
    
    // Stable ordering primarily by member_number
    const query = `
      SELECT * FROM members
      ${whereClause}
      ORDER BY member_number ASC, created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    
    values.push(params.pageSize, offset);

    const rows = await this.query<MemberRow>(query, values, executor);
    return {
      members: rows.map((r) => this.mapRow(r)),
      totalCount
    };
  }

  /**
   * Lists all members, optionally filtering by status.
   */
  async list(status?: string, executor?: Queryable): Promise<Member[]> {
    let query = `SELECT * FROM members`;
    const values: unknown[] = [];
    
    if (status) {
      query += ` WHERE status = $1`;
      values.push(status);
    }
    
    query += ` ORDER BY member_number ASC, created_at DESC;`;

    const rows = await this.query<MemberRow>(query, values, executor);
    return rows.map((r) => this.mapRow(r));
  }
}
