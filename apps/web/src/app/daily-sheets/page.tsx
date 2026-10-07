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

const getLocalISODate = (d: Date) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};

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
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    const dom = d.getDate();
    const chunkStart = Math.floor((dom - 1) / 7) * 7 + 1;
    d.setDate(chunkStart);
    return d;
  });
  const [payments, setPayments] = useState<Record<string, Record<string, {s: boolean, l: boolean, sDate?: string, lDate?: string}>>>({});

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
        const s = new Date(days[0]);
        s.setDate(s.getDate() - 30);
        const sDate = s.toISOString().slice(0, 10);
        const eDate = getLocalISODate(days[6]);
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
      setCustomSCount(0);
      setCustomLCount(0);
    }
  }, [customPayModal]);
  
  if (authLoading || dashboardLoading) return <LoadingState label="Loading..." fullscreen />;
  if (!user || !summary) return null;

  const actualTodayStr = getLocalISODate(new Date());

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

  const nextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    if (next.getMonth() !== currentDate.getMonth()) {
        next.setDate(1);
    }
    setCurrentDate(next);
  };
  
  const prevWeek = () => {
    const prev = new Date(currentDate);
    if (currentDate.getDate() === 1) {
       prev.setDate(0); // Last day of prev month
       const lastDay = prev.getDate();
       const chunkStart = Math.floor((lastDay - 1) / 7) * 7 + 1;
       prev.setDate(chunkStart);
    } else {
       prev.setDate(prev.getDate() - 7);
       if (prev.getMonth() !== currentDate.getMonth()) {
           prev.setDate(1);
       }
    }
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
             sDate: s ? getLocalISODate(new Date()) : prev[rowId]?.[dateStr]?.sDate,
             l: l || prev[rowId]?.[dateStr]?.l || false,
             lDate: l ? getLocalISODate(new Date()) : prev[rowId]?.[dateStr]?.lDate
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
      
      // Make actual API call
      apiRequest('/daily-sheets/record-payment', {
        method: 'POST',
        body: {
          memberId: row.memberId,
          businessDate: dateStr,
          savingsAmountPaise: type === 's' ? (!isChecked ? row.daily : 0) : 0,
          loanAmountPaise: type === 'l' ? (!isChecked ? row.loan : 0) : 0,
          loanId: row.loanId
        }
      }).catch(console.error);

      const actualTodayStr = getLocalISODate(new Date());
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

  const tableData = membersList.filter(m => {
    const matchesSearch = !searchTerm || m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.shop.toLowerCase().includes(searchTerm.toLowerCase()) || m.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'All Categories' || m.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const customTotal = ((customSCount ? customSCount * customPayModal?.daily : 0) + (customLCount ? customLCount * customPayModal?.loan : 0)) / 100;

  return (
    <AppShell>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem', width: '100%', boxSizing: 'border-box', overflowX: 'hidden', opacity: loadingMembers ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        
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
              <input type="text" placeholder="Search member name, shop, or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '0.5rem 1rem 0.5rem 2.5rem', width: '100%', border: '1px solid #e2e8f0', borderRadius: '0.375rem', outline: 'none' }} />
            </div>
            <select value={currentDate.getMonth()} onChange={(e) => {
              const newMonthIndex = parseInt(e.target.value, 10);
              const newDate = new Date(2026, newMonthIndex, 1);
              setCurrentDate(newDate);
            }} style={{ padding: '0.5rem 2rem 0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', background: '#fff' }}>
              {Array.from({length: 12}, (_, i) => {
                const d = new Date(2026, i, 1);
                return <option key={i} value={i}>{d.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</option>;
              })}
            </select>
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
          <button onClick={prevWeek} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.375rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </button>
          <div style={{ background: '#16a34a', color: '#fff', borderRadius: '0.375rem', padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, minWidth: '160px', justifyContent: 'center' }}>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
            {monthName}
          </div>
          {days.map((d, i) => {
             const isToday = getLocalISODate(d) === actualTodayStr;
             const isSelected = getLocalISODate(d) === getLocalISODate(selectedDate);
             return (
             <div key={i} onClick={() => setSelectedDate(d)} style={{ cursor: 'pointer', flex: 1, background: isSelected ? '#f0fdf4' : '#fff', border: isSelected ? '2px solid #16a34a' : (isToday ? '1px solid #16a34a' : '1px solid #e2e8f0'), borderRadius: '0.375rem', padding: '0.5rem 0', textAlign: 'center', minWidth: '80px' }}>
               <div style={{ fontSize: '0.875rem', fontWeight: 700, color: isToday ? '#16a34a' : 'var(--color-espresso-900)' }}>{d.getDate()}/{d.getMonth() + 1}</div>
               <div style={{ fontSize: '0.75rem', color: isToday ? '#16a34a' : 'var(--color-espresso-500)' }}>{d.toLocaleDateString('en-US', {weekday: 'short'})}</div>
             </div>
             );
          })}
          <button onClick={nextWeek} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.375rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
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
                {days.map((d, i) => {
                  const isToday = getLocalISODate(d) === actualTodayStr;
                  const isSelected = getLocalISODate(d) === getLocalISODate(selectedDate);
                  const bg = isSelected ? '#dcfce7' : (isToday ? '#f0fdf4' : 'transparent');
                  const color = isToday ? '#16a34a' : 'inherit';
                  return (
                  <th key={i} style={{ padding: '0.5rem 0.25rem', textAlign: 'center', borderRight: '1px solid #e2e8f0', minWidth: '40px', background: bg, color: color, fontWeight: isToday ? 800 : 600 }}>
                    {d.getDate()}/{d.getMonth() + 1}<br/>
                    <span style={{fontWeight: isToday ? 700 : 400, textTransform: 'capitalize'}}>{d.toLocaleDateString('en-US', {weekday: 'short'})}</span>
                  </th>
                  );
                })}
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }} rowSpan={2}>ACTION</th>
              </tr>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: 'var(--color-espresso-600)', fontWeight: 600, fontSize: '0.75rem' }}>
                {days.map((d, i) => {
                   const isToday = getLocalISODate(d) === actualTodayStr;
                   const isSelected = getLocalISODate(d) === getLocalISODate(selectedDate);
                   const bg = isSelected ? '#dcfce7' : (isToday ? '#f0fdf4' : 'transparent');
                   const color = isToday ? '#16a34a' : 'inherit';
                   return (
                   <th key={i} style={{ padding: '0.25rem 0', textAlign: 'center', borderRight: '1px solid #e2e8f0', background: bg, color: color, fontWeight: isToday ? 800 : 600 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%' }}>
                       <span style={{flex: 1, textAlign: 'center'}}>S</span>
                       <span style={{flex: 1, textAlign: 'center'}}>L</span>
                     </div>
                   </th>
                   );
                })}
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
                  const todayDateStr = getLocalISODate(new Date());
                  const selectedDateStr = getLocalISODate(selectedDate);
                  const rowPayments = payments[row.id]?.[selectedDateStr] || { s: false, l: false };
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
                       const dateStr = getLocalISODate(d);
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

                       const isSelected = dateStr === getLocalISODate(selectedDate);
                       const isToday = dateStr === actualTodayStr;
                       const bg = isSelected ? '#dcfce7' : (isToday ? '#f0fdf4' : 'transparent');
                       const shadow = isSelected ? 'inset 0 0 8px rgba(22, 163, 74, 0.2)' : 'none';
                       return (
                         <td key={dayIndex} style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', background: bg, boxShadow: shadow }}>
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
                           <button style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.375rem 0.75rem', borderRadius: '0.25rem', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', minWidth: '80px', whiteSpace: 'nowrap' }} onClick={() => handlePay(row.id, selectedDateStr, true, row.hasLoan)}>
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
        description="Select the amounts you are paying. Arrears will be cleared first."
        confirmLabel={`Pay ₹${customTotal}`}
        cancelLabel="Cancel"
        onConfirm={async () => {
          if (customSCount === 0 && customLCount === 0) {
            notification.error("Please select an amount to pay.");
            return;
          }
          
          const actualTodayStr = getLocalISODate(new Date());
          
          const newPrev = { ...payments };
          if (!newPrev[customPayModal.id]) newPrev[customPayModal.id] = {};
          
          let sRemaining = customSCount;
          let lRemaining = customLCount;
          
          const orderedDates = [...days.map(d => getLocalISODate(d))];
          if (!orderedDates.includes(actualTodayStr)) orderedDates.push(actualTodayStr);
          orderedDates.sort();
          
          let advanceDateS = new Date(actualTodayStr);
          let advanceDateL = new Date(actualTodayStr);
          
          for (const dStr of orderedDates) {
             if (dStr > actualTodayStr) break;
             
             const p = newPrev[customPayModal.id][dStr] || { s: false, l: false };
             if (!p.s && sRemaining > 0) {
                newPrev[customPayModal.id][dStr] = { ...newPrev[customPayModal.id][dStr], s: true, sDate: actualTodayStr };
                sRemaining--;
             }
             if (!p.l && customPayModal.hasLoan && lRemaining > 0) {
                newPrev[customPayModal.id][dStr] = { ...newPrev[customPayModal.id][dStr], l: true, lDate: actualTodayStr };
                lRemaining--;
             }
          }
          
          while(sRemaining > 0) {
             advanceDateS.setDate(advanceDateS.getDate() + 1);
             const advStr = getLocalISODate(advanceDateS);
             if (!newPrev[customPayModal.id][advStr]?.s) {
                newPrev[customPayModal.id][advStr] = { ...(newPrev[customPayModal.id][advStr] || {s:false, l:false}), s: true, sDate: actualTodayStr };
                sRemaining--;
             }
          }
          
          while(lRemaining > 0 && customPayModal.hasLoan) {
             advanceDateL.setDate(advanceDateL.getDate() + 1);
             const advStr = getLocalISODate(advanceDateL);
             if (!newPrev[customPayModal.id][advStr]?.l) {
                newPrev[customPayModal.id][advStr] = { ...(newPrev[customPayModal.id][advStr] || {s:false, l:false}), l: true, lDate: actualTodayStr };
                lRemaining--;
             }
          }
          
          // Perform actual API calls for all custom payments sequentially to persist
          for (const dStr of Object.keys(newPrev[customPayModal.id])) {
             const dayP = newPrev[customPayModal.id][dStr];
             if (dayP.sDate === actualTodayStr || dayP.lDate === actualTodayStr) {
                 await apiRequest('/daily-sheets/record-payment', {
                    method: 'POST',
                    body: {
                       memberId: customPayModal.memberId,
                       businessDate: dStr,
                       savingsAmountPaise: dayP.sDate === actualTodayStr ? customPayModal.daily : 0,
                       loanAmountPaise: dayP.lDate === actualTodayStr ? customPayModal.loan : 0,
                       loanId: customPayModal.loanId
                    }
                 }).catch(console.error);
             }
          }

          setPayments(newPrev);
          
          notification.success("Custom payments recorded successfully");
          setCustomPayModal(null);
        }}
      >
        {(() => {
           const actualTodayStr = getLocalISODate(new Date());
           let sArrearsCount = 0;
           let lArrearsCount = 0;
           let sTodayMissing = false;
           let lTodayMissing = false;
           
           if (customPayModal) {
               const arrearsDays = Array.from({length: 30}, (_, i) => {
                  const d = new Date(actualTodayStr);
                  d.setDate(d.getDate() - 30 + i);
                  return d;
               });
               for (const d of arrearsDays) {
                  const dStr = getLocalISODate(d);
                  if (dStr < actualTodayStr) {
                     if (!payments[customPayModal.id]?.[dStr]?.s) sArrearsCount++;
                     if (customPayModal.hasLoan && !payments[customPayModal.id]?.[dStr]?.l) lArrearsCount++;
                  } else if (dStr === actualTodayStr) {
                     if (!payments[customPayModal.id]?.[dStr]?.s) sTodayMissing = true;
                     if (customPayModal.hasLoan && !payments[customPayModal.id]?.[dStr]?.l) lTodayMissing = true;
                  }
               }
           }
           
           const sArrearsCovered = Math.min(sArrearsCount, customSCount);
           const sTodayCovered = Math.min(sTodayMissing ? 1 : 0, Math.max(0, customSCount - sArrearsCount));
           const sAdvanceCovered = Math.max(0, customSCount - sArrearsCount - (sTodayMissing ? 1 : 0));
           
           const lArrearsCovered = Math.min(lArrearsCount, customLCount);
           const lTodayCovered = Math.min(lTodayMissing ? 1 : 0, Math.max(0, customLCount - lArrearsCount));
           const lAdvanceCovered = Math.max(0, customLCount - lArrearsCount - (lTodayMissing ? 1 : 0));
           
           const sRemArrears = sArrearsCount - sArrearsCovered;
           const lRemArrears = lArrearsCount - lArrearsCovered;

           return (
             <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               
               {/* Savings Breakdown */}
               <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-espresso-900)' }}>Savings Amount</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.25rem' }}>
                       <button onClick={() => setCustomSCount(Math.max(0, customSCount - 1))} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>-</button>
                       <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{customSCount}</span>
                       <button onClick={() => setCustomSCount(customSCount + 1)} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>+</button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                     {sArrearsCount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                           <span style={{ color: '#64748b' }}>Balance Due ({sArrearsCount} days):</span>
                           <span style={{ fontWeight: 600, color: sRemArrears > 0 ? '#ef4444' : '#16a34a' }}>₹{((sRemArrears) * (customPayModal?.daily || 0)) / 100}</span>
                        </div>
                     )}
                     {sTodayMissing && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                           <span style={{ color: '#64748b' }}>Present (Today):</span>
                           <span style={{ fontWeight: 600, color: sTodayCovered === 0 ? '#ef4444' : '#16a34a' }}>₹{((1 - sTodayCovered) * (customPayModal?.daily || 0)) / 100}</span>
                        </div>
                     )}
                     {sAdvanceCovered > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                           <span style={{ color: '#64748b' }}>Advance Paid:</span>
                           <span style={{ fontWeight: 600, color: '#16a34a' }}>+ ₹{(sAdvanceCovered * (customPayModal?.daily || 0)) / 100}</span>
                        </div>
                     )}
                  </div>
               </div>
               
               {/* Loan Breakdown */}
               {customPayModal?.hasLoan && (
                 <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-espresso-900)' }}>Loan Repayment</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.25rem' }}>
                         <button onClick={() => setCustomLCount(Math.max(0, customLCount - 1))} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>-</button>
                         <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{customLCount}</span>
                         <button onClick={() => setCustomLCount(customLCount + 1)} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>+</button>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                       {lArrearsCount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span style={{ color: '#64748b' }}>Balance Due ({lArrearsCount} days):</span>
                             <span style={{ fontWeight: 600, color: lRemArrears > 0 ? '#ef4444' : '#16a34a' }}>₹{((lRemArrears) * (customPayModal?.loan || 0)) / 100}</span>
                          </div>
                       )}
                       {lTodayMissing && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span style={{ color: '#64748b' }}>Present (Today):</span>
                             <span style={{ fontWeight: 600, color: lTodayCovered === 0 ? '#ef4444' : '#16a34a' }}>₹{((1 - lTodayCovered) * (customPayModal?.loan || 0)) / 100}</span>
                          </div>
                       )}
                       {lAdvanceCovered > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span style={{ color: '#64748b' }}>Advance Paid:</span>
                             <span style={{ fontWeight: 600, color: '#16a34a' }}>+ ₹{(lAdvanceCovered * (customPayModal?.loan || 0)) / 100}</span>
                          </div>
                       )}
                    </div>
                 </div>
               )}
             </div>
           );
        })()}
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
          const actualTodayStr = getLocalISODate(new Date());
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
