'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { useNotification } from '@/hooks/useNotification';
import { useTranslation } from '@/hooks/useTranslation';
import { AppShell } from '@/components/layout';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Input, Button } from '@/components/ui';
import { formatRupees } from '@/lib/formatters';
import { apiRequest } from '@/lib/api/client';

export default function DailySheetsPage() {
  const { user, loading: authLoading } = useAuth();
  const { summary, loading: dashboardLoading } = useDashboard();
  const notification = useNotification();
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState<'DUE' | 'ADVANCE'>('DUE');
  const [customPayModal, setCustomPayModal] = useState<any>(null);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    apiRequest<{ data: { members: any[] } }>('/members')
      .then(res => setMembersList(res.data.members || []))
      .catch(e => console.error(e))
      .finally(() => setLoadingMembers(false));
  }, []);
  
  if (authLoading || dashboardLoading || loadingMembers) return <LoadingState label="Loading..." fullscreen />;
  if (!user || !summary) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const { coreMetrics, collectionMetrics } = summary;

  // Map backend members to table format
  const tableData = membersList.map(m => {
    const dailyAmt = (m.numberOfSheets || 1) * 200 * 100;
    return {
      id: m.memberNumber,
      name: m.memberName,
      phone: m.mobileNumber || 'N/A',
      shop: m.shopName,
      category: 'General',
      daily: dailyAmt,
      oldArrears: 0,
      totalDue: dailyAmt,
      paid: 0,
      status: 'OVERDUE / PENDING'
    };
  });

  return (
    <AppShell>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.5rem 0' }}>{t('dailySheets.title')}</h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>{t('dailySheets.subtitlePrefix')} <strong>{todayStr}</strong>{t('dailySheets.subtitleSuffix')}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
              <span style={{ color: '#64748b', marginRight: '0.5rem' }}>{t('dailySheets.date')}</span>
              <span style={{ fontWeight: 600 }}>{todayStr}</span>
              <svg style={{ marginLeft: '0.5rem', width: '16px', height: '16px', color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
            <button style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>{t('dailySheets.goToToday')}</button>
            <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, color: '#16a34a', cursor: 'pointer' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              {t('dailySheets.exportExcel')}
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, color: '#6d28d9', cursor: 'pointer' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              {t('dailySheets.printSheet')}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#fff', borderRadius: '0.5rem', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('dailySheets.activeMembers')}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{coreMetrics.activeMembers}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>0 {t('dailySheets.inAdvanceCoverage')}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: '0.5rem', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('dailySheets.expectedDuesToday')}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{formatRupees(collectionMetrics.expectedTodayAmountPaise)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>{coreMetrics.activeMembers} {t('dailySheets.membersDueToday')}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: '0.5rem', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('dailySheets.collectedToday')}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{formatRupees(collectionMetrics.todayCollectionAmountPaise)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}><span style={{ color: '#16a34a' }}>{collectionMetrics.todayCollectionCount} {t('dailySheets.paid')}</span> • <span style={{ color: '#2563eb' }}>0 {t('dailySheets.advance')}</span></div>
          </div>
          <div style={{ background: '#fff', borderRadius: '0.5rem', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('dailySheets.pendingToday')}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{formatRupees(collectionMetrics.expectedTodayAmountPaise - collectionMetrics.todayCollectionAmountPaise)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}><span style={{ color: '#dc2626' }}>{collectionMetrics.pendingCollectionsCount} Not {t('dailySheets.paid')}</span> • <span style={{ color: '#dc2626' }}>0 {t('dailySheets.overdue')}</span></div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', fontSize: '0.875rem', gap: '1.5rem' }}>
          <div style={{ fontWeight: 700, color: '#475569', letterSpacing: '0.05em' }}>{t('dailySheets.statusBreakdown')}</div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{t('dailySheets.expected')} {formatRupees(collectionMetrics.expectedTodayAmountPaise)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }}></span> {t('dailySheets.paid')}: {formatRupees(collectionMetrics.todayCollectionAmountPaise)} ({collectionMetrics.todayCollectionCount})</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb' }}></span> {t('dailySheets.advance')} {t('dailySheets.paid')}: ₹0 (0)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa' }}></span> {t('dailySheets.advance')} Covered: ₹0 (0)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span> {t('dailySheets.partial')} ₹0 (0)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span> {t('dailySheets.overdue')}: {formatRupees(collectionMetrics.expectedTodayAmountPaise - collectionMetrics.todayCollectionAmountPaise)} ({collectionMetrics.pendingCollectionsCount})</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#991b1b' }}></span> Not {t('dailySheets.paid')}: ₹0 (0)</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <button 
            onClick={() => setActiveTab('DUE')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '2rem', border: 'none', background: activeTab === 'DUE' ? '#16a34a' : '#f1f5f9', color: activeTab === 'DUE' ? '#fff' : '#64748b', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
            {t('dailySheets.todaysCollectionDue')} ({coreMetrics.activeMembers})
          </button>
          <button 
            onClick={() => setActiveTab('ADVANCE')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '2rem', border: '1px solid #3b82f6', background: activeTab === 'ADVANCE' ? '#eff6ff' : 'transparent', color: '#3b82f6', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#3b82f6' }}></div>
            {t('dailySheets.advance')} Covered (0)
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: '#fff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '0.75rem', top: '0.625rem', width: '16px', height: '16px', color: '#6366f1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="text" placeholder={t('dailySheets.searchPlaceholder')} style={{ padding: '0.5rem 1rem 0.5rem 2.5rem', width: '300px', border: '1px solid #e2e8f0', borderRadius: '0.375rem', outline: 'none' }} />
            </div>
            <select style={{ padding: '0.5rem 2rem 0.5rem 2.5rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', appearance: 'none', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E") no-repeat right 0.75rem center/16px' }}>
              <option>{t('dailySheets.todaysDue')} ({coreMetrics.activeMembers})</option>
            </select>
            <select style={{ padding: '0.5rem 2rem 0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', appearance: 'none', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E") no-repeat right 0.75rem center/16px' }}>
              <option>{t('dailySheets.allCategories')}</option>
            </select>
          </div>
          <div style={{ color: '#64748b', fontSize: '0.875rem' }}>{t('dailySheets.showing')} {coreMetrics.activeMembers} {t('dailySheets.merchants')}</div>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>
                <th style={{ padding: '1rem' }}>{t('dailySheets.colSno')}</th>
                <th style={{ padding: '1rem' }}>{t('dailySheets.colMemberId')}</th>
                <th style={{ padding: '1rem' }}>{t('dailySheets.colMemberName')}</th>
                <th style={{ padding: '1rem' }}>{t('dailySheets.colShopName')}</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>{t('dailySheets.colDailyAmount')}</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>{t('dailySheets.colOldArrears')}</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>{t('dailySheets.colTotalDue')}</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>{t('dailySheets.colActualPaid')}</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>{t('dailySheets.colStatus')}</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>{t('dailySheets.colPaymentTime')}</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>{t('dailySheets.colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <svg style={{ width: '48px', height: '48px', margin: '0 auto 1rem', color: '#cbd5e1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#334155' }}>{t('dailySheets.noDataAvailable')}</div>
                    <div style={{ marginTop: '0.25rem' }}>{t('dailySheets.noMembersScheduled')}</div>
                  </td>
                </tr>
              ) : (
                tableData.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff5f5' }}>
                    <td style={{ padding: '1rem', borderLeft: '4px solid #ef4444', fontWeight: 500 }}>{i + 1}</td>
                    <td style={{ padding: '1rem', fontWeight: 700 }}>{row.id}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#db2777', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                        {row.phone}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.shop}</div>
                      <div style={{ color: '#16a34a', fontSize: '0.75rem', marginTop: '0.25rem' }}>{row.category}</div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                      <span style={{ textDecoration: 'line-through', color: '#94a3b8', marginRight: '0.25rem' }}>{formatRupees(row.daily)}</span>
                      <br/>
                      {formatRupees(row.daily)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#b91c1c' }}>{formatRupees(row.oldArrears)}</div>
                      <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>{t('dailySheets.overdue')}</div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: '#b91c1c' }}>{formatRupees(row.totalDue)}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatRupees(row.paid)}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ background: '#fecaca', color: '#991b1b', padding: '0.25rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626' }}></div>
                        OVERDUE / PENDING
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>-</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                        <button style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.375rem 0.75rem', borderRadius: '0.25rem', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', minWidth: '110px', justifyContent: 'center' }} onClick={() => notification.success(`${t('dailySheets.paid')} successfully`)}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          {t('dailySheets.paid')} ({formatRupees(row.totalDue)})
                        </button>
                        <button style={{ background: '#fff', color: '#16a34a', border: '1px solid #16a34a', padding: '0.375rem 0.75rem', borderRadius: '0.25rem', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', minWidth: '110px' }} onClick={() => setCustomPayModal(row)}>
                          Custom Amount
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(customPayModal)}
        onClose={() => setCustomPayModal(null)}
        title={`Custom Payment for ${customPayModal?.name}`}
        description={`Total due is ₹${customPayModal?.totalDue}`}
        confirmLabel="Submit Payment"
        cancelLabel="Cancel"
        onConfirm={async () => {
          notification.success('Custom payment successful!');
          setCustomPayModal(null);
        }}
      >
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input label="{t('dailySheets.advance')} {t('dailySheets.paid')} Until Date (Optional)" type="date" />
          <Input label="Total Amount Received (₹)" type="number" placeholder={`e.g. ${customPayModal?.totalDue}`} />
          <Input label="Loan Repayment Amount (₹)" type="number" placeholder="Enter loan amount if paying" />
        </div>
      </ConfirmDialog>
    </AppShell>
  );
}
