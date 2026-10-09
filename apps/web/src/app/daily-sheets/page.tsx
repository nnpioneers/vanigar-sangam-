'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  const [detailsModal, setDetailsModal] = useState<{title: string, data: any[], type: 's' | 'l' | 'both'} | null>(null);
  const [quickProfileId, setQuickProfileId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;
  const [whatsappModal, setWhatsappModal] = useState<boolean>(false);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [waSendingStatus, setWaSendingStatus] = useState<Record<string, string>>({});
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
        const currentYear = new Date().getFullYear();
        const sDate = `${currentYear}-01-01`;
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
             joinDate: `${new Date().getFullYear()}-01-01`,
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
               newPayments[member.id][date].sDate = ds.payment_date || date;
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
               newPayments[member.id][date].lDate = rp.payment_date || date;
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
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, currentDate]);

  
  if (authLoading || dashboardLoading) return <LoadingState label="Loading..." fullscreen />;
  if (!user || !summary) return null;

  const actualTodayStr = getLocalISODate(new Date());

  // Override metrics for testing
  const activeMembersCount = membersList.length;
  
  let savingsExpectedTodayPaise = 0;
  let savingsCollectedTodayPaise = 0;
  let savingsCollectedCount = 0;
  let savingsPendingCount = 0;
  
  let loansExpectedTodayPaise = 0;
  let loansCollectedTodayPaise = 0;
  let loansCollectedCount = 0;
  let activeLoansCount = 0;
  
  const savingsDetails: any[] = [];
  const loansDetails: any[] = [];

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const actualTodayObj = new Date();
  const calculationEnd = actualTodayObj < monthEnd ? actualTodayObj : monthEnd;
  const monthDaysStr: string[] = [];
  for (let d = new Date(monthStart); d <= calculationEnd; d.setDate(d.getDate() + 1)) {
     monthDaysStr.push(getLocalISODate(d));
  }

  let savingsExpectedMonthPaise = 0;
  let savingsCollectedMonthPaise = 0;
  let savingsPendingMonthCount = 0;

  let loansExpectedMonthPaise = 0;
  let loansCollectedMonthPaise = 0;
  let loansPendingMonthCount = 0;

  membersList.forEach(m => {
     // Savings
     savingsExpectedTodayPaise += m.daily;
     
     // Loans
     if (m.hasLoan) {
        loansExpectedTodayPaise += m.loan;
        activeLoansCount++;
     }
     
     const selectedDateStr = getLocalISODate(selectedDate);
     const p = payments[m.id]?.[selectedDateStr];
     
     let sPaid = false;
     let lPaid = false;

     if (p?.s) {
        savingsCollectedTodayPaise += m.daily;
        savingsCollectedCount++;
        sPaid = true;
     } else {
        savingsPendingCount++;
     }
     
     if (p?.l && m.hasLoan) {
        loansCollectedTodayPaise += m.loan;
        loansCollectedCount++;
        lPaid = true;
     }
     
     savingsDetails.push({ member: m, amount: m.daily, paid: sPaid });
     if (m.hasLoan) {
        loansDetails.push({ member: m, amount: m.loan, paid: lPaid });
     }

     monthDaysStr.forEach(dStr => {
        if (dStr < m.joinDate) return;
        
        savingsExpectedMonthPaise += m.daily;
        if (m.hasLoan) loansExpectedMonthPaise += m.loan;
        
        const mp = payments[m.id]?.[dStr];
        if (mp?.s) {
           savingsCollectedMonthPaise += m.daily;
        } else {
           savingsPendingMonthCount++;
        }
        
        if (m.hasLoan) {
           if (mp?.l) {
              loansCollectedMonthPaise += m.loan;
           } else {
              loansPendingMonthCount++;
           }
        }
     });
  });

  const coreMetrics = { activeMembers: activeMembersCount };
  const collectionMetrics = {
     expectedTodayAmountPaise: savingsExpectedTodayPaise + loansExpectedTodayPaise,
     todayCollectionAmountPaise: savingsCollectedTodayPaise + loansCollectedTodayPaise,
     todayCollectionCount: savingsCollectedCount, // roughly
     pendingCollectionsCount: activeMembersCount - savingsCollectedCount
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
          savingsAmountPaise: type === 's' ? (!isChecked ? row.daily : 0) : (dayPayments.s ? row.daily : 0),
          loanAmountPaise: type === 'l' ? (!isChecked ? row.loan : 0) : (dayPayments.l ? row.loan : 0),
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
    if (categoryFilter === 'All Categories') return matchesSearch;
    if (categoryFilter === 'Savings Dues Only') return matchesSearch; // Everyone has savings
    if (categoryFilter === 'Loan Dues Only') return matchesSearch && m.hasLoan;
    return matchesSearch && m.category === categoryFilter;
  });
  const totalPages = Math.ceil(tableData.length / itemsPerPage);
  const paginatedData = tableData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  
  const shopCategories = Array.from(new Set(membersList.map(m => m.category || 'General')));

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
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '0.5rem 2rem 0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', background: '#fff' }}>
              <option value="All Categories">All Categories</option>
              <option value="Savings Dues Only">Savings Dues Only</option>
              <option value="Loan Dues Only">Loan Dues Only</option>
              <optgroup label="Shop Category">
                {shopCategories.map(cat => (
                  <option key={cat} value={cat as string}>{cat as string}</option>
                ))}
              </optgroup>
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
          <div 
            style={{ background: '#f0fdf4', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #bbf7d0', cursor: 'pointer', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            onClick={() => setDetailsModal({ title: 'Savings Details', data: savingsDetails, type: 's' })}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>SAVINGS {selectedDate.getDate()} {selectedDate.toLocaleString('en-US', { month: 'short' })} ({selectedDate.toLocaleString('en-US', { weekday: 'short' })})</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#14532d', marginBottom: '0.5rem' }}>{formatRupees(savingsExpectedTodayPaise)}</div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '0.75rem', borderTop: '1px dashed #bbf7d0', paddingTop: '0.5rem' }}>
              <div style={{ color: '#15803d' }}>
                <div style={{ fontWeight: 700 }}>Collected</div>
                <div>{formatRupees(savingsCollectedTodayPaise)} ({savingsCollectedCount})</div>
              </div>
              <div style={{ color: '#b91c1c', textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>Pending</div>
                <div>{formatRupees(savingsExpectedTodayPaise - savingsCollectedTodayPaise)} ({savingsPendingCount})</div>
              </div>
            </div>
          </div>

          <div 
            style={{ background: '#f0fdf4', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #bbf7d0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>SAVINGS {monthName}</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#14532d', marginBottom: '0.5rem' }}>{formatRupees(savingsExpectedMonthPaise)}</div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '0.75rem', borderTop: '1px dashed #bbf7d0', paddingTop: '0.5rem' }}>
              <div style={{ color: '#15803d' }}>
                <div style={{ fontWeight: 700 }}>Collected</div>
                <div>{formatRupees(savingsCollectedMonthPaise)}</div>
              </div>
              <div style={{ color: '#b91c1c', textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>Pending</div>
                <div>{formatRupees(savingsExpectedMonthPaise - savingsCollectedMonthPaise)} ({savingsPendingMonthCount})</div>
              </div>
            </div>
          </div>

          <div 
            style={{ background: '#fef2f2', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #fecaca', cursor: 'pointer', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            onClick={() => setDetailsModal({ title: 'Loan Details', data: loansDetails, type: 'l' })}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', letterSpacing: '0.05em', textTransform: 'uppercase' }}>LOANS {selectedDate.getDate()} {selectedDate.toLocaleString('en-US', { month: 'short' })} ({selectedDate.toLocaleString('en-US', { weekday: 'short' })})</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7f1d1d', marginBottom: '0.5rem' }}>{formatRupees(loansExpectedTodayPaise)}</div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '0.75rem', borderTop: '1px dashed #fecaca', paddingTop: '0.5rem' }}>
              <div style={{ color: '#15803d' }}>
                <div style={{ fontWeight: 700 }}>Collected</div>
                <div>{formatRupees(loansCollectedTodayPaise)} ({loansCollectedCount})</div>
              </div>
              <div style={{ color: '#b91c1c', textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>Pending</div>
                <div>{formatRupees(loansExpectedTodayPaise - loansCollectedTodayPaise)} ({activeLoansCount - loansCollectedCount})</div>
              </div>
            </div>
          </div>

          <div 
            style={{ background: '#fef2f2', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #fecaca', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', letterSpacing: '0.05em', textTransform: 'uppercase' }}>LOANS {monthName}</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7f1d1d', marginBottom: '0.5rem' }}>{formatRupees(loansExpectedMonthPaise)}</div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '0.75rem', borderTop: '1px dashed #fecaca', paddingTop: '0.5rem' }}>
              <div style={{ color: '#15803d' }}>
                <div style={{ fontWeight: 700 }}>Collected</div>
                <div>{formatRupees(loansCollectedMonthPaise)}</div>
              </div>
              <div style={{ color: '#b91c1c', textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>Pending</div>
                <div>{formatRupees(loansExpectedMonthPaise - loansCollectedMonthPaise)} ({loansPendingMonthCount})</div>
              </div>
            </div>
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
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-espresso-900)' }}>No Data Available</div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, i) => {
                  const todayDateStr = getLocalISODate(new Date());
                  const selectedDateStr = getLocalISODate(selectedDate);
                  const rowPayments = payments[row.id]?.[selectedDateStr] || { s: false, l: false };
                  const isFullyPaid = rowPayments.s && (!row.hasLoan || rowPayments.l);

                  return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500, borderRight: '1px solid #e2e8f0' }}>{(currentPage - 1) * itemsPerPage + i + 1}</td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
  <a href="#" onClick={(e) => { e.preventDefault(); setQuickProfileId(row.memberId); }} style={{ color: '#16a34a', textDecoration: 'none' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>{row.id}</a>
</td>
                    <td style={{ padding: '0.75rem 0.5rem', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 600 }}>
  <a href="#" onClick={(e) => { e.preventDefault(); setQuickProfileId(row.memberId); }} style={{ color: 'var(--color-espresso-900)', textDecoration: 'none' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>{row.name}</a>
</div>
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
                             Pay (₹{((rowPayments.s ? 0 : row.daily) + (row.hasLoan && !rowPayments.l ? row.loan : 0)) / 100})
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
        
        
        {/* Pagination & WhatsApp Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', background: currentPage === 1 ? '#f8fafc' : '#fff', color: currentPage === 1 ? '#94a3b8' : '#1e293b', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
            <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>Page {currentPage} of {totalPages || 1}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', background: (currentPage === totalPages || totalPages === 0) ? '#f8fafc' : '#fff', color: (currentPage === totalPages || totalPages === 0) ? '#94a3b8' : '#1e293b', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer' }}>Next</button>
          </div>
          <button onClick={() => setWhatsappModal(true)} style={{ background: '#25D366', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.22.584 4.397 1.696 6.305L.135 24l5.807-1.523c1.839 1.018 3.902 1.554 6.089 1.554 6.646 0 12.031-5.385 12.031-12.031S18.677 0 12.031 0zm0 21.996c-1.892 0-3.743-.509-5.362-1.469l-.385-.228-3.987 1.045 1.066-3.887-.25-.398A9.972 9.972 0 012.035 12.03c0-5.523 4.492-10.015 10.015-10.015 5.523 0 10.015 4.492 10.015 10.015 0 5.523-4.492 10.015-10.015 10.015zM17.5 14.5c-.302-.151-1.787-.881-2.064-.981-.277-.101-.479-.151-.68.151-.202.302-.781.981-.958 1.183-.176.201-.353.226-.655.075-2.039-1.025-3.52-2.195-4.872-4.482-.176-.302.174-.298.536-.889.076-.126.038-.252 0-.378-.176-.403-.68-1.636-.932-2.24-.245-.589-.494-.509-.68-.518l-.58-.009c-.201 0-.529.075-.806.378-.277.302-1.058 1.033-1.058 2.518 0 1.485 1.083 2.92 1.234 3.121.151.202 2.128 3.25 5.154 4.553 1.942.836 2.721.921 3.73.774 1.154-.168 2.668-1.09 3.045-2.146.378-1.056.378-1.961.265-2.146-.113-.186-.416-.287-.718-.438z"/></svg>
            Send WhatsApp Reminders
          </button>
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
          
          const joinDateObj = new Date(customPayModal.joinDate || actualTodayStr);
          const todayObj = new Date(actualTodayStr);
          const timeDiff = todayObj.getTime() - joinDateObj.getTime();
          const daysDiff = Math.max(0, Math.floor(timeDiff / (1000 * 3600 * 24)));
          
          const orderedDates: string[] = [];
          for (let i = 0; i <= daysDiff; i++) {
             const d = new Date(joinDateObj);
             d.setDate(d.getDate() + i);
             orderedDates.push(getLocalISODate(d));
          }
          
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
               const joinDateObj = new Date(customPayModal.joinDate || actualTodayStr);
               const todayObj = new Date(actualTodayStr);
               const timeDiff = todayObj.getTime() - joinDateObj.getTime();
               const daysDiff = Math.max(0, Math.floor(timeDiff / (1000 * 3600 * 24)));
               
               const arrearsDays = Array.from({length: daysDiff}, (_, i) => {
                  const d = new Date(joinDateObj);
                  d.setDate(d.getDate() + i);
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

      {/* Modals for Clickable Dashboard Cards */}
      {detailsModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setDetailsModal(null)}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-espresso-900)' }}>{detailsModal.title}</h2>
              <button onClick={() => setDetailsModal(null)} style={{ background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {detailsModal.data.map((d: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: d.paid ? '#f0fdf4' : '#fff' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-espresso-900)' }}>{d.member.name} ({d.member.id})</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{d.member.shop}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontWeight: 700, color: d.paid ? '#16a34a' : '#0f172a' }}>{formatRupees(d.amount)}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: d.paid ? '#16a34a' : '#ef4444' }}>{d.paid ? 'Paid' : 'Pending'}</span>
                  </div>
                </div>
              ))}
              {detailsModal.data.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Profile Modal */}
      {quickProfileId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setQuickProfileId(null)}>
          <div style={{ background: '#f8fafc', borderRadius: '12px', width: '100%', maxWidth: '1000px', height: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  P
                </div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-espresso-900)' }}>Member Profile</h2>
              </div>
              <button onClick={() => setQuickProfileId(null)} style={{ background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              <iframe src={`/members/${quickProfileId}`} style={{ width: '100%', height: '100%', border: 'none', background: '#f8fafc' }} />
            </div>
          </div>
        </div>
      )}


      {/* WhatsApp Modal */}
      {whatsappModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setWhatsappModal(false)}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', position: 'sticky', top: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="24" height="24" fill="#16a34a" viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.22.584 4.397 1.696 6.305L.135 24l5.807-1.523c1.839 1.018 3.902 1.554 6.089 1.554 6.646 0 12.031-5.385 12.031-12.031S18.677 0 12.031 0zm0 21.996c-1.892 0-3.743-.509-5.362-1.469l-.385-.228-3.987 1.045 1.066-3.887-.25-.398A9.972 9.972 0 012.035 12.03c0-5.523 4.492-10.015 10.015-10.015 5.523 0 10.015 4.492 10.015 10.015 0 5.523-4.492 10.015-10.015 10.015z"/></svg>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#16a34a' }}>WhatsApp Automation (Page {currentPage})</h2>
              </div>
              <button onClick={() => setWhatsappModal(false)} style={{ background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>&times;</button>
            </div>
            
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Showing {paginatedData.length} members on this page</span>
                <button 
                  onClick={async () => {
                    for (const row of paginatedData) {
                       setWaSendingStatus(prev => ({...prev, [row.id]: 'sending'}));
                       await new Promise(resolve => setTimeout(resolve, 600));
                       setWaSendingStatus(prev => ({...prev, [row.id]: 'sent'}));
                    }
                    notification.success(`Successfully sent WhatsApp messages to ${paginatedData.length} members!`);
                  }} 
                  style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                >
                  Simulate Send All
                </button>
              </div>
              
              {paginatedData.map((row: any, i: number) => {
                const todayStr = getLocalISODate(new Date());
                const p = payments[row.id]?.[todayStr] || { s: false, l: false };
                let msg = "";
                
                if (p.s || p.l) {
                   msg = `Hello ${row.name}, we have received your payment today (${todayStr}). `;
                   if (p.s) msg += `Savings: ${formatRupees(row.daily)}. `;
                   if (p.l) msg += `Loan: ${formatRupees(row.loan)}. `;
                   msg += `Total: ${formatRupees((p.s ? row.daily : 0) + (p.l ? row.loan : 0))}. Thank you!`;
                } else {
                   msg = `Reminder: Hello ${row.name}, your due of ${formatRupees(row.daily + (row.hasLoan ? row.loan : 0))} for today (${todayStr}) is pending. Please pay at the earliest.`;
                }
                
                const encodedMsg = encodeURIComponent(msg);
                const waUrl = `https://wa.me/91${row.phone.replace(/\D/g, '')}?text=${encodedMsg}`;

                return (
                  <div key={i} style={{ border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: (p.s || p.l) ? '#f0fdf4' : '#fff5f5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{row.name} ({row.id})</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', background: (p.s || p.l) ? '#dcfce7' : '#fee2e2', color: (p.s || p.l) ? '#16a34a' : '#ef4444' }}>
                        {(p.s || p.l) ? 'PAID' : 'PENDING'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Phone: {row.phone}</div>
                    <div style={{ padding: '0.75rem', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '0.5rem', fontSize: '0.9rem', color: '#475569', marginTop: '0.25rem' }}>
                      {msg}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ background: waSendingStatus[row.id] === 'sent' ? '#0ea5e9' : '#25D366', color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.375rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: waSendingStatus[row.id] === 'sending' ? 0.7 : 1, pointerEvents: waSendingStatus[row.id] === 'sending' ? 'none' : 'auto' }}>
                        {waSendingStatus[row.id] === 'sending' ? (
                           <span>Sending...</span>
                        ) : waSendingStatus[row.id] === 'sent' ? (
                           <>
                             <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                             Sent ✓
                           </>
                        ) : (
                           <>
                             <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.22.584 4.397 1.696 6.305L.135 24l5.807-1.523c1.839 1.018 3.902 1.554 6.089 1.554 6.646 0 12.031-5.385 12.031-12.031S18.677 0 12.031 0zm0 21.996c-1.892 0-3.743-.509-5.362-1.469l-.385-.228-3.987 1.045 1.066-3.887-.25-.398A9.972 9.972 0 012.035 12.03c0-5.523 4.492-10.015 10.015-10.015 5.523 0 10.015 4.492 10.015 10.015 0 5.523-4.492 10.015-10.015 10.015z"/></svg>
                             Send WhatsApp
                           </>
                        )}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}
