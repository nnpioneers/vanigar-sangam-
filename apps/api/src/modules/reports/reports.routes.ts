import { Router } from 'express';
import { ReportsController } from './reports.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import type { AppModule } from '../module.types.js';

const router = Router();
const controller = new ReportsController();

// Phase 13 Reports - All Read-Only, requiring authentication
router.use(requireAuth);

router.get('/daily-collections', controller.getDailyCollections);
router.get('/collections', controller.getCollections);
router.get('/loans', controller.getLoans);
router.get('/repayments', controller.getRepayments);
router.get('/members', controller.getMembers);
router.get('/guarantors', controller.getGuarantors);
router.get('/cash', controller.getCashLedger);

export const reportsModule: AppModule = {
  name: 'reports',
  basePath: '/api/v1/reports',
  router: router,
};
