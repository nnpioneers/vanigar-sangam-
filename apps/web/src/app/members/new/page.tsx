'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useNotification } from '@/hooks/useNotification';
import { AppShell, PageContainer, Breadcrumbs } from '@/components/layout';
import { Button, Input, Select, Alert, type SelectOption } from '@/components/ui';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { createMember, type CreateMemberInput, type RelationshipType } from '@/lib/api/members';
import { ApiRequestError } from '@/lib/api/client';
import { getSafeErrorMessage } from '@/lib/error-utils';
import styles from './add-member.module.css';

export default function AddMemberPage() {
  const router = useRouter();
  const { user, loading: authLoading, error: authError } = useAuth();
  const { t } = useTranslation();
  const notification = useNotification();

  // Form State
  const [formData, setFormData] = useState({
    memberNumber: '',
    memberName: '',
    mobileNumber: '',
    dailyCollectionAmount: '',
    membershipStatus: 'ACTIVE',
    joinDate: new Date().toISOString().split('T')[0],
    
    shopName: '',
    shopCategory: 'Grocery',
    shopContactNumber: '',
    shopEmail: '',
    shopAddress: '',
    tradeLicense: '',
    
    successorName: '',
    successorRelationship: '' as RelationshipType | '',
    successorContactNumber: '',
    successorAlternateContact: '',
    successorEmail: '',
    successorTakeoverDate: '',
    successorResidentialAddress: '',
    successorRemarks: '',
    successorRelationshipOther: '',

    nomineeName: '',
    nomineeRelationship: '' as RelationshipType | '',
    nomineeRelationshipOther: '',
    nomineePhone: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  if (authLoading) return <LoadingState fullscreen label={t('common.loading')} />;
  if (!user || authError) {
    router.replace('/login?from=%2Fmembers%2Fnew');
    return <LoadingState fullscreen label={t('authentication.authenticating')} />;
  }
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState
            title={t('feedback.accessDenied')}
            message={t('feedback.accessDenied')}
            action={<Button onClick={() => router.push('/dashboard')}>{t('navigation.dashboard')}</Button>}
          />
        </PageContainer>
      </AppShell>
    );
  }

  const breadcrumbs = [
    { label: t('navigation.dashboard'), href: '/dashboard' },
    { label: t('members.title'), href: '/members' },
    { label: t('members.addMemberTitle') },
  ];

  const relationshipOptions: SelectOption[] = [
    { value: 'FATHER', label: t('members.relFather') },
    { value: 'MOTHER', label: t('members.relMother') },
    { value: 'HUSBAND', label: t('members.relHusband') },
    { value: 'WIFE', label: t('members.relWife') },
    { value: 'SON', label: t('members.relSon') },
    { value: 'DAUGHTER', label: t('members.relDaughter') },
    { value: 'OTHER', label: t('members.relOther') },
  ];

  const statusOptions: SelectOption[] = [
    { value: 'ACTIVE', label: t('common.active') },
    { value: 'INACTIVE', label: t('common.inactive') },
  ];

  const shopCategoryOptions: SelectOption[] = [
    { value: 'Grocery', label: 'Grocery' },
    { value: 'Textiles', label: 'Textiles' },
    { value: 'Hardware', label: 'Hardware' },
    { value: 'Electronics', label: 'Electronics' },
    { value: 'Other', label: 'Other' },
  ];

  const isDirty = Object.values(formData).some(val => val !== '' && val !== 'ACTIVE' && val !== 'Grocery' && val !== new Date().toISOString().split('T')[0]);

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      router.push('/members');
    }
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (generalError) setGeneralError(null);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.memberNumber.trim()) errors.memberNumber = t('members.errMemberNumberRequired');
    if (!formData.memberName.trim()) errors.memberName = t('members.errMemberNameRequired');
    if (!formData.mobileNumber.trim()) errors.mobileNumber = t('members.errMobileNumberRequired');
    if (!formData.dailyCollectionAmount.trim()) errors.dailyCollectionAmount = t('members.errDailyCollectionRequired');
    if (!formData.shopName.trim()) errors.shopName = t('members.errRelatedPersonNameRequired');
    if (!formData.shopAddress.trim()) errors.shopAddress = t('members.errAddressRequired');
    if (!formData.joinDate.trim()) errors.joinDate = t('members.errJoinDateRequired');
    if (!formData.shopCategory.trim()) errors.shopCategory = t('members.errShopCategoryRequired');

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setGeneralError(null);

    const input: CreateMemberInput = {
      memberNumber: formData.memberNumber.trim(),
      memberName: formData.memberName.trim(),
      mobileNumber: formData.mobileNumber.trim(),
      numberOfSheets: 1, // Legacy requirement
      dailyCollectionAmount: Number(formData.dailyCollectionAmount),
      joinDate: formData.joinDate,
      shopName: formData.shopName.trim(),
      shopCategory: formData.shopCategory,
      shopContactNumber: formData.shopContactNumber.trim(),
      shopEmail: formData.shopEmail.trim(),
      tradeLicense: formData.tradeLicense.trim(),
      address: formData.shopAddress.trim(),
      relatedPersonName: formData.successorName || 'None', // Legacy fallback
      relatedPersonRelationship: formData.successorRelationship as RelationshipType || 'OTHER', // Legacy fallback
      
      successorName: formData.successorName.trim(),
      successorRelationship: formData.successorRelationship === 'OTHER' 
        ? formData.successorRelationshipOther.trim() 
        : formData.successorRelationship,
      successorContactNumber: formData.successorContactNumber.trim(),
      successorAlternateContact: formData.successorAlternateContact.trim(),
      successorEmail: formData.successorEmail.trim(),
      successorTakeoverDate: formData.successorTakeoverDate.trim(),
      successorResidentialAddress: formData.successorResidentialAddress.trim(),
      successorRemarks: formData.successorRemarks.trim(),

      nomineeName: formData.nomineeName.trim(),
      nomineeRelationship: formData.nomineeRelationship === 'OTHER'
        ? formData.nomineeRelationshipOther.trim()
        : formData.nomineeRelationship,
      nomineePhone: formData.nomineePhone.trim(),
    };

    try {
      const created = await createMember(input);
      notification.success(t('members.memberCreatedSuccess'));
      router.push(`/members/${encodeURIComponent(created.memberNumber)}`);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        if (err.status === 409 || err.code === 'CONFLICT') {
          const conflictMsg = t('members.memberNumberAlreadyExists');
          setFieldErrors((prev) => ({ ...prev, memberNumber: conflictMsg }));
          setGeneralError(conflictMsg);
        } else {
          setGeneralError(getSafeErrorMessage(err, t));
        }
      } else {
        setGeneralError(getSafeErrorMessage(err, t));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <PageContainer>
        <div className={styles.container}>
          <Breadcrumbs items={breadcrumbs} />

          <nav className={styles.navBar} aria-label="Page navigation">
            <button type="button" onClick={handleCancel} className={styles.backButton} aria-label={t('members.backToMembers')}>
              <svg className={styles.backIcon} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 10H5M10 15l-5-5 5-5" />
              </svg>
              <span>{t('members.backToMembers')}</span>
            </button>
          </nav>

          <header className={styles.headerCard}>
            <h1 className={styles.headerTitle}>{t('members.addMemberTitle')}</h1>
          </header>

          {generalError && (
            <Alert variant="error" onDismiss={() => setGeneralError(null)} aria-live="assertive">
              {generalError}
            </Alert>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            
            {/* Section 1: Member Information */}
            <section className={styles.sectionCard} aria-labelledby="section-basic-title">
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrapper} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h2 id="section-basic-title" className={styles.sectionTitle}>{t('members.sectionMemberInfo')}</h2>
              </div>

              <div className={styles.fieldGrid}>
                <div>
                  <Input id="memberNumber" label={t('members.colMemberID')} required value={formData.memberNumber} onChange={(e) => handleFieldChange('memberNumber', e.target.value)} error={fieldErrors.memberNumber} placeholder="VS-1053" disabled={isSubmitting} />
                </div>
                <div>
                  <Input id="memberName" label={t('members.colFullMemberName')} required value={formData.memberName} onChange={(e) => handleFieldChange('memberName', e.target.value)} error={fieldErrors.memberName} placeholder="e.g. S. Ravi Kumar" disabled={isSubmitting} />
                </div>
                <div>
                  <Input id="mobileNumber" type="tel" label={t('members.colMemberContactPhone')} required value={formData.mobileNumber} onChange={(e) => handleFieldChange('mobileNumber', e.target.value)} error={fieldErrors.mobileNumber} placeholder="10-digit mobile" disabled={isSubmitting} />
                </div>
                <div>
                  <Input id="dailyCollectionAmount" type="number" label={t('members.colDailyCollectionAmount')} required value={formData.dailyCollectionAmount} onChange={(e) => handleFieldChange('dailyCollectionAmount', e.target.value)} error={fieldErrors.dailyCollectionAmount} placeholder="200" disabled={isSubmitting} />
                  <span style={{fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block'}}>{t('members.colDailyCollectionAmountSub')}</span>
                </div>
                <div>
                  <Input id="joinDate" type="date" label={t('members.colJoinDate')} required value={formData.joinDate} onChange={(e) => handleFieldChange('joinDate', e.target.value)} error={fieldErrors.joinDate} disabled={isSubmitting} />
                </div>
                <div>
                  <Select id="membershipStatus" label={t('members.colMembershipStatus')} required options={statusOptions} value={formData.membershipStatus} onChange={(e) => handleFieldChange('membershipStatus', e.target.value)} disabled={isSubmitting} />
                </div>
              </div>
            </section>

            {/* Section 2: Shop & Contact Details */}
            <section className={styles.sectionCard} aria-labelledby="section-shop-title">
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrapper} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <h2 id="section-shop-title" className={styles.sectionTitle}>{t('members.sectionShopContact')}</h2>
              </div>

              <div className={styles.fieldGrid}>
                <div>
                  <Input id="shopName" label={t('members.colShopBusinessName')} required value={formData.shopName} onChange={(e) => handleFieldChange('shopName', e.target.value)} error={fieldErrors.shopName} placeholder="e.g. Ravi Stores & Groceries" disabled={isSubmitting} />
                </div>
                <div>
                  <Select id="shopCategory" label={t('members.colShopCategory')} required options={shopCategoryOptions} value={formData.shopCategory} onChange={(e) => handleFieldChange('shopCategory', e.target.value)} error={fieldErrors.shopCategory} disabled={isSubmitting} />
                </div>
                <div>
                  <Input id="shopContactNumber" type="tel" label={t('members.colShopContactNum')} value={formData.shopContactNumber} onChange={(e) => handleFieldChange('shopContactNumber', e.target.value)} placeholder="Shop phone/mobile" disabled={isSubmitting} />
                </div>
                <div>
                  <Input id="shopEmail" type="email" label={t('members.colShopEmail')} value={formData.shopEmail} onChange={(e) => handleFieldChange('shopEmail', e.target.value)} placeholder="shop@example.com" disabled={isSubmitting} />
                </div>
                <div className={styles.spanFull}>
                  <Input id="shopAddress" label={t('members.colShopAddress')} required value={formData.shopAddress} onChange={(e) => handleFieldChange('shopAddress', e.target.value)} error={fieldErrors.shopAddress} placeholder="Full shop address in market / bazaar..." disabled={isSubmitting} />
                </div>
                <div className={styles.spanFull}>
                  <Input id="tradeLicense" label={t('members.colTradeLicense')} value={formData.tradeLicense} onChange={(e) => handleFieldChange('tradeLicense', e.target.value)} placeholder="TR-SLM-2026-XXXX or GSTIN" disabled={isSubmitting} />
                </div>
              </div>
            </section>

            {/* Section 3: Family Successor */}
            <section className={styles.sectionCard} aria-labelledby="section-successor-title">
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrapper} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h2 id="section-successor-title" className={styles.sectionTitle}>{t('members.sectionSuccessor')}</h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>{t('members.successorSubtext')}</p>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#115e59', fontWeight: 600 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {t('members.familyMember1')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                      <input type="radio" checked readOnly style={{ accentColor: '#10b981' }} />
                      {t('members.primarySuccessor')}
                    </label>
                    <button type="button" style={{ color: '#ef4444', backgroundColor: 'transparent', border: '1px solid #fecaca', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      {t('members.clear')}
                    </button>
                  </div>
                </div>

                <div className={styles.fieldGrid}>
                  <div>
                    <Input id="successorName" label={t('members.colSuccessorName')} value={formData.successorName} onChange={(e) => handleFieldChange('successorName', e.target.value)} placeholder="Family member's full name" disabled={isSubmitting} />
                  </div>
                  {formData.successorRelationship === 'OTHER' ? (
                    <div style={{ position: 'relative' }}>
                      <Input id="successorRelationshipOther" label={t('members.colSuccessorRel')} value={formData.successorRelationshipOther} onChange={(e) => handleFieldChange('successorRelationshipOther', e.target.value)} placeholder={t('members.specifyRelationshipPlaceholder')} disabled={isSubmitting} />
                      <button type="button" onClick={() => { handleFieldChange('successorRelationship', ''); handleFieldChange('successorRelationshipOther', ''); }} style={{ position: 'absolute', right: '10px', top: '35px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b', padding: '4px' }} title="Change selection">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Select id="successorRelationship" label={t('members.colSuccessorRel')} options={[{ value: '', label: t('members.selectRelationshipPlaceholder') }, ...relationshipOptions]} value={formData.successorRelationship} onChange={(e) => handleFieldChange('successorRelationship', e.target.value)} disabled={isSubmitting} />
                    </div>
                  )}
                  <div>
                    <Input id="successorContactNumber" type="tel" label={t('members.colSuccessorContact')} value={formData.successorContactNumber} onChange={(e) => handleFieldChange('successorContactNumber', e.target.value)} placeholder="10-digit mobile number" disabled={isSubmitting} />
                  </div>
                  <div>
                    <Input id="successorAlternateContact" type="tel" label={t('members.colSuccessorAltContact')} value={formData.successorAlternateContact} onChange={(e) => handleFieldChange('successorAlternateContact', e.target.value)} placeholder="Secondary mobile number" disabled={isSubmitting} />
                  </div>
                  <div>
                    <Input id="successorEmail" type="email" label={t('members.colSuccessorEmail')} value={formData.successorEmail} onChange={(e) => handleFieldChange('successorEmail', e.target.value)} placeholder="successor@example.com" disabled={isSubmitting} />
                  </div>
                  <div>
                    <Input id="successorTakeoverDate" label={t('members.colSuccessorDate')} value={formData.successorTakeoverDate} onChange={(e) => handleFieldChange('successorTakeoverDate', e.target.value)} placeholder="e.g. 2027-01-01, After 2 years, or Future" disabled={isSubmitting} />
                  </div>
                  <div>
                    <Input id="successorResidentialAddress" label={t('members.colSuccessorAddress')} value={formData.successorResidentialAddress} onChange={(e) => handleFieldChange('successorResidentialAddress', e.target.value)} placeholder="Personal / residential address" disabled={isSubmitting} />
                  </div>
                  <div>
                    <Input id="successorRemarks" label={t('members.colSuccessorRemarks')} value={formData.successorRemarks} onChange={(e) => handleFieldChange('successorRemarks', e.target.value)} placeholder="Special succession notes or handover plans" disabled={isSubmitting} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <button type="button" style={{ color: '#115e59', backgroundColor: '#f0fdf4', border: '1px dashed #6ee7b7', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                  {t('members.btnAddFamilyMember')}
                </button>
              </div>
            </section>

            {/* Section 4: Nominee Details */}
            <section className={styles.sectionCard} aria-labelledby="section-nominee-title">
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrapper} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <polyline points="17 11 19 13 23 9" />
                  </svg>
                </div>
                <h2 id="section-nominee-title" className={styles.sectionTitle}>{t('members.sectionNomineeDetails')}</h2>
              </div>

              <div className={styles.fieldGrid}>
                <div>
                  <Input id="nomineeName" label={t('members.colNomineeNameForm')} value={formData.nomineeName} onChange={(e) => handleFieldChange('nomineeName', e.target.value)} error={fieldErrors.nomineeName} disabled={isSubmitting} />
                </div>
                {formData.nomineeRelationship === 'OTHER' ? (
                  <div style={{ position: 'relative' }}>
                    <Input id="nomineeRelationshipOther" label={t('members.colNomineeRelationshipForm')} value={formData.nomineeRelationshipOther} onChange={(e) => handleFieldChange('nomineeRelationshipOther', e.target.value)} placeholder={t('members.specifyRelationshipPlaceholder')} disabled={isSubmitting} />
                    <button type="button" onClick={() => { handleFieldChange('nomineeRelationship', ''); handleFieldChange('nomineeRelationshipOther', ''); }} style={{ position: 'absolute', right: '10px', top: '35px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b', padding: '4px' }} title="Change selection">
                      ✕
                    </button>
                  </div>
                ) : (
                  <div>
                    <Select id="nomineeRelationship" label={t('members.colNomineeRelationshipForm')} value={formData.nomineeRelationship} onChange={(e) => handleFieldChange('nomineeRelationship', e.target.value)} options={[
                      { value: '', label: t('members.selectRelationshipPlaceholder') },
                      ...relationshipOptions
                    ]} error={fieldErrors.nomineeRelationship} disabled={isSubmitting} />
                  </div>
                )}
                <div>
                  <Input id="nomineePhone" type="tel" label={t('members.colNomineeContactNumber')} value={formData.nomineePhone} onChange={(e) => handleFieldChange('nomineePhone', e.target.value)} error={fieldErrors.nomineePhone} placeholder="10-digit mobile number" disabled={isSubmitting} />
                </div>
              </div>
            </section>

            {/* Form Actions Footer */}
            <footer className={styles.actionsBar} style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', padding: '1rem', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                {t('members.cancel')}
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
                {isSubmitting ? t('members.savingMember') : t('members.saveMemberAndShop')}
              </Button>
            </footer>
          </form>

          <ConfirmDialog
            isOpen={showDiscardConfirm}
            onClose={() => setShowDiscardConfirm(false)}
            onConfirm={() => router.push('/members')}
            title={t('members.discardChangesTitle')}
            description={t('members.discardChangesDesc')}
            confirmLabel={t('members.discardConfirm')}
            cancelLabel={t('members.keepEditing')}
            variant="warning"
          />
        </div>
      </PageContainer>
    </AppShell>
  );
}
