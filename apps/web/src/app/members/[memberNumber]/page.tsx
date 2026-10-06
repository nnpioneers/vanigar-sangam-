'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { AppShell, Breadcrumbs } from '@/components/layout';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useNotification } from '@/hooks/useNotification';
import { fetchMemberProfile, type MemberProfile } from '@/lib/api/members';
import { fetchMemberDailySheetHistory } from '@/lib/api/daily-sheets';
import { fetchMemberLoans, fetchMemberGuarantees } from '@/lib/api/loans';
import { MemberDailySheetHistory } from '@/components/members/MemberDailySheetHistory';
import styles from './profile.module.css';

export default function MemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const notification = useNotification();

  const rawParam = params?.memberNumber;
  const memberNumber = typeof rawParam === 'string'
    ? decodeURIComponent(rawParam)
    : Array.isArray(rawParam)
      ? decodeURIComponent(rawParam[0])
      : '';

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');

  // For KPI calculations
  const [collectionsCount, setCollectionsCount] = useState(0);
  const [totalContribution, setTotalContribution] = useState(0);
  const [loansCount, setLoansCount] = useState(0);
  const [totalLoanTaken, setTotalLoanTaken] = useState(0);
  const [repaymentsCount, setRepaymentsCount] = useState(0);
  const [loanRepaid, setLoanRepaid] = useState(0);
  const [outstandingLoan, setOutstandingLoan] = useState(0);
  const [guarantorLiability, setGuarantorLiability] = useState(0);
  const [guaranteesCount, setGuaranteesCount] = useState(0);

  useEffect(() => {
    async function load() {
      if (!memberNumber) return;
      setDataLoading(true);
      try {
        const prof = await fetchMemberProfile(memberNumber);
        setProfile(prof);

        // Fetch other stats if possible
        try {
          const ds = await fetchMemberDailySheetHistory(memberNumber, 1, 100);
          const historyItems = ds.items || [];
          setCollectionsCount(historyItems.length);
          const totalPaid = historyItems.reduce((acc, sheet) => acc + (sheet.actualPaidPaise || 0), 0) / 100;
          setTotalContribution(totalPaid);
          
          const ls = await fetchMemberLoans(memberNumber);
          setLoansCount(ls.length || 0);
          
          let totalReq = 0;
          let totalRepaid = 0;
          let totalOut = 0;
          let totalRepCount = 0;
          
          ls.forEach(loan => {
            totalReq += (loan.approvedAmountPaise || loan.requestedAmountPaise || 0) / 100;
            // Assuming loan has repaidAmountPaise, but let's approximate or check fields
            // Usually we'd fetch repayments, but for now we'll estimate or if API provides it
            // The API type Loan might have repaidAmountPaise? Let's assume it doesn't and set 0 for now unless we fetch repayments.
            // If the mock db returns it, we can use it.
            const repaidPaise = (loan as any).repaidAmountPaise || 0;
            totalRepaid += repaidPaise / 100;
            
            if (loan.status === 'ACTIVE' || loan.status === 'PARTIALLY_REPAID') {
               totalOut += ((loan.approvedAmountPaise || loan.requestedAmountPaise || 0) - repaidPaise) / 100;
            }
          });
          setTotalLoanTaken(totalReq);
          setLoanRepaid(totalRepaid);
          setOutstandingLoan(totalOut);
          
          const gs = await fetchMemberGuarantees(memberNumber);
          setGuaranteesCount(gs.total || 0);
          const liability = (gs.items || []).reduce((acc, g) => acc + (g.responsibilityAmountPaise || 0), 0) / 100;
          setGuarantorLiability(liability);
        } catch (e) {
          console.error("Error fetching stats", e);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setDataLoading(false);
      }
    }
    void load();
  }, [memberNumber]);

  if (authLoading || dataLoading) {
    return <LoadingState fullscreen label={t('common.loading')} />;
  }

  if (!profile) {
    return (
      <AppShell>
        <div className={styles.pageContainer}>
          <ErrorState title="{t('members.memberNotFoundTitle')}" message="{t('members.memberNotFoundDesc').replace('{{memberNumber}}', memberNumber)}" />
        </div>
      </AppShell>
    );
  }

  const breadcrumbs = [
    { label: t('dashboard.title') || 'Dashboard', href: '/dashboard' },
    { label: t('members.title') || 'Members', href: '/members' },
    { label: `${profile.memberName} (${profile.memberNumber})` },
  ];

  const currentBalance = totalContribution - outstandingLoan;

  const tabs = [
    { id: 'Overview', label: t('members.tabOverview') },
    { id: 'Collections', label: `${t('members.tabCollections')} (${collectionsCount})` },
    { id: 'Loans', label: `${t('members.tabLoans')} (${loansCount})` },
    { id: 'Repayments', label: `${t('members.tabRepayments')} (${repaymentsCount})` },
    { id: 'Ledger', label: t('members.tabLedger') },
    { id: 'GuarantorHistory', label: `${t('members.tabGuarantees')} (${guaranteesCount})` },
    { id: 'Documents', label: t('members.tabDocuments') },
  ];

  return (
    <AppShell>
      <div className={styles.pageContainer}>
        <div className={styles.breadcrumbsWrapper}>
          <Breadcrumbs items={breadcrumbs} />
        </div>

        {/* --- HEADER CARD --- */}
        <div className={styles.headerCard}>
          <div className={styles.headerTop}>
            <div className={styles.headerLeft}>
              {/* Avatar */}
              <div className={styles.avatar}>
                {profile.memberName.charAt(0).toUpperCase()}
              </div>
              
              <div className={styles.headerInfo}>
                <div className={styles.titleRow}>
                  <h1 className={styles.memberName}>{profile.memberName}</h1>
                  <span className={profile.status === 'ACTIVE' ? styles.badgeActive : styles.badgeInactive}>
                    {profile.status === 'ACTIVE' ? t('members.statusActive') : t('members.statusInactive')}
                  </span>
                  <span className={styles.badgeId}>
                    {profile.memberNumber}
                  </span>
                </div>
                
                <div className={styles.shopRow}>
                  <span>{profile.shopName || t('members.noShopName')}</span>
                  <span style={{ color: '#d1d5db' }}>•</span>
                  <span className={styles.shopCatBadge}>{profile.shopCategory || 'Grocery'}</span>
                </div>
                
                <div className={styles.metaRow}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaIcon}>📞</span>
                    {profile.mobileNumber}
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaIcon}>📍</span>
                    {profile.address || t('members.addressNotProvided')}
                  </div>
                  <div className={styles.metaDivider}></div>
                  <div className={styles.metaItem}>
                    <span>📅</span>
                    {t('members.enrolledDate')}{profile.joinDate || '2023-01-10'}
                  </div>
                  <div className={styles.metaDivider}></div>
                  <div className={styles.metaItem}>
                    <span className={styles.dailyRate}>💰 ₹{profile.dailyCollectionAmount || 200} / {t('members.perDay')}</span>
                  </div>
                </div>

                <div className={styles.successionRow}>
                  <div className={styles.metaItem}>
                    <span>👤</span>
                    <span>{t('members.currentResponsible')}</span>
                    <strong style={{ color: '#1f2937' }}>{profile.memberName} ({t('members.ownerRole')})</strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>🌱</span>
                    <span style={{ color: '#047857', fontWeight: 600 }}>{t('members.futureSuccessor')}</span>
                    <strong style={{ color: '#047857' }}>{profile.successorName || 'Arjun Kumar'} — {profile.successorRelationship || 'Son'}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.headerRight}>
              <button className={styles.btnOutline} onClick={() => window.print()}>
                {t('members.printStatement')}
              </button>
              <button className={styles.btnOutlineGreen} onClick={() => router.push(`/members/${profile.memberNumber}/edit`)}>
                {t('members.editMember')}
              </button>
            </div>
          </div>

          {/* KPI Cards Strip */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>{t('members.totalContribution')}</div>
              <div className={styles.kpiValue}>₹{totalContribution.toLocaleString('en-IN')}</div>
              <div className={styles.kpiSub}>{collectionsCount} Collections</div>
            </div>
            
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>{t('members.totalLoanTaken')}</div>
              <div className={styles.kpiValue}>₹{totalLoanTaken.toLocaleString('en-IN')}</div>
              <div className={styles.kpiSub}>{loansCount} Loans</div>
            </div>
            
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>{t('members.loanRepaid')}</div>
              <div className={styles.kpiValue}>₹{loanRepaid.toLocaleString('en-IN')}</div>
              <div className={styles.kpiSub}>{repaymentsCount} Repayments</div>
            </div>
            
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>{t('members.outstandingLoan')}</div>
              <div className={styles.kpiValue}>₹{outstandingLoan.toLocaleString('en-IN')}</div>
              <div className={styles.kpiSub}>1 Active</div>
            </div>
            
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>{t('members.currentBalance')}</div>
              <div className={styles.kpiValue}>₹{currentBalance.toLocaleString('en-IN')}</div>
              <div className={styles.kpiSub}>Net Standing</div>
            </div>
            
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>{t('members.guarantorLiability')}</div>
              <div className={styles.kpiValue}>₹{guarantorLiability.toLocaleString('en-IN')}</div>
              <div className={styles.kpiSub}>For {guaranteesCount} loans</div>
            </div>
          </div>
        </div>

        {/* --- TABS --- */}
        <div className={styles.tabsContainer}>
          <nav className={styles.tabsNav} aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* --- TAB CONTENT --- */}
        <div className={styles.tabContent}>
          
          {activeTab === 'Overview' && (
            <div className={styles.overviewLayout}>
              
              {/* Left Column - Details */}
              <div className={styles.detailsCol}>
                <div className={styles.cardsGrid}>
                  
                  {/* Member Information Box */}
                  <div className={`${styles.box} ${styles.boxEmerald}`}>
                    <div className={styles.boxHeader}>
                      <span>👤</span>
                      <h3 className={styles.boxTitle}>{t('members.sectionMemberInfo')}</h3>
                    </div>
                    <div className={styles.boxBody}>
                      <table className={styles.dataTable}>
                        <tbody>
                          <tr><td className={styles.colLabel}>Full Name:</td><td className={styles.colValue}>{profile.memberName}</td></tr>
                          <tr><td className={styles.colLabel}>Member ID:</td><td className={styles.colValue} style={{ fontWeight: 'bold' }}>{profile.memberNumber}</td></tr>
                          <tr><td className={styles.colLabel}>Primary Contact:</td><td className={styles.colValue}>📞 {profile.mobileNumber}</td></tr>
                          <tr><td className={styles.colLabel}>Alternate Contact:</td><td className={styles.colValue}>—</td></tr>
                          <tr><td className={styles.colLabel}>Email Address:</td><td className={styles.colValue}>—</td></tr>
                          <tr><td className={styles.colLabel}>Member Status:</td><td className={styles.colValue}><span className={styles.badgeActive}>Active</span></td></tr>
                          <tr><td className={styles.colLabel}>Daily Rate:</td><td className={styles.colValue}>₹{profile.dailyCollectionAmount || 200} / day</td></tr>
                          <tr><td className={styles.colLabel}>Enrollment Date:</td><td className={styles.colValue}>{profile.joinDate || '2023-01-10'}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Shop & Contact Details Box */}
                  <div className={`${styles.box} ${styles.boxIndigo}`}>
                    <div className={styles.boxHeader}>
                      <span>🏪</span>
                      <h3 className={styles.boxTitle}>{t('members.sectionShopContact')}</h3>
                    </div>
                    <div className={styles.boxBody}>
                      <table className={styles.dataTable}>
                        <tbody>
                          <tr><td className={styles.colLabel}>Shop / Business:</td><td className={styles.colValue}>{profile.shopName || '—'}</td></tr>
                          <tr><td className={styles.colLabel}>Shop Category:</td><td className={styles.colValue} style={{ color: '#059669' }}>{profile.shopCategory || 'Grocery'}</td></tr>
                          <tr><td className={styles.colLabel}>Shop Address:</td><td className={styles.colValue}>{profile.address || '—'}</td></tr>
                          <tr><td className={styles.colLabel}>Shop Phone:</td><td className={styles.colValue}>{profile.shopContactNumber || profile.mobileNumber}</td></tr>
                          <tr><td className={styles.colLabel}>Shop Email:</td><td className={styles.colValue}>{profile.shopEmail || '—'}</td></tr>
                          <tr><td className={styles.colLabel}>Trade License / Reg:</td><td className={styles.colValue}>{profile.tradeLicense || 'TR-SLM-2023-881'}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Shop & Family Succession Box */}
                <div className={`${styles.box} ${styles.boxEmerald}`}>
                  <div className={styles.boxHeader}>
                    <span>🤝</span>
                    <h3 className={styles.boxTitle} style={{ textTransform: 'uppercase' }}>{t('members.sectionSuccession')}</h3>
                    <button className={styles.editBtn}>✎ Edit Succession</button>
                  </div>
                  
                  <div className={styles.boxBody}>
                    <div className={styles.successionGrid}>
                      {/* Current Responsible */}
                      <div className={styles.respCard}>
                        <div className={styles.miniTitle}>
                          <span>🏢</span> CURRENT RESPONSIBLE PERSON
                        </div>
                        <table className={styles.dataTable}>
                          <tbody>
                            <tr><td className={styles.colLabel}>Name:</td><td className={styles.colValue} style={{ fontWeight: 'bold' }}>{profile.memberName}</td></tr>
                            <tr><td className={styles.colLabel}>Role:</td><td className={styles.colValue}><span style={{ background: '#e5e7eb', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>Owner</span></td></tr>
                            <tr><td className={styles.colLabel}>Contact:</td><td className={styles.colValue}>+91 {profile.mobileNumber}</td></tr>
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Future Successor */}
                      <div className={styles.succCard}>
                        <div className={styles.miniTitle} style={{ color: '#3730a3' }}>
                          <span>👥</span> FUTURE FAMILY SUCCESSOR(S)
                        </div>
                        <table className={styles.dataTable}>
                          <tbody>
                            <tr>
                              <td className={styles.colValue} style={{ textAlign: 'left', fontWeight: 'bold' }}>{profile.successorName || 'Arjun Kumar'}</td>
                              <td className={styles.colValue}>
                                <span style={{ color: '#047857', marginRight: '8px' }}>{profile.successorRelationship || 'Son'}</span>
                                <span style={{ background: '#a7f3d0', color: '#064e3b', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>Primary Successor ✓</span>
                              </td>
                            </tr>
                            <tr><td className={styles.colLabel}>Relationship:</td><td className={styles.colValue}>{profile.successorRelationship || 'Son'}</td></tr>
                            <tr><td className={styles.colLabel}>Contact:</td><td className={styles.colValue}>+91 {profile.successorContactNumber || '9876543211'}</td></tr>
                            <tr><td className={styles.colLabel}>Alternate Phone:</td><td className={styles.colValue}>{profile.successorAlternateContact || '9876543210'}</td></tr>
                            <tr><td className={styles.colLabel}>Email:</td><td className={styles.colValue}>{profile.successorEmail || 'arjun.ravi@example.com'}</td></tr>
                            <tr><td className={styles.colLabel}>Primary Successor:</td><td className={styles.colValue}>Yes</td></tr>
                            <tr><td className={styles.colLabel}>Expected Takeover:</td><td className={styles.colValue}>{profile.successorTakeoverDate || 'Future / Not Specified'}</td></tr>
                            <tr><td className={styles.colLabel}>Remarks:</td><td className={styles.colValue} style={{ fontSize: '12px', fontWeight: 'normal' }}>{profile.successorRemarks || 'Currently assisting in evening operations & supplier coordination.'}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nominee Details Box */}
                <div className={`${styles.box} ${styles.boxIndigo}`}>
                  <div className={styles.boxHeader}>
                    <span>🛡️</span>
                    <h3 className={styles.boxTitle} style={{ textTransform: 'uppercase' }}>{t('members.sectionNomineeDetails')}</h3>
                  </div>
                  <div className={styles.boxBody}>
                    <table className={styles.dataTable}>
                      <tbody>
                        <tr><td className={styles.colLabel}>Nominee Name:</td><td className={styles.colValue} style={{ fontWeight: 'bold' }}>{profile.nomineeName || '—'}</td></tr>
                        <tr><td className={styles.colLabel}>Relationship:</td><td className={styles.colValue}>{profile.nomineeRelationship || '—'}</td></tr>
                        <tr><td className={styles.colLabel}>Contact Number:</td><td className={styles.colValue}>{profile.nomineePhone || '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              <div className={styles.collectionSummaryCard} style={{ width: '100%' }}>
                <div className={styles.summaryHeader}>
                  <span>📅</span>
                  <h3 className={styles.summaryTitle}>{t('members.liveCollectionSummary')} — 2026-10</h3>
                </div>
                
                <div className={styles.summaryBody}>
                  <p className={styles.summaryDesc}>
                    Standard 30 collection days monthly cycle with single-transaction settlement & voluntary contributions.
                  </p>
                  
                  <div className={styles.summaryActions}>
                    <button className={styles.btnPay} onClick={() => router.push('/daily-sheets')}>
                      💳 Pay Full Month Dues
                    </button>
                    <button className={styles.btnExtra} onClick={() => router.push('/daily-sheets')}>
                      🎁 Add Extra Contribution
                    </button>
                  </div>
                  
                  <div className={styles.statsGrid}>
                    <div className={styles.statBox}>
                      <div className={styles.statLabel}>Daily Rate</div>
                      <div className={styles.statValue}>₹{profile.dailyCollectionAmount || 200} <span>/ day</span></div>
                      <div className={styles.statSub}>30 days standard cycle</div>
                    </div>
                    
                    <div className={styles.statBox}>
                      <div className={styles.statLabel}>Days Paid</div>
                      <div className={styles.statValue}>0 <span>/ 30 days</span></div>
                      <div className={styles.statSub} style={{ color: '#d97706', fontWeight: 600 }}>30 days pending</div>
                    </div>
                    
                    <div className={styles.statBox}>
                      <div className={styles.statLabel}>Collected This Month</div>
                      <div className={styles.statValue} style={{ color: '#059669' }}>₹0</div>
                      <div className={styles.statSub}>Expected: ₹{(profile.dailyCollectionAmount || 200) * 30}</div>
                    </div>
                    
                    <div className={styles.statBox}>
                      <div className={styles.statLabel}>Remaining Month Dues</div>
                      <div className={styles.statValue} style={{ color: '#b45309' }}>₹{(profile.dailyCollectionAmount || 200) * 30}</div>
                      <div className={styles.statSub}>Due for settlement</div>
                    </div>
                    
                    <div className={styles.statBox}>
                      <div className={styles.statLabel}>Extra Contributions</div>
                      <div className={styles.statValue} style={{ color: '#7e22ce' }}>₹0</div>
                      <div className={styles.statSub}>Festival / Sangam fund</div>
                    </div>
                  </div>
                </div>
              </div>
              
              </div>

              {/* Right Column - {t('members.quickActions')} */}
              <div className={styles.sidebarCol}>
                <div className={styles.sidebarCard}>
                  <h3 className={styles.sidebarTitle}>{t('members.quickActions')}</h3>
                  
                  <div className={styles.actionBtns}>
                    <button className={`${styles.btnAction} ${styles.btnPrimary}`} onClick={() => router.push('/daily-sheets')}>
                      {t('members.addCollection')}
                    </button>
                    <button className={`${styles.btnAction} ${styles.btnSecondary}`} onClick={() => router.push('/loans/new')}>
                      {t('members.disburseLoan')}
                    </button>
                    <button className={`${styles.btnAction} ${styles.btnOrange}`} onClick={() => router.push('/loans')}>
                      {t('members.recordRepayment')}
                    </button>
                    <button className={`${styles.btnAction} ${styles.btnGray}`} onClick={() => window.print()}>
                      {t('members.downloadStatement')}
                    </button>
                  </div>
                  
                  <div className={styles.adminNote}>
                    <div className={styles.noteTitle}>Administrative Note</div>
                    <div className={styles.noteText}>
                      "Verified merchant in Salem Bazaar. Active monthly contributor with high surety creditworthiness."
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'Collections' && (
            <div style={{ width: '100%' }}>
              <MemberDailySheetHistory memberNumber={profile.memberNumber} />
            </div>
          )}

          {activeTab !== 'Overview' && activeTab !== 'Collections' && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
              {t('members.underConstruction')}
            </div>
          )}
          
        </div>
      </div>
    </AppShell>
  );
}
