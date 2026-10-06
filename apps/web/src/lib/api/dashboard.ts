import { apiRequest } from './client';

export interface DashboardSummaryResponse {
  coreMetrics: {
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
  };
  collectionMetrics: {
    todayCollectionAmountPaise: number;
    todayCollectionCount: number;
    pendingCollectionsCount: number;
    advanceCollectionsCount: number;
    totalCollectionAmountPaise: number;
    expectedTodayAmountPaise: number;
  };
  loanMetrics: {
    totalLoans: number;
    activeLoans: number;
    partiallyRepaidLoans: number;
    closedLoans: number;
    totalLoansGivenPaise: number;
    totalLoanRepaidPaise: number;
    outstandingLoansPaise: number;
  };
  cashMetrics: {
    totalCashInHandPaise: number;
    adminWiseCash: {
      accountId: string;
      adminId: string;
      accountName: string;
      balancePaise: number;
    }[];
  };
  overdueMetrics: {
    status: 'POLICY_PENDING' | 'AVAILABLE';
    overdueCount?: number;
  };
  businessDate: string;
}

export interface RecentTransaction {
  id: string;
  transactedAt: string;
  transactionType: 'COLLECTION' | 'LOAN_DISBURSEMENT' | 'LOAN_REPAYMENT' | 'CASH_TRANSFER' | 'OTHER';
  referenceId: string;
  memberId?: string;
  memberName?: string;
  amountPaise: number;
  direction?: 'CREDIT' | 'DEBIT';
}

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  const res = await apiRequest<{ data: DashboardSummaryResponse }>('/dashboard/summary');
  return res.data;
}

export async function fetchRecentTransactions(limit = 10): Promise<{ transactions: RecentTransaction[] }> {
  const res = await apiRequest<{ data: { transactions: RecentTransaction[] } }>(
    `/dashboard/recent-transactions?limit=${limit}`
  );
  return res.data;
}
