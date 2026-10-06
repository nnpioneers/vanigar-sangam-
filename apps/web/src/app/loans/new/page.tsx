'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AppShell, PageContainer, Breadcrumbs } from '@/components/layout';
import { Button, Input, Spinner, Badge } from '@/components/ui';
import { fetchMemberProfile, type MemberProfile } from '@/lib/api/members';
import { fetchMemberLoans, fetchActiveLoanForMember, createLoan, addGuarantor, type Loan } from '@/lib/api/loans';
import { getSafeErrorMessage } from '@/lib/error-utils';
import { formatRupees } from '@/lib/formatters';
import styles from './new-loan.module.css';

export default function NewLoanPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  // Borrower State
  const [borrowerNumber, setBorrowerNumber] = useState('');
  const [borrowerProfile, setBorrowerProfile] = useState<MemberProfile | null>(null);
  const [borrowerLoading, setBorrowerLoading] = useState(false);
  const [borrowerError, setBorrowerError] = useState('');

  // Nominee State
  const [nomineeNumber, setNomineeNumber] = useState('');
  const [nomineeProfile, setNomineeProfile] = useState<MemberProfile | null>(null);
  const [nomineeLoans, setNomineeLoans] = useState<Loan[]>([]);
  const [nomineeLoading, setNomineeLoading] = useState(false);
  const [nomineeError, setNomineeError] = useState('');

  // Loan Details
  const [loanAmount, setLoanAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleBorrowerSearch = async () => {
    if (!borrowerNumber) return;
    setBorrowerLoading(true);
    setBorrowerError('');
    setBorrowerProfile(null);
    try {
      const profile = await fetchMemberProfile(borrowerNumber);
      setBorrowerProfile(profile);
    } catch (err) {
      setBorrowerError(getSafeErrorMessage(err));
    } finally {
      setBorrowerLoading(false);
    }
  };

  const handleNomineeSearch = async () => {
    if (!nomineeNumber) return;
    if (nomineeNumber.trim() === borrowerNumber.trim()) {
      setNomineeError('Borrower cannot be their own nominee.');
      return;
    }
    setNomineeLoading(true);
    setNomineeError('');
    setNomineeProfile(null);
    setNomineeLoans([]);
    try {
      const profile = await fetchMemberProfile(nomineeNumber);
      setNomineeProfile(profile);
      
      const loans = await fetchMemberLoans(nomineeNumber);
      setNomineeLoans(loans || []);
    } catch (err) {
      setNomineeError(getSafeErrorMessage(err));
    } finally {
      setNomineeLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    
    if (!borrowerProfile || !nomineeProfile || !loanAmount) {
      setSubmitError('Please complete all sections.');
      return;
    }
    if (borrowerProfile.memberNumber === nomineeProfile.memberNumber) {
      setSubmitError('Borrower cannot be their own nominee.');
      return;
    }

    const amountPaise = Number(loanAmount) * 100;
    if (amountPaise <= 0 || isNaN(amountPaise)) {
      setSubmitError('Invalid loan amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Loan
      const loan = await createLoan({
        memberNumber: borrowerProfile.memberNumber,
        requestedAmountPaise: amountPaise,
        applicationDate: new Date().toISOString().split('T')[0]!
      });

      // 2. Add Nominee (Guarantor)
      await addGuarantor(loan.id, {
        memberNumber: nomineeProfile.memberNumber,
        responsibilityAmountPaise: amountPaise
      });

      // 3. Navigate back to loans
      router.push('/loans');
    } catch (err) {
      setSubmitError(getSafeErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  if (authLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spinner size="lg" /></div>;
  if (!user) return null;

  return (
    <AppShell>
      <PageContainer>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
          
          <div>
            <Breadcrumbs items={[{ label: 'Loans', href: '/loans' }, { label: 'New Loan Registration' }]} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0', color: 'var(--color-espresso-900)' }}>New Loan Registration</h1>
          </div>

          {/* Section 1: Borrower */}
          <section style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--color-neutral-200)' }}>
            <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '1rem', color: 'var(--color-primary-900)' }}>1. Borrower Details</h2>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <Input
                  id="borrowerNumber"
                  label="Member Number"
                  value={borrowerNumber}
                  onChange={(e) => setBorrowerNumber(e.target.value)}
                  placeholder="e.g. VN001"
                />
              </div>
              <Button type="button" variant="primary" onClick={handleBorrowerSearch} disabled={borrowerLoading} style={{ minHeight: '44px' }}>
                {borrowerLoading ? <Spinner size="sm" /> : 'Search Member'}
              </Button>
            </div>
            
            {borrowerError && <div style={{ color: 'var(--color-danger-600)', fontSize: '0.875rem' }}>{borrowerError}</div>}
            
            {borrowerProfile && (
              <div style={{ background: 'var(--color-neutral-50)', padding: '1rem', borderRadius: '4px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
                <div><strong>Name:</strong> {borrowerProfile.memberName}</div>
                <div><strong>Mobile:</strong> {borrowerProfile.mobileNumber}</div>
                <div><strong>{borrowerProfile.relatedPersonRelationship}:</strong> {borrowerProfile.relatedPersonName}</div>
                <div><strong>Shop:</strong> {borrowerProfile.shopName || 'N/A'}</div>
                <div><strong>Status:</strong> <Badge variant={borrowerProfile.status === 'ACTIVE' ? 'success' : 'danger'}>{borrowerProfile.status}</Badge></div>
                <div><strong>Daily Due:</strong> {borrowerProfile.numberOfSheets * 200} ({borrowerProfile.numberOfSheets} sheets)</div>
              </div>
            )}
          </section>

          {/* Section 2: Nominee */}
          <section style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--color-neutral-200)', opacity: borrowerProfile ? 1 : 0.5, pointerEvents: borrowerProfile ? 'auto' : 'none' }}>
            <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '1rem', color: 'var(--color-primary-900)' }}>2. Nominee Selection</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', marginBottom: '1rem' }}>A nominee MUST be an existing member.</p>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <Input
                  id="nomineeNumber"
                  label="Existing Member Number"
                  value={nomineeNumber}
                  onChange={(e) => setNomineeNumber(e.target.value)}
                  placeholder="e.g. VN002"
                />
              </div>
              <Button type="button" variant="primary" onClick={handleNomineeSearch} disabled={nomineeLoading} style={{ minHeight: '44px' }}>
                {nomineeLoading ? <Spinner size="sm" /> : 'Search Nominee'}
              </Button>
            </div>
            
            {nomineeError && <div style={{ color: 'var(--color-danger-600)', fontSize: '0.875rem', marginBottom: '1rem' }}>{nomineeError}</div>}
            
            {nomineeProfile && (
              <>
                <div style={{ background: 'var(--color-primary-50)', padding: '1rem', borderRadius: '4px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  <div><strong>Name:</strong> {nomineeProfile.memberName}</div>
                  <div><strong>Mobile:</strong> {nomineeProfile.mobileNumber}</div>
                  <div><strong>{nomineeProfile.relatedPersonRelationship}:</strong> {nomineeProfile.relatedPersonName}</div>
                  <div><strong>Shop:</strong> {nomineeProfile.shopName || 'N/A'}</div>
                  <div><strong>Status:</strong> <Badge variant={nomineeProfile.status === 'ACTIVE' ? 'success' : 'danger'}>{nomineeProfile.status}</Badge></div>
                </div>

                <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0' }}>Nominee Loan History</h3>
                {nomineeLoans.length === 0 ? (
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)', fontStyle: 'italic' }}>No previous loans found</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-neutral-300)' }}>
                          <th style={{ padding: '0.5rem 0' }}>Date</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nomineeLoans.map(l => (
                          <tr key={l.id} style={{ borderBottom: '1px solid var(--color-neutral-200)' }}>
                            <td style={{ padding: '0.5rem 0' }}>{l.applicationDate}</td>
                            <td>{formatRupees(l.requestedAmountPaise)}</td>
                            <td>
                              <Badge variant={l.status === 'ACTIVE' ? 'primary' : l.status === 'OVERDUE' ? 'danger' : l.status === 'CLOSED' ? 'success' : 'default'}>
                                {l.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Section 3: Submission */}
          <section style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--color-neutral-200)', opacity: nomineeProfile ? 1 : 0.5, pointerEvents: nomineeProfile ? 'auto' : 'none' }}>
            <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '1rem', color: 'var(--color-primary-900)' }}>3. Loan Details</h2>
            
            <div style={{ maxWidth: '300px', marginBottom: '1.5rem' }}>
              <Input
                id="loanAmount"
                label="Requested Amount (₹)"
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="e.g. 50000"
              />
            </div>

            {submitError && <div style={{ color: 'var(--color-danger-600)', fontSize: '0.875rem', marginBottom: '1rem' }}>{submitError}</div>}

            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !loanAmount} style={{ width: '100%', minHeight: '48px', fontSize: '1.1rem' }}>
              {isSubmitting ? <Spinner size="sm" /> : 'Submit Loan Application'}
            </Button>
          </section>

        </div>
      </PageContainer>
    </AppShell>
  );
}
