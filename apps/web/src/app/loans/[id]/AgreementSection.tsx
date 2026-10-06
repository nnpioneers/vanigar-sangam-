'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Badge, Spinner, Button, Input } from '@/components/ui';
import { apiRequest } from '@/lib/api/client';
import { getSafeErrorMessage } from '@/lib/error-utils';
import type { Loan } from '@/lib/api/loans';

export interface LoanAgreement {
  id: string;
  loanId: string;
  agreementNumber: string | null;
  agreementDate: string;
  status: 'DRAFT' | 'SIGNED' | 'CANCELLED';
  recordedByAdminId: string;
  createdAt: string;
  updatedAt: string;
}

export function AgreementSection({ loanId, loan }: { loanId: string; loan: Loan }) {

  const [agreement, setAgreement] = useState<LoanAgreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [agreementDate, setAgreementDate] = useState(new Date().toISOString().split('T')[0] as string);

  const loadAgreement = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ data: { agreement: LoanAgreement | null } }>(`/loans/${loanId}/agreement`);
      setAgreement(res.data?.agreement || null);
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
        void loadAgreement();
      }
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [loadAgreement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreementDate) return;
    
    try {
      setSubmitting(true);
      setError(null);
      
      await apiRequest(`/loans/${loanId}/agreement`, {
        method: 'POST',
        body: JSON.stringify({ agreementDate }),
      });
      
      await loadAgreement();
      setShowForm(false);
    } catch (err) {
      setError(getSafeErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isEligibleForAgreement = loan.status === 'NEW' || loan.status === 'ACTIVE';

  if (loading && !agreement) {
    return <div className="p-4 flex justify-center"><Spinner size="sm" /></div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Loan Agreement</h2>
        {!agreement && !showForm && isEligibleForAgreement && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            Create Agreement
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
          {error}
        </div>
      )}

      {showForm && !agreement && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New Agreement</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input
              label="Agreement Date"
              type="date"
              required
              value={agreementDate}
              onChange={(e) => setAgreementDate(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {!agreement && !showForm ? (
        <div className="text-center p-6 border border-gray-200 border-dashed rounded-lg bg-gray-50 text-gray-500 text-sm">
          No agreement exists for this loan. {isEligibleForAgreement ? 'Click "Create Agreement" to start.' : ''}
        </div>
      ) : agreement ? (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <tbody className="divide-y divide-gray-200 bg-white">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-500 w-1/3">Status</td>
                <td className="px-4 py-3">
                  <Badge variant={agreement.status === 'DRAFT' ? 'default' : agreement.status === 'SIGNED' ? 'success' : 'danger'}>
                    {agreement.status}
                  </Badge>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-500">Agreement Date</td>
                <td className="px-4 py-3 text-gray-900">
                  {new Date(agreement.agreementDate).toLocaleDateString()}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-500">Agreement Reference</td>
                <td className="px-4 py-3 text-gray-900">{agreement.agreementNumber || '—'}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-500">Created At</td>
                <td className="px-4 py-3 text-gray-900">{new Date(agreement.createdAt).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
