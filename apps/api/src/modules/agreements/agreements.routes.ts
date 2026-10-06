/**
 * Agreements Routes (Phase 10.2)
 */

import { Router } from 'express';
import { agreementsController } from './agreements.controller.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { validateCreateAgreementBody } from './agreements.validation.js';

export const agreementsRouter = Router({ mergeParams: true });

// Note: These routes will be mounted under /api/v1/loans/:loanId/agreement in the loans router

agreementsRouter.get(
  '/',
  (req, res, next) => agreementsController.getAgreementForLoan(req, res, next)
);

agreementsRouter.post(
  '/',
  validateBody(validateCreateAgreementBody),
  (req, res, next) => agreementsController.createAgreement(req, res, next)
);
