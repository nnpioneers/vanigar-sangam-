import { useState, useCallback, useEffect } from 'react';
import { fetchDashboardSummary, fetchRecentTransactions, type DashboardSummaryResponse, type RecentTransaction } from '@/lib/api';

export function useDashboard() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const summaryData = await fetchDashboardSummary();
      const transactionsData = await fetchRecentTransactions();
      
      setSummary(summaryData);
      setTransactions(transactionsData.transactions || []);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
  }, [loadDashboard]);

  return {
    summary,
    transactions,
    loading,
    error,
    reload: loadDashboard,
  };
}
