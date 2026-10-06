/**
 * Loans Repository (Phase 8.2, 8.6–8.8, 8.10)
 *
 * Handles direct database access for the Loans domain using parametric queries.
 */

import { getDbPool } from '../../database/index.js';
import type { Queryable } from '../../database/index.js';
import type { Loan, LoanListFilter, LoanStatus, CreateLoanInput } from './loans.types.js';

export class LoansRepository {
  private formatIsoTimestamp(val: Date | string | null): string | null {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  private formatDateOnly(val: Date | string | null): string | null {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0]!;
  }

  private mapRowToLoan(row: Record<string, unknown>): Loan {
    return {
      id: String(row.id),
      memberId: String(row.member_id),
      memberNumber: row.member_number != null ? String(row.member_number) : undefined,
      memberName: row.member_name != null ? String(row.member_name) : undefined,
      shopName: row.shop_name !== undefined ? (row.shop_name != null ? String(row.shop_name) : null) : undefined,
      numberOfSheets: row.number_of_sheets != null ? parseInt(String(row.number_of_sheets), 10) : undefined,
      requestedAmountPaise: parseInt(String(row.requested_amount_paise), 10),
      approvedAmountPaise: row.approved_amount_paise != null ? parseInt(String(row.approved_amount_paise), 10) : null,
      status: String(row.status) as LoanStatus,
      applicationDate: this.formatDateOnly(row.application_date as string | Date | null)!,
      disbursementDate: this.formatDateOnly(row.disbursement_date as string | Date | null),
      maxDueDate: this.formatDateOnly(row.max_due_date as string | Date | null),
      recordedByAdminId: String(row.recorded_by_admin_id),
      createdAt: this.formatIsoTimestamp(row.created_at as string | Date | null)!,
      updatedAt: this.formatIsoTimestamp(row.updated_at as string | Date | null)!,
    };
  }

