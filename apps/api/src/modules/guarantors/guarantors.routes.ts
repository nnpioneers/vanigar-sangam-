/**
 * Guarantors Routes (Phase 9.2)
 */

import { Router } from 'express';
import { guarantorsController } from './guarantors.controller.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { validateCreateGuarantorBody } from './guarantors.validation.js';

export const guarantorsRouter = Router({ mergeParams: true });

// Note: These routes will be mounted under /api/v1/loans/:loanId/guarantors in the loans router

guarantorsRouter.get(
  '/',
  (req, res, next) => guarantorsController.getGuarantorsForLoan(req, res, next)
);

guarantorsRouter.post(
  '/',
  validateBody(validateCreateGuarantorBody),
  (req, res, next) => guarantorsController.addGuarantor(req, res, next)
);

// We define this at the root api level or we can mount it here if we pass loanId.
// For /api/v1/loans/:loanId/guarantors/:id
guarantorsRouter.get(
  '/:id',
  (req, res, next) => guarantorsController.getGuarantor(req, res, next)
);
