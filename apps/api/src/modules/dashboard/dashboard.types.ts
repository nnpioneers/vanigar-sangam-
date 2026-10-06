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

export interface DashboardRecentTransactionsResponse {
  transactions: RecentTransaction[];
}
