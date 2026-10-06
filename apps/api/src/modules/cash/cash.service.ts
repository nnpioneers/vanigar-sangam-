/**
 * Cash Service (Phase 4.1)
 *
 * Implements business orchestration for administrator cash holding accounts
 * and the append-only cash ledger.
 * Enforces transactional execution via ServiceContext.
 */

import { CashRepository } from './cash.repository.js';
import { withTransaction } from '../../database/transaction.js';
import type { Queryable } from '../../database/index.js';
import type { ServiceContext } from '../module.types.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  AppError,
} from '../../errors/app-error.js';
import type {
  AdminCashAccount,
  CashTransaction,
  DerivedCashBalance,
  CreateCashAccountDto,
  RecordCashTransactionDto,
  InitiateCashTransferDto,
  CashTransfer,
  RecordCashReconciliationDto,
  CashReconciliation,
} from './cash.types.js';

export class CashService {
  constructor(private readonly repo: CashRepository = new CashRepository()) {}

  /**
   * Retrieves an administrator's cash account by admin user ID.
   */
  async getAccountForAdmin(adminId: string, ctx?: ServiceContext): Promise<AdminCashAccount | null> {
    if (!adminId) {
      throw new ValidationError('Admin ID is required.');
    }
    return this.repo.findAccountByAdminId(adminId, ctx?.tx);
  }

