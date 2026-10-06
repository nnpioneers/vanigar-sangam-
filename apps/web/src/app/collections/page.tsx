'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import Link from 'next/link';
import { AppShell, PageContainer, Breadcrumbs } from '@/components/layout';
import {
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
} from '@/components/ui';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import {
  fetchCollections,
  type Collection,
  type CollectionSummary,
  type PaymentMode,
} from '@/lib/api';
import { getSafeErrorMessage } from '@/lib/error-utils';
import styles from './collections.module.css';

const DEFAULT_PAGE_SIZE = 20;

export default function CollectionsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { t } = useTranslation();

  // Filters
  const [businessDate, setBusinessDate] = useState<string>('');
  const [memberNumber, setMemberNumber] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Applied Filters State (for search button / pagination)
  const [appliedFilters, setAppliedFilters] = useState<{
    businessDate: string;
    memberNumber: string;
    paymentMode: string;
    status: string;
  }>({
    businessDate: '',
    memberNumber: '',
    paymentMode: '',
    status: '',
  });

  // Data & Lifecycle
  const [items, setItems] = useState<Collection[]>([]);
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  // Authentication Guard
  useEffect(() => {
    if (!authLoading && !user) {
      void logout();
    }
  }, [user, authLoading, logout]);

  // Load Collections
  const loadCollections = useCallback(
    async (currentPage: number, filters: typeof appliedFilters) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchCollections({
          businessDate: filters.businessDate || undefined,
          memberNumber: filters.memberNumber || undefined,
          paymentMode: (filters.paymentMode as PaymentMode) || undefined,
          status: (filters.status as 'COLLECTED' | 'CORRECTED' | 'ALL') || undefined,
          page: currentPage,
          pageSize: DEFAULT_PAGE_SIZE,
        });

        setItems(res.items);
        setSummary(res.summary);
        setTotalPages(res.totalPages);
        setTotalCount(res.totalCount);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Trigger data fetch asynchronously avoiding cascading renders
  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore && user) {
        void loadCollections(page, appliedFilters);
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [user, page, appliedFilters, loadCollections]);

  // Handle Search Submission
  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(1);
    setAppliedFilters({
      businessDate: businessDate.trim(),
      memberNumber: memberNumber.trim(),
      paymentMode: paymentMode.trim(),
      status: status.trim(),
    });
  };

  const handleResetFilters = () => {
    setBusinessDate('');
    setMemberNumber('');
    setPaymentMode('');
    setStatus('');
    setPage(1);
    setAppliedFilters({
      businessDate: '',
      memberNumber: '',
      paymentMode: '',
      status: '',
    });
  };

  const handleExportCsv = () => {
    const query = new URLSearchParams();
    if (appliedFilters.businessDate) query.set('businessDate', appliedFilters.businessDate);
    if (appliedFilters.memberNumber) query.set('memberNumber', appliedFilters.memberNumber);
    if (appliedFilters.paymentMode) query.set('paymentMode', appliedFilters.paymentMode);
    if (appliedFilters.status) query.set('status', appliedFilters.status);

    const qs = query.toString();
    const exportUrl = `/api/v1/collections/export${qs ? `?${qs}` : ''}`;
    
    // Since cookies are sent automatically by the browser, window.open works for authenticated CSV export.
    window.open(exportUrl, '_blank');
  };

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'CASH':
        return t('dailySheets.modeCash');
      case 'ONLINE':
        return t('dailySheets.modeOnline');
      case 'BANK_TRANSFER':
        return t('dailySheets.modeBankTransfer');
      case 'CHEQUE':
        return t('dailySheets.modeCheque');
      default:
        return mode;
    }
  };

  if (authLoading || (!user && loading)) {
    return <LoadingState label={t('common.loading')} fullscreen />;
  }

  return (
    <AppShell>
      <PageContainer>
        <div className={styles.container}>
          {/* Header */}
          <div className={styles.headerRow}>
            <div className={styles.headerTextGroup}>
              <Breadcrumbs
                items={[
                  { label: t('navigation.dashboard'), href: '/dashboard' },
                  { label: t('collections.title') },
                ]}
              />
              <h1 className={styles.headerTitle}>{t('collections.title')}</h1>
              <p className={styles.headerSubtitle}>{t('collections.subtitle')}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Button variant="outline" onClick={handleExportCsv} disabled={loading || items.length === 0}>
                Export CSV
              </Button>
            </div>
          </div>

      {/* Filter Bar */}
      <div className={styles.filterCard}>
        <form className={styles.filterForm} onSubmit={handleApplyFilter}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="col-filter-date">
              {t('collections.filterDate')}
            </label>
            <input
              id="col-filter-date"
              type="date"
              className={styles.filterInput}
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="col-filter-member">
              {t('collections.filterMember')}
            </label>
            <input
              id="col-filter-member"
              type="text"
              className={styles.filterInput}
              placeholder={t('collections.filterMemberPlaceholder')}
              value={memberNumber}
              onChange={(e) => setMemberNumber(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="col-filter-mode">
              {t('collections.filterMode')}
            </label>
            <select
              id="col-filter-mode"
              className={styles.filterSelect}
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option value="">{t('collections.allModes')}</option>
              <option value="CASH">{t('dailySheets.modeCash')}</option>
              <option value="ONLINE">{t('dailySheets.modeOnline')}</option>
              <option value="BANK_TRANSFER">{t('dailySheets.modeBankTransfer')}</option>
              <option value="CHEQUE">{t('dailySheets.modeCheque')}</option>
              <option value="OTHER">{t('dailySheets.modeOther')}</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="col-filter-status">
              {t('collections.filterStatus')}
            </label>
            <select
              id="col-filter-status"
              className={styles.filterSelect}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t('collections.allStatuses')}</option>
              <option value="COLLECTED">{t('collections.statusCollected')}</option>
              <option value="CORRECTED">{t('collections.statusCorrected')}</option>
            </select>
          </div>

          <div className={styles.filterActions}>
            <Button type="submit" variant="primary">
              {t('common.filter')}
            </Button>
            <Button type="button" variant="outline" onClick={handleResetFilters}>
              {t('collections.resetFilters')}
            </Button>
          </div>
        </form>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('collections.totalCollections')}</span>
            <span className={`${styles.summaryValue} ${styles.summaryHighlight}`}>
              {formatCurrency(summary.totalAmountPaise)}
            </span>
            <span className={styles.summarySubtext}>
              {summary.activeCount} {t('collections.statusCollected').toLowerCase()}
              {summary.correctedCount > 0 && ` • ${summary.correctedCount} ${t('collections.statusCorrected').toLowerCase()}`}
            </span>
          </div>

          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('collections.cashCollections')}</span>
            <span className={styles.summaryValue}>
              {formatCurrency(summary.cashAmountPaise)}
            </span>
            <span className={styles.summarySubtext}>{t('dailySheets.modeCash')}</span>
          </div>

          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('collections.digitalCollections')}</span>
            <span className={styles.summaryValue}>
              {formatCurrency(summary.digitalAmountPaise)}
            </span>
            <span className={styles.summarySubtext}>UPI / Online / Bank</span>
          </div>

          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('collections.collectionCount')}</span>
            <span className={styles.summaryValue}>{totalCount}</span>
            <span className={styles.summarySubtext}>
              {totalPages > 1 ? `Page ${page} of ${totalPages}` : 'All records'}
            </span>
          </div>
        </div>
      )}

      {/* History Table & Cards */}
      <div className={styles.historyCard}>
        <div className={styles.historyHeader}>
          <h2 className={styles.historyTitle}>{t('collections.title')}</h2>
          <span className={styles.pageInfo}>
            {totalCount} {t('collections.collectionCount').toLowerCase()}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <LoadingState label={t('collections.loadingCollections')} />
          </div>
        ) : error ? (
          <div style={{ padding: 'var(--space-6)' }}>
            <ErrorState
              title={t('common.noData')}
              message={getSafeErrorMessage(error)}
              onRetry={() => void loadCollections(page, appliedFilters)}
            />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title={t('collections.emptyTitle')}
            description={t('collections.emptyDesc')}
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className={styles.tableWrapper}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('collections.colDate')}</TableHead>
                    <TableHead>{t('collections.colMember')}</TableHead>
                    <TableHead>{t('collections.colDailySheet')}</TableHead>
                    <TableHead>{t('collections.colAmount')}</TableHead>
                    <TableHead>{t('collections.colMode')}</TableHead>
                    <TableHead>{t('collections.colStatus')}</TableHead>
                    <TableHead>{t('collections.colAdmin')}</TableHead>
                    <TableHead>{t('collections.colTime')}</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      className={item.isCorrected ? styles.correctedRow : undefined}
                    >
                      <TableCell>{item.businessDate}</TableCell>
                      <TableCell>
                        <div className={styles.memberText}>
                          <Link href={`/members/${item.memberNumber}`} className={styles.memberName} style={{ color: 'var(--color-primary-600)', textDecoration: 'none' }}>
                            {item.memberName}
                          </Link>
                          <span className={styles.memberNumber}>{item.memberNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/daily-sheets/${item.dailySheetId}`} className={styles.sheetCode} title={item.dailySheetId} style={{ color: 'var(--color-primary-600)', textDecoration: 'none' }}>
                          {item.dailySheetId.slice(0, 8)}…
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(item.amountPaise)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.paymentMode === 'CASH' ? 'primary' : 'default'}>
                          {getModeLabel(item.paymentMode)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.isCorrected ? (
                          <div>
                            <Badge variant="danger">{t('collections.correctedBadge')}</Badge>
                            {item.correctionReason && (
                              <div className={styles.correctedReason}>
                                {item.correctionReason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="success">{t('collections.activeBadge')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.recordedByAdminName || 'Staff'}</TableCell>
                      <TableCell>{formatTime(item.collectedAt)}</TableCell>
                      <TableCell>
                        <Link href={`/collections/${item.id}`} style={{ color: 'var(--color-primary-600)', fontWeight: 500, textDecoration: 'none' }}>
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className={styles.mobileCardList}>
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`${styles.mobileCard} ${item.isCorrected ? styles.correctedRow : ''}`}
                >
                  <div className={styles.mobileCardHeader}>
                    <div className={styles.memberText}>
                      <Link href={`/members/${item.memberNumber}`} className={styles.memberName} style={{ color: 'var(--color-primary-600)', textDecoration: 'none' }}>
                        {item.memberName}
                      </Link>
                      <span className={styles.memberNumber}>{item.memberNumber}</span>
                    </div>
                    {item.isCorrected ? (
                      <Badge variant="danger">{t('collections.correctedBadge')}</Badge>
                    ) : (
                      <Badge variant="success">{t('collections.activeBadge')}</Badge>
                    )}
                  </div>

                  <div className={styles.mobileCardRow}>
                    <span className={styles.mobileCardLabel}>{t('collections.colAmount')}</span>
                    <span style={{ fontWeight: 700 }}>{formatCurrency(item.amountPaise)}</span>
                  </div>

                  <div className={styles.mobileCardRow}>
                    <span className={styles.mobileCardLabel}>{t('collections.colMode')}</span>
                    <Badge variant={item.paymentMode === 'CASH' ? 'primary' : 'default'}>
                      {getModeLabel(item.paymentMode)}
                    </Badge>
                  </div>

                  <div className={styles.mobileCardRow}>
                    <span className={styles.mobileCardLabel}>{t('collections.colDate')}</span>
                    <span>{item.businessDate} • {formatTime(item.collectedAt)}</span>
                  </div>

                  <div className={styles.mobileCardRow}>
                    <span className={styles.mobileCardLabel}>{t('collections.colDailySheet')}</span>
                    <Link href={`/daily-sheets/${item.dailySheetId}`} className={styles.sheetCode} style={{ color: 'var(--color-primary-600)', textDecoration: 'none' }}>
                      {item.dailySheetId.slice(0, 8)}…
                    </Link>
                  </div>

                  {item.isCorrected && item.correctionReason && (
                    <div className={styles.correctedReason}>
                      Reason: {item.correctionReason}
                    </div>
                  )}

                  <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-neutral-100)', paddingTop: 'var(--space-3)' }}>
                    <Link href={`/collections/${item.id}`} style={{ color: 'var(--color-primary-600)', fontWeight: 500, textDecoration: 'none', fontSize: 'var(--text-sm)' }}>
                      View Details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className={styles.paginationBar}>
                <span className={styles.pageInfo}>
                  Page {page} of {totalPages} ({totalCount} total)
                </span>
                <div className={styles.pageControls}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    {t('common.back')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
