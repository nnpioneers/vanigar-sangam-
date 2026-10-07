/**
 * Daily Sheet Routes (Phase 6.4)
 *
 * Mounts HTTP endpoints for Daily Sheet operations under /api/v1/daily-sheets.
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validation.middleware.js';
import { validateUuidParam } from '@vanigar/validation';
import { validateMemberNumberParam } from '../members/members.validation.js';
import {
  validateCreateDailySheetPayload,
  validateDailySheetListQuery,
  validateCorrectDailySheetPayload,
} from './daily-sheets.validation.js';
import {
  createDailySheetController,
  getDailySheetByIdController,
  listDailySheetsController,
  getMemberDailySheetHistoryController,
  correctDailySheetController,
  getDailySheetsGridDataController,
  recordPaymentController,
} from './daily-sheets.controller.js';
import type { AppModule } from '../module.types.js';

export const dailySheetsRouter = Router();

dailySheetsRouter.use(requireAuth);

dailySheetsRouter.post(
  '/',
  validateBody(validateCreateDailySheetPayload),
  createDailySheetController
);

dailySheetsRouter.get(
  '/',
  validateQuery(validateDailySheetListQuery),
  listDailySheetsController
);

dailySheetsRouter.get(
  '/member/:memberNumber',
  validateParams(validateMemberNumberParam),
  getMemberDailySheetHistoryController
);

dailySheetsRouter.get(
  '/grid',
  getDailySheetsGridDataController
);

dailySheetsRouter.post(
  '/record-payment',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  recordPaymentController
);

dailySheetsRouter.post(
  '/:id/correct',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  validateParams((params: unknown) => {
    const p = params as { id?: unknown };
    return validateUuidParam(p?.id, 'id');
  }),
  validateBody(validateCorrectDailySheetPayload),
  correctDailySheetController
);

dailySheetsRouter.get(
  '/:id',
  validateParams((params: unknown) => {
    const p = params as { id?: unknown };
    return validateUuidParam(p?.id, 'id');
  }),
  getDailySheetByIdController
);

export const dailySheetsModule: AppModule = {
  name: 'daily-sheets',
  basePath: '/api/v1/daily-sheets',
  router: dailySheetsRouter,
};
