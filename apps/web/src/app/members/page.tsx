'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { AppShell, PageContainer, Breadcrumbs } from '@/components/layout';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  EmptyState,
  Button,
  Input,
} from '@/components/ui';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { useNotification } from '@/hooks/useNotification';
import { fetchMembers, deactivateMember, activateMember, type MemberListItem } from '@/lib/api/members';
import { getSafeErrorMessage } from '@/lib/error-utils';
import styles from './members.module.css';

const PAGE_SIZE = 10;

/**
 * Member List & Search Screen (Phase 5.4)
 *
 * Provides:
 * - Enterprise-grade Member Registry table (desktop) and card view (mobile)
 * - Exact and prefix Member Number search with debounce/submit control
 * - Status filter tabs (All, Active, Inactive)
 * - Safe pagination preserving search queries
 * - Full loading, empty, and error feedback states
 * - Strict presentation isolation: no fake data or unreleased financial columns
 */
export default function MembersPage() {
  const router = useRouter();
  const { user, loading: authLoading, error: authError, logout } = useAuth();
  const { t } = useTranslation();
  const notification = useNotification();

  // Search & Filter state
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Data & Pagination state
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [dataLoading, setDataLoading] = useState(true);
  const [apiError, setApiError] = useState<unknown | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Deactivation state
  const [memberToDeactivate, setMemberToDeactivate] = useState<MemberListItem | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Activation state (Phase 5.8.1)
  const [memberToActivate, setMemberToActivate] = useState<MemberListItem | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
        return;
      }

      setDataLoading(true);
      setApiError(null);

      try {
        const result = await fetchMembers({
          page,
          pageSize: PAGE_SIZE,
          q: appliedQuery || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        });

        if (!isCancelled) {
          setMembers(result.members);
          setTotalCount(result.totalCount);
        }
      } catch (err) {
        if (!isCancelled) {
          setApiError(err);
        }
      } finally {
        if (!isCancelled) {
          setDataLoading(false);
        }
      }
    }

    void load();

    return () => {
      isCancelled = true;
    };
  }, [user, page, appliedQuery, statusFilter, refreshIndex]);

  // Auth gate checks
  if (authLoading) {
    return <LoadingState fullscreen label={t('common.loading')} />;
  }

  if (authError || !user) {
    return (
      <ErrorState
        fullscreen
        error={authError}
        title={t('feedback.somethingWentWrong')}
        message={authError || t('feedback.sessionExpired')}
        action={
          <Button variant="primary" onClick={() => logout()}>
            {t('authentication.login')}
          </Button>
        }
      />
    );
  }

  // Role gate: only SUPER_ADMIN and ADMIN are permitted to manage members
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState
            title={t('feedback.accessDenied')}
            message={t('feedback.accessDenied')}
            action={
              <Button variant="primary" onClick={() => router.push('/dashboard')}>
                {t('navigation.dashboard')}
              </Button>
            }
          />
        </PageContainer>
      </AppShell>
    );
  }

  // Search submission handler
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedQuery(searchInput.trim());
    setPage(1);
  };

  // Clear search handler
  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedQuery('');
    setPage(1);
  };

  // Status tab change handler
  const handleStatusChange = (newStatus: 'ALL' | 'ACTIVE' | 'INACTIVE') => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  // Pagination navigation
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canGoPrevious = page > 1 && !dataLoading;
  const canGoNext = page < totalPages && !dataLoading;

  const handlePreviousPage = () => {
    if (canGoPrevious) {
      setPage((prev) => Math.max(1, prev - 1));
    }
  };

  const handleNextPage = () => {
    if (canGoNext) {
      setPage((prev) => Math.min(totalPages, prev + 1));
    }
  };

  // Deactivation confirmation handler
  const handleDeactivateConfirm = async () => {
    if (!memberToDeactivate || isDeactivating) return;
    setIsDeactivating(true);
    try {
      await deactivateMember(memberToDeactivate.memberNumber);
      notification.success(t('members.memberDeactivatedSuccess'));
      setMemberToDeactivate(null);
      setRefreshIndex((prev) => prev + 1);
    } catch (err: unknown) {
      notification.error(getSafeErrorMessage(err, t));
    } finally {
      setIsDeactivating(false);
    }
  };

  // Activation confirmation handler (Phase 5.8.1)
  const handleActivateConfirm = async () => {
    if (!memberToActivate || isActivating) return;
    setIsActivating(true);
    try {
      await activateMember(memberToActivate.memberNumber);
      notification.success(t('members.memberActivatedSuccess'));
      setMemberToActivate(null);
      setRefreshIndex((prev) => prev + 1);
    } catch (err: unknown) {
      notification.error(getSafeErrorMessage(err, t));
    } finally {
      setIsActivating(false);
    }
  };

  const handleRetry = () => {
    setRefreshIndex((prev) => prev + 1);
  };

  const startIndex = totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const endIndex = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <AppShell>
      <PageContainer>
        <div className={styles.container}>
          {/* Breadcrumb Navigation */}
          <Breadcrumbs
            items={[
              { label: t('navigation.dashboard'), href: '/dashboard' },
              { label: t('members.title') },
            ]}
          />

          {/* Page Header */}
          <header className={styles.headerRow}>
            <div className={styles.headerTextGroup}>
              <h1 className={styles.headerTitle}>{t('members.title')}</h1>
              <p className={styles.headerSubtitle}>{t('members.subtitle')}</p>
            </div>

            <div className={styles.headerActions}>
              <Button
                variant="primary"
                onClick={() => router.push('/members/new')}
                aria-label={t('members.addMember')}
                leftIcon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                <span>{t('members.addMember')}</span>
              </Button>
            </div>
          </header>

          {/* Search & Filter Toolbar */}
          <section className={styles.toolbarCard} aria-label="Search and filter toolbar">
            <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
              <div className={styles.searchInputWrapper}>
                <Input
                  id="member-search-input"
                  type="text"
                  placeholder={t('members.searchPlaceholder')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  startAdornment={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                  endAdornment={
                    searchInput ? (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 2,
                          color: 'var(--color-espresso-400)',
                        }}
                        aria-label={t('members.clearButton')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : null
                  }
                />
              </div>

              <Button type="submit" variant="primary" size="md">
                {t('members.searchButton')}
              </Button>

              {appliedQuery && (
                <Button type="button" variant="outline" size="md" onClick={handleClearSearch}>
                  {t('members.clearButton')}
                </Button>
              )}
            </form>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>{t('members.filterStatus')}:</span>
              <div className={styles.filterTabs} role="tablist" aria-label={t('members.filterStatus')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === 'ALL'}
                  className={`${styles.filterTab} ${statusFilter === 'ALL' ? styles.filterTabActive : ''}`.trim()}
                  onClick={() => handleStatusChange('ALL')}
                >
                  {t('members.allStatuses')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === 'ACTIVE'}
                  className={`${styles.filterTab} ${statusFilter === 'ACTIVE' ? styles.filterTabActive : ''}`.trim()}
                  onClick={() => handleStatusChange('ACTIVE')}
                >
                  {t('members.statusActive')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === 'INACTIVE'}
                  className={`${styles.filterTab} ${statusFilter === 'INACTIVE' ? styles.filterTabActive : ''}`.trim()}
                  onClick={() => handleStatusChange('INACTIVE')}
                >
                  {t('members.statusInactive')}
                </button>
              </div>
            </div>
          </section>

          {/* Main Content Area */}
          <main className={styles.contentCard}>
            {dataLoading ? (
              <div className={styles.skeletonContainer} aria-label={t('common.loading')} role="status">
                <div className={styles.skeletonRow} />
                <div className={styles.skeletonRow} />
                <div className={styles.skeletonRow} />
                <div className={styles.skeletonRow} />
                <div className={styles.skeletonRow} />
              </div>
            ) : apiError ? (
              <ErrorState error={apiError} onRetry={handleRetry} />
            ) : members.length === 0 ? (
              appliedQuery || statusFilter !== 'ALL' ? (
                <EmptyState
                  title={t('members.noResultsTitle')}
                  description={t('members.noResultsDescription')}
                  action={
                    <Button variant="outline" onClick={handleClearSearch}>
                      {t('members.clearButton')}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title={t('members.emptyTitle')}
                  description={t('members.emptyDescription')}
                />
              )
            ) : (
              <>
                {/* Desktop Data Table */}
                <div className={styles.desktopTable}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('members.colMemberNumber')}</TableHead>
                        <TableHead>{t('members.colMemberName')}</TableHead>
                        <TableHead>{t('members.colShopName')}</TableHead>
                        <TableHead>{t('members.colMobileNumber')}</TableHead>
                        <TableHead>{t('members.colSheets')}</TableHead>
                        <TableHead>{t('members.colStatus')}</TableHead>
                        <TableHead>{t('members.colActions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className={styles.memberNumberText}>{m.memberNumber}</TableCell>
                          <TableCell className={styles.memberNameText}>{m.memberName}</TableCell>
                          <TableCell>{m.shopName || <span className={styles.mutedCellText}>—</span>}</TableCell>
                          <TableCell>{m.mobileNumber}</TableCell>
                          <TableCell>
                            <span className={styles.sheetsBadge}>{m.numberOfSheets}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={m.status === 'ACTIVE' ? 'success' : 'default'} dot>
                              {m.status === 'ACTIVE' ? t('members.statusActive') : t('members.statusInactive')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(`/members/${encodeURIComponent(m.memberNumber)}`)}
                                title={t('members.viewTooltip')}
                                aria-label={`${t('members.actionView')} ${m.memberNumber}`}
                              >
                                {t('members.actionView')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(`/members/${encodeURIComponent(m.memberNumber)}/edit`)}
                                aria-label={`${t('members.editMember')} ${m.memberNumber}`}
                              >
                                {t('members.editMember')}
                              </Button>
                              {m.status === 'ACTIVE' && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => setMemberToDeactivate(m)}
                                  aria-label={`${t('members.deactivate')} ${m.memberNumber}`}
                                >
                                  {t('members.deactivate')}
                                </Button>
                              )}
                              {m.status === 'INACTIVE' && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setMemberToActivate(m)}
                                  aria-label={`${t('members.activate')} ${m.memberNumber}`}
                                >
                                  {t('members.activate')}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Responsive Cards */}
                <div className={styles.mobileCards} aria-label="Member cards">
                  {members.map((m) => (
                    <article key={m.id} className={styles.mobileCard}>
                      <div className={styles.mobileCardHeader}>
                        <span className={styles.memberNumberText}>{m.memberNumber}</span>
                        <Badge variant={m.status === 'ACTIVE' ? 'success' : 'default'} dot>
                          {m.status === 'ACTIVE' ? t('members.statusActive') : t('members.statusInactive')}
                        </Badge>
                      </div>

                      <h3 className={styles.mobileCardName}>{m.memberName}</h3>

                      <div className={styles.mobileCardGrid}>
                        <div className={styles.mobileCardItem}>
                          <span className={styles.mobileCardLabel}>{t('members.colShopName')}</span>
                          <span className={styles.mobileCardValue}>{m.shopName || '—'}</span>
                        </div>
                        <div className={styles.mobileCardItem}>
                          <span className={styles.mobileCardLabel}>{t('members.colMobileNumber')}</span>
                          <span className={styles.mobileCardValue}>{m.mobileNumber}</span>
                        </div>
                        <div className={styles.mobileCardItem}>
                          <span className={styles.mobileCardLabel}>{t('members.colSheets')}</span>
                          <span className={styles.mobileCardValue}>
                            <span className={styles.sheetsBadge}>{m.numberOfSheets}</span>
                          </span>
                        </div>
                      </div>

                      <div
                        className={styles.mobileCardActions}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') ? '1fr 1fr 1fr' : '1fr 1fr',
                          gap: 'var(--space-2)',
                        }}
                      >
                        <Button
                          fullWidth
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/members/${encodeURIComponent(m.memberNumber)}`)}
                          title={t('members.viewTooltip')}
                          aria-label={`${t('members.actionView')} ${m.memberNumber}`}
                        >
                          {t('members.actionView')}
                        </Button>
                        <Button
                          fullWidth
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/members/${encodeURIComponent(m.memberNumber)}/edit`)}
                          aria-label={`${t('members.editMember')} ${m.memberNumber}`}
                        >
                          {t('members.editMember')}
                        </Button>
                        {m.status === 'ACTIVE' && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
                          <Button
                            fullWidth
                            size="sm"
                            variant="danger"
                            onClick={() => setMemberToDeactivate(m)}
                            aria-label={`${t('members.deactivate')} ${m.memberNumber}`}
                          >
                            {t('members.deactivate')}
                          </Button>
                        )}
                        {m.status === 'INACTIVE' && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
                          <Button
                            fullWidth
                            size="sm"
                            variant="secondary"
                            onClick={() => setMemberToActivate(m)}
                            aria-label={`${t('members.activate')} ${m.memberNumber}`}
                          >
                            {t('members.activate')}
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                {/* Pagination Controls */}
                <footer className={styles.paginationBar}>
                  <div className={styles.paginationInfo}>
                    {t('members.paginationSummary', {
                      start: startIndex,
                      end: endIndex,
                      total: totalCount,
                    })}
                  </div>

                  <div className={styles.paginationControls}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canGoPrevious}
                      onClick={handlePreviousPage}
                      aria-label={t('members.previousPage')}
                    >
                      {t('members.previousPage')}
                    </Button>

                    <span className={styles.pageIndicator}>
                      {t('members.paginationPage', {
                        page,
                        totalPages,
                      })}
                    </span>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canGoNext}
                      onClick={handleNextPage}
                      aria-label={t('members.nextPage')}
                    >
                      {t('members.nextPage')}
                    </Button>
                  </div>
                </footer>
              </>
            )}
          </main>
        </div>

        {/* Deactivation Confirmation Dialog */}
        <ConfirmDialog
          isOpen={Boolean(memberToDeactivate)}
          onClose={() => {
            if (!isDeactivating) {
              setMemberToDeactivate(null);
            }
          }}
          onConfirm={handleDeactivateConfirm}
          title={t('members.confirmDeactivateTitle')}
          description={t('members.confirmDeactivateDesc', {
            memberNumber: memberToDeactivate?.memberNumber || '',
            memberName: memberToDeactivate?.memberName || '',
          })}
          confirmLabel={t('members.deactivateConfirm')}
          cancelLabel={t('members.cancel')}
          variant="danger"
          isLoading={isDeactivating}
        />

        {/* Activation Confirmation Dialog (Phase 5.8.1) */}
        <ConfirmDialog
          isOpen={Boolean(memberToActivate)}
          onClose={() => {
            if (!isActivating) {
              setMemberToActivate(null);
            }
          }}
          onConfirm={handleActivateConfirm}
          title={t('members.confirmActivateTitle')}
          description={t('members.confirmActivateDesc', {
            memberNumber: memberToActivate?.memberNumber || '',
            memberName: memberToActivate?.memberName || '',
          })}
          confirmLabel={t('members.activateConfirm')}
          cancelLabel={t('members.cancel')}
          variant="primary"
          isLoading={isActivating}
        />
      </PageContainer>
    </AppShell>
  );
}
