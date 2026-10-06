/**
 * Agreements Repository (Phase 10.2)
 */

import { getDbPool, type Queryable } from '../../database/index.js';
import type { LoanAgreement, AgreementStatus } from './agreements.types.js';

export class AgreementsRepository {
  private formatIsoTimestamp(val: Date | string | null): string | null {
    if (!val) return null;
    const d = typeof val === 'string' ? new Date(val) : val;
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  private mapRow(row: Record<string, unknown>): LoanAgreement {
    return {
      id: row.id as string,
      loanId: row.loan_id as string,
      agreementNumber: row.agreement_number as string | null,
      agreementDate: this.formatIsoTimestamp(row.agreement_date as Date)!.split('T')[0] as string,
      status: row.status as AgreementStatus,
      recordedByAdminId: row.recorded_by_admin_id as string,
      createdAt: this.formatIsoTimestamp(row.created_at as Date)!,
      updatedAt: this.formatIsoTimestamp(row.updated_at as Date)!,
    };
  }

  async create(
    loanId: string,
    agreementDate: string,
    adminId: string,
    executor: Queryable = getDbPool()
  ): Promise<LoanAgreement> {
    const res = await executor.query(
      `INSERT INTO loan_agreements (
         loan_id, agreement_date, recorded_by_admin_id
       ) VALUES ($1, $2, $3)
       RETURNING *;`,
      [loanId, agreementDate, adminId]
    );

    return this.mapRow(res.rows[0] as Record<string, unknown>);
  }

  async findByLoanId(loanId: string, executor: Queryable = getDbPool()): Promise<LoanAgreement | null> {
    const res = await executor.query(
      `SELECT * FROM loan_agreements WHERE loan_id = $1 LIMIT 1;`,
      [loanId]
    );
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0] as Record<string, unknown>);
  }
}

export const agreementsRepository = new AgreementsRepository();
