'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Button, PageHeader } from '@/components/ui';
import { fetchReport, downloadReportCsv } from '@/lib/api/reports';

type ReportType = 'daily-collections' | 'collections' | 'loans' | 'repayments' | 'members' | 'guarantors' | 'cash';

const REPORTS = [
  { id: 'daily-collections', label: 'Daily Collections' },
  { id: 'collections', label: 'Collections Ledger' },
  { id: 'loans', label: 'Loans' },
  { id: 'repayments', label: 'Repayments' },
  { id: 'members', label: 'Members' },
  { id: 'guarantors', label: 'Guarantors' },
  { id: 'cash', label: 'Admin Cash' },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('daily-collections');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchReport(activeReport, { page, pageSize: 20, ...filters });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch'));
    } finally {
      setIsLoading(false);
    }
  }, [activeReport, page, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async () => {
    try {
      await downloadReportCsv(activeReport, filters);
    } catch (err) {
      console.error(err);
      alert('Failed to download CSV');
    }
  };

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <PageHeader
          title="Reports"
          description="View and export administrative reports."
        />
        <Button variant="secondary" onClick={handleExport}>
          Download CSV
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-[var(--border)]">
        {REPORTS.map(r => (
          <button
            key={r.id}
            onClick={() => { setActiveReport(r.id as ReportType); setPage(1); setFilters({}); }}
            className={`px-4 py-2 whitespace-nowrap rounded-t-md text-sm font-medium transition-colors ${
              activeReport === r.id 
                ? 'bg-[var(--card)] text-[var(--foreground)] border-t border-l border-r border-[var(--border)] -mb-[1px]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <Card className="p-4 flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Date From</label>
          <input
            type="date"
            className="w-full h-9 rounded-md border border-[var(--border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
            value={filters.dateFrom || ''}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Date To</label>
          <input
            type="date"
            className="w-full h-9 rounded-md border border-[var(--border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
            value={filters.dateTo || ''}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Member Number</label>
          <input
            type="text"
            className="w-full h-9 rounded-md border border-[var(--border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
            placeholder="Search..."
            value={filters.memberNumber || ''}
            onChange={(e) => updateFilter('memberNumber', e.target.value)}
          />
        </div>
      </Card>

      {error ? (
        <div className="p-4 bg-red-500/10 text-red-500 rounded-md">Failed to load report data.</div>
      ) : isLoading ? (
        <div className="p-8 text-center text-[var(--muted-foreground)] animate-pulse">Loading report...</div>
      ) : (
        <div className="space-y-4">
          {data?.summary && (
            <Card className="p-4 bg-[var(--muted)]/50">
              <h3 className="text-sm font-semibold mb-2">Summary</h3>
              <div className="flex gap-6 flex-wrap">
                {Object.entries(data.summary).map(([key, val]) => (
                  <div key={key}>
                    <div className="text-xs text-[var(--muted-foreground)]">{key}</div>
                    <div className="text-lg font-medium">
                      {key.toLowerCase().includes('amount') || key.toLowerCase().includes('due') || key.toLowerCase().includes('paid') || key.toLowerCase().includes('balance')
                        ? `₹${((val as number) / 100).toFixed(2)}` 
                        : String(val)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-[var(--muted)] text-[var(--muted-foreground)]">
                <tr>
                  {data?.items && data.items.length > 0 ? (
                    Object.keys(data.items[0]).map(key => (
                      <th key={key} className="px-4 py-3 font-medium border-b border-[var(--border)]">
                        {key}
                      </th>
                    ))
                  ) : (
                    <th className="px-4 py-3 font-medium border-b border-[var(--border)]">Results</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data?.items && data.items.length > 0 ? (
                  data.items.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-[var(--muted)]/50">
                      {Object.entries(row).map(([key, val]) => (
                        <td key={key} className="px-4 py-3 whitespace-nowrap">
                          {val === null || val === undefined 
                            ? '-' 
                            : typeof val === 'boolean' 
                              ? (val ? 'Yes' : 'No') 
                              : key.toLowerCase().includes('amount') || key.toLowerCase().includes('due') || key.toLowerCase().includes('paid') || key.toLowerCase().includes('balance') || key.toLowerCase().includes('responsibility')
                                ? `₹${(Number(val) / 100).toFixed(2)}`
                                : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                      No records found matching filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          {data && data.totalPages > 1 && (
            <div className="flex justify-between items-center">
              <div className="text-sm text-[var(--muted-foreground)]">
                Showing page {data.page} of {data.totalPages}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === data.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
