/**
 * Cash Routes (Phase 4.1)
 *
 * Mounts structural endpoints for admin cash account balances:
 * - GET /api/v1/cash/accounts/me
 * - GET /api/v1/cash/accounts/:accountId/balance
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateParams } from '../../middleware/validation.middleware.js';
import { validateUuidParam } from '@vanigar/validation';
import {
  getMyCashAccountController,
  getAccountBalanceController,
  initiateTransferController,
  recordReconciliationController,
} from './cash.controller.js';
import type { AppModule } from '../module.types.js';

export const cashRouter = Router();

// Structural read endpoints (guarded by session authentication)
cashRouter.get('/accounts/me', requireAuth, getMyCashAccountController);
cashRouter.get(
  '/accounts/:accountId/balance',
  requireAuth,
  validateParams((params: unknown) => {
    const p = params as { accountId?: unknown };
    return validateUuidParam(p.accountId, 'accountId');
  }),
  getAccountBalanceController
);

// Structural write endpoints
cashRouter.post('/transfers', requireAuth, initiateTransferController);
cashRouter.post('/reconciliations', requireAuth, recordReconciliationController);

export const cashModule: AppModule = {
  name: 'cash',
  basePath: '/api/v1/cash',
  router: cashRouter,
};
