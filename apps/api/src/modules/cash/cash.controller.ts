/**
 * Cash Controller (Phase 4.1)
 *
 * Exposes structural HTTP endpoints for viewing administrator cash holdings and balances.
 * Complies with BaseController response conventions and shared-types contracts.
 */

import type { Request, Response } from 'express';
import { CashService } from './cash.service.js';
import { sendSuccess } from '../../controllers/base.controller.js';
import { paiseToRupees } from '../../database/money.js';
import type { DerivedCashBalance } from './cash.types.js';

let cashServiceInstance: CashService | null = null;
function getCashService(): CashService {
  if (!cashServiceInstance) {
    cashServiceInstance = new CashService();
  }
  return cashServiceInstance;
}

/**
 * Formats a DerivedCashBalance into a JSON-safe DTO.
 * Serializes BigInt amounts to strings and adds formatted rupee strings.
 */
function formatBalanceResponse(b: DerivedCashBalance) {
  return {
    accountId: b.accountId,
    adminId: b.adminId,
    accountName: b.accountName,
    status: b.status,
    totalCreditPaise: b.totalCreditPaise.toString(),
    totalDebitPaise: b.totalDebitPaise.toString(),
    balancePaise: b.balancePaise.toString(),
    balanceRupees: paiseToRupees(b.balancePaise),
    transactionCount: b.transactionCount,
    lastTransactedAt: b.lastTransactedAt?.toISOString() ?? null,
  };
}

/**
 * GET /api/v1/cash/accounts/me
 * Retrieves or lazily initializes the authenticated administrator's cash account and balance.
 */
export async function getMyCashAccountController(req: Request, res: Response): Promise<void> {
  const admin = req.auth;
  if (!admin) {
    res.status(401).json({
      data: null,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
    return;
  }

  const cashService = getCashService();
  const account = await cashService.getOrCreateAccountForAdmin(
    admin.id,
    `Cash in Hand - ${admin.fullName}`,
    {
      adminId: admin.id,
      requestId: req.id,
    }
  );

  const balance = await cashService.getDerivedBalance(account.id, {
    adminId: admin.id,
    requestId: req.id,
  });

  sendSuccess(res, {
    account: {
      id: account.id,
      adminId: account.adminId,
      accountName: account.accountName,
      status: account.status,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    },
    balance: formatBalanceResponse(balance),
  });
}

/**
 * GET /api/v1/cash/accounts/:accountId/balance
 * Retrieves the derived balance for a specific cash account.
 */
export async function getAccountBalanceController(req: Request, res: Response): Promise<void> {
  const accountId = req.params.accountId as string;
  const cashService = getCashService();
  const balance = await cashService.getDerivedBalance(accountId, {
    adminId: req.auth?.id,
    requestId: req.id,
  });

  sendSuccess(res, formatBalanceResponse(balance));
}

/**
 * POST /api/v1/cash/transfers
 * Initiates an admin-to-admin cash transfer.
 */
export async function initiateTransferController(req: Request, res: Response): Promise<void> {
  const admin = req.auth;
  if (!admin) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return;
  }

  const { sourceAccountId, destinationAccountId, amountPaise, idempotencyKey, notes } = req.body;
  const cashService = getCashService();
  const transfer = await cashService.transferCash(
    {
      sourceAccountId,
      destinationAccountId,
      amountPaise: BigInt(amountPaise),
      idempotencyKey,
      notes,
      initiatedByAdminId: admin.id,
    },
    { adminId: admin.id, requestId: req.id }
  );

  sendSuccess(res, {
    transfer: {
      id: transfer.id,
      sourceAccountId: transfer.sourceAccountId,
      destinationAccountId: transfer.destinationAccountId,
      amountPaise: transfer.amountPaise.toString(),
      status: transfer.status,
      idempotencyKey: transfer.idempotencyKey,
      notes: transfer.notes,
      initiatedByAdminId: transfer.initiatedByAdminId,
      createdAt: transfer.createdAt.toISOString(),
      updatedAt: transfer.updatedAt.toISOString(),
    },
  });
}

/**
 * POST /api/v1/cash/reconciliations
 * Records a physical cash reconciliation.
 */
export async function recordReconciliationController(req: Request, res: Response): Promise<void> {
  const admin = req.auth;
  if (!admin) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return;
  }

  const { accountId, expectedBalancePaise, actualBalancePaise, notes } = req.body;
  const cashService = getCashService();
  const reconciliation = await cashService.recordReconciliation(
    {
      accountId,
      expectedBalancePaise: BigInt(expectedBalancePaise),
      actualBalancePaise: BigInt(actualBalancePaise),
      notes,
      performedByAdminId: admin.id,
    },
    { adminId: admin.id, requestId: req.id }
  );

  sendSuccess(res, {
    reconciliation: {
      id: reconciliation.id,
      accountId: reconciliation.accountId,
      expectedBalancePaise: reconciliation.expectedBalancePaise.toString(),
      actualBalancePaise: reconciliation.actualBalancePaise.toString(),
      discrepancyPaise: reconciliation.discrepancyPaise.toString(),
      status: reconciliation.status,
      notes: reconciliation.notes,
      performedByAdminId: reconciliation.performedByAdminId,
      createdAt: reconciliation.createdAt.toISOString(),
      updatedAt: reconciliation.updatedAt.toISOString(),
    },
  });
}