  /**
   * Retrieves an administrator's cash account or creates one if it does not yet exist.
   */
  async getOrCreateAccountForAdmin(
    adminId: string,
    defaultName = 'Cash in Hand',
    ctx?: ServiceContext
  ): Promise<AdminCashAccount> {
    if (!adminId) {
      throw new ValidationError('Admin ID is required.');
    }

    const existing = await this.repo.findAccountByAdminId(adminId, ctx?.tx);
    if (existing) {
      return existing;
    }

    try {
      return await this.repo.createAccount(
        {
          adminId,
          accountName: defaultName,
          status: 'ACTIVE',
        },
        ctx?.tx
      );
    } catch (err: unknown) {
      // PostgreSQL unique constraint violation (duplicate account for admin)
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        const recheck = await this.repo.findAccountByAdminId(adminId, ctx?.tx);
        if (recheck) return recheck;
        throw new ConflictError('A cash holding account already exists for this administrator.');
      }
      // PostgreSQL foreign key violation (referenced admin does not exist)
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23503') {
        throw new NotFoundError(`Administrator with ID "${adminId}" does not exist.`);
      }
      throw err;
    }
  }

  /**
   * Creates a cash account explicitly.
   */
  async createAccount(dto: CreateCashAccountDto, ctx?: ServiceContext): Promise<AdminCashAccount> {
    if (!dto.adminId) {
      throw new ValidationError('Admin ID is required.');
    }
    if (!dto.accountName || dto.accountName.trim().length === 0) {
      throw new ValidationError('Account name is required.');
    }

    try {
      return await this.repo.createAccount(dto, ctx?.tx);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError('A cash holding account already exists for this administrator.');
      }
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23503') {
        throw new NotFoundError(`Administrator with ID "${dto.adminId}" does not exist.`);
      }
      throw err;
    }
  }

  /**
   * Retrieves the derived cash balance for a specified cash account.
   * Derived purely from: SUM(CREDIT) - SUM(DEBIT)
   */
  async getDerivedBalance(accountId: string, ctx?: ServiceContext): Promise<DerivedCashBalance> {
    if (!accountId) {
      throw new ValidationError('Account ID is required.');
    }

    const balance = await this.repo.getDerivedBalance(accountId, ctx?.tx);
    if (!balance) {
      throw new NotFoundError(`Cash account with ID "${accountId}" was not found.`);
    }

    return balance;
  }

  /**
   * Retrieves the derived cash balance for an administrator by admin ID.
   */
  async getDerivedBalanceForAdmin(adminId: string, ctx?: ServiceContext): Promise<DerivedCashBalance> {
    if (!adminId) {
      throw new ValidationError('Admin ID is required.');
    }

    const balance = await this.repo.getDerivedBalanceByAdminId(adminId, ctx?.tx);
    if (!balance) {
      throw new NotFoundError(`No cash holding account found for administrator with ID "${adminId}".`);
    }

    return balance;
  }

  /**
   * Appends an immutable cash transaction entry.
   *
   * Validates:
   * 1. Account existence and active status.
   * 2. Positive amount (amountPaise > 0n).
   * 3. Direction is CREDIT or DEBIT.
   * 4. Propagates correlation context if provided.
   */
  async recordTransaction(dto: RecordCashTransactionDto, ctx?: ServiceContext): Promise<CashTransaction> {
    if (!dto.accountId) {
      throw new ValidationError('Account ID is required.');
    }

    if (typeof dto.amountPaise !== 'bigint' || dto.amountPaise <= 0n) {
      throw new ValidationError('Transaction amount must be a positive integer in paise (greater than zero).');
    }

    if (dto.direction !== 'CREDIT' && dto.direction !== 'DEBIT') {
      throw new ValidationError('Transaction direction must be either "CREDIT" or "DEBIT".');
    }

    // Verify account exists and is ACTIVE
    const account = await this.repo.findAccountById(dto.accountId, ctx?.tx);
    if (!account) {
      throw new NotFoundError(`Cash account with ID "${dto.accountId}" was not found.`);
    }

    if (account.status !== 'ACTIVE') {
      throw new AppError(
        `Cannot record transaction: cash account is currently ${account.status}.`,
        400,
        'ACCOUNT_NOT_ACTIVE'
      );
    }

    const recordedByAdminId = dto.recordedByAdminId || ctx?.adminId;
    if (!recordedByAdminId) {
      throw new ValidationError('Recording administrator ID is required.');
    }

    const enrichedDto: RecordCashTransactionDto = {
      ...dto,
      recordedByAdminId,
      correlationId: dto.correlationId ?? ctx?.requestId,
    };

    return this.repo.recordTransaction(enrichedDto, ctx?.tx);
  }

  /**
   * Lists chronological transactions for an account.
   */
  async listTransactions(
    accountId: string,
    limit = 50,
    ctx?: ServiceContext
  ): Promise<CashTransaction[]> {
    if (!accountId) {
      throw new ValidationError('Account ID is required.');
    }
    return this.repo.listTransactions(accountId, limit, ctx?.tx);
  }

  /**
   * Transfers cash between two admin accounts.
   * Unresolved Business Policies: Negative cash balance policy, Transfer handover acknowledgement policy.
   * Foundation implemented: Single-step authoritative transfer (debits source, credits destination).
   */
  async transferCash(dto: InitiateCashTransferDto, ctx?: ServiceContext): Promise<CashTransfer> {
    if (dto.sourceAccountId === dto.destinationAccountId) {
      throw new ValidationError('Source and destination accounts must be different.');
    }
    if (typeof dto.amountPaise !== 'bigint' || dto.amountPaise <= 0n) {
      throw new ValidationError('Transfer amount must be positive.');
    }
    if (!dto.initiatedByAdminId) {
      throw new ValidationError('Initiating admin ID is required.');
    }

    if (dto.idempotencyKey) {
      const existing = await this.repo.findTransferByIdempotencyKey(dto.idempotencyKey, ctx?.tx);
      if (existing) return existing;
    }

    // Execute atomically
    const executeTransfer = async (tx: Queryable) => {
      // 1. Verify accounts exist and are ACTIVE
      const source = await this.repo.findAccountById(dto.sourceAccountId, tx);
      const dest = await this.repo.findAccountById(dto.destinationAccountId, tx);

      if (!source) throw new NotFoundError('Source account not found.');
      if (!dest) throw new NotFoundError('Destination account not found.');
      if (source.status !== 'ACTIVE' || dest.status !== 'ACTIVE') {
        throw new AppError('Both accounts must be active.', 400, 'ACCOUNTS_NOT_ACTIVE');
      }

      // NOTE: Negative balance check is currently an unresolved policy. Not enforcing here yet.

      // 2. Create the transfer record
      const transfer = await this.repo.createTransfer(dto, tx);

      // 3. Record DEBIT against source
      await this.repo.recordTransaction({
        accountId: source.id,
        amountPaise: dto.amountPaise,
        direction: 'DEBIT',
        transactionType: 'TRANSFER_OUT',
        domainEntityType: 'cash_transfers',
        domainEntityId: transfer.id,
        correlationId: dto.idempotencyKey ?? transfer.id,
        notes: `Transfer to ${dest.accountName}`,
        recordedByAdminId: dto.initiatedByAdminId,
      }, tx);

      // 4. Record CREDIT against destination
      await this.repo.recordTransaction({
        accountId: dest.id,
        amountPaise: dto.amountPaise,
        direction: 'CREDIT',
        transactionType: 'TRANSFER_IN',
        domainEntityType: 'cash_transfers',
        domainEntityId: transfer.id,
        correlationId: dto.idempotencyKey ?? transfer.id,
        notes: `Transfer from ${source.accountName}`,
        recordedByAdminId: dto.initiatedByAdminId,
      }, tx);

      return transfer;
    };

    if (ctx?.tx) {
      return executeTransfer(ctx.tx);
    }
    return withTransaction((tx) => executeTransfer(tx));
  }

  /**
   * Records a physical cash reconciliation result.
   * Unresolved Business Policies: Adjustment authorization policy.
   * Foundation implemented: Records discrepancy but does NOT automatically adjust balance.
   */
  async recordReconciliation(dto: RecordCashReconciliationDto, ctx?: ServiceContext): Promise<CashReconciliation> {
    if (!dto.accountId) throw new ValidationError('Account ID is required.');
    if (typeof dto.expectedBalancePaise !== 'bigint') throw new ValidationError('Expected balance is required.');
    if (typeof dto.actualBalancePaise !== 'bigint') throw new ValidationError('Actual balance is required.');
    if (!dto.performedByAdminId) throw new ValidationError('Performing admin ID is required.');

    const account = await this.repo.findAccountById(dto.accountId, ctx?.tx);
    if (!account) throw new NotFoundError('Account not found.');

    const currentBalance = await this.getDerivedBalance(dto.accountId, ctx);
    if (currentBalance.balancePaise !== dto.expectedBalancePaise) {
      throw new ConflictError('Expected balance does not match current derived balance.');
    }

    // Records the reconciliation. Automatic adjustment is NOT implemented due to unresolved policy.
    return this.repo.createReconciliation(dto, ctx?.tx);
  }
}
