'use client';

/**
 * Loans List Page (Phase 8.5 & 8.9)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useRouter } from 'next/navigation';
import { AppShell, PageContainer } from '@/components/layout';
import {
  Button,
  Input,
  Select,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  EmptyState,
  Spinner,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { fetchLoans, createLoan, type Loan, type LoanListFilter, type LoanStatus } from '@/lib/api/loans';
import { getSafeErrorMessage } from '@/lib/error-utils';
import { formatRupees } from '@/lib/formatters';
import Link from 'next/link';

function getLoanStatusBadgeVariant(status: LoanStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'NEW':
      return 'default';
    case 'ACTIVE':
      return 'primary';
    case 'PARTIALLY_REPAID':
      return 'warning';
    case 'CLOSED':
      return 'success';
    case 'OVERDUE':
      return 'danger';
    default:
      return 'default';
  }
}

export default function LoansPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [filter, setFilter] = useState<LoanListFilter>({ page: 1, pageSize: 20 });
  const [pendingFilter, setPendingFilter] = useState<LoanListFilter>({ page: 1, pageSize: 20 });
  const [loans, setLoans] = useState<Loan[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async (currentFilter: LoanListFilter) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchLoans(currentFilter);
      setLoans(res?.items || []);
      setTotal(res?.total || 0);
      setTotalPages(res?.totalPages || 0);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore && !authLoading && user) {
        void loadData(filter);
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [filter.page, filter.pageSize, filter.status, filter.memberNumber, authLoading, user, loadData]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const applied = { ...pendingFilter, page: 1 };
    setFilter(applied);
  };

  const handleClear = () => {
    const cleared = { page: 1, pageSize: 20 };
    setPendingFilter(cleared);
    setFilter(cleared);
  };

  const getStatusLabel = (status: LoanStatus): string => {
    switch (status) {
      case 'NEW': return t('loans.statusNew') || 'New';
      case 'ACTIVE': return t('loans.statusActive') || 'Active';
      case 'PARTIALLY_REPAID': return t('loans.statusPartiallyRepaid') || 'Partially Repaid';
      case 'CLOSED': return t('loans.statusClosed') || 'Closed';
      case 'OVERDUE': return t('loans.statusOverdue') || 'Overdue';
      default: return status;
    }
  };

  const currentPage = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages || (loans?.length || 0) < pageSize;

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <PageContainer title={t('loans.title') || 'Loans'}>
          <EmptyState
            title={t('feedback.accessDenied') || 'Access Denied'}
            description={t('feedback.sessionExpired') || 'Your session has expired. Please sign in again.'}
            action={
              <Button variant="primary" onClick={() => router.push('/login')}>
                {t('authentication.login') || 'Sign In'}
              </Button>
            }
          />
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer title={t('loans.title') || 'Loans'}>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.9375rem', marginBottom: 'var(--space-5)', marginTop: 0 }}>
          {t('loans.subtitle') || 'Read-only lifecycle and historical record of member loans.'}
        </p>

        <div style={{
          background: 'var(--color-neutral-0)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          border: '1px solid var(--color-neutral-200)',
          marginBottom: 'var(--space-6)',
        }}>
          <form
            id="loans-filter-form"
            onSubmit={handleFilterSubmit}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', alignItems: 'end' }}
          >
            <Input
              id="loans-filter-member"
              label={t('loans.filterMember') || 'Member Number'}
              placeholder="e.g. VN001"
              value={pendingFilter.memberNumber || ''}
              onChange={(e) => setPendingFilter({ ...pendingFilter, memberNumber: e.target.value })}
            />
            <Select
              id="loans-filter-status"
              label={t('loans.filterStatus') || 'Status'}
              value={pendingFilter.status || ''}
              onChange={(e) => setPendingFilter({ ...pendingFilter, status: e.target.value as LoanStatus | '' })}
              options={[
                { value: '', label: t('loans.allStatuses') || 'All Statuses' },
                { value: 'NEW', label: t('loans.statusNew') || 'New' },
                { value: 'ACTIVE', label: t('loans.statusActive') || 'Active' },
                { value: 'PARTIALLY_REPAID', label: t('loans.statusPartiallyRepaid') || 'Partially Repaid' },
                { value: 'CLOSED', label: t('loans.statusClosed') || 'Closed' },
                { value: 'OVERDUE', label: t('loans.statusOverdue') || 'Overdue' },
              ]}
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button id="loans-filter-submit" type="submit" variant="primary" style={{ flex: 1, minHeight: '44px' }}>
                {t('loans.filterButton') || 'Filter'}
              </Button>
              <Button id="loans-filter-clear" type="button" variant="outline" onClick={handleClear} style={{ minHeight: '44px' }}>
                {t('loans.clearButton') || 'Clear'}
              </Button>
            </div>
          </form>
          
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
             <Link href="/loans/new">
               <Button variant="primary">+ Issue Loan</Button>
             </Link>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <EmptyState
            title={t('messages.error') || 'Error'}
            description={getSafeErrorMessage(error)}
            action={
              <Button id="loans-retry-btn" onClick={() => loadData(filter)}>
                {t('feedback.retry') || 'Retry'}
              </Button>
            }
          />
        ) : loans.length === 0 ? (
          <EmptyState
            title={t('loans.emptyTitle') || 'No Loans Found'}
            description={
              (filter.memberNumber || filter.status)
                ? (t('loans.noResultsDesc') || 'No loan records match the current filters.')
                : (t('loans.emptyDesc') || 'There are no loan records matching the current filters.')
            }
            action={
              (filter.memberNumber || filter.status) ? (
                <Button id="loans-clear-filters-btn" variant="outline" onClick={handleClear}>
                  {t('loans.clearButton') || 'Clear Filters'}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div style={{
            background: 'var(--color-neutral-0)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-neutral-200)',
            overflow: 'hidden',
          }}>
            <div style={{ overflowX: 'auto' }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('loans.colMember') || 'Member'}</TableHead>
                    <TableHead>{t('loans.colRequestedAmount') || 'Requested Amount'}</TableHead>
                    <TableHead>{t('loans.colStatus') || 'Status'}</TableHead>
                    <TableHead>{t('loans.colApplicationDate') || 'Application Date'}</TableHead>
                    <TableHead style={{ textAlign: 'right' }}>{t('loans.colActions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map(loan => {
                    const memberTarget = loan.memberNumber || loan.memberId;
                    return (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <Link
                            href={`/members/${memberTarget}`}
                            style={{ color: 'var(--color-primary-600)', textDecoration: 'none', fontWeight: 500 }}
                          >
                            {loan.memberName
                              ? `${loan.memberName} (${loan.memberNumber || '—'})`
                              : (loan.memberNumber || 'View Member')}
                          </Link>
                        </TableCell>
                        <TableCell>{formatRupees(loan.requestedAmountPaise)}</TableCell>
                        <TableCell>
                          <Badge variant={getLoanStatusBadgeVariant(loan.status)}>
                            {getStatusLabel(loan.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{loan.applicationDate}</TableCell>
                        <TableCell style={{ textAlign: 'right' }}>
                          <Link href={`/loans/${loan.id}`}>
                            <Button
                              id={`loan-view-btn-${loan.id}`}
                              variant="outline"
                              size="sm"
                              style={{ minHeight: '44px' }}
                            >
                              {t('loans.actionView') || 'View'}
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div style={{
              padding: 'var(--space-4)',
              borderTop: '1px solid var(--color-neutral-200)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
                {t('loans.showingCount', { count: String(loans.length), total: String(total) }) ||
                  `Showing ${loans.length} of ${total} loans`}
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500)' }}>
                  {t('loans.pageLabel', { page: String(currentPage), total: String(totalPages || 1) }) ||
                    `Page ${currentPage} of ${totalPages || 1}`}
                </span>
                <Button
                  id="loans-prev-page-btn"
                  variant="outline"
                  size="sm"
                  disabled={isFirstPage}
                  onClick={() => setFilter(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
                  style={{ minHeight: '44px' }}
                >
                  {t('loans.prevPage') || 'Previous'}
                </Button>
                <Button
                  id="loans-next-page-btn"
                  variant="outline"
                  size="sm"
                  disabled={isLastPage}
                  onClick={() => setFilter(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
                  style={{ minHeight: '44px' }}
                >
                  {t('loans.nextPage') || 'Next'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}
