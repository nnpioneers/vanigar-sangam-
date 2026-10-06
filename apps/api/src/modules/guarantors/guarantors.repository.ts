/**
 * Guarantors Repository (Phase 9.2)
 *
 * Handles database access for loan guarantors.
 */

import { getDbPool, type Queryable } from '../../database/index.js';
import type { Guarantor, GuarantorStatus, GuaranteedLoan } from './guarantors.types.js';

export class GuarantorsRepository {
  private formatIsoTimestamp(val: Date | string | null): string | null {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  /**
   * Maps a database row to a Guarantor domain entity.
   */
  private mapRow(row: Record<string, unknown>): Guarantor {
    return {
      id: row.id as string,
      loanId: row.loan_id as string,
      guarantorMemberId: row.guarantor_member_id as string,
      guarantorMemberNumber: row.member_number as string,
      guarantorMemberName: row.member_name as string,
      guarantorShopName: row.shop_name as string | null,
      responsibilityAmountPaise: parseInt((row.responsibility_amount_paise as string) || '0', 10),
      status: row.status as GuarantorStatus,
      recordedByAdminId: row.recorded_by_admin_id as string,
      createdAt: this.formatIsoTimestamp(row.created_at as Date)!,
      updatedAt: this.formatIsoTimestamp(row.updated_at as Date)!,
    };
  }

  async create(
    loanId: string,
    guarantorMemberId: string,
    amountPaise: number,
    adminId: string,
    executor: Queryable = getDbPool()
  ): Promise<Guarantor> {
    const res = await executor.query(
      `INSERT INTO loan_guarantors (
         loan_id, guarantor_member_id, responsibility_amount_paise, recorded_by_admin_id
       ) VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [loanId, guarantorMemberId, amountPaise, adminId]
    );

    // Fetch joined data immediately
    return this.findById(res.rows[0]!.id, executor) as Promise<Guarantor>;
  }

  async findById(id: string, executor: Queryable = getDbPool()): Promise<Guarantor | null> {
    const res = await executor.query(
      `SELECT g.*, m.member_number, m.member_name, m.shop_name
       FROM loan_guarantors g
       JOIN members m ON g.guarantor_member_id = m.id
       WHERE g.id = $1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]!);
  }

  async findByLoanId(loanId: string, executor: Queryable = getDbPool()): Promise<Guarantor[]> {
    const res = await executor.query(
      `SELECT g.*, m.member_number, m.member_name, m.shop_name
       FROM loan_guarantors g
       JOIN members m ON g.guarantor_member_id = m.id
       WHERE g.loan_id = $1
       ORDER BY g.created_at ASC`,
      [loanId]
    );
    return res.rows.map(row => this.mapRow(row));
  }

  async getGuarantorCountForLoan(loanId: string, executor: Queryable = getDbPool()): Promise<number> {
    const res = await executor.query(
      `SELECT COUNT(*)::int as count FROM loan_guarantors WHERE loan_id = $1`,
      [loanId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  async getTotalResponsibilityForLoan(loanId: string, executor: Queryable = getDbPool()): Promise<number> {
    const res = await executor.query(
      `SELECT SUM(responsibility_amount_paise)::bigint as total 
       FROM loan_guarantors 
       WHERE loan_id = $1`,
      [loanId]
    );
    return parseInt(res.rows[0]?.total || '0', 10);
  }

  async isGuarantorForLoan(loanId: string, memberId: string, executor: Queryable = getDbPool()): Promise<boolean> {
    const res = await executor.query(
      `SELECT 1 FROM loan_guarantors WHERE loan_id = $1 AND guarantor_member_id = $2 LIMIT 1`,
      [loanId, memberId]
    );
    return res.rows.length > 0;
  }

  async findGuaranteesByMemberNumber(
    memberNumber: string,
    page: number = 1,
    pageSize: number = 10,
    executor: Queryable = getDbPool()
  ): Promise<{ items: GuaranteedLoan[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const countRes = await executor.query(
      `SELECT COUNT(*) as count 
       FROM loan_guarantors g
       JOIN members gm ON g.guarantor_member_id = gm.id
       WHERE gm.member_number = $1`,
      [memberNumber]
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const dataRes = await executor.query(
      `SELECT 
         g.id,
         g.loan_id,
         l.requested_amount_paise as loan_amount_paise,
         l.status as loan_status,
         l.application_date,
         l.disbursement_date,
         (SELECT COALESCE(SUM(amount_paise), 0) FROM loan_repayments WHERE loan_id = l.id) as total_repaid,
         g.responsibility_amount_paise,
         g.status as guarantee_status,
         g.created_at,
         bm.member_number as borrower_member_number,
         bm.member_name as borrower_member_name,
         bm.shop_name as borrower_shop_name
       FROM loan_guarantors g
       JOIN members gm ON g.guarantor_member_id = gm.id
       JOIN loans l ON g.loan_id = l.id
       JOIN members bm ON l.member_id = bm.id
       WHERE gm.member_number = $1
       ORDER BY g.created_at DESC
       LIMIT $2 OFFSET $3;`,
      [memberNumber, pageSize, offset]
    );

    const items: GuaranteedLoan[] = dataRes.rows.map((row) => {
      const loanAmount = parseInt((row.loan_amount_paise as string) || '0', 10);
      const totalRepaid = parseInt((row.total_repaid as string) || '0', 10);
      const outstanding = loanAmount - totalRepaid;

      return {
        id: row.id as string,
        loanId: row.loan_id as string,
        borrowerMemberNumber: row.borrower_member_number as string,
        borrowerMemberName: row.borrower_member_name as string,
        borrowerShopName: row.borrower_shop_name ? (row.borrower_shop_name as string) : undefined,
        loanAmountPaise: loanAmount,
        loanOutstandingPaise: outstanding,
        loanStatus: row.loan_status as string,
        loanApplicationDate: this.formatIsoTimestamp(row.application_date as Date | null),
        loanDisbursementDate: this.formatIsoTimestamp(row.disbursement_date as Date | null),
        responsibilityAmountPaise: parseInt((row.responsibility_amount_paise as string) || '0', 10),
        guaranteeStatus: row.guarantee_status as GuarantorStatus,
        createdAt: this.formatIsoTimestamp(row.created_at as Date)!,
      };
    });

    return { items, total };
  }
}

export const guarantorsRepository = new GuarantorsRepository();
