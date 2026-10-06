/**
 * Loans Routes (Phase 8.2, 8.4, 8.6, 8.7)
 *
 * Mounts HTTP endpoints for the Loans module.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateQuery, validateBody, validateParams } from '../../middleware/validation.middleware.js';
import { validateUuidParam } from '@vanigar/validation';
import { validateCreateLoanBody, validateLoanListQuery, validateUpdateLoanStatusBody } from './loans.validation.js';
import {
  createLoanController,
  getLoanByIdController,
  listLoansController,
  getMemberLoansController,
  getActiveMemberLoanController,
  updateLoanStatusController,
} from './loans.controller.js';
import { guarantorsRouter } from '../guarantors/guarantors.routes.js';
import { guarantorsController } from '../guarantors/guarantors.controller.js';
import { agreementsRouter } from '../agreements/agreements.routes.js';
import { disbursementsRouter } from '../disbursements/disbursements.routes.js';
import type { AppModule } from '../module.types.js';

export const loansRouter = Router();

// Protect all routes
loansRouter.use(requireAuth);

loansRouter.post('/', validateBody(validateCreateLoanBody), createLoanController);

loansRouter.get('/', validateQuery(validateLoanListQuery), listLoansController);

loansRouter.get(
  '/member/:memberNumber/active',
  getActiveMemberLoanController
);

loansRouter.get(
  '/member/:memberNumber',
  getMemberLoansController
);

loansRouter.get(
  '/member/:memberNumber/guarantees',
  (req, res, next) => guarantorsController.getMemberGuarantees(req, res, next)
);

loansRouter.patch(
  '/:id/status',
  validateParams((params: unknown) => {
    const p = params as { id?: unknown };
    return validateUuidParam(p?.id, 'id');
  }),
  validateBody(validateUpdateLoanStatusBody),
  updateLoanStatusController
);

loansRouter.get(
  '/:id',
  validateParams((params: unknown) => {
    const p = params as { id?: unknown };
    return validateUuidParam(p?.id, 'id');
  }),
  getLoanByIdController
);

// Phase 9: Mount guarantors module
loansRouter.use('/:loanId/guarantors', guarantorsRouter);

// Phase 10: Mount agreements module
loansRouter.use('/:loanId/agreement', agreementsRouter);

// Phase 10.8: Mount disbursements module
loansRouter.use('/:loanId/disbursement', disbursementsRouter);

export const loansModule: AppModule = {
  name: 'loans',
  basePath: '/api/v1/loans',
  router: loansRouter,
};
