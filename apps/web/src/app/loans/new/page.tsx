'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AppShell, PageContainer, Breadcrumbs } from '@/components/layout';
import { Button, Input, Spinner, Badge } from '@/components/ui';
import { fetchMemberProfile, type MemberProfile } from '@/lib/api/members';
import { createLoan } from '@/lib/api/loans';
import { getSafeErrorMessage } from '@/lib/error-utils';
import { formatRupees } from '@/lib/formatters';
import { motion, AnimatePresence } from 'framer-motion';

// --- STYLES ---
const theme = {
  bg: '#121212', // Dark Charcoal
  surface: '#1E1E1E',
  surfaceHover: '#2A2A2A',
  gold: '#D4AF37', // Luxury Gold
  goldHover: '#F3E5AB', // Warm Cream
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',
  border: '#333333',
  glass: 'rgba(30, 30, 30, 0.7)',
  glassBorder: 'rgba(212, 175, 55, 0.3)',
};

const STEPS = [
  { id: 1, title: "Applicant Details", icon: "👤" },
  { id: 2, title: "Guarantor Details", icon: "🤝" },
  { id: 3, title: "Collateral", icon: "💎" },
  { id: 4, title: "Loan Config", icon: "⚙️" },
  { id: 5, title: "Review", icon: "📋" },
];

