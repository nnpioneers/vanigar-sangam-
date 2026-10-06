/**
 * Cash Module Types & Contracts (Phase 4.1)
 *
 * Defines domain entities, database row contracts, and DTOs for admin cash accounts
 * and the append-only cash ledger.
 */

export type CashAccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type CashTransactionDirection = 'CREDIT' | 'DEBIT';

export type CashTransactionType =
  | 'OPENING_BALANCE'
  | 'COLLECTION_DEPOSIT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'LOAN_DISBURSEMENT'
  | 'EXPENSE'
  | 'ADJUSTMENT';

/**
 * Domain entity representing an administrator's physical cash holding account.
 * Note: Intentionally does NOT store an authoritative mutable balance column.
 */
export interface AdminCashAccount {
  id: string;
  adminId: string;
  accountName: string;
  status: CashAccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raw database row shape for `admin_cash_accounts`.
 */
export interface AdminCashAccountRow {
  id: string;
  admin_id: string;
  account_name: string;
  status: CashAccountStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * Domain entity representing an immutable ledger record in `cash_transactions`.
 */
export interface CashTransaction {
  id: string;
  accountId: string;
  amountPaise: bigint;
  direction: CashTransactionDirection;
  transactionType: CashTransactionType;
  domainEntityType?: string | null;
  domainEntityId?: string | null;
  correlationId?: string | null;
  notes?: string | null;
  recordedByAdminId: string;
  transactedAt: Date;
  createdAt: Date;
}

/**
 * Raw database row shape for `cash_transactions`.
 * Note: PostgreSQL returns BIGINT columns as strings to prevent IEEE 754 precision loss.
 */
export interface CashTransactionRow {
  id: string;
  account_id: string;
  amount_paise: string | bigint;
  direction: CashTransactionDirection;
  transaction_type: CashTransactionType;
  domain_entity_type?: string | null;
  domain_entity_id?: string | null;
  correlation_id?: string | null;
  notes?: string | null;
  recorded_by_admin_id: string;
  transacted_at: Date;
  created_at: Date;
}

/**
 * Derived cash balance summary computed strictly from the append-only transaction ledger:
 * Balance = SUM(CREDIT entries) - SUM(DEBIT entries)
 */
export interface DerivedCashBalance {
  accountId: string;
  adminId: string;
  accountName: string;
  status: CashAccountStatus;
  totalCreditPaise: bigint;
  totalDebitPaise: bigint;
  balancePaise: bigint;
  transactionCount: number;
  lastTransactedAt: Date | null;
}

/**
 * Raw database row shape for `v_admin_cash_balances` view.
 */
export interface DerivedCashBalanceRow {
  account_id: string;
  admin_id: string;
  account_name: string;
  status: CashAccountStatus;
  total_credit_paise: string | bigint;
  total_debit_paise: string | bigint;
  balance_paise: string | bigint;
  transaction_count: string | number;
  last_transacted_at: Date | null;
}

/**
 * Input DTO for creating an admin cash account.
 */
export interface CreateCashAccountDto {
  adminId: string;
  accountName: string;
  status?: CashAccountStatus;
}

/**
 * Input DTO for recording an append-only cash transaction.
 */
export interface RecordCashTransactionDto {
  accountId: string;
  amountPaise: bigint;
  direction: CashTransactionDirection;
  transactionType: CashTransactionType;
  domainEntityType?: string;
  domainEntityId?: string;
  correlationId?: string;
  notes?: string;
  recordedByAdminId: string;
  transactedAt?: Date;
}

export type CashTransferStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REJECTED';
export type CashReconciliationStatus = 'PENDING' | 'RESOLVED';

export interface CashTransfer {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountPaise: bigint;
  status: CashTransferStatus;
  idempotencyKey?: string | null;
  notes?: string | null;
  initiatedByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CashTransferRow {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount_paise: string | bigint;
  status: CashTransferStatus;
  idempotency_key?: string | null;
  notes?: string | null;
  initiated_by_admin_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface CashReconciliation {
  id: string;
  accountId: string;
  expectedBalancePaise: bigint;
  actualBalancePaise: bigint;
  discrepancyPaise: bigint;
  status: CashReconciliationStatus;
  notes?: string | null;
  performedByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CashReconciliationRow {
  id: string;
  account_id: string;
  expected_balance_paise: string | bigint;
  actual_balance_paise: string | bigint;
  discrepancy_paise: string | bigint;
  status: CashReconciliationStatus;
  notes?: string | null;
  performed_by_admin_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface InitiateCashTransferDto {
  sourceAccountId: string;
  destinationAccountId: string;
  amountPaise: bigint;
  idempotencyKey?: string;
  notes?: string;
  initiatedByAdminId: string;
}

export interface RecordCashReconciliationDto {
  accountId: string;
  expectedBalancePaise: bigint;
  actualBalancePaise: bigint;
  notes?: string;
  performedByAdminId: string;
}
