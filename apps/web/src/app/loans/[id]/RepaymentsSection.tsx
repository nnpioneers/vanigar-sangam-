'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Spinner, Button, Input } from '@/components/ui';
import { apiRequest } from '@/lib/api/client';
import { getSafeErrorMessage } from '@/lib/error-utils';
import type { Loan } from '@/lib/api/loans';
import { formatRupees } from '@/lib/formatters';
import type { LoanRepayment, LoanOutstanding } from '@/lib/api/repayments';

export function RepaymentsSection({ loanId, loan }: { loanId: string; loan: Loan }) {
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [outstanding, setOutstanding] = useState<LoanOutstanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [amountPaiseInput, setAmountPaiseInput] = useState('');
  const [repaymentDate, setRepaymentDate] = useState(new Date().toISOString().split('T')[0] as string);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [repaymentsRes, outstandingRes] = await Promise.all([
        apiRequest<{ data: { items: LoanRepayment[] } }>(`/loans/${loanId}/repayments`),
        apiRequest<{ data: LoanOutstanding }>(`/loans/${loanId}/outstanding`)
      ]);
      
      setRepayments(repaymentsRes.data?.items || []);
      setOutstanding(outstandingRes.data || null);
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
        void loadData();
      }
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountPaiseInput || !repaymentDate || !paymentMode) return;
    
    const amountPaise = parseInt(amountPaiseInput, 10);
    if (isNaN(amountPaise) || amountPaise <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      await apiRequest(`/loans/${loanId}/repayments`, {
        method: 'POST',
        body: JSON.stringify({ 
          amountPaise, 
          repaymentDate, 
          paymentMode,
          referenceNumber: referenceNumber || undefined,
          notes: notes || undefined
        }),
      });
      
      await loadData();
      setShowForm(false);
      
      // Reset form
      setAmountPaiseInput('');
      setReferenceNumber('');
      setNotes('');
      setPaymentMode('CASH');
    } catch (err) {
      setError(getSafeErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isEligibleForRepayment = loan.status === 'NEW' || loan.status === 'ACTIVE' || loan.status === 'PARTIALLY_REPAID' || loan.status === 'OVERDUE';

  if (loading && repayments.length === 0 && !outstanding) {
    return <div className="p-4 flex justify-center"><Spinner size="sm" /></div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Repayments</h2>
        {!showForm && isEligibleForRepayment && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            Record Repayment
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
          {error}
        </div>
      )}

      {outstanding && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Principal (Authoritative)</div>
            <div className="text-lg font-medium text-gray-900">{formatRupees(outstanding.principalAmountPaise)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Repaid</div>
            <div className="text-lg font-medium text-gray-900">{formatRupees(outstanding.totalRepaidPaise)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Remaining Principal</div>
            <div className="text-lg font-medium text-gray-900">{formatRupees(outstanding.remainingPrincipalPaise)}</div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Record New Repayment</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input
              label="Amount (in Paise)"
              type="number"
              value={amountPaiseInput}
              onChange={(e) => setAmountPaiseInput(e.target.value)}
              required
              min="1"
              placeholder="e.g. 100000 for ₹1,000"
            />
            
            <Input
              label="Repayment Date"
              type="date"
              value={repaymentDate}
              onChange={(e) => setRepaymentDate(e.target.value)}
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                required
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            
            <Input
              label="Reference Number (Optional)"
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Cheque No, UTR, etc."
            />
          </div>
          
          <div className="mb-4">
            <Input
              label="Notes (Optional)"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting || !amountPaiseInput || !repaymentDate}>
              {submitting ? <Spinner size="sm" /> : 'Record'}
            </Button>
          </div>
        </form>
      )}

      {repayments.length > 0 ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recorded On</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {repayments.map((rp) => (
                  <tr key={rp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{rp.repaymentDate}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{formatRupees(rp.amountPaise)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{rp.paymentMode}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{rp.referenceNumber || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(rp.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Mobile Cards */}
          <div className="grid md:hidden gap-4">
            {repayments.map((rp) => (
              <div key={rp.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-gray-900">{rp.repaymentDate}</div>
                  <div className="text-lg font-bold text-gray-900">{formatRupees(rp.amountPaise)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>
                    <span className="text-xs text-gray-400 block uppercase">Mode</span>
                    {rp.paymentMode}
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block uppercase">Ref</span>
                    {rp.referenceNumber || '-'}
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400 block uppercase">Recorded</span>
                    {new Date(rp.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        !showForm && (
          <div className="text-center py-6 text-gray-500 border border-dashed border-gray-200 rounded-md bg-gray-50">
            No repayments recorded yet.
          </div>
        )
      )}
    </div>
  );
}
