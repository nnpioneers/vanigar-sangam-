'use client';

/**
 * Loan Detail Page (Phase 8.5, 8.6, 8.9, 8.10)
 *
 * Read-only view of a single loan record with complete structural member information.
 *
 * States handled: auth-loading, unauthorized, data-loading, not-found, error, complete.
 * No repayment UI. No guarantor UI. No outstanding amounts. No fake overdue calculations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { AppShell, PageContainer, Breadcrumbs } from '@/components/layout';
import { Button, Badge, Spinner, EmptyState } from '@/components/ui';
import { fetchLoanById, type Loan, type LoanStatus } from '@/lib/api/loans';
import { getSafeErrorMessage } from '@/lib/error-utils';
import { formatRupees } from '@/lib/formatters';
import Link from 'next/link';
import { GuarantorsSection } from './GuarantorsSection';
import { AgreementSection } from './AgreementSection';
import { DisbursementSection } from './DisbursementSection';
import { RepaymentsSection } from './RepaymentsSection';

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

/** Displays a single labeled field in the detail grid */
function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--color-neutral-500)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 'var(--space-1)',
      }}>
        {label}
      </div>
      <div style={{ fontSize: '1rem', color: 'var(--color-neutral-900)' }}>
        {value || '—'}
      </div>
    </div>
  );
}

