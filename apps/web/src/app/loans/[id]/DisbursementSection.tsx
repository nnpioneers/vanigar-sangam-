'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Badge, Spinner, Button, Input } from '@/components/ui';
import { apiRequest } from '@/lib/api/client';
import { getSafeErrorMessage } from '@/lib/error-utils';
import type { Loan } from '@/lib/api/loans';
import { formatRupees } from '@/lib/formatters';

export interface LoanDisbursement {
  id: string;
  loanId: string;
  amountPaise: number;
  disbursementDate: string;
  cashAccountId: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  recordedByAdminId: string;
  createdAt: string;
  updatedAt: string;
}

export function DisbursementSection({ loanId, loan }: { loanId: string; loan: Loan }) {
  const { t } = useTranslation();
  const [disbursement, setDisbursement] = useState<LoanDisbursement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().split('T')[0] as string);

  const loadDisbursement = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ data: { disbursement: LoanDisbursement | null } }>(`/loans/${loanId}/disbursement`);
      setDisbursement(res.data?.disbursement || null);
    } catch (err) {
      setError(getSafeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) {
        void loadDisbursement();
      }
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [loadDisbursement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disbursementDate) return;
    
    try {
      setSubmitting(true);
      setError(null);
      
      await apiRequest(`/loans/${loanId}/disbursement`, {
        method: 'POST',
        body: JSON.stringify({ disbursementDate }),
      });
      
      await loadDisbursement();
      setShowForm(false);
    } catch (err) {
      setError(getSafeErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isEligible = loan.status === 'NEW' || loan.status === 'ACTIVE';

  if (loading && !disbursement) {
    return <div className="p-4 flex justify-center"><Spinner size="sm" /></div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Loan Disbursement</h2>
        {!disbursement && !showForm && isEligible && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            Request Disbursement
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
          {error}
        </div>
      )}

      {showForm && !disbursement && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New Disbursement Request</h3>
          
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-md border border-yellow-200">
            <strong>Note:</strong> Disbursing funds requires an active Cash Account Policy. Currently, the cash account selection policy is unresolved. The request will be recorded as PENDING until cash policy is explicitly established. No funds will be deducted from the ledger.
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input
              label="Disbursement Date"
              type="date"
              required
              value={disbursementDate}
              onChange={(e) => setDisbursementDate(e.target.value)}
              disabled={submitting}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Disbursement Amount</label>
              <div className="text-lg font-semibold text-gray-900 px-3 py-2 bg-gray-100 rounded-md border border-gray-300">
                {formatRupees(loan.requestedAmountPaise)}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="primary" isLoading={submitting}>
              Request Pending Disbursement
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {!disbursement && !showForm ? (
        <div className="text-center p-6 border border-gray-200 border-dashed rounded-lg bg-gray-50 text-gray-500 text-sm">
          No disbursement record exists. {isEligible ? 'Click "Request Disbursement" to start.' : ''}
        </div>
      ) : disbursement ? (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <tbody className="divide-y divide-gray-200 bg-white">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-500 w-1/3">Status</td>
                <td className="px-4 py-3">
                  <Badge variant={disbursement.status === 'COMPLETED' ? 'success' : disbursement.status === 'PENDING' ? 'warning' : 'danger'}>
                    {disbursement.status === 'PENDING' ? 'PENDING (POLICY UNRESOLVED)' : disbursement.status}
                  </Badge>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-500">Amount</td>
                <td className="px-4 py-3 text-gray-900 font-semibold">
                  {formatRupees(disbursement.amountPaise)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-500">Date</td>
                <td className="px-4 py-3 text-gray-900">
                  {new Date(disbursement.disbursementDate).toLocaleDateString()}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-500">Cash Account</td>
                <td className="px-4 py-3 text-gray-900">
                  {disbursement.cashAccountId ? disbursement.cashAccountId : <span className="text-gray-400 italic">Unresolved Policy / Pending</span>}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-500">Created At</td>
                <td className="px-4 py-3 text-gray-900">{new Date(disbursement.createdAt).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
