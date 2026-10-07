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
  const [pastPayModal, setPastPayModal] = useState<{row: any, dateStr: string, d: Date, type: 's' | 'l'} | null>(null);
  const [customSCount, setCustomSCount] = useState(0);
  const [customLCount, setCustomLCount] = useState(0);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    // Default to a week that includes today
    d.setDate(d.getDate() - d.getDay() + 1); // Start of week (Monday)
    return d;
  });
  const [payments, setPayments] = useState<Record<string, Record<string, {s: boolean, l: boolean}>>>({});

  const [arrearsData, setArrearsData] = useState<any>(null);

  // 7 days calculation
  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    const fetchGridData = async () => {
      setLoadingMembers(true);
      try {
        const sDate = days[0].toISOString().slice(0, 10);
        const eDate = days[6].toISOString().slice(0, 10);
        const res = await apiRequest<{ data: any }>(`/daily-sheets/grid?startDate=${sDate}&endDate=${eDate}`);
        
        const { members, loans, dailySheets, repayments } = res.data;
        
        const newPayments: any = {};
        
        const formattedData = members.map((m: any) => {
           const memberLoan = loans.find((l: any) => l.member_id === m.id);
           const hasLoan = !!memberLoan;
           const dailyAmt = (m.number_of_sheets || 1) * 200 * 100;
           
           newPayments[m.member_number] = {};
           
           return {
             id: m.member_number,
             memberId: m.id,
             name: m.member_name,
             phone: m.mobile_number || 'N/A',
             shop: m.shop_name,
             category: 'General',
             daily: dailyAmt,
             hasLoan,
             loanId: memberLoan?.loan_id,
             loan: hasLoan ? 1000 * 100 : 0,
             totalDue: dailyAmt,
             status: 'OVERDUE / PENDING'
           };
        });
        
        // Populate payments map
        dailySheets.forEach((ds: any) => {
           const member = formattedData.find((f: any) => f.memberId === ds.member_id);
           if (member) {
             const date = ds.business_date.slice(0, 10);
             if (!newPayments[member.id][date]) newPayments[member.id][date] = { s: false, l: false };
             if (ds.actual_paid_paise > 0) {
               newPayments[member.id][date].s = true;
               newPayments[member.id][date].sDate = date;
             }
           }
        });
        repayments.forEach((rp: any) => {
           const member = formattedData.find((f: any) => f.memberId === rp.member_id);
           if (member) {
             const date = rp.business_date.slice(0, 10);
             if (!newPayments[member.id][date]) newPayments[member.id][date] = { s: false, l: false };
             if (rp.amount_paise > 0) {
               newPayments[member.id][date].l = true;
               newPayments[member.id][date].lDate = date;
             }
           }
        });
        
        setMembersList(formattedData);
        setPayments(newPayments);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMembers(false);
      }
    };
    fetchGridData();
  }, [currentDate]);

  useEffect(() => {
    if (customPayModal) {
      setCustomSCount(1);
      setCustomLCount(customPayModal.hasLoan ? 1 : 0);
      setArrearsData(null);
      apiRequest<{ data: any }>(`/daily-sheets/arrears/${customPayModal.memberId}`)
        .then(res => setArrearsData(res.data))
        .catch(err => console.error("Failed to fetch arrears", err));
    }
  }, [customPayModal]);
  
  if (authLoading || dashboardLoading || loadingMembers) return <LoadingState label="Loading..." fullscreen />;
  if (!user || !summary) return null;

  const actualTodayStr = new Date().toISOString().slice(0, 10);

  // Override metrics for testing
  const activeMembersCount = membersList.length;
  let expectedTodayAmountPaise = 0;
  let todayCollectionAmountPaise = 0;
  let todayCollectionCount = 0;

  membersList.forEach(m => {
     expectedTodayAmountPaise += m.daily;
     if (m.hasLoan) expectedTodayAmountPaise += m.loan;
     
     const p = payments[m.id]?.[actualTodayStr];
     if (p?.s || p?.l) {
        if (p.s) todayCollectionAmountPaise += m.daily;
        if (p.l) todayCollectionAmountPaise += m.loan;
        todayCollectionCount++;
     }
  });

  const coreMetrics = { activeMembers: activeMembersCount };
  const collectionMetrics = {
     expectedTodayAmountPaise,
     todayCollectionAmountPaise,
     todayCollectionCount,
     pendingCollectionsCount: activeMembersCount - todayCollectionCount
  };

  const nextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };
  
  const prevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    setCurrentDate(prev);
  };

  const handlePay = async (rowId: string, dateStr: string, s: boolean, l: boolean) => {
    const row = membersList.find(r => r.id === rowId);
    if (!row) return;

    try {
      await apiRequest('/daily-sheets/record-payment', {
        method: 'POST',
        body: {
          memberId: row.memberId,
          businessDate: dateStr,
          savingsAmountPaise: s ? row.daily : 0,
          loanAmountPaise: l ? row.loan : 0,
          loanId: row.loanId
        }
      });
      
      setPayments(prev => ({
        ...prev,
        [rowId]: {
          ...(prev[rowId] || {}),
          [dateStr]: { 
             s: s || prev[rowId]?.[dateStr]?.s || false, 
             sDate: s ? new Date().toISOString().slice(0,10) : prev[rowId]?.[dateStr]?.sDate,
             l: l || prev[rowId]?.[dateStr]?.l || false,
             lDate: l ? new Date().toISOString().slice(0,10) : prev[rowId]?.[dateStr]?.lDate
          }
        }
      }));
      notification.success('Payment recorded successfully in database');
    } catch (e: any) {
      notification.error(e.message || 'Failed to record payment');
    }
  };

  const handleBoxClick = (e: React.MouseEvent, clickedDate: Date, row: any, type: 's' | 'l') => {
    e.preventDefault();
    const mockToday = new Date();
    mockToday.setHours(0,0,0,0);
    const clickD = new Date(clickedDate);
    clickD.setHours(0,0,0,0);

    if (clickD > mockToday) {
      notification.error(`Today is ${mockToday.getDate()}th, why are you selecting ${clickD.getDate()}th? It won't work.`);
    } else {
      const dateStr = clickedDate.toISOString().slice(0, 10);
      const dayPayments = payments[row.id]?.[dateStr] || { s: false, l: false };
      const isPast = clickD < mockToday;
      const isChecked = type === 's' ? dayPayments.s : dayPayments.l;

      if (isPast && isChecked) {
         notification.info("This past payment has already been recorded and cannot be changed.");
         return;
      }

      if (isPast && !isChecked) {
         setPastPayModal({ row, dateStr, d: clickedDate, type });
         return;
      }
      
      const actualTodayStr = new Date().toISOString().slice(0, 10);
      setPayments(prev => ({
        ...prev,
        [row.id]: {
          ...(prev[row.id] || {}),
          [dateStr]: { 
             ...dayPayments,
             [type]: !isChecked,
             [`${type}Date`]: !isChecked ? actualTodayStr : undefined
          }
        }
      }));
    }
  };

  const tableData = membersList;

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const customTotal = ((customSCount ? customSCount * customPayModal?.daily : 0) + (customLCount ? customLCount * customPayModal?.loan : 0)) / 100;

  return (
    <AppShell>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-espresso-900)', margin: '0 0 0.5rem 0' }}>{t('dailySheets.title')}</h1>
            <p style={{ margin: 0, color: 'var(--color-espresso-500)', fontSize: '0.875rem' }}>{t('dailySheets.subtitlePrefix')} <strong>{actualTodayStr}</strong>{t('dailySheets.subtitleSuffix')}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Top search & filter matching image */}
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <svg style={{ position: 'absolute', left: '0.75rem', top: '0.625rem', width: '16px', height: '16px', color: '#6366f1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="text" placeholder="Search member name, shop, or ID..." style={{ padding: '0.5rem 1rem 0.5rem 2.5rem', width: '100%', border: '1px solid #e2e8f0', borderRadius: '0.375rem', outline: 'none' }} />
            </div>
            <input 
              type="date" 
              value={currentDate.toISOString().slice(0, 10)}
              onChange={(e) => {
                if (e.target.value) {
                  setCurrentDate(new Date(e.target.value));
                }
              }} 
              style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', background: '#fff', outline: 'none', color: 'var(--color-espresso-900)', fontWeight: 600 }} 
            />
            <select style={{ padding: '0.5rem 2rem 0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', background: '#fff' }}>
              <option>All Categories</option>
            </select>
            <div style={{ color: 'var(--color-espresso-500)', fontSize: '0.875rem' }}>Showing {tableData.length} members</div>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#f8fafc', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ background: '#dbeafe', color: '#2563eb', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-espresso-500)', letterSpacing: '0.05em' }}>ACTIVE MEMBERS</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-espresso-900)', marginBottom: '0.75rem' }}>{coreMetrics.activeMembers}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-espresso-400)', marginTop: '0.5rem' }}>0 in advance coverage</div>
          </div>
          <div style={{ background: '#f0fdf4', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #bbf7d0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', letterSpacing: '0.05em' }}>EXPECTED DUES</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#14532d', marginBottom: '0.75rem' }}>{formatRupees(collectionMetrics.expectedTodayAmountPaise)}</div>
            <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.5rem' }}>{coreMetrics.activeMembers} members due today</div>
          </div>
          <div style={{ background: '#f5f3ff', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #ddd6fe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', letterSpacing: '0.05em' }}>COLLECTED TODAY</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4c1d95', marginBottom: '0.75rem' }}>{formatRupees(collectionMetrics.todayCollectionAmountPaise)}</div>
            <div style={{ fontSize: '0.75rem', color: '#7c3aed', marginTop: '0.5rem' }}>{collectionMetrics.todayCollectionCount} Paid • {collectionMetrics.pendingCollectionsCount} Pending</div>
          </div>
          <div style={{ background: '#fffbeb', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #fde68a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ background: '#fef3c7', color: '#d97706', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', letterSpacing: '0.05em' }}>PENDING TODAY</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#92400e', marginBottom: '0.75rem' }}>{formatRupees(collectionMetrics.expectedTodayAmountPaise - collectionMetrics.todayCollectionAmountPaise)}</div>
            <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '0.5rem' }}>{collectionMetrics.pendingCollectionsCount} Not Paid • 0 Overdue</div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', fontSize: '0.875rem', gap: '1.5rem', overflowX: 'auto', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-espresso-900)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>DAILY COLLECTION STATUS BREAKDOWN</div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>Expected: {formatRupees(collectionMetrics.expectedTodayAmountPaise)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#2563eb' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb' }}></span> Paid: {formatRupees(collectionMetrics.todayCollectionAmountPaise)} ({collectionMetrics.todayCollectionCount})</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#16a34a' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }}></span> Advance Paid: ₹0 (0)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span> Not Paid / Overdue: {formatRupees(collectionMetrics.expectedTodayAmountPaise - collectionMetrics.todayCollectionAmountPaise)} ({collectionMetrics.pendingCollectionsCount})</span>
          </div>
        </div>

        {/* 7 Days Navigator Row */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', overflowX: 'auto' }}>
          <button onClick={prevDay} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.375rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </button>
          <div style={{ background: '#16a34a', color: '#fff', borderRadius: '0.375rem', padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, minWidth: '160px', justifyContent: 'center' }}>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
            {monthName}
          </div>
          {days.map((d, i) => {
             const isToday = d.toISOString().slice(0, 10) === actualTodayStr;
             return (
             <div key={i} style={{ flex: 1, background: isToday ? '#f0fdf4' : '#fff', border: isToday ? '1px solid #16a34a' : '1px solid #e2e8f0', borderRadius: '0.375rem', padding: '0.5rem 0', textAlign: 'center', minWidth: '80px' }}>
               <div style={{ fontSize: '0.875rem', fontWeight: 700, color: isToday ? '#16a34a' : 'var(--color-espresso-900)' }}>{d.getDate()}/{d.getMonth() + 1}</div>
               <div style={{ fontSize: '0.75rem', color: isToday ? '#16a34a' : 'var(--color-espresso-500)' }}>{d.toLocaleDateString('en-US', {weekday: 'short'})}</div>
             </div>
             );
          })}
          <button onClick={nextDay} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.375rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
          </button>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: 'var(--color-espresso-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                <th style={{ padding: '0.75rem 0.5rem', borderRight: '1px solid #e2e8f0' }} rowSpan={2}>S.NO</th>
                <th style={{ padding: '0.75rem 0.5rem', borderRight: '1px solid #e2e8f0' }} rowSpan={2}>MEMBER ID</th>
                <th style={{ padding: '0.75rem 0.5rem', borderRight: '1px solid #e2e8f0' }} rowSpan={2}>MEMBER NAME</th>
                <th style={{ padding: '0.75rem 0.5rem', borderRight: '1px solid #e2e8f0' }} rowSpan={2}>SHOP NAME</th>
                <th style={{ padding: '0.75rem 0.5rem', borderRight: '1px solid #e2e8f0', textAlign: 'center' }} rowSpan={2}>SAVINGS / LOAN (₹)</th>
                {days.map((d, i) => (
                  <th key={i} style={{ padding: '0.5rem 0.25rem', textAlign: 'center', borderRight: '1px solid #e2e8f0', minWidth: '40px' }}>
                    {d.getDate()}/{d.getMonth() + 1}<br/>
                    <span style={{fontWeight: 400, textTransform: 'capitalize'}}>{d.toLocaleDateString('en-US', {weekday: 'short'})}</span>
                  </th>
                ))}
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }} rowSpan={2}>ACTION</th>
              </tr>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: 'var(--color-espresso-600)', fontWeight: 600, fontSize: '0.75rem' }}>
                {days.map((d, i) => (
                   <th key={i} style={{ padding: '0.25rem 0', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%' }}>
                       <span style={{flex: 1, textAlign: 'center'}}>S</span>
                       <span style={{flex: 1, textAlign: 'center'}}>L</span>
                     </div>
                   </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-espresso-900)' }}>No Data Available</div>
                  </td>
                </tr>
              ) : (
                tableData.map((row, i) => {
                  const todayDateStr = new Date().toISOString().slice(0,10);
                  const rowPayments = payments[row.id]?.[todayDateStr] || { s: false, l: false };
                  const isFullyPaid = rowPayments.s && (!row.hasLoan || rowPayments.l);

                  return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500, borderRight: '1px solid #e2e8f0' }}>{i + 1}</td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#16a34a', borderRight: '1px solid #e2e8f0' }}>{row.id}</td>
                    <td style={{ padding: '0.75rem 0.5rem', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-espresso-900)' }}>{row.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#8b5cf6', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                        {row.phone}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-espresso-900)' }}>{row.shop}</div>
                      <div style={{ color: '#16a34a', fontSize: '0.75rem', marginTop: '0.25rem' }}>{row.category}</div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                      {row.hasLoan ? (
                        <>
                          <div style={{ color: '#1e3a8a', background: '#eff6ff', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block', marginBottom: '0.25rem' }}>S/Rs {row.daily / 100}</div>
                          <br/>
                          <div style={{ color: '#991b1b', background: '#fef2f2', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block' }}>L/Rs {row.loan / 100}</div>
                        </>
                      ) : (
                        <div style={{ color: 'var(--color-espresso-900)' }}>S/Rs {row.daily / 100}</div>
                      )}
                    </td>
                    {days.map((d, dayIndex) => {
                       const dateStr = d.toISOString().slice(0,10);
                       const dayPayments = payments[row.id]?.[dateStr] || { s: false, l: false };
                       const isPast = d < new Date(new Date().setHours(0,0,0,0));
                       const isFuture = d > new Date(new Date().setHours(0,0,0,0));

                       const renderCheckbox = (checked: boolean, type: 's' | 'l') => {
                         const paidDateStr = type === 's' ? dayPayments.sDate : dayPayments.lDate;
                         const isLate = paidDateStr && paidDateStr > dateStr;
                         const isAdvance = paidDateStr && paidDateStr < dateStr;

                         let bgColor = '#fff';
                         let borderColor = '#cbd5e1';
                         let content = null;
                         let title = '';

                         if (checked) {
                            if (isLate) {
                               bgColor = '#ef4444'; // Red for late payment
                               borderColor = 'transparent';
                               title = `Paid late on ${new Date(paidDateStr).toLocaleDateString()}`;
                               content = <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>;
                            } else if (isAdvance) {
                               bgColor = '#16a34a'; // Green for advance payment
                               borderColor = 'transparent';
                               title = `Advance paid on ${new Date(paidDateStr).toLocaleDateString()}`;
                               content = <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>;
                            } else {
                               bgColor = '#2563eb'; // Blue for normal payment (paid on the same day)
                               borderColor = 'transparent';
                               title = `Paid on ${new Date(paidDateStr || dateStr).toLocaleDateString()}`;
                               content = <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>;
                            }
                         } else {
                            if (isPast) {
                               bgColor = '#fef2f2'; // Light red background
                               borderColor = '#ef4444'; // Red border
                               title = 'Unpaid (Overdue)';
                               content = <svg width="10" height="10" fill="none" stroke="#ef4444" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>;
                            } else {
                               // Empty white box for today/future
                            }
                         }

                         return (
                           <div title={title} style={{
                             width: '18px', height: '18px', borderRadius: '3px',
                             background: bgColor, border: `1px solid ${borderColor}`,
                             display: 'flex', alignItems: 'center', justifyContent: 'center',
                             cursor: 'pointer'
                           }} onClick={(e) => handleBoxClick(e, d, row, type)}>
                             {content}
                           </div>
                         );
                       };

                       return (
                         <td key={dayIndex} style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', width: '100%', height: '100%' }}>
                             <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                               {renderCheckbox(dayPayments.s, 's')}
                             </div>
                             {row.hasLoan ? (
                               <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                 {renderCheckbox(dayPayments.l, 'l')}
                               </div>
                             ) : (
                               <div style={{ flex: 1 }}></div>
                             )}
                           </div>
                         </td>
                       );
                    })}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                        {isFullyPaid ? (
                           <button style={{ background: '#f1f5f9', color: '#94a3b8', border: '1px solid #cbd5e1', padding: '0.375rem 0.75rem', borderRadius: '0.25rem', fontWeight: 600, fontSize: '0.75rem', cursor: 'not-allowed', minWidth: '80px', whiteSpace: 'nowrap' }} disabled>
                             Paid
                           </button>
                        ) : (
                           <button style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.375rem 0.75rem', borderRadius: '0.25rem', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', minWidth: '80px', whiteSpace: 'nowrap' }} onClick={() => handlePay(row.id, todayDateStr, true, row.hasLoan)}>
                             Pay (₹{(row.daily + row.loan) / 100})
                           </button>
                        )}
                        <button style={{ background: '#fff', color: 'var(--color-espresso-600)', border: '1px solid var(--color-espresso-200)', padding: '0.375rem 0.75rem', borderRadius: '0.25rem', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', minWidth: '80px', whiteSpace: 'nowrap' }} onClick={() => setCustomPayModal(row)}>
                          Custom Amount
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-espresso-600)', flexWrap: 'wrap', gap: '1rem' }}>
           <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2563eb' }}></span> Paid</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#16a34a' }}></span> Advance Paid</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></span> Not Paid / Overdue</span>
           </div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#16a34a' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Payment status updates in real-time
           </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(customPayModal)}
        onClose={() => setCustomPayModal(null)}
        title={`Custom Payment for ${customPayModal?.name}`}
        description="Select the amounts you are paying today. The system will automatically clear all old dues first."
        confirmLabel={`Pay ₹${customTotal}`}
        cancelLabel="Cancel"
        onConfirm={async () => {
          if (customSCount === 0 && customLCount === 0) {
            notification.error("Please select an amount to pay.");
            return;
          }
          
          if (!arrearsData) {
            notification.error("Arrears data is still loading. Please try again in a moment.");
            return;
          }

          const actualTodayStr = new Date().toISOString().slice(0,10);
          const actualToday = new Date(actualTodayStr);
          
          // Calculate dates to apply savings
          const sDatesToApply = [];
          const missingS = arrearsData.savings.missedDates || [];
          
          for (let i = 0; i < customSCount; i++) {
             if (i < missingS.length) {
               sDatesToApply.push(missingS[i]);
             } else {
               const targetD = new Date(actualToday);
               targetD.setDate(actualToday.getDate() + (i - missingS.length));
               sDatesToApply.push(targetD.toISOString().slice(0,10));
             }
          }

          // Calculate dates to apply loans
          const lDatesToApply = [];
          const missingL = arrearsData.loan.missedDates || [];
          
          for (let i = 0; i < customLCount; i++) {
             if (i < missingL.length) {
               lDatesToApply.push(missingL[i]);
             } else {
               const targetD = new Date(actualToday);
               targetD.setDate(actualToday.getDate() + (i - missingL.length));
               lDatesToApply.push(targetD.toISOString().slice(0,10));
             }
          }

          // Combine all unique dates to make API calls
          const uniqueDates = Array.from(new Set([...sDatesToApply, ...lDatesToApply]));
          
          try {
            await Promise.all(uniqueDates.map(dateStr => {
              const applyS = sDatesToApply.includes(dateStr);
              const applyL = lDatesToApply.includes(dateStr);
              return apiRequest('/daily-sheets/record-payment', {
                method: 'POST',
                body: {
                  memberId: customPayModal.memberId,
                  businessDate: dateStr,
                  savingsAmountPaise: applyS ? customPayModal.daily : 0,
                  loanAmountPaise: applyL ? customPayModal.loan : 0,
                  loanId: customPayModal.loanId
                }
              });
            }));
            
            // Update local state
            setPayments(prev => {
               const newPrev = { ...prev };
               if (!newPrev[customPayModal.id]) newPrev[customPayModal.id] = {};
               
               sDatesToApply.forEach(dateStr => {
                  newPrev[customPayModal.id][dateStr] = {
                     ...(newPrev[customPayModal.id][dateStr] || { s: false, l: false }),
                     s: true,
                     sDate: actualTodayStr
                  };
               });
               lDatesToApply.forEach(dateStr => {
                  newPrev[customPayModal.id][dateStr] = {
                     ...(newPrev[customPayModal.id][dateStr] || { s: false, l: false }),
                     l: true,
                     lDate: actualTodayStr
                  };
               });
               
               return newPrev;
            });
            
            notification.success("Custom payments recorded successfully");
            setCustomPayModal(null);
          } catch (e: any) {
            notification.error(e.message || 'Failed to record custom payments');
          }
        }}
      >
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {(() => {
             if (!arrearsData) return <div style={{ color: 'var(--color-espresso-500)', fontSize: '0.875rem' }}>Loading arrears...</div>;
             
             const missingSCount = arrearsData.savings.missedDates.length;
             const missingLCount = arrearsData.loan.missedDates.length;
             const missingSAmount = arrearsData.savings.missedAmountPaise / 100;
             const missingLAmount = arrearsData.loan.missedAmountPaise / 100;
             
             if (missingSCount > 0 || missingLCount > 0) {
               return (
                 <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#991b1b', fontSize: '0.875rem' }}>
                   <div style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1rem' }}>Balance Alert</div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {missingSCount > 0 && <div>• <strong>Savings Balance:</strong> ₹{missingSAmount} (Unpaid for {missingSCount} days)</div>}
                      {missingLCount > 0 && <div>• <strong>Loan Balance:</strong> ₹{missingLAmount} (Unpaid for {missingLCount} days)</div>}
                   </div>
                   <div style={{ marginTop: '0.5rem', fontStyle: 'italic', fontSize: '0.75rem' }}>Adding amounts will automatically clear these old dues first before advancing to current/future dates.</div>
                 </div>
               );
             }
             return null;
          })()}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: customSCount > 0 ? '#f0fdf4' : '#fff' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700, color: 'var(--color-espresso-900)' }}>Savings Amount</span>
              <span style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: 600 }}>₹{(customPayModal?.daily * customSCount) / 100}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.25rem' }}>
               <button onClick={() => setCustomSCount(Math.max(0, customSCount - 1))} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>-</button>
               <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{customSCount}</span>
               <button onClick={() => setCustomSCount(customSCount + 1)} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>+</button>
            </div>
          </div>
          
          {customPayModal?.hasLoan && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: customLCount > 0 ? '#f0fdf4' : '#fff' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-espresso-900)' }}>Loan Repayment</span>
                <span style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: 600 }}>₹{(customPayModal?.loan * customLCount) / 100}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.25rem' }}>
                 <button onClick={() => setCustomLCount(Math.max(0, customLCount - 1))} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>-</button>
                 <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{customLCount}</span>
                 <button onClick={() => setCustomLCount(customLCount + 1)} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>+</button>
              </div>
            </div>
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={Boolean(pastPayModal)}
        onClose={() => setPastPayModal(null)}
        title="Late Payment Warning"
        description={`The original date (${pastPayModal ? new Date(pastPayModal.dateStr).toLocaleDateString() : ''}) is past due. Are you sure you want to mark this as paid today?`}
        confirmLabel="Yes, Mark as Paid"
        cancelLabel="Cancel"
        onConfirm={async () => {
          if (!pastPayModal) return;
          const { row, dateStr, type } = pastPayModal;
          const actualTodayStr = new Date().toISOString().slice(0, 10);
          const dayPayments = payments[row.id]?.[dateStr] || { s: false, l: false };
          
          setPayments(prev => ({
            ...prev,
            [row.id]: {
              ...(prev[row.id] || {}),
              [dateStr]: { 
                 ...dayPayments,
                 [type]: true,
                 [`${type}Date`]: actualTodayStr
              }
            }
          }));
          notification.success("Recorded as paid late.");
          setPastPayModal(null);
        }}
      >
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.5rem', color: '#991b1b', fontSize: '0.875rem' }}>
           This will be recorded with today's date and displayed as a <strong style={{ color: '#ef4444' }}>Red Tick</strong>.
        </div>
      </ConfirmDialog>
    </AppShell>
  );
}
