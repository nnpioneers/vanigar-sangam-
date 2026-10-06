import { type PoolClient } from 'pg';
import { getDbPool } from '../../database/index.js';
import type { LoanRepayment, CreateRepaymentInput } from './repayments.types.js';

function mapRowToRepayment(row: any): LoanRepayment {
  return {
    id: row.id,
    loanId: row.loan_id,
    amountPaise: parseInt(row.amount_paise, 10),
    repaymentDate: row.repayment_date instanceof Date ? row.repayment_date.toISOString().split('T')[0] : row.repayment_date,
    recordedByAdminId: row.recorded_by_admin_id,
    paymentMode: row.payment_mode,
    referenceNumber: row.reference_number,
    notes: row.notes,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

export async function createRepaymentWithAudit(
  client: PoolClient,
  adminId: string,
  input: CreateRepaymentInput
): Promise<LoanRepayment> {
  // Insert repayment
  const repaymentRes = await client.query(
    `INSERT INTO loan_repayments (
      loan_id, amount_paise, repayment_date, recorded_by_admin_id, 
      payment_mode, reference_number, notes, idempotency_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      input.loanId,
      input.amountPaise,
      input.repaymentDate,
      adminId, // Recorded by current admin
      input.paymentMode,
      input.referenceNumber || null,
      input.notes || null,
      input.idempotencyKey || null,
    ]
  );
  
  const repaymentRow = repaymentRes.rows[0];

  // Insert audit
  await client.query(
    `INSERT INTO loan_repayments_audit (
      repayment_id, loan_id, admin_id, action, amount_paise
    ) VALUES ($1, $2, $3, $4, $5)`,
    [
      repaymentRow.id,
      input.loanId,
      adminId,
      'CREATE_REPAYMENT',
      input.amountPaise,
    ]
  );

  return mapRowToRepayment(repaymentRow);
}

export async function getRepaymentByIdempotencyKey(key: string): Promise<LoanRepayment | null> {
  const pool = getDbPool();
  const res = await pool.query('SELECT * FROM loan_repayments WHERE idempotency_key = $1', [key]);
  if (res.rows.length === 0) return null;
  return mapRowToRepayment(res.rows[0]);
}

export async function listRepaymentsByLoanId(loanId: string): Promise<LoanRepayment[]> {
  const pool = getDbPool();
  const res = await pool.query(
    'SELECT * FROM loan_repayments WHERE loan_id = $1 ORDER BY repayment_date DESC, created_at DESC',
    [loanId]
  );
  return res.rows.map(mapRowToRepayment);
}

export async function getRepaymentById(id: string): Promise<LoanRepayment | null> {
  const pool = getDbPool();
  const res = await pool.query('SELECT * FROM loan_repayments WHERE id = $1', [id]);
  if (res.rows.length === 0) return null;
  return mapRowToRepayment(res.rows[0]);
}