export default function PremiumLoanWizard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [borrowerNumber, setBorrowerNumber] = useState('');
  const [borrowerProfile, setBorrowerProfile] = useState<MemberProfile | null>(null);
  const [borrowerLoading, setBorrowerLoading] = useState(false);

  const [guarantorType, setGuarantorType] = useState<'MEMBER'|'NON_MEMBER'>('MEMBER');
  const [guarantorNumber, setGuarantorNumber] = useState('');
  const [guarantorProfile, setGuarantorProfile] = useState<MemberProfile | null>(null);
  const [guarantorLoading, setGuarantorLoading] = useState(false);

  const [collateralType, setCollateralType] = useState('');
  const [collateralValue, setCollateralValue] = useState('');

  const [loanAmount, setLoanAmount] = useState('');
  const [loanType, setLoanType] = useState('DAILY_COLLECTION');
  const [tenure, setTenure] = useState('100');

  // Handlers
  const handleBorrowerSearch = async () => {
    if (!borrowerNumber) return;
    setBorrowerLoading(true);
    try {
      const profile = await fetchMemberProfile(borrowerNumber);
      setBorrowerProfile(profile);
    } catch (err) {
      alert(getSafeErrorMessage(err));
    } finally {
      setBorrowerLoading(false);
    }
  };

  const handleGuarantorSearch = async () => {
    if (!guarantorNumber) return;
    setGuarantorLoading(true);
    try {
      const profile = await fetchMemberProfile(guarantorNumber);
      setGuarantorProfile(profile);
    } catch (err) {
      alert(getSafeErrorMessage(err));
    } finally {
      setGuarantorLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep(s => s + 1);
  };
  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(s => s - 1);
  };

  const handleSubmit = async () => {
    if (!borrowerProfile || !loanAmount) return;
    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const newLoan = await createLoan({
        memberNumber: borrowerProfile.memberNumber,
        requestedAmountPaise: parseInt(loanAmount, 10) * 100,
        applicationDate: today
      });
      // In a real app, we would also submit Guarantor and Collateral details here using API endpoints.
      router.push(`/loans/${newLoan.id}`);
    } catch (err) {
      alert(getSafeErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  if (authLoading) return <div style={{ background: theme.bg, height: '100vh' }} />;

  return (
    <AppShell>
      <div style={{ minHeight: '100vh', background: theme.bg, color: theme.textPrimary, padding: '2rem', fontFamily: '"Inter", sans-serif' }}>
        
        {/* Header */}
        <div style={{ maxWidth: '900px', margin: '0 auto', marginBottom: '3rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: theme.gold, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>
            New Loan Application
          </h1>
          <p style={{ color: theme.textSecondary, fontSize: '1.1rem' }}>Premium 5-Step Origination Workflow</p>
        </div>

        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', gap: '2rem' }}>
          
          {/* Sidebar / Progress */}
          <div style={{ flex: '0 0 250px' }}>
            <div style={{ background: theme.surface, borderRadius: '16px', padding: '1.5rem', border: `1px solid ${theme.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              {STEPS.map((step) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                return (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', opacity: isActive || isCompleted ? 1 : 0.4, transition: 'all 0.3s' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', 
                      background: isActive ? theme.gold : (isCompleted ? theme.surfaceHover : 'transparent'),
                      border: `2px solid ${isActive || isCompleted ? theme.gold : theme.textSecondary}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isActive ? theme.bg : theme.textPrimary,
                      fontWeight: 'bold', fontSize: '1.2rem'
                    }}>
                      {isCompleted ? '✓' : step.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '1px' }}>Step {step.id}</div>
                      <div style={{ fontWeight: isActive ? 600 : 400, color: isActive ? theme.goldHover : theme.textPrimary }}>{step.title}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, position: 'relative' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                style={{ 
                  background: theme.glass, backdropFilter: 'blur(10px)', 
                  borderRadius: '16px', padding: '2.5rem', 
                  border: `1px solid ${theme.glassBorder}`,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                  minHeight: '400px', display: 'flex', flexDirection: 'column'
                }}
              >
                
                {/* STEP 1: Applicant Details */}
                {currentStep === 1 && (
                  <>
                    <h2 style={{ fontSize: '1.8rem', color: theme.gold, marginBottom: '1.5rem' }}>Applicant Details</h2>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                      <input 
                        type="text" 
                        value={borrowerNumber} 
                        onChange={e => setBorrowerNumber(e.target.value)} 
                        placeholder="Enter Member ID (e.g. M001)" 
                        style={{ flex: 1, padding: '1rem', borderRadius: '8px', background: theme.bg, border: `1px solid ${theme.border}`, color: theme.textPrimary, fontSize: '1rem', outline: 'none' }}
                      />
                      <button 
                        onClick={handleBorrowerSearch} 
                        style={{ background: theme.gold, color: theme.bg, border: 'none', padding: '0 2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                      >
                        {borrowerLoading ? 'Searching...' : 'Search'}
                      </button>
                    </div>

                    {borrowerProfile && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: theme.surface, padding: '1.5rem', borderRadius: '12px', border: `1px solid ${theme.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
                          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: theme.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: theme.bg, fontWeight: 'bold' }}>
                            {borrowerProfile.memberName.charAt(0)}
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1.4rem', margin: 0, color: theme.goldHover }}>{borrowerProfile.memberName}</h3>
                            <p style={{ color: theme.textSecondary, margin: '0.2rem 0 0 0' }}>{borrowerProfile.memberNumber} • {borrowerProfile.shopName || 'No Shop'}</p>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.95rem' }}>
                          <div><span style={{ color: theme.textSecondary }}>Mobile:</span> {borrowerProfile.mobileNumber}</div>
                          <div><span style={{ color: theme.textSecondary }}>Category:</span> {borrowerProfile.shopCategory || 'N/A'}</div>
                          <div><span style={{ color: theme.textSecondary }}>Address:</span> {borrowerProfile.address}</div>
                          <div><span style={{ color: theme.textSecondary }}>Status:</span> <span style={{ color: borrowerProfile.status === 'ACTIVE' ? '#4ade80' : '#f87171' }}>{borrowerProfile.status}</span></div>
                        </div>
                      </motion.div>
                    )}
                  </>
                )}

                {/* STEP 2: Guarantor */}
                {currentStep === 2 && (
                  <>
                    <h2 style={{ fontSize: '1.8rem', color: theme.gold, marginBottom: '1.5rem' }}>Guarantor Details</h2>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                      <button 
                        onClick={() => setGuarantorType('MEMBER')} 
                        style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: `1px solid ${guarantorType === 'MEMBER' ? theme.gold : theme.border}`, background: guarantorType === 'MEMBER' ? 'rgba(212, 175, 55, 0.1)' : theme.surface, color: guarantorType === 'MEMBER' ? theme.goldHover : theme.textPrimary, cursor: 'pointer', fontWeight: 600, transition: '0.2s' }}
                      >
                        Existing Member
                      </button>
                      <button 
                        onClick={() => setGuarantorType('NON_MEMBER')} 
                        style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: `1px solid ${guarantorType === 'NON_MEMBER' ? theme.gold : theme.border}`, background: guarantorType === 'NON_MEMBER' ? 'rgba(212, 175, 55, 0.1)' : theme.surface, color: guarantorType === 'NON_MEMBER' ? theme.goldHover : theme.textPrimary, cursor: 'pointer', fontWeight: 600, transition: '0.2s' }}
                      >
                        Non-Member
                      </button>
                    </div>

                    {guarantorType === 'MEMBER' && (
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                        <input 
                          type="text" 
                          value={guarantorNumber} 
                          onChange={e => setGuarantorNumber(e.target.value)} 
                          placeholder="Enter Guarantor Member ID" 
                          style={{ flex: 1, padding: '1rem', borderRadius: '8px', background: theme.bg, border: `1px solid ${theme.border}`, color: theme.textPrimary, fontSize: '1rem', outline: 'none' }}
                        />
                        <button 
                          onClick={handleGuarantorSearch} 
                          style={{ background: theme.gold, color: theme.bg, border: 'none', padding: '0 2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                        >
                          {guarantorLoading ? 'Searching...' : 'Search'}
                        </button>
                      </div>
                    )}

                    {guarantorProfile && guarantorType === 'MEMBER' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: theme.surface, padding: '1.5rem', borderRadius: '12px', border: `1px solid ${theme.border}` }}>
                        <h3 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0', color: theme.goldHover }}>{guarantorProfile.memberName} ({guarantorProfile.memberNumber})</h3>
                        <p style={{ color: theme.textSecondary, margin: '0 0 0.5rem 0' }}>Mobile: {guarantorProfile.mobileNumber}</p>
                        <p style={{ color: theme.textSecondary, margin: 0 }}>Shop: {guarantorProfile.shopName}</p>
                      </motion.div>
                    )}

                    {guarantorType === 'NON_MEMBER' && (
                      <div style={{ background: theme.surface, padding: '2rem', borderRadius: '12px', textAlign: 'center', color: theme.textSecondary, border: `1px dashed ${theme.border}` }}>
                        Non-member guarantor form elements go here...
                      </div>
                    )}
                  </>
                )}

                {/* STEP 3: Collateral */}
                {currentStep === 3 && (
                  <>
                    <h2 style={{ fontSize: '1.8rem', color: theme.gold, marginBottom: '1.5rem' }}>Collateral Details</h2>
                    <p style={{ color: theme.textSecondary, marginBottom: '2rem' }}>Register physical security or documents pledged against this loan.</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: theme.goldHover, fontWeight: 600 }}>Collateral Type</label>
                        <select 
                          value={collateralType} 
                          onChange={e => setCollateralType(e.target.value)}
                          style={{ width: '100%', padding: '1rem', borderRadius: '8px', background: theme.bg, border: `1px solid ${theme.border}`, color: theme.textPrimary, fontSize: '1rem', outline: 'none' }}
                        >
                          <option value="">Select Type...</option>
                          <option value="PROPERTY">Property Document</option>
                          <option value="JEWELRY">Gold / Jewelry</option>
                          <option value="VEHICLE">Vehicle RC</option>
                          <option value="BLANK_CHEQUE">Blank Cheques</option>
                          <option value="PROMISSORY_NOTE">Promissory Note</option>
                        </select>
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: theme.goldHover, fontWeight: 600 }}>Estimated Value (₹)</label>
                        <input 
                          type="number" 
                          value={collateralValue} 
                          onChange={e => setCollateralValue(e.target.value)} 
                          placeholder="e.g. 500000" 
                          style={{ width: '100%', padding: '1rem', borderRadius: '8px', background: theme.bg, border: `1px solid ${theme.border}`, color: theme.textPrimary, fontSize: '1rem', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* STEP 4: Loan Config */}
                {currentStep === 4 && (
                  <>
                    <h2 style={{ fontSize: '1.8rem', color: theme.gold, marginBottom: '1.5rem' }}>Loan Configuration</h2>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: theme.goldHover, fontWeight: 600 }}>Requested Amount (₹)</label>
                        <input 
                          type="number" 
                          value={loanAmount} 
                          onChange={e => setLoanAmount(e.target.value)} 
                          placeholder="e.g. 100000" 
                          style={{ width: '100%', padding: '1rem', borderRadius: '8px', background: theme.bg, border: `1px solid ${theme.gold}`, color: theme.goldHover, fontSize: '1.5rem', fontWeight: 'bold', outline: 'none' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '1.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: theme.goldHover, fontWeight: 600 }}>Loan Type</label>
                          <select 
                            value={loanType} 
                            onChange={e => setLoanType(e.target.value)}
                            style={{ width: '100%', padding: '1rem', borderRadius: '8px', background: theme.bg, border: `1px solid ${theme.border}`, color: theme.textPrimary, fontSize: '1rem', outline: 'none' }}
                          >
                            <option value="DAILY_COLLECTION">Daily Collection</option>
                            <option value="WEEKLY">Weekly Collection</option>
                            <option value="MONTHLY">Monthly</option>
                          </select>
                        </div>
                        
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: theme.goldHover, fontWeight: 600 }}>Tenure (Days)</label>
                          <input 
                            type="number" 
                            value={tenure} 
                            onChange={e => setTenure(e.target.value)} 
                            placeholder="100" 
                            style={{ width: '100%', padding: '1rem', borderRadius: '8px', background: theme.bg, border: `1px solid ${theme.border}`, color: theme.textPrimary, fontSize: '1rem', outline: 'none' }}
                          />
                        </div>
                      </div>
                      
                      {loanAmount && tenure && (
                        <div style={{ padding: '1.5rem', background: 'rgba(212, 175, 55, 0.05)', borderRadius: '8px', border: `1px solid rgba(212, 175, 55, 0.2)` }}>
                          <div style={{ color: theme.goldHover, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Estimated Collection</div>
                          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>
                            ₹{Math.ceil(parseInt(loanAmount) / parseInt(tenure)).toLocaleString()} <span style={{ fontSize: '1rem', color: theme.textSecondary, fontWeight: 400 }}>/ day</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* STEP 5: Review */}
                {currentStep === 5 && (
                  <>
                    <h2 style={{ fontSize: '1.8rem', color: theme.gold, marginBottom: '1.5rem' }}>Review Application</h2>
                    
                    <div style={{ background: theme.surface, borderRadius: '12px', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
                      <div style={{ padding: '1rem 1.5rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: theme.textSecondary }}>Applicant</span>
                        <span style={{ fontWeight: 600 }}>{borrowerProfile?.memberName || 'N/A'}</span>
                      </div>
                      <div style={{ padding: '1rem 1.5rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: theme.textSecondary }}>Guarantor</span>
                        <span style={{ fontWeight: 600 }}>{guarantorType === 'MEMBER' ? guarantorProfile?.memberName : 'Non-Member'}</span>
                      </div>
                      <div style={{ padding: '1rem 1.5rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: theme.textSecondary }}>Collateral</span>
                        <span style={{ fontWeight: 600 }}>{collateralType || 'None'}</span>
                      </div>
                      <div style={{ padding: '1.5rem', background: 'rgba(212, 175, 55, 0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: theme.goldHover, fontWeight: 600, fontSize: '1.2rem' }}>Requested Loan</span>
                          <span style={{ fontSize: '2rem', fontWeight: 800, color: theme.gold }}>₹{parseInt(loanAmount || '0').toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Navigation Buttons */}
                <div style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
                  <button 
                    onClick={handlePrev} 
                    disabled={currentStep === 1 || isSubmitting}
                    style={{ background: 'transparent', color: theme.textSecondary, border: `1px solid ${theme.border}`, padding: '0.75rem 2rem', borderRadius: '8px', fontWeight: 600, cursor: currentStep === 1 ? 'not-allowed' : 'pointer', opacity: currentStep === 1 ? 0.5 : 1, transition: '0.2s' }}
                  >
                    Back
                  </button>
                  
                  {currentStep < 5 ? (
                    <button 
                      onClick={handleNext} 
                      disabled={(currentStep === 1 && !borrowerProfile)}
                      style={{ background: theme.gold, color: theme.bg, border: 'none', padding: '0.75rem 2.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: (currentStep === 1 && !borrowerProfile) ? 'not-allowed' : 'pointer', opacity: (currentStep === 1 && !borrowerProfile) ? 0.5 : 1, transition: '0.2s' }}
                    >
                      Next Step →
                    </button>
                  ) : (
                    <button 
                      onClick={handleSubmit} 
                      disabled={isSubmitting}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.75rem 2.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {isSubmitting ? 'Processing...' : 'Submit Application'}
                    </button>
                  )}
                </div>

              </motion.div>
            </AnimatePresence>
          </div>
          
        </div>
      </div>
    </AppShell>
  );
}
