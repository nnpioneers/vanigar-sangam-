/**
 * Disbursements Routes (Phase 10.8)
 */

import { Router } from 'express';
import { disbursementsController } from './disbursements.controller.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { validateCreateDisbursementBody } from './disbursements.validation.js';

export const disbursementsRouter = Router({ mergeParams: true });

// Note: These routes will be mounted under /api/v1/loans/:loanId/disbursement in the loans router

disbursementsRouter.get(
  '/',
  (req, res, next) => disbursementsController.getDisbursementForLoan(req, res, next)
);

disbursementsRouter.post(
  '/',
  validateBody(validateCreateDisbursementBody),
  (req, res, next) => disbursementsController.createDisbursement(req, res, next)
);
