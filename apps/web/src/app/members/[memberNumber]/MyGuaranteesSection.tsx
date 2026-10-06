'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Badge, Spinner, Button } from '@/components/ui';
import { fetchMemberGuarantees, type GuaranteedLoan } from '@/lib/api/loans';
import { getSafeErrorMessage } from '@/lib/error-utils';
import { formatRupees } from '@/lib/formatters';
import Link from 'next/link';

export function MyGuaranteesSection({ memberNumber }: { memberNumber: string }) {
  const { t } = useTranslation();
  const [guarantees, setGuarantees] = useState<GuaranteedLoan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadGuarantees = useCallback(async (p: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMemberGuarantees(memberNumber, p, pageSize);
      setGuarantees(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(getSafeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [memberNumber]);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) {
        void loadGuarantees(page);
      }
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [loadGuarantees, page]);

  if (loading && guarantees.length === 0) {
    return <div className="p-4 flex justify-center"><Spinner size="md" /></div>;
  }

  if (error && guarantees.length === 0) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>;
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">My Guarantees</h2>

      {guarantees.length === 0 ? (
        <div className="text-center p-6 border border-gray-200 border-dashed rounded-lg bg-gray-50 text-gray-500 text-sm">
          This member is not acting as a guarantor for any loans.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900">Borrower</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900">Loan Details</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900">Loan Status & Dates</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900">Financials</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900">Guarantee</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {guarantees.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-blue-600 hover:underline">
                        <Link href={`/members/${g.borrowerMemberNumber}`}>
                          {g.borrowerMemberNumber}
                        </Link>
                      </div>
                      <div className="text-gray-500">{g.borrowerMemberName}</div>
                      {g.borrowerShopName && <div className="text-gray-400 text-xs">{g.borrowerShopName}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-gray-900">Loan #{g.loanId.split('-')[0]}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="mb-1">
                        <Badge variant={g.loanStatus === 'ACTIVE' ? 'primary' : g.loanStatus === 'CLOSED' ? 'success' : 'default'}>
                          {g.loanStatus}
                        </Badge>
                      </div>
                      {g.loanApplicationDate && <div className="text-xs text-gray-500">Applied: {new Date(g.loanApplicationDate).toLocaleDateString()}</div>}
                      {g.loanDisbursementDate && <div className="text-xs text-gray-500">Disbursed: {new Date(g.loanDisbursementDate).toLocaleDateString()}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm">Amount: <span className="font-medium">{formatRupees(g.loanAmountPaise)}</span></div>
                      {typeof g.loanOutstandingPaise === 'number' && (
                        <div className="text-sm mt-1">Loan Outstanding: <span className="font-medium text-red-600">{formatRupees(g.loanOutstandingPaise)}</span></div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium mb-1">
                        Responsibility: {formatRupees(g.responsibilityAmountPaise)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={g.guaranteeStatus === 'ACTIVE' ? 'primary' : 'default'}>{g.guaranteeStatus}</Badge>
                        <span className="text-xs text-gray-500">since {new Date(g.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Link href={`/loans/${g.loanId}`} className="text-blue-600 hover:underline text-sm font-medium">
                        View Loan
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 text-sm">
              <span className="text-gray-600">
                Showing {Math.min((page - 1) * pageSize + 1, total)} to {Math.min(page * pageSize, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1 || loading}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages || loading}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
