'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button, Badge, Spinner, Input } from '@/components/ui';
import { fetchGuarantorsForLoan, addGuarantor, type Guarantor, type Loan } from '@/lib/api/loans';
import { getSafeErrorMessage } from '@/lib/error-utils';
import { formatRupees } from '@/lib/formatters';
import Link from 'next/link';

export function GuarantorsSection({ loanId, loan }: { loanId: string; loan: Loan }) {
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [memberNumber, setMemberNumber] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadGuarantors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchGuarantorsForLoan(loanId);
      setGuarantors(data);
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
        void loadGuarantors();
      }
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [loadGuarantors]);

  const canAddGuarantor = (loan.status === 'NEW' || loan.status === 'ACTIVE') && guarantors.length < 3;
  const totalResponsibility = guarantors.reduce((sum, g) => sum + g.responsibilityAmountPaise, 0);
  const remainingCapacity = loan.requestedAmountPaise - totalResponsibility;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberNumber.trim() || !amountInput.trim()) return;

    try {
      setSubmitting(true);
      setFormError(null);
      const amountPaise = Math.floor(parseFloat(amountInput) * 100);
      if (isNaN(amountPaise) || amountPaise <= 0) {
        throw new Error('Please enter a valid positive amount.');
      }

      await addGuarantor(loanId, {
        memberNumber: memberNumber.trim(),
        responsibilityAmountPaise: amountPaise,
      });

      setMemberNumber('');
      setAmountInput('');
      setShowForm(false);
      await loadGuarantors();
    } catch (err) {
      setFormError(getSafeErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-4 flex justify-center"><Spinner size="md" /></div>;
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>;
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Guarantors</h2>
        {canAddGuarantor && !showForm && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            Add Guarantor
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-4 text-sm">
        <div>Total Responsibility: <span className="font-semibold">{formatRupees(totalResponsibility)}</span></div>
        <div>Remaining Capacity: <span className="font-semibold text-gray-600">{formatRupees(Math.max(0, remainingCapacity))}</span></div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-sm font-semibold mb-3">Add New Guarantor</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member Number</label>
              <Input
                type="text"
                placeholder="e.g. M-101"
                value={memberNumber}
                onChange={(e) => setMemberNumber(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsibility Amount (₹)</label>
              <Input
                type="number"
                min="1"
                step="0.01"
                placeholder={`Max: ₹${remainingCapacity / 100}`}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
          </div>

          {formError && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">
              {formError}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" variant="primary" isLoading={submitting}>
              Add
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {guarantors.length === 0 ? (
        <div className="text-center p-6 border border-gray-200 border-dashed rounded-lg bg-gray-50 text-gray-500 text-sm">
          No guarantors have been added to this loan.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900">Member</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900">Responsibility</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900">Date Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {guarantors.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-blue-600 hover:underline">
                      <Link href={`/members/${g.guarantorMemberNumber}`}>
                        {g.guarantorMemberNumber}
                      </Link>
                    </div>
                    <div className="text-gray-500">{g.guarantorMemberName}</div>
                    {g.guarantorShopName && <div className="text-gray-400 text-xs">{g.guarantorShopName}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                    {formatRupees(g.responsibilityAmountPaise)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={g.status === 'ACTIVE' ? 'primary' : 'default'}>{g.status}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {new Date(g.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
