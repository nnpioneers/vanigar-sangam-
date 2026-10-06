import { dashboardRepository, type DashboardRepository } from './dashboard.repository.js';
import type { DashboardSummaryResponse, DashboardRecentTransactionsResponse } from './dashboard.types.js';
import type { ServiceContext } from '../module.types.js';

export class DashboardService {
  constructor(private readonly repo: DashboardRepository = dashboardRepository) {}

  async getSummary(context: ServiceContext = {}): Promise<DashboardSummaryResponse> {
    return this.repo.getDashboardSummary(context.tx);
  }

  async getRecentTransactions(limit = 10, context: ServiceContext = {}): Promise<DashboardRecentTransactionsResponse> {
    const transactions = await this.repo.getRecentTransactions(limit, context.tx);
    return { transactions };
  }
}

export const dashboardService = new DashboardService();
