import { Router } from 'express';
import { dashboardController } from './dashboard.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

// All dashboard routes require authentication
router.use(requireAuth);

router.get('/summary', dashboardController.getSummary);
router.get('/recent-transactions', dashboardController.getRecentTransactions);

export { router as dashboardRouter };