export default function LoanDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?from=${encodeURIComponent(`/loans/${id}`)}`);
    }
  }, [user, authLoading, router, id]);

  const loadLoan = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      setNotFound(false);
      const data = await fetchLoanById(id);
      setLoan(data);
    } catch (err) {
      const e = err as Error & { status?: number; statusCode?: number };
      if (e.status === 404 || e.statusCode === 404 || e.message?.includes('not found')) {
        setNotFound(true);
      } else {
        setError(e);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore && !authLoading && user && id) {
        void loadLoan();
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [id, authLoading, user, loadLoan]);

  const getStatusLabel = (status: LoanStatus): string => {
    switch (status) {
      case 'NEW':
        return t('loans.statusNew') || 'New';
      case 'ACTIVE':
        return t('loans.statusActive') || 'Active';
      case 'PARTIALLY_REPAID':
        return t('loans.statusPartiallyRepaid') || 'Partially Repaid';
      case 'CLOSED':
        return t('loans.statusClosed') || 'Closed';
      case 'OVERDUE':
        return t('loans.statusOverdue') || 'Overdue';
      default:
        return status;
    }
  };

  // Auth loading
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  // Unauthorized
  if (!user) {
    return null; // redirect handled in useEffect
  }

  const memberTarget = loan?.memberNumber || loan?.memberId;

  return (
    <AppShell>
      <PageContainer>
        <div style={{ maxWidth: '850px', margin: '0 auto', width: '100%' }}>

          {/* Breadcrumbs */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Breadcrumbs
              items={[
                { label: t('loans.title') || 'Loans', href: '/loans' },
                { label: t('loans.detailTitle') || 'Loan Details' },
              ]}
            />
          </div>

          {/* Data Loading Spinner */}
          {loading ? (
            <div style={{ padding: 'var(--space-12)', display: 'flex', justifyContent: 'center' }}>
              <Spinner size="lg" />
            </div>

          ) : notFound ? (
            <EmptyState
              title={t('loans.notFoundTitle') || 'Loan Not Found'}
              description={t('loans.notFoundDesc') || 'No loan record exists with this ID.'}
              action={
                <Button id="loan-back-btn" variant="outline" onClick={() => router.push('/loans')}>
                  {t('loans.backToLoans') || 'Back to Loans'}
                </Button>
              }
            />

          ) : error ? (
            <EmptyState
              title={t('messages.error') || 'Error'}
              description={getSafeErrorMessage(error)}
              action={
                <Button id="loan-detail-retry-btn" onClick={loadLoan}>
                  {t('feedback.retry') || 'Retry'}
                </Button>
              }
            />

          ) : loan ? (
            <div style={{
              background: 'var(--color-neutral-0)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              border: '1px solid var(--color-neutral-200)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-6)',
            }}>

              {/* Header: title + status badge */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
                paddingBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--color-neutral-200)',
              }}>
                <div>
                  <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: 'var(--color-neutral-900)',
                    margin: '0 0 var(--space-2) 0',
                  }}>
                    {t('loans.detailTitle') || 'Loan Details'}
                  </h1>
                  <p style={{ margin: 0, color: 'var(--color-neutral-500)', fontSize: '0.875rem' }}>
                    {t('loans.loanId') || 'Loan ID'}:{' '}
                    <span style={{ fontFamily: 'monospace' }}>{loan.id}</span>
                  </p>
                </div>
                <Badge id={`loan-status-badge-${loan.id}`} variant={getLoanStatusBadgeVariant(loan.status)}>
                  {getStatusLabel(loan.status)}
                </Badge>
              </div>

              {/* Member Information Block */}
              <div style={{
                background: 'var(--color-neutral-50)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-5)',
                border: '1px solid var(--color-neutral-200)',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-4)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--color-neutral-900)' }}>
                    {t('loans.memberDetails') || 'Member Information'}
                  </h2>
                  {memberTarget && (
                    <Link
                      id="loan-view-member-link"
                      href={`/members/${memberTarget}`}
                      style={{
                        color: 'var(--color-primary-600)',
                        textDecoration: 'none',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {t('loans.viewMemberProfile') || 'View Member Profile'} &rarr;
                    </Link>
                  )}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 'var(--space-4)',
                }}>
                  <DetailField
                    label={t('loans.colMemberName') || 'Member Name'}
                    value={loan.memberName}
                  />
                  <DetailField
                    label={t('loans.colMemberNumber') || 'Member Number'}
                    value={loan.memberNumber}
                  />
                  <DetailField
                    label={t('loans.shopName') || 'Shop Name'}
                    value={loan.shopName}
                  />
                  <DetailField
                    label={t('loans.sheetsCount') || 'Number of Sheets'}
                    value={loan.numberOfSheets != null ? String(loan.numberOfSheets) : null}
                  />
                </div>
              </div>

              {/* Loan Financial & Structural Details */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-4)',
                padding: 'var(--space-5)',
                background: 'var(--color-neutral-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-neutral-200)',
              }}>
                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-neutral-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 'var(--space-1)',
                  }}>
                    {t('loans.colRequestedAmount') || 'Requested Amount'}
                  </div>
                  <div style={{ fontSize: '1.25rem', color: 'var(--color-neutral-900)', fontWeight: 600 }}>
                    {formatRupees(loan.requestedAmountPaise)}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-neutral-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 'var(--space-1)',
                  }}>
                    {t('loans.colApprovedAmount') || 'Approved Amount'}
                  </div>
                  <div style={{ fontSize: '1.25rem', color: 'var(--color-neutral-900)', fontWeight: 600 }}>
                    {loan.approvedAmountPaise != null
                      ? formatRupees(loan.approvedAmountPaise)
                      : (t('loans.pendingApproval') || 'Pending')}
                  </div>
                </div>

                <DetailField
                  label={t('loans.applicationDate') || 'Application Date'}
                  value={loan.applicationDate}
                />
                <DetailField
                  label={t('loans.disbursementDate') || 'Disbursement Date'}
                  value={loan.disbursementDate || (t('loans.pendingDisbursement') || 'Pending')}
                />
                <DetailField
                  label={t('loans.maxDueDate') || 'Max Due Date'}
                  value={loan.maxDueDate}
                />
                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-neutral-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 'var(--space-1)',
                  }}>
                    {t('loans.recordedByAdmin') || 'Recorded By Admin'}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-700)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {loan.recordedByAdminId}
                  </div>
                </div>
              </div>

              {/* Audit Timestamps */}
              <div style={{
                fontSize: '0.8125rem',
                color: 'var(--color-neutral-500)',
                paddingTop: 'var(--space-2)',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
              }}>
                <span>
                  {t('loans.createdTimestamp') || 'Created'}: {new Date(loan.createdAt).toLocaleString()}
                </span>
                <span>
                  {t('loans.updatedTimestamp') || 'Updated'}: {new Date(loan.updatedAt).toLocaleString()}
                </span>
              </div>

              {/* Back Navigation */}
              <div style={{ paddingTop: 'var(--space-2)' }}>
                <Button
                  id="loan-detail-back-btn"
                  variant="outline"
                  onClick={() => router.push('/loans')}
                >
                  &larr; {t('loans.backToLoans') || 'Back to Loans'}
                </Button>
              </div>

            </div>
          ) : null}

          {loan && !loading && !notFound ? (
            <>
              <AgreementSection loanId={loan.id} loan={loan} />
              <GuarantorsSection loanId={loan.id} loan={loan} />
              <DisbursementSection loanId={loan.id} loan={loan} />
              <RepaymentsSection loanId={loan.id} loan={loan} />
            </>
          ) : null}
        </div>
      </PageContainer>
    </AppShell>
  );
}
