'use client';

/**
 * Member Loan History Component (Phase 8.5)
 *
 * Displays the loan history for a specific member.
 */

import React, { useState, useEffect } from 'react';
import { fetchMemberLoans, type Loan } from '@/lib/api/loans';
import { Badge, Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Spinner, EmptyState } from '@/components/ui';
import { getSafeErrorMessage } from '@/lib/error-utils';
import { formatRupees } from '@/lib/formatters';
import Link from 'next/link';

interface MemberLoanHistoryProps {
  memberNumber: string;
}

export function MemberLoanHistory({ memberNumber }: MemberLoanHistoryProps) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadLoans = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMemberLoans(memberNumber);
      setLoans(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore && memberNumber) {
        void loadLoans();
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberNumber]);

  return (
    <section style={{ background: 'var(--color-neutral-0)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-neutral-200)' }} aria-labelledby="section-loans-title">
      <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-neutral-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="section-loans-title" style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-neutral-900)', margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          Loan History
        </h2>
        <Button variant="outline" size="sm" onClick={loadLoans} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
            <Spinner size="md" />
          </div>
        ) : error ? (
          <EmptyState
            title="Failed to load loan history"
            description={getSafeErrorMessage(error)}
            action={<Button onClick={loadLoans}>Retry</Button>}
          />
        ) : loans.length === 0 ? (
          <EmptyState
            title="No Loans Found"
            description="This member has no recorded loans."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Application Date</TableHead>
                  <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>{formatRupees(loan.requestedAmountPaise)}</TableCell>
                    <TableCell>
                      <Badge variant={loan.status === 'ACTIVE' ? 'primary' : loan.status === 'CLOSED' ? 'success' : loan.status === 'OVERDUE' ? 'danger' : loan.status === 'PARTIALLY_REPAID' ? 'warning' : 'default'}>
                        {loan.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{loan.applicationDate}</TableCell>
                    <TableCell style={{ textAlign: 'right' }}>
                      <Link href={`/loans/${loan.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </section>
  );
}
