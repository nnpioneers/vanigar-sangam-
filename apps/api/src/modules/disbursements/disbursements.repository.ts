/**
 * Disbursements Repository (Phase 10.6)
 */

import { getDbPool, type Queryable } from '../../database/index.js';
import type { LoanDisbursement, DisbursementStatus } from './disbursements.types.js';

export class DisbursementsRepository {
  private formatIsoTimestamp(val: Date | string | null): string | null {
    if (!val) return null;
    const d = typeof val === 'string' ? new Date(val) : val;
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  private mapRow(row: Record<string, unknown>): LoanDisbursement {
    return {
      id: row.id as string,
      loanId: row.loan_id as string,
      amountPaise: parseInt(row.amount_paise as string, 10),
      disbursementDate: this.formatIsoTimestamp(row.disbursement_date as Date)!.split('T')[0] as string,
      cashAccountId: row.cash_account_id as string | null,
      status: row.status as DisbursementStatus,
      recordedByAdminId: row.recorded_by_admin_id as string,
      createdAt: this.formatIsoTimestamp(row.created_at as Date)!,
      updatedAt: this.formatIsoTimestamp(row.updated_at as Date)!,
    };
  }

  async createPendingDisbursement(
    loanId: string,
    amountPaise: number,
    disbursementDate: string,
    adminId: string,
    executor: Queryable = getDbPool()
  ): Promise<LoanDisbursement> {
    const res = await executor.query(
      `INSERT INTO loan_disbursements (
         loan_id, amount_paise, disbursement_date, cash_account_id, status, recorded_by_admin_id
       ) VALUES ($1, $2, $3, NULL, 'PENDING', $4)
       RETURNING *;`,
      [loanId, amountPaise, disbursementDate, adminId]
    );

    return this.mapRow(res.rows[0] as Record<string, unknown>);
  }

  async findByLoanId(loanId: string, executor: Queryable = getDbPool()): Promise<LoanDisbursement | null> {
    const res = await executor.query(
      `SELECT * FROM loan_disbursements WHERE loan_id = $1 LIMIT 1;`,
      [loanId]
    );
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0] as Record<string, unknown>);
  }
}

export const disbursementsRepository = new DisbursementsRepository();
