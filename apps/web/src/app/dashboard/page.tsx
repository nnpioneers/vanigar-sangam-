'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { useTranslation } from '@/hooks/useTranslation';
import { AppShell, PageContainer } from '@/components/layout';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { formatRupees } from '@/lib/formatters';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, error: authError, logout } = useAuth();
  const { summary, transactions, loading: dashboardLoading, error: dashboardError } = useDashboard();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<'seettu' | 'loans'>('seettu');

  if (authLoading || dashboardLoading) {
    return <LoadingState fullscreen label="Loading..." />;
  }

  if (authError || !user) {
    return (
      <ErrorState
        fullscreen
        error={authError}
        title="Session Expired"
        message="Your session has expired. Please log in again."
        action={<button className={styles.actionButton} onClick={() => logout()}>Login</button>}
      />
    );
  }

  if (dashboardError) {
    return (
      <ErrorState
        fullscreen
        error={dashboardError}
        title="Error Loading Dashboard"
        message="Could not load the dashboard data."
        action={<button className={styles.actionButton} onClick={() => window.location.reload()}>Retry</button>}
      />
    );
  }

  const handleActionClick = (path: string) => {
    router.push(path);
  };

  const {
    coreMetrics,
    collectionMetrics,
    loanMetrics,
    cashMetrics
  } = summary!;

  const expectedToday = collectionMetrics.expectedTodayAmountPaise || 0;
  const collectedToday = collectionMetrics.todayCollectionAmountPaise || 0;
  const pendingToday = expectedToday - collectedToday;
  
  const totalRepaidPercent = loanMetrics.totalLoansGivenPaise > 0 
    ? Math.round((loanMetrics.totalLoanRepaidPaise / loanMetrics.totalLoansGivenPaise) * 100) 
    : 0;

  return (
    <AppShell>
      <div className={styles.dashboardContainer}>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--color-espresso-900)' }}>{t('dashboard.title')}</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-espresso-500)', margin: '0.25rem 0 0' }}>{t('dashboard.overview')} of {t('common.appName')}</p>
        </div>

        {/* Daily Collection Banner */}
        <div style={{ backgroundColor: '#115e59', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          {/* Left: Title & Subtitle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.55rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.05em' }}>{t('dashboard.dailyCollectionSheetBadge')}</span>
              <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>{t('dashboard.dailyCollectionOverview')}</span>
            </div>
            <div style={{ color: '#99f6e4', fontSize: '0.7rem', cursor: 'pointer', lineHeight: 1 }} onClick={() => handleActionClick('/daily-sheets/new')}>
              {t('dashboard.dailyCollectionSubtext')}
            </div>
          </div>

          {/* Middle: Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <span style={{ color: '#86efac', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase' }}>{t('dashboard.expectedToday')}</span>
              <span style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2 }}>{formatRupees(expectedToday)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <span style={{ color: '#86efac', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase' }}>{t('dashboard.collectedToday')}</span>
              <span style={{ color: '#4ade80', fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2 }}>{formatRupees(collectedToday)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <span style={{ color: '#86efac', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase' }}>{t('dashboard.pendingToday')}</span>
              <span style={{ color: '#fcd34d', fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2 }}>{formatRupees(pendingToday)}</span>
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '0.35rem 0.75rem', borderRadius: '0.35rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
              <span style={{ color: '#ccfbf1', fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase' }}>{t('dashboard.membersStatus')}</span>
              <span style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 800, lineHeight: 1.1 }}>{collectionMetrics.todayCollectionCount} {t('dashboard.paid')} / {collectionMetrics.pendingCollectionsCount ?? (coreMetrics.activeMembers - collectionMetrics.todayCollectionCount)} {t('dashboard.pending')}</span>
            </div>
            <button 
              onClick={() => handleActionClick('/daily-sheets/new')}
              style={{ backgroundColor: '#ffffff', color: '#115e59', border: 'none', padding: '0.45rem 0.85rem', borderRadius: '0.35rem', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
            >
              {t('dashboard.openDailySheetBtn')} &rarr;
            </button>
          </div>
        </div>

        <div className={styles.cardsGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
          {/* Card 1 - Total Members */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1 }}>{t('dashboard.cardTotalMembers')}</div>
              <div style={{ backgroundColor: '#dcfce7', color: '#16a34a', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>VS</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>{coreMetrics.totalMembers}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 'auto', flexWrap: 'wrap' }}>
              <span style={{ backgroundColor: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>{coreMetrics.activeMembers} {t('dashboard.activeStr')}</span>
              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{coreMetrics.inactiveMembers} {t('dashboard.inactiveStr')}</span>
            </div>
          </div>

          {/* Card 2 - Total Collection */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1 }}>{t('dashboard.cardTotalCollection')}</div>
              <div style={{ backgroundColor: '#ecfdf5', color: '#10b981', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>₹</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>{formatRupees(collectionMetrics.totalCollectionAmountPaise || 0)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 'auto', flexWrap: 'wrap' }}>
              <span style={{ backgroundColor: '#ecfdf5', color: '#10b981', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>100% {t('dashboard.verifiedStr')}</span>
              <span style={{ fontSize: '0.65rem', color: '#64748b', lineHeight: 1.1 }}>{t('dashboard.cumulativeReceipts')}</span>
            </div>
          </div>

          {/* Card 3 - Total Loan Given */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1 }}>{t('dashboard.cardTotalLoanGiven')}</div>
              <div style={{ backgroundColor: '#f3e8ff', color: '#9333ea', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>↗</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>{formatRupees(loanMetrics.totalLoansGivenPaise || 0)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 'auto', flexWrap: 'wrap' }}>
              <span style={{ backgroundColor: '#f3e8ff', color: '#9333ea', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>{loanMetrics.totalLoans} {t('dashboard.loansStr')}</span>
              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{loanMetrics.activeLoans} {t('dashboard.activeLoansStr')}</span>
            </div>
          </div>

          {/* Card 4 - Total Loan Repaid */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1 }}>{t('dashboard.cardTotalLoanRepaid')}</div>
              <div style={{ backgroundColor: '#eff6ff', color: '#3b82f6', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>✓</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>{formatRupees(loanMetrics.totalLoanRepaidPaise || 0)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 'auto', flexWrap: 'wrap' }}>
              <span style={{ backgroundColor: '#eff6ff', color: '#3b82f6', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>{totalRepaidPercent}% {t('dashboard.repaidStr')}</span>
              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{loanMetrics.closedLoans} {t('dashboard.settledStr')}</span>
            </div>
          </div>

          {/* Card 5 - Outstanding Loans */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1 }}>{t('dashboard.cardOutstandingLoans')}</div>
              <div style={{ backgroundColor: '#fffbeb', color: '#d97706', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>!</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>{formatRupees(loanMetrics.outstandingLoansPaise || 0)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 'auto', flexWrap: 'wrap' }}>
              <span style={{ backgroundColor: '#fffbeb', color: '#d97706', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>{loanMetrics.activeLoans} {t('dashboard.activeStr')}</span>
              <span style={{ fontSize: '0.65rem', color: '#64748b', lineHeight: 1.1 }}>{t('dashboard.guarantorBacked')}</span>
            </div>
          </div>

          {/* Card 6 - Sangam Net Balance */}
          <div style={{ backgroundColor: '#115e59', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#ccfbf1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1 }}>{t('dashboard.cardSangamNetBalance')}</div>
              <div style={{ backgroundColor: '#0f766e', color: '#ccfbf1', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>₹</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.75rem' }}>{formatRupees(cashMetrics.totalCashInHandPaise || 0)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 'auto', flexWrap: 'wrap' }}>
              <span style={{ backgroundColor: '#0f766e', color: '#ccfbf1', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>{t('dashboard.cashStr')}</span>
              <span style={{ fontSize: '0.65rem', color: '#99f6e4', lineHeight: 1.1 }}>{t('dashboard.liquidReserves')}</span>
            </div>
          </div>
        </div>

        <div className={styles.chartsSection} style={{ gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', alignItems: 'stretch' }}>
          
          {/* Collection vs Loan Analysis Chart Card */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>{t('dashboard.collectionVsLoanTitle')}</h2>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{t('dashboard.collectionVsLoanDesc')}</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <div style={{ width: '10px', height: '10px', backgroundColor: '#166534', borderRadius: '2px' }}></div>
                  {t('dashboard.chartCollections')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <div style={{ width: '10px', height: '10px', backgroundColor: '#8b5cf6', borderRadius: '2px' }}></div>
                  {t('dashboard.chartLoansDisbursed')}
                </div>
              </div>
            </div>

            {/* Custom CSS Bar Chart */}
            <div style={{ position: 'relative', height: '240px', display: 'flex', marginTop: 'auto' }}>
              {/* Y-Axis Labels */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '1rem', color: '#64748b', fontSize: '0.7rem', fontWeight: 500, textAlign: 'right', width: '40px' }}>
                <span>₹160k</span>
                <span>₹140k</span>
                <span>₹120k</span>
                <span>₹100k</span>
                <span>₹80k</span>
                <span>₹60k</span>
                <span>₹40k</span>
                <span>₹20k</span>
                <span>₹0k</span>
              </div>
              
              {/* Chart Area */}
              <div style={{ flex: 1, position: 'relative', borderBottom: '1px solid #cbd5e1' }}>
                {/* Grid Lines */}
                {[0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5].map((pos, i) => (
                  <div key={i} style={{ position: 'absolute', top: `${pos}%`, left: 0, right: 0, borderTop: '1px solid #f1f5f9' }}></div>
                ))}
                
                {/* Bars Container */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', padding: '0 0.5rem' }}>
                  {/* Empty state check */}
                  {!(summary as any).chartData || (summary as any).chartData.length === 0 ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>
                      {t('dashboard.noDataAvailable')}
                    </div>
                  ) : (
                    (summary as any).chartData.map((data: any, index: number) => (
                      <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '0.5rem', height: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.25rem', flex: 1, width: '100%', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                          <div style={{ width: '35%', backgroundColor: '#166534', height: `${(data.collection / 160) * 100}%`, borderRadius: '4px 4px 0 0', minWidth: '16px', maxWidth: '32px' }}></div>
                          <div style={{ width: '35%', backgroundColor: '#8b5cf6', height: `${(data.loan / 160) * 100}%`, borderRadius: '4px 4px 0 0', minWidth: '16px', maxWidth: '32px' }}></div>
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.5rem', position: 'absolute', bottom: '-24px' }}>
                          {data.month}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div style={{ height: '24px' }}></div> {/* Spacer for X-axis labels */}
          </div>

          {/* Pending Items & Dues Card */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header */}
            <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>{t('dashboard.pendingItemsTitle')}</h2>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{t('dashboard.pendingItemsDesc')}</p>
                </div>
                <div style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {activeTab === 'seettu' ? collectionMetrics.pendingCollectionsCount || 0 : loanMetrics.activeLoans || 0} {t('dashboard.actionRequired')}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                <div 
                  onClick={() => setActiveTab('seettu')}
                  style={{ padding: '0.75rem 1.5rem', color: activeTab === 'seettu' ? '#115e59' : '#64748b', fontWeight: activeTab === 'seettu' ? 700 : 600, fontSize: '0.875rem', borderBottom: activeTab === 'seettu' ? '2px solid #115e59' : 'none', cursor: 'pointer', textAlign: 'center', flex: 1 }}
                >
                  {t('dashboard.tabPendingSeettu')} ({collectionMetrics.pendingCollectionsCount || 0})
                </div>
                <div 
                  onClick={() => setActiveTab('loans')}
                  style={{ padding: '0.75rem 1.5rem', color: activeTab === 'loans' ? '#115e59' : '#64748b', fontWeight: activeTab === 'loans' ? 700 : 600, fontSize: '0.875rem', borderBottom: activeTab === 'loans' ? '2px solid #115e59' : 'none', cursor: 'pointer', textAlign: 'center', flex: 1 }}
                >
                  {t('dashboard.tabActiveLoans')} ({loanMetrics.activeLoans || 0})
                </div>
              </div>
            </div>

            {/* List */}
            <div style={{ padding: '0 1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {activeTab === 'seettu' ? (
                !(summary as any).pendingMembers || (summary as any).pendingMembers.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600, minHeight: '150px' }}>
                    {t('dashboard.noPendingCollections')}
                  </div>
                ) : (
                  (summary as any).pendingMembers.map((member: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0', borderBottom: i < ((summary as any).pendingMembers.length - 1) ? '1px solid #f1f5f9' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ backgroundColor: '#fef3c7', color: '#d97706', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                          {member.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{member.name}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{member.sub}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleActionClick(`/collections/new?memberId=${member.id}`)}
                        style={{ backgroundColor: '#ffffff', color: '#115e59', border: '1px solid #115e59', padding: '0.4rem 1rem', borderRadius: '0.35rem', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Collect
                      </button>
                    </div>
                  ))
                )
              ) : (
                !(summary as any).activeLoanMembers || (summary as any).activeLoanMembers.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600, minHeight: '150px' }}>
                    {t('dashboard.noActiveLoans')}
                  </div>
                ) : (
                  (summary as any).activeLoanMembers.map((member: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0', borderBottom: i < ((summary as any).activeLoanMembers.length - 1) ? '1px solid #f1f5f9' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ backgroundColor: '#fef3c7', color: '#d97706', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                          {member.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{member.name}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{member.sub}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleActionClick(`/repayments/new?memberId=${member.id}`)}
                        style={{ backgroundColor: '#ffffff', color: '#115e59', border: '1px solid #115e59', padding: '0.4rem 1rem', borderRadius: '0.35rem', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Recover
                      </button>
                    </div>
                  ))
                )
              )}
            </div>

            {/* Footer */}
            {((summary as any).pendingMembers?.length || 0) > 0 && (
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ color: '#115e59', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => handleActionClick('/collections')}>
                  View all {collectionMetrics.pendingCollectionsCount} members &rarr;
                </span>
              </div>
            )}

          </div>
        </div>

        {/* Recent Transactions Table */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>{t('dashboard.recentActivityTitle')}</h2>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{t('dashboard.recentActivityDesc')}</p>
            </div>
            <button 
              onClick={() => handleActionClick('/collections')}
              style={{ backgroundColor: '#ffffff', color: '#115e59', border: '1px solid #115e59', padding: '0.5rem 1rem', borderRadius: '0.35rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {t('dashboard.viewDailyLedgerBtn')}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem 0.5rem', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>{t('dashboard.colMemberShop')}</th>
                  <th style={{ padding: '1rem 0.5rem', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>{t('dashboard.colTransactionType')}</th>
                  <th style={{ padding: '1rem 0.5rem', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>{t('dashboard.colAmount')}</th>
                  <th style={{ padding: '1rem 0.5rem', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>{t('dashboard.colDate')}</th>
                  <th style={{ padding: '1rem 0.5rem', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>{t('dashboard.colReferenceNo')}</th>
                  <th style={{ padding: '1rem 0.5rem', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textAlign: 'center' }}>{t('dashboard.colMode')}</th>
                  <th style={{ padding: '1rem 0.5rem', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textAlign: 'center' }}>{t('dashboard.colStatus')}</th>
                  <th style={{ padding: '1rem 0.5rem', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textAlign: 'center' }}>{t('dashboard.colReceipt')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                      {t('dashboard.emptyActivityTitle')}
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx: any, idx: number) => {
                    const initials = tx.memberName ? tx.memberName.substring(0, 1).toUpperCase() : 'S';
                    const amountStr = (tx.direction === 'CREDIT' ? '+' : '-') + formatRupees(tx.amountPaise);
                    
                    let txType = tx.transactionType;
                    if (txType === 'COLLECTION') txType = t('dashboard.transactionTypeCollection');
                    else if (txType === 'LOAN_DISBURSEMENT') txType = t('dashboard.transactionTypeLoanDisbursement');
                    else if (txType === 'LOAN_REPAYMENT') txType = t('dashboard.transactionTypeLoanRepayment');
                    
                    const dateObj = new Date(tx.transactedAt);
                    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                    
                    return (
                      <tr key={tx.id} style={{ borderBottom: idx < transactions.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '1rem 0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ backgroundColor: '#ecfdf5', color: '#115e59', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                              {initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{tx.memberName || 'Sangam Member'}</div>
                              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Member</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem 0.5rem' }}>
                          <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, display: 'inline-block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                            {txType}
                          </div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            {tx.transactionType === 'COLLECTION' ? 'Monthly Seettu' : 'Transaction'}
                          </div>
                        </td>
                        <td style={{ padding: '1rem 0.5rem', fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>
                          {amountStr}
                        </td>
                        <td style={{ padding: '1rem 0.5rem', color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>
                          {dateStr}
                        </td>
                        <td style={{ padding: '1rem 0.5rem', color: '#0f172a', fontSize: '0.85rem', fontWeight: 700 }}>
                          {tx.referenceId}
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                          <span style={{ backgroundColor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                            Cash
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                          <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 }}>
                            {tx.transactionType === 'COLLECTION' && tx.amountPaise > 0 ? 'Paid' : t('dashboard.statusCompleted')}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                          <button style={{ backgroundColor: '#ffffff', color: '#64748b', border: '1px solid #e2e8f0', width: '28px', height: '28px', borderRadius: '0.35rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            📄
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button style={{ flex: 1, background: 'var(--color-primary-900)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 600, border: 'none', cursor: 'pointer' }} onClick={() => handleActionClick('/members/new')}>{t('dashboard.btnAddMember')}</button>
          <button style={{ flex: 1, background: 'var(--color-primary-900)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 600, border: 'none', cursor: 'pointer' }} onClick={() => handleActionClick('/collections/new')}>{t('dashboard.btnAddCollection')}</button>
          <button style={{ flex: 1, background: 'var(--color-primary-900)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 600, border: 'none', cursor: 'pointer' }} onClick={() => handleActionClick('/loans/new')}>{t('dashboard.btnAddLoan')}</button>
          <button style={{ flex: 1, background: 'var(--color-primary-900)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 600, border: 'none', cursor: 'pointer' }} onClick={() => handleActionClick('/repayments/new')}>{t('dashboard.btnAddRepayment')}</button>
        </div>

      </div>
    </AppShell>
  );
}
