import type { Request, Response, NextFunction } from 'express';
import { dashboardService, type DashboardService } from './dashboard.service.js';
import { sendSuccess } from '../../controllers/base.controller.js';

export class DashboardController {
  constructor(private readonly service: DashboardService = dashboardService) {}

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await this.service.getSummary({ adminId: req.user?.id });
      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  };

  getRecentTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const transactions = await this.service.getRecentTransactions(limit, { adminId: req.user?.id });
      sendSuccess(res, transactions);
    } catch (error) {
      next(error);
    }
  };
}

export const dashboardController = new DashboardController();
