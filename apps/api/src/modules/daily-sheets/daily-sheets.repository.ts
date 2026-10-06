/**
 * Daily Sheet Repository (Phase 6.1 — 6.4)
 *
 * Implements database persistence for the Daily Sheet module.
 * Extends BaseRepository to support transactional query executors.
 */

import { BaseRepository } from '../../repositories/base.repository.js';
import type { Queryable } from '../../database/index.js';
import type {
  DailySheet,
  DailySheetRow,
  DailySheetWithMemberRow,
  CreateDailySheetDto,
  DailySheetListFilter,
  DailySheetCorrection,
  DailySheetCorrectionRow,
  CreateDailySheetCorrectionDto,
} from './daily-sheets.types.js';

export class DailySheetRepository extends BaseRepository {
  /**
   * Helper to format Date or string to YYYY-MM-DD string.
   */
  private formatDateOnly(val: string | Date): string {
    if (typeof val === 'string') {
      return val.slice(0, 10);
    }
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Helper to format timestamp to ISO-8601 string or null.
   */
  private formatIsoTimestamp(val: Date | string | null | undefined): string | null {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString();
    return new Date(val).toISOString();
  }

  /**
   * Maps a database row to a DailySheet domain entity.
   */
  private mapRow(row: DailySheetRow | DailySheetWithMemberRow): DailySheet {
    const withMember = row as Partial<DailySheetWithMemberRow>;
    const totalDuePaise = typeof row.total_due_paise === 'number'
      ? row.total_due_paise
      : parseInt(row.total_due_paise as unknown as string, 10);
    const actualPaidPaise = typeof row.actual_paid_paise === 'number'
      ? row.actual_paid_paise
      : parseInt(row.actual_paid_paise as unknown as string, 10);

    const balanceRemainingPaise = Math.max(0, totalDuePaise - actualPaidPaise);
    const excessPaidPaise = Math.max(0, actualPaidPaise - totalDuePaise);

    return {
      id: row.id,
      memberId: row.member_id,
      memberNumber: withMember.member_number,
      memberName: withMember.member_name,
      businessDate: this.formatDateOnly(row.business_date),
      numberOfSheets: typeof row.number_of_sheets === 'number'
        ? row.number_of_sheets
        : parseInt(row.number_of_sheets as unknown as string, 10),
      dailyDueAmountPaise: typeof row.daily_due_amount_paise === 'number'
        ? row.daily_due_amount_paise
        : parseInt(row.daily_due_amount_paise as unknown as string, 10),
      previousArrearsPaise: typeof row.previous_arrears_paise === 'number'
        ? row.previous_arrears_paise
        : parseInt(row.previous_arrears_paise as unknown as string, 10),
      totalDuePaise,
      actualPaidPaise,
      balanceRemainingPaise,
      excessPaidPaise,
      status: row.status,
      paymentTime: this.formatIsoTimestamp(row.payment_time),
      paymentMode: row.payment_mode,
      notes: row.notes,
      idempotencyKey: row.idempotency_key,
      recordedByAdminId: row.recorded_by_admin_id,
      isCorrected: Boolean(row.correction_id),
      correctionReason: row.correction_reason ?? null,
      correctedAt: this.formatIsoTimestamp(row.corrected_at),
      correctedByAdminId: row.corrected_by_admin_id ?? null,
      createdAt: this.formatIsoTimestamp(row.created_at)!,
      updatedAt: this.formatIsoTimestamp(row.updated_at)!,
    };
  }

  /**
   * Creates a new Daily Sheet record in the database.
   */
  async create(dto: CreateDailySheetDto, executor?: Queryable): Promise<DailySheet> {
    const query = `
      INSERT INTO daily_sheets (
        member_id,
        business_date,
        number_of_sheets,
        daily_due_amount_paise,
        previous_arrears_paise,
        total_due_paise,
        actual_paid_paise,
        status,
        payment_time,
        payment_mode,
        notes,
        idempotency_key,
        recorded_by_admin_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;

    const params = [
      dto.memberId,
      dto.businessDate,
      dto.numberOfSheets,
      dto.dailyDueAmountPaise,
      dto.previousArrearsPaise ?? 0,
      dto.totalDuePaise,
      dto.actualPaidPaise ?? 0,
      dto.status,
      dto.paymentTime ?? null,
      dto.paymentMode ?? null,
      dto.notes ?? null,
      dto.idempotencyKey ?? null,
      dto.recordedByAdminId,
    ];

    const row = await this.queryOne<DailySheetRow>(query, params, executor);
    if (!row) {
      throw new Error('Failed to insert daily sheet record');
    }
    return this.mapRow(row);
  }

  /**
   * Finds a daily sheet record by its UUID.
   */
  async findById(id: string, executor?: Queryable): Promise<DailySheet | null> {
    const query = `
      SELECT
        ds.*,
        m.member_number,
        m.member_name,
        dsc.id as correction_id,
        dsc.reason as correction_reason,
        dsc.created_at as corrected_at,
        dsc.corrected_by_admin_id as corrected_by_admin_id
      FROM daily_sheets ds
      INNER JOIN members m ON ds.member_id = m.id
      LEFT JOIN daily_sheet_corrections dsc ON ds.id = dsc.original_daily_sheet_id
      WHERE ds.id = $1;
    `;
    const row = await this.queryOne<DailySheetWithMemberRow>(query, [id], executor);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Finds a daily sheet record by member UUID and business date.
   */
  async findByMemberAndDate(
    memberId: string,
    businessDate: string,
    executor?: Queryable
  ): Promise<DailySheet | null> {
    const query = `
      SELECT
        ds.*,
        m.member_number,
        m.member_name,
        dsc.id as correction_id,
        dsc.reason as correction_reason,
        dsc.created_at as corrected_at,
        dsc.corrected_by_admin_id as corrected_by_admin_id
      FROM daily_sheets ds
      INNER JOIN members m ON ds.member_id = m.id
      LEFT JOIN daily_sheet_corrections dsc ON ds.id = dsc.original_daily_sheet_id
      WHERE ds.member_id = $1 AND ds.business_date = $2;
    `;
    const row = await this.queryOne<DailySheetWithMemberRow>(query, [memberId, businessDate], executor);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Finds a daily sheet record by idempotency key.
   */
  async findByIdempotencyKey(key: string, executor?: Queryable): Promise<DailySheet | null> {
    const query = `
      SELECT
        ds.*,
        m.member_number,
        m.member_name,
        dsc.id as correction_id,
        dsc.reason as correction_reason,
        dsc.created_at as corrected_at,
        dsc.corrected_by_admin_id as corrected_by_admin_id
      FROM daily_sheets ds
      INNER JOIN members m ON ds.member_id = m.id
      LEFT JOIN daily_sheet_corrections dsc ON ds.id = dsc.original_daily_sheet_id
      WHERE ds.idempotency_key = $1;
    `;
    const row = await this.queryOne<DailySheetWithMemberRow>(query, [key], executor);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Lists daily sheets with explicit column selection and filters.
   */
  async findMany(
    filter: DailySheetListFilter,
    executor?: Queryable
  ): Promise<{ items: DailySheet[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter.businessDate) {
      conditions.push(`ds.business_date = $${paramIdx++}`);
      params.push(filter.businessDate);
    }

    if (filter.status) {
      conditions.push(`ds.status = $${paramIdx++}`);
      params.push(filter.status);
    }

    if (filter.memberNumber) {
      conditions.push(`m.member_number ILIKE $${paramIdx++}`);
      params.push(`%${filter.memberNumber.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM daily_sheets ds
      INNER JOIN members m ON ds.member_id = m.id
      ${whereClause};
    `;
    const countRow = await this.queryOne<{ total: number }>(countQuery, params, executor);
    const total = countRow?.total ?? 0;

    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const dataQuery = `
      SELECT
        ds.id,
        ds.member_id,
        ds.business_date,
        ds.number_of_sheets,
        ds.daily_due_amount_paise,
        ds.previous_arrears_paise,
        ds.total_due_paise,
        ds.actual_paid_paise,
        ds.status,
        ds.payment_time,
        ds.payment_mode,
        ds.notes,
        ds.idempotency_key,
        ds.recorded_by_admin_id,
        ds.created_at,
        ds.updated_at,
        m.member_number,
        m.member_name,
        dsc.id as correction_id,
        dsc.reason as correction_reason,
        dsc.created_at as corrected_at,
        dsc.corrected_by_admin_id as corrected_by_admin_id
      FROM daily_sheets ds
      INNER JOIN members m ON ds.member_id = m.id
      LEFT JOIN daily_sheet_corrections dsc ON ds.id = dsc.original_daily_sheet_id
      ${whereClause}
      ORDER BY ds.business_date DESC, ds.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++};
    `;

    const dataParams = [...params, pageSize, offset];
    const rows = await this.query<DailySheetWithMemberRow>(dataQuery, dataParams, executor);

    return {
      items: rows.map((r) => this.mapRow(r)),
      total,
    };
  }

  /**
   * Records an auditable correction entry in daily_sheet_corrections.
   */
  async createCorrection(
    dto: CreateDailySheetCorrectionDto,
    executor?: Queryable
  ): Promise<DailySheetCorrection> {
    const query = `
      INSERT INTO daily_sheet_corrections (
        original_daily_sheet_id,
        member_id,
        business_date,
        original_actual_paid_paise,
        original_status,
        reason,
        reversal_cash_transaction_id,
        corrected_by_admin_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const params = [
      dto.originalDailySheetId,
      dto.memberId,
      dto.businessDate,
      dto.originalActualPaidPaise,
      dto.originalStatus,
      dto.reason,
      dto.reversalCashTransactionId ?? null,
      dto.correctedByAdminId,
    ];

    const row = await this.queryOne<DailySheetCorrectionRow>(query, params, executor);
    if (!row) {
      throw new Error('Failed to insert daily sheet correction record');
    }

    return {
      id: row.id,
      originalDailySheetId: row.original_daily_sheet_id,
      memberId: row.member_id,
      businessDate: this.formatDateOnly(row.business_date),
      originalActualPaidPaise: typeof row.original_actual_paid_paise === 'number'
        ? row.original_actual_paid_paise
        : parseInt(row.original_actual_paid_paise as unknown as string, 10),
      originalStatus: row.original_status,
      reason: row.reason,
      reversalCashTransactionId: row.reversal_cash_transaction_id,
      correctedByAdminId: row.corrected_by_admin_id,
      createdAt: this.formatIsoTimestamp(row.created_at)!,
    };
  }

  /**
   * Finds an existing correction record by original daily sheet ID.
   */
  async findCorrectionBySheetId(
    sheetId: string,
    executor?: Queryable
  ): Promise<DailySheetCorrection | null> {
    const query = `
      SELECT *
      FROM daily_sheet_corrections
      WHERE original_daily_sheet_id = $1;
    `;
    const row = await this.queryOne<DailySheetCorrectionRow>(query, [sheetId], executor);
    if (!row) return null;

    return {
      id: row.id,
      originalDailySheetId: row.original_daily_sheet_id,
      memberId: row.member_id,
      businessDate: this.formatDateOnly(row.business_date),
      originalActualPaidPaise: typeof row.original_actual_paid_paise === 'number'
        ? row.original_actual_paid_paise
        : parseInt(row.original_actual_paid_paise as unknown as string, 10),
      originalStatus: row.original_status,
      reason: row.reason,
      reversalCashTransactionId: row.reversal_cash_transaction_id,
      correctedByAdminId: row.corrected_by_admin_id,
      createdAt: this.formatIsoTimestamp(row.created_at)!,
    };
  }

  /**
   * Retrieves daily sheets for a specific member by business memberNumber.
   */
  async findByMemberNumber(
    memberNumber: string,
    page = 1,
    pageSize = 20,
    executor?: Queryable
  ): Promise<{ items: DailySheet[]; total: number }> {
    return this.findMany({ memberNumber, page, pageSize }, executor);
  }
}
