'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/hooks/useNotification';
import {
  fetchMemberDailySheetHistory,
  correctDailySheet,
  type DailySheet,
  type DailySheetListResponse,
  type DailySheetStatus,
} from '@/lib/api/daily-sheets';
import { getSafeErrorMessage } from '@/lib/error-utils';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import {
  Badge,
  Button,
  Input,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import styles from './MemberDailySheetHistory.module.css';

interface MemberDailySheetHistoryProps {
  memberNumber: string;
}

export function MemberDailySheetHistory({ memberNumber }: MemberDailySheetHistoryProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const notification = useNotification();

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [data, setData] = useState<DailySheetListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Correction state
  const [sheetToCorrect, setSheetToCorrect] = useState<DailySheet | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);

  const canCorrect = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const loadHistory = useCallback(async () => {
    if (!memberNumber) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMemberDailySheetHistory(memberNumber, page, pageSize);
      setData(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [memberNumber, page, pageSize]);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) {
        void loadHistory();
      }
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [loadHistory, refreshIndex]);

  const handleExecuteCorrection = async () => {
    if (!sheetToCorrect || !correctionReason.trim()) {
      notification.error(t('dailySheets.errReasonRequired'));
      return;
    }

    setIsCorrecting(true);
    try {
      await correctDailySheet(sheetToCorrect.id, correctionReason.trim());
      notification.success(t('dailySheets.correctionSuccess'));
      setSheetToCorrect(null);
      setCorrectionReason('');
      setRefreshIndex((prev) => prev + 1);
    } catch (err) {
      notification.error(getSafeErrorMessage(err));
    } finally {
      setIsCorrecting(false);
    }
  };

  const getStatusBadge = (status: DailySheetStatus) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success">{t('dailySheets.statusPaid')}</Badge>;
      case 'PARTIAL':
        return <Badge variant="warning">{t('dailySheets.statusPartial')}</Badge>;
      case 'NOT_PAID':
        return <Badge variant="danger">{t('dailySheets.statusNotPaid')}</Badge>;
      case 'ADVANCE_PAID':
        return <Badge variant="primary">{t('dailySheets.statusAdvancePaid')}</Badge>;
      case 'ADVANCE_COVERED':
        return <Badge variant="primary">{t('dailySheets.statusAdvanceCovered')}</Badge>;
      case 'OVERDUE':
        return <Badge variant="danger">{t('dailySheets.statusOverdue')}</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getPaymentModeLabel = (mode: string | null) => {
    if (!mode) return '—';
    switch (mode) {
      case 'CASH':
        return t('dailySheets.modeCash');
      case 'ONLINE':
        return t('dailySheets.modeOnline');
      case 'BANK_TRANSFER':
        return t('dailySheets.modeBankTransfer');
      case 'CHEQUE':
        return t('dailySheets.modeCheque');
      case 'OTHER':
        return t('dailySheets.modeOther');
      default:
        return mode;
    }
  };

  // Aggregated page summary
  const items = data?.items ?? [];
  const totalPaidPaise = items.reduce((acc, curr) => acc + curr.actualPaidPaise, 0);
  const totalDuePaise = items.reduce((acc, curr) => acc + curr.totalDuePaise, 0);
  const totalBalancePaise = items.reduce((acc, curr) => acc + curr.balanceRemainingPaise, 0);

  return (
    <section className={styles.container} aria-labelledby="section-daily-sheet-history-title">
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderLeft}>
          <div className={styles.sectionIconWrapper} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h2 id="section-daily-sheet-history-title" className={styles.sectionTitle}>
            {t('dailySheets.recentHistoryTitle')}
          </h2>
        </div>
        {data && data.pagination.total > 0 && (
          <span className={styles.countBadge}>
            {data.pagination.total} {data.pagination.total === 1 ? 'Entry' : 'Entries'}
          </span>
        )}
      </div>

      {loading && (
        <div className={styles.loadingContainer}>
          <LoadingState label={t('dailySheets.loadingHistory')} />
        </div>
      )}

      {!loading && Boolean(error) && (
        <ErrorState
          error={error || undefined}
          onRetry={() => setRefreshIndex((prev) => prev + 1)}
        />
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title={t('dailySheets.noHistoryTitle')}
          description={t('dailySheets.noHistoryDesc')}
        />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          {/* Summary Strip */}
          <div className={styles.summaryStrip}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{t('dailySheets.colTotalDue')}</span>
              <span className={styles.summaryValue}>₹{(totalDuePaise / 100).toFixed(2)}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{t('dailySheets.colActualPaid')}</span>
              <span className={`${styles.summaryValue} ${styles.paidColor}`}>
                ₹{(totalPaidPaise / 100).toFixed(2)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{t('dailySheets.colBalance')}</span>
              <span className={`${styles.summaryValue} ${totalBalancePaise > 0 ? styles.balanceColor : ''}`}>
                ₹{(totalBalancePaise / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Desktop Table */}
          <div className={styles.tableWrapper}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dailySheets.colBusinessDate')}</TableHead>
                  <TableHead>{t('dailySheets.colSheets')}</TableHead>
                  <TableHead>{t('dailySheets.colDailyDue')}</TableHead>
                  <TableHead>{t('dailySheets.colArrears')}</TableHead>
                  <TableHead>{t('dailySheets.colTotalDue')}</TableHead>
                  <TableHead>{t('dailySheets.colActualPaid')}</TableHead>
                  <TableHead>{t('dailySheets.colBalance')}</TableHead>
                  <TableHead>{t('dailySheets.colExcess')}</TableHead>
                  <TableHead>{t('dailySheets.colMode')}</TableHead>
                  <TableHead>{t('dailySheets.colStatus')}</TableHead>
                  {canCorrect && <TableHead>{t('common.actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((sheet) => (
                  <TableRow key={sheet.id}>
                    <TableCell className={styles.dateCell}>{sheet.businessDate}</TableCell>
                    <TableCell>{sheet.numberOfSheets}</TableCell>
                    <TableCell>₹{(sheet.dailyDueAmountPaise / 100).toFixed(2)}</TableCell>
                    <TableCell>₹{(sheet.previousArrearsPaise / 100).toFixed(2)}</TableCell>
                    <TableCell className={styles.boldCell}>₹{(sheet.totalDuePaise / 100).toFixed(2)}</TableCell>
                    <TableCell className={styles.paidCell}>₹{(sheet.actualPaidPaise / 100).toFixed(2)}</TableCell>
                    <TableCell className={sheet.balanceRemainingPaise > 0 ? styles.balanceCell : ''}>
                      ₹{(sheet.balanceRemainingPaise / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>₹{(sheet.excessPaidPaise / 100).toFixed(2)}</TableCell>
                    <TableCell>{getPaymentModeLabel(sheet.paymentMode)}</TableCell>
                    <TableCell>
                      <div className={styles.statusCell}>
                        {getStatusBadge(sheet.status)}
                        {sheet.isCorrected && (
                          <Badge variant="default">{t('dailySheets.correctedBadge')}</Badge>
                        )}
                      </div>
                    </TableCell>
                    {canCorrect && (
                      <TableCell>
                        {sheet.isCorrected ? (
                          <span className={styles.mutedText}>—</span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            className={styles.correctBtn}
                            onClick={() => setSheetToCorrect(sheet)}
                          >
                            {t('dailySheets.correctAction')}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List */}
          <div className={styles.mobileCardsList}>
            {items.map((sheet) => (
              <div key={sheet.id} className={styles.mobileCard}>
                <div className={styles.mobileCardHeader}>
                  <span className={styles.mobileDate}>{sheet.businessDate}</span>
                  <div className={styles.statusCell}>
                    {getStatusBadge(sheet.status)}
                    {sheet.isCorrected && (
                      <Badge variant="default">{t('dailySheets.correctedBadge')}</Badge>
                    )}
                  </div>
                </div>
                <div className={styles.mobileGrid}>
                  <div className={styles.mobileField}>
                    <span className={styles.mobileLabel}>{t('dailySheets.colSheets')}</span>
                    <span className={styles.mobileVal}>{sheet.numberOfSheets}</span>
                  </div>
                  <div className={styles.mobileField}>
                    <span className={styles.mobileLabel}>{t('dailySheets.colTotalDue')}</span>
                    <span className={styles.mobileValBold}>₹{(sheet.totalDuePaise / 100).toFixed(2)}</span>
                  </div>
                  <div className={styles.mobileField}>
                    <span className={styles.mobileLabel}>{t('dailySheets.colActualPaid')}</span>
                    <span className={styles.mobileValPaid}>₹{(sheet.actualPaidPaise / 100).toFixed(2)}</span>
                  </div>
                  <div className={styles.mobileField}>
                    <span className={styles.mobileLabel}>{t('dailySheets.colBalance')}</span>
                    <span className={styles.mobileVal}>₹{(sheet.balanceRemainingPaise / 100).toFixed(2)}</span>
                  </div>
                  <div className={styles.mobileField}>
                    <span className={styles.mobileLabel}>{t('dailySheets.colMode')}</span>
                    <span className={styles.mobileVal}>{getPaymentModeLabel(sheet.paymentMode)}</span>
                  </div>
                </div>
                {canCorrect && !sheet.isCorrected && (
                  <div className={styles.mobileActionRow}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSheetToCorrect(sheet)}
                    >
                      {t('dailySheets.correctAction')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination Bar */}
          {data && data.pagination.totalPages > 1 && (
            <nav className={styles.paginationBar} aria-label="Daily sheet pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('common.back')}
              </Button>
              <span className={styles.pageInfo}>
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('common.next')}
              </Button>
            </nav>
          )}
        </>
      )}

      {/* Controlled Correction Dialog */}
      {sheetToCorrect && (
        <ConfirmDialog
          isOpen={Boolean(sheetToCorrect)}
          onClose={() => {
            if (!isCorrecting) {
              setSheetToCorrect(null);
              setCorrectionReason('');
            }
          }}
          onConfirm={handleExecuteCorrection}
          title={t('dailySheets.confirmCorrectTitle')}
          description={t('dailySheets.confirmCorrectDesc')
            .replace('{{businessDate}}', sheetToCorrect.businessDate)
            .replace('{{amount}}', (sheetToCorrect.actualPaidPaise / 100).toFixed(2))}
          confirmLabel={isCorrecting ? t('dailySheets.correctingEntry') : t('dailySheets.confirmCorrectButton')}
          cancelLabel={t('common.cancel')}
          variant="warning"
          isLoading={isCorrecting}
        >
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Input
              id="correctionReasonInputMemberProfile"
              label={t('dailySheets.correctionReasonLabel')}
              placeholder={t('dailySheets.correctionReasonPlaceholder')}
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              required
            />
          </div>
        </ConfirmDialog>
      )}
    </section>
  );
}
