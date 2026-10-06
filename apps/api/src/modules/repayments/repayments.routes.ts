import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import {
  createRepaymentController,
  getLoanRepaymentsController,
  getRepaymentController,
  getLoanOutstandingController,
} from './repayments.controller.js';

const router = Router();

// Only SUPER_ADMIN and ADMIN can record repayments
router.post(
  '/loans/:loanId/repayments',
  requireAuth,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  createRepaymentController
);

// Any authenticated role can view repayments
router.get(
  '/loans/:loanId/repayments',
  requireAuth,
  getLoanRepaymentsController
);

router.get(
  '/repayments/:id',
  requireAuth,
  getRepaymentController
);

router.get(
  '/loans/:loanId/outstanding',
  requireAuth,
  getLoanOutstandingController
);

export { router as repaymentsRouter };