  async findById(id: string, executor: Queryable = getDbPool()): Promise<Loan | null> {
    const res = await executor.query(
      `SELECT
         l.id, l.member_id, l.requested_amount_paise, l.approved_amount_paise,
         l.status, l.application_date, l.disbursement_date, l.max_due_date,
         l.recorded_by_admin_id, l.created_at, l.updated_at,
         m.member_number, m.member_name, m.shop_name, m.number_of_sheets
       FROM loans l
       INNER JOIN members m ON l.member_id = m.id
       WHERE l.id = $1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    if (!row) return null;
    return this.mapRowToLoan(row as Record<string, unknown>);
  }

  async findByIdForUpdate(id: string, executor: Queryable): Promise<Loan | null> {
    const res = await executor.query(
      `SELECT
         l.id, l.member_id, l.requested_amount_paise, l.approved_amount_paise,
         l.status, l.application_date, l.disbursement_date, l.max_due_date,
         l.recorded_by_admin_id, l.created_at, l.updated_at,
         m.member_number, m.member_name, m.shop_name, m.number_of_sheets
       FROM loans l
       INNER JOIN members m ON l.member_id = m.id
       WHERE l.id = $1
       FOR UPDATE`,
      [id]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    if (!row) return null;
    return this.mapRowToLoan(row as Record<string, unknown>);
  }

  async findByMemberId(memberId: string, executor: Queryable = getDbPool()): Promise<Loan[]> {
    const res = await executor.query(
      `SELECT
         l.id, l.member_id, l.requested_amount_paise, l.approved_amount_paise,
         l.status, l.application_date, l.disbursement_date, l.max_due_date,
         l.recorded_by_admin_id, l.created_at, l.updated_at,
         m.member_number, m.member_name, m.shop_name, m.number_of_sheets
       FROM loans l
       INNER JOIN members m ON l.member_id = m.id
       WHERE l.member_id = $1
       ORDER BY l.application_date DESC, l.created_at DESC`,
      [memberId]
    );
    return res.rows.map(row => this.mapRowToLoan(row as Record<string, unknown>));
  }

  async findActiveLoanByMemberId(memberId: string, executor: Queryable = getDbPool()): Promise<Loan | null> {
    const res = await executor.query(
      `SELECT
         l.id, l.member_id, l.requested_amount_paise, l.approved_amount_paise,
         l.status, l.application_date, l.disbursement_date, l.max_due_date,
         l.recorded_by_admin_id, l.created_at, l.updated_at,
         m.member_number, m.member_name, m.shop_name, m.number_of_sheets
       FROM loans l
       INNER JOIN members m ON l.member_id = m.id
       WHERE l.member_id = $1 AND l.status IN ('NEW', 'ACTIVE', 'PARTIALLY_REPAID', 'OVERDUE')
       LIMIT 1`,
      [memberId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    if (!row) return null;
    return this.mapRowToLoan(row as Record<string, unknown>);
  }

  async hasActiveLoan(memberId: string, executor: Queryable = getDbPool()): Promise<boolean> {
    const res = await executor.query(
      `SELECT 1
       FROM loans
       WHERE member_id = $1 AND status IN ('NEW', 'ACTIVE', 'PARTIALLY_REPAID', 'OVERDUE')
       LIMIT 1`,
      [memberId]
    );
    return res.rows.length > 0;
  }

  async getMemberDailySheetCount(memberId: string, executor: Queryable = getDbPool()): Promise<number> {
    const res = await executor.query(
      `SELECT COUNT(*)::int as count
       FROM daily_sheets
       WHERE member_id = $1`,
      [memberId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  /**
   * Phase 8.8: Checks whether the member has an OVERDUE loan whose application_date
   * is more than `thresholdDays` days ago.
   *
   * This is a structural check only — it does NOT calculate outstanding amounts,
   * repayments, or automatically change any loan status.
   * The "overdue beyond 100 days" rule blocks new loan creation until the overdue
   * loan is manually settled (status changed to CLOSED).
   */
  async hasOverdueLoanBeyondDays(
    memberId: string,
    thresholdDays: number,
    executor: Queryable = getDbPool()
  ): Promise<boolean> {
    const res = await executor.query(
      `SELECT 1
       FROM loans
       WHERE member_id = $1
         AND status = 'OVERDUE'
         AND application_date < (CURRENT_DATE - INTERVAL '1 day' * $2)
       LIMIT 1`,
      [memberId, thresholdDays]
    );
    return res.rows.length > 0;
  }

  async create(
    memberId: string,
    data: CreateLoanInput,
    adminId: string,
    executor: Queryable = getDbPool()
  ): Promise<Loan> {
    const res = await executor.query(
      `INSERT INTO loans (
         member_id,
         requested_amount_paise,
         application_date,
         recorded_by_admin_id,
         status
       ) VALUES ($1, $2, $3, $4, 'NEW')
       RETURNING 
         id, member_id, requested_amount_paise, approved_amount_paise,
         status, application_date, disbursement_date, max_due_date,
         recorded_by_admin_id, created_at, updated_at`,
      [
        memberId,
        data.requestedAmountPaise,
        data.applicationDate,
        adminId
      ]
    );
    const createdRow = res.rows[0];
    if (!createdRow) throw new Error('Failed to insert loan record');
    // Load with joined member details for full structural payload
    const fullLoan = await this.findById(String(createdRow.id), executor);
    return fullLoan || this.mapRowToLoan(createdRow as Record<string, unknown>);
  }

  async updateStatus(
    id: string,
    newStatus: LoanStatus,
    executor: Queryable = getDbPool()
  ): Promise<Loan> {
    const res = await executor.query(
      `UPDATE loans
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [newStatus, id]
    );
    if (res.rows.length === 0) {
      throw new Error(`Loan with ID "${id}" not found`);
    }
    const updated = await this.findById(id, executor);
    if (!updated) {
      throw new Error(`Failed to load updated loan with ID "${id}"`);
    }
    return updated;
  }

  async findMany(
    filter: LoanListFilter,
    executor: Queryable = getDbPool()
  ): Promise<{ items: Loan[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter.status) {
      conditions.push(`l.status = $${paramIdx++}`);
      params.push(filter.status);
    }
    
    if (filter.memberNumber) {
      conditions.push(`m.member_number = $${paramIdx++}`);
      params.push(filter.memberNumber);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const countRes = await executor.query(
      `SELECT COUNT(l.id)
       FROM loans l
       LEFT JOIN members m ON l.member_id = m.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const dataRes = await executor.query(
      `SELECT
         l.id, l.member_id, l.requested_amount_paise, l.approved_amount_paise,
         l.status, l.application_date, l.disbursement_date, l.max_due_date,
         l.recorded_by_admin_id, l.created_at, l.updated_at,
         m.member_number, m.member_name, m.shop_name, m.number_of_sheets
       FROM loans l
       LEFT JOIN members m ON l.member_id = m.id
       ${whereClause}
       ORDER BY l.application_date DESC, l.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, pageSize, offset]
    );

    return {
      items: dataRes.rows.map(row => this.mapRowToLoan(row as Record<string, unknown>)),
      total,
    };
  }
}
