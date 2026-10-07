'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { apiRequest } from '@/lib/api/client';
import { getSafeErrorMessage } from '@/lib/error-utils';
import styles from './collections.module.css';

type RangeType = 'date' | 'week' | 'month' | 'year' | 'custom';

export default function CollectionsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'savings' | 'loan'>('savings');
  
  // Date Filters
  const [rangeType, setRangeType] = useState<RangeType>('date');
  const [singleDate, setSingleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);
  const [gridData, setGridData] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      void logout();
    }
  }, [user, authLoading, logout]);

  const { start, end } = useMemo(() => {
    const now = new Date();
    let s = '';
    let e = '';

    switch (rangeType) {
      case 'date':
        s = singleDate;
        e = singleDate;
        break;
      case 'week': {
        const first = new Date(now);
        first.setDate(first.getDate() - first.getDay());
        const last = new Date(now);
        last.setDate(last.getDate() - last.getDay() + 6);
        s = first.toISOString().split('T')[0];
        e = last.toISOString().split('T')[0];
        break;
      }
      case 'month': {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        s = first.toISOString().split('T')[0];
        e = last.toISOString().split('T')[0];
        break;
      }
      case 'year': {
        const first = new Date(now.getFullYear(), 0, 1);
        const last = new Date(now.getFullYear(), 11, 31);
        s = first.toISOString().split('T')[0];
        e = last.toISOString().split('T')[0];
        break;
      }
      case 'custom':
        s = customStartDate;
        e = customEndDate;
        break;
    }
    return { start: s, end: e };
  }, [rangeType, singleDate, customStartDate, customEndDate]);

  const loadGridData = useCallback(async (sDate: string, eDate: string) => {
    if (!sDate || !eDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ data: any }>(`/daily-sheets/grid?startDate=${sDate}&endDate=${eDate}`);
      setGridData(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && start && end) {
      void loadGridData(start, end);
    }
  }, [user, start, end, loadGridData]);

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (authLoading || (!user && loading)) {
    return <LoadingState label={t('common.loading')} fullscreen />;
  }

  let totalCollectedPaise = 0;
  let itemsList: any[] = [];
  let pendingCount = 0;

  if (gridData) {
    if (activeTab === 'savings') {
      const sheets = gridData.dailySheets || [];
      totalCollectedPaise = sheets.reduce((sum: number, sheet: any) => sum + Number(sheet.actual_paid_paise), 0);
      
      const paidMemberIds = new Set(sheets.map((s: any) => s.member_id));
      const activeMembers = gridData.members || [];
      pendingCount = activeMembers.filter((m: any) => !paidMemberIds.has(m.id)).length;
      
      itemsList = sheets.map((sheet: any) => {
        const member = activeMembers.find((m: any) => m.id === sheet.member_id);
        return {
          id: `${sheet.member_id}-${sheet.business_date}-${Math.random()}`,
          businessDate: sheet.business_date,
          memberNumber: member?.member_number,
          memberName: member?.member_name,
          amountPaise: Number(sheet.actual_paid_paise),
          type: 'Savings'
        };
      });
    } else {
      const repayments = gridData.repayments || [];
      totalCollectedPaise = repayments.reduce((sum: number, rep: any) => sum + Number(rep.amount_paise), 0);
      
      const activeMembers = gridData.members || [];
      itemsList = repayments.map((rep: any) => {
        const member = activeMembers.find((m: any) => m.id === rep.member_id);
        return {
          id: `${rep.member_id}-${rep.business_date}-${Math.random()}`,
          businessDate: rep.business_date,
          memberNumber: member?.member_number,
          memberName: member?.member_name,
          amountPaise: Number(rep.amount_paise),
          type: 'Loan'
        };
      });
    }
  }

  return (
    <AppShell>
      <PageContainer>
        <div className={styles.container}>
          <div className={styles.headerRow}>
            <div className={styles.headerTextGroup}>
              <Breadcrumbs
                items={[
                  { label: t('navigation.dashboard'), href: '/dashboard' },
                  { label: 'Collections' },
                ]}
              />
              <h1 className={styles.headerTitle}>Collections</h1>
              <p className={styles.headerSubtitle}>Traceable financial recap of daily member payments and loans.</p>
              
              <div className={styles.tabsContainer}>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'savings' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('savings')}
                >
                  Savings
                </button>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'loan' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('loan')}
                >
                  Loan
                </button>
              </div>
            </div>
          </div>

          <div className={styles.filterCard}>
            <div className={styles.filterForm}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Date Range</label>
                <select
                  className={styles.filterSelect}
                  value={rangeType}
                  onChange={(e) => setRangeType(e.target.value as RangeType)}
                >
                  <option value="date">Specific Date</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {rangeType === 'date' && (
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Select Date</label>
                  <input
                    type="date"
                    className={styles.filterInput}
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                  />
                </div>
              )}

              {rangeType === 'custom' && (
                <>
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>From Date</label>
                    <input
                      type="date"
                      className={styles.filterInput}
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>To Date</label>
                    <input
                      type="date"
                      className={styles.filterInput}
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {gridData && (
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Total {activeTab === 'savings' ? 'Savings' : 'Loan'} Collections</span>
                <span className={`${styles.summaryValue} ${styles.summaryHighlight}`}>
                  {formatCurrency(totalCollectedPaise)}
                </span>
                <span className={styles.summarySubtext}>
                  {start} to {end}
                </span>
              </div>

              {activeTab === 'savings' && rangeType === 'date' && (
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Pending Members</span>
                  <span className={styles.summaryValue}>
                    {pendingCount}
                  </span>
                  <span className={styles.summarySubtext}>Have not paid today</span>
                </div>
              )}

              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Collection Entries</span>
                <span className={styles.summaryValue}>{itemsList.length}</span>
                <span className={styles.summarySubtext}>Records Found</span>
              </div>
            </div>
          )}

          <div className={styles.historyCard}>
            <div className={styles.historyHeader}>
              <h2 className={styles.historyTitle}>{activeTab === 'savings' ? 'Savings Collections' : 'Loan Collections'}</h2>
            </div>

            {loading ? (
              <div style={{ padding: 'var(--space-8)' }}>
                <LoadingState label="Loading data..." />
              </div>
            ) : error ? (
              <div style={{ padding: 'var(--space-6)' }}>
                <ErrorState
                  title={t('common.noData')}
                  message={getSafeErrorMessage(error)}
                  onRetry={() => void loadGridData(start, end)}
                />
              </div>
            ) : itemsList.length === 0 ? (
              <EmptyState
                title="No Collections Found"
                description={`No ${activeTab} collections match the selected period.`}
              />
            ) : (
              <div className={styles.tableWrapper}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsList.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <span>{item.businessDate}</span>
                        </TableCell>
                        <TableCell>
                          <div className={styles.memberText}>
                            <span className={styles.memberName}>{item.memberName || 'Unknown'}</span>
                            <span className={styles.memberNumber}>{item.memberNumber || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={activeTab === 'savings' ? 'success' : 'primary'}>
                            {item.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span style={{ fontWeight: 600 }}>{formatCurrency(item.amountPaise)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
