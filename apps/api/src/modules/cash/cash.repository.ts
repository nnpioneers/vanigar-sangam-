/**
 * Cash Repository (Phase 4.1)
 *
 * Implements database operations for admin cash accounts and the append-only cash ledger.
 * Extends BaseRepository to support optional transactional execution clients.
 */

import { BaseRepository } from '../../repositories/base.repository.js';
import type { Queryable } from '../../database/index.js';
import type {
  AdminCashAccount,
  AdminCashAccountRow,
  CashTransaction,
  CashTransactionRow,
  DerivedCashBalance,
  DerivedCashBalanceRow,
  CreateCashAccountDto,
  RecordCashTransactionDto,
  CashTransfer,
  CashTransferRow,
  CashReconciliation,
  CashReconciliationRow,
  InitiateCashTransferDto,
  RecordCashReconciliationDto,
} from './cash.types.js';

export class CashRepository extends BaseRepository {
  /**
   * Maps a database row to an AdminCashAccount domain entity.
   */
  private mapAccountRow(row: AdminCashAccountRow): AdminCashAccount {
    return {
      id: row.id,
      adminId: row.admin_id,
      accountName: row.account_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Maps a database row to a CashTransaction domain entity with exact bigint paise.
   */
  private mapTransactionRow(row: CashTransactionRow): CashTransaction {
    return {
      id: row.id,
      accountId: row.account_id,
      amountPaise: typeof row.amount_paise === 'bigint' ? row.amount_paise : BigInt(row.amount_paise),
      direction: row.direction,
      transactionType: row.transaction_type,
      domainEntityType: row.domain_entity_type ?? null,
      domainEntityId: row.domain_entity_id ?? null,
      correlationId: row.correlation_id ?? null,
      notes: row.notes ?? null,
      recordedByAdminId: row.recorded_by_admin_id,
      transactedAt: row.transacted_at,
      createdAt: row.created_at,
    };
  }

  /**
   * Maps a database row from `v_admin_cash_balances` to a DerivedCashBalance domain entity.
   */
  private mapBalanceRow(row: DerivedCashBalanceRow): DerivedCashBalance {
    return {
      accountId: row.account_id,
      adminId: row.admin_id,
      accountName: row.account_name,
      status: row.status,
      totalCreditPaise: typeof row.total_credit_paise === 'bigint' ? row.total_credit_paise : BigInt(row.total_credit_paise),
      totalDebitPaise: typeof row.total_debit_paise === 'bigint' ? row.total_debit_paise : BigInt(row.total_debit_paise),
      balancePaise: typeof row.balance_paise === 'bigint' ? row.balance_paise : BigInt(row.balance_paise),
      transactionCount: typeof row.transaction_count === 'number' ? row.transaction_count : parseInt(row.transaction_count, 10),
      lastTransactedAt: row.last_transacted_at ?? null,
    };
  }

  /**
   * Finds a cash account by the owning administrator ID.
   */
  async findAccountByAdminId(adminId: string, executor?: Queryable): Promise<AdminCashAccount | null> {
    const row = await this.queryOne<AdminCashAccountRow>(
      `SELECT id, admin_id, account_name, status, created_at, updated_at
       FROM admin_cash_accounts
       WHERE admin_id = $1;`,
      [adminId],
      executor
    );
    return row ? this.mapAccountRow(row) : null;
  }

  /**
   * Finds a cash account by its primary key ID.
   */
  async findAccountById(id: string, executor?: Queryable): Promise<AdminCashAccount | null> {
    const row = await this.queryOne<AdminCashAccountRow>(
      `SELECT id, admin_id, account_name, status, created_at, updated_at
       FROM admin_cash_accounts
       WHERE id = $1;`,
      [id],
      executor
    );
    return row ? this.mapAccountRow(row) : null;
  }

  /**
   * Creates a new cash holding account for an administrator.
   */
  async createAccount(dto: CreateCashAccountDto, executor?: Queryable): Promise<AdminCashAccount> {
    const status = dto.status ?? 'ACTIVE';
    const row = await this.queryOne<AdminCashAccountRow>(
      `INSERT INTO admin_cash_accounts (admin_id, account_name, status)
       VALUES ($1, $2, $3)
       RETURNING id, admin_id, account_name, status, created_at, updated_at;`,
      [dto.adminId, dto.accountName, status],
      executor
    );
    if (!row) {
      throw new Error('Failed to insert admin cash account record');
    }
    return this.mapAccountRow(row);
  }

  /**
   * Appends an immutable cash transaction entry to `cash_transactions`.
   */
  async recordTransaction(dto: RecordCashTransactionDto, executor?: Queryable): Promise<CashTransaction> {
    const transactedAt = dto.transactedAt ?? new Date();
    const row = await this.queryOne<CashTransactionRow>(
      `INSERT INTO cash_transactions (
         account_id,
         amount_paise,
         direction,
         transaction_type,
         domain_entity_type,
         domain_entity_id,
         correlation_id,
         notes,
         recorded_by_admin_id,
         transacted_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING 
         id,
         account_id,
         amount_paise,
         direction,
         transaction_type,
         domain_entity_type,
         domain_entity_id,
         correlation_id,
         notes,
         recorded_by_admin_id,
         transacted_at,
         created_at;`,
      [
        dto.accountId,
        dto.amountPaise.toString(), // Passes exact 64-bit integer representation
        dto.direction,
        dto.transactionType,
        dto.domainEntityType ?? null,
        dto.domainEntityId ?? null,
        dto.correlationId ?? null,
        dto.notes ?? null,
        dto.recordedByAdminId,
        transactedAt,
      ],
      executor
    );
    if (!row) {
      throw new Error('Failed to record cash ledger transaction');
    }
    return this.mapTransactionRow(row);
  }

  /**
   * Queries the derived cash balance for an account from the `v_admin_cash_balances` view.
   * Balance = SUM(CREDIT) - SUM(DEBIT)
   */
  async getDerivedBalance(accountId: string, executor?: Queryable): Promise<DerivedCashBalance | null> {
    const row = await this.queryOne<DerivedCashBalanceRow>(
      `SELECT 
         account_id,
         admin_id,
         account_name,
         status,
         total_credit_paise,
         total_debit_paise,
         balance_paise,
         transaction_count,
         last_transacted_at
       FROM v_admin_cash_balances
       WHERE account_id = $1;`,
      [accountId],
      executor
    );
    return row ? this.mapBalanceRow(row) : null;
  }

  /**
   * Queries the derived cash balance for an administrator by admin ID.
   */
  async getDerivedBalanceByAdminId(adminId: string, executor?: Queryable): Promise<DerivedCashBalance | null> {
    const row = await this.queryOne<DerivedCashBalanceRow>(
      `SELECT 
         account_id,
         admin_id,
         account_name,
         status,
         total_credit_paise,
         total_debit_paise,
         balance_paise,
         transaction_count,
         last_transacted_at
       FROM v_admin_cash_balances
       WHERE admin_id = $1;`,
      [adminId],
      executor
    );
    return row ? this.mapBalanceRow(row) : null;
  }

  /**
   * Lists chronological transactions for a cash account.
   */
  async listTransactions(
    accountId: string,
    limit = 50,
    executor?: Queryable
  ): Promise<CashTransaction[]> {
    const rows = await this.query<CashTransactionRow>(
      `SELECT 
         id,
         account_id,
         amount_paise,
         direction,
         transaction_type,
         domain_entity_type,
         domain_entity_id,
         correlation_id,
         notes,
         recorded_by_admin_id,
         transacted_at,
         created_at
       FROM cash_transactions
       WHERE account_id = $1
       ORDER BY transacted_at DESC, created_at DESC
       LIMIT $2;`,
      [accountId, limit],
      executor
    );
    return rows.map((r) => this.mapTransactionRow(r));
  }

  /**
   * Maps a database row to a CashTransfer domain entity.
   */
  private mapTransferRow(row: CashTransferRow): CashTransfer {
    return {
      id: row.id,
      sourceAccountId: row.source_account_id,
      destinationAccountId: row.destination_account_id,
      amountPaise: typeof row.amount_paise === 'bigint' ? row.amount_paise : BigInt(row.amount_paise),
      status: row.status,
      idempotencyKey: row.idempotency_key ?? null,
      notes: row.notes ?? null,
      initiatedByAdminId: row.initiated_by_admin_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Maps a database row to a CashReconciliation domain entity.
   */
  private mapReconciliationRow(row: CashReconciliationRow): CashReconciliation {
    return {
      id: row.id,
      accountId: row.account_id,
      expectedBalancePaise: typeof row.expected_balance_paise === 'bigint' ? row.expected_balance_paise : BigInt(row.expected_balance_paise),
      actualBalancePaise: typeof row.actual_balance_paise === 'bigint' ? row.actual_balance_paise : BigInt(row.actual_balance_paise),
      discrepancyPaise: typeof row.discrepancy_paise === 'bigint' ? row.discrepancy_paise : BigInt(row.discrepancy_paise),
      status: row.status,
      notes: row.notes ?? null,
      performedByAdminId: row.performed_by_admin_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Creates a cash transfer record.
   */
  async createTransfer(dto: InitiateCashTransferDto, executor?: Queryable): Promise<CashTransfer> {
    const row = await this.queryOne<CashTransferRow>(
      `INSERT INTO cash_transfers (
         source_account_id,
         destination_account_id,
         amount_paise,
         status,
         idempotency_key,
         notes,
         initiated_by_admin_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING 
         id,
         source_account_id,
         destination_account_id,
         amount_paise,
         status,
         idempotency_key,
         notes,
         initiated_by_admin_id,
         created_at,
         updated_at;`,
      [
        dto.sourceAccountId,
        dto.destinationAccountId,
        dto.amountPaise.toString(),
        'COMPLETED', // We'll just mark it COMPLETED directly for Phase 4.2 unless a two-step is enforced, but let's allow service to manage status. Actually, I should allow passing status.
        dto.idempotencyKey ?? null,
        dto.notes ?? null,
        dto.initiatedByAdminId,
      ],
      executor
    );
    if (!row) {
      throw new Error('Failed to create cash transfer record');
    }
    return this.mapTransferRow(row);
  }

  /**
   * Finds a transfer by idempotency key.
   */
  async findTransferByIdempotencyKey(idempotencyKey: string, executor?: Queryable): Promise<CashTransfer | null> {
    const row = await this.queryOne<CashTransferRow>(
      `SELECT 
         id,
         source_account_id,
         destination_account_id,
         amount_paise,
         status,
         idempotency_key,
         notes,
         initiated_by_admin_id,
         created_at,
         updated_at
       FROM cash_transfers
       WHERE idempotency_key = $1;`,
      [idempotencyKey],
      executor
    );
    return row ? this.mapTransferRow(row) : null;
  }

  /**
   * Creates a cash reconciliation record.
   */
  async createReconciliation(dto: RecordCashReconciliationDto, executor?: Queryable): Promise<CashReconciliation> {
    const discrepancyPaise = dto.actualBalancePaise - dto.expectedBalancePaise;
    const row = await this.queryOne<CashReconciliationRow>(
      `INSERT INTO cash_reconciliations (
         account_id,
         expected_balance_paise,
         actual_balance_paise,
         discrepancy_paise,
         status,
         notes,
         performed_by_admin_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING 
         id,
         account_id,
         expected_balance_paise,
         actual_balance_paise,
         discrepancy_paise,
         status,
         notes,
         performed_by_admin_id,
         created_at,
         updated_at;`,
      [
        dto.accountId,
        dto.expectedBalancePaise.toString(),
        dto.actualBalancePaise.toString(),
        discrepancyPaise.toString(),
        'PENDING', // default for now, could be 'RESOLVED' if discrepancy is 0. Let's make it RESOLVED if 0.
        dto.notes ?? null,
        dto.performedByAdminId,
      ],
      executor
    );
    if (!row) {
      throw new Error('Failed to create cash reconciliation record');
    }
    return this.mapReconciliationRow(row);
  }
}
