'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useNotification } from '@/hooks/useNotification';
import { AppShell, PageContainer, Breadcrumbs } from '@/components/layout';
import { Button, Input, Select, Alert, type SelectOption } from '@/components/ui';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import {
  fetchMemberProfile,
  updateMember,
  type MemberProfile,
  type UpdateMemberInput,
  type RelationshipType,
} from '@/lib/api/members';
import { ApiRequestError } from '@/lib/api/client';
import { getSafeErrorMessage, toSafeUserError } from '@/lib/error-utils';
import styles from './edit-member.module.css';

interface MemberFormState {
  memberName: string;
  address: string;
  mobileNumber: string;
  numberOfSheets: string;
  relatedPersonName: string;
  relatedPersonRelationship: RelationshipType;
  shopName: string;
  nomineeName: string;
  nomineeRelationship: string;
  nomineePhone: string;
  insuranceNumber: string;
}

const emptyFormState: MemberFormState = {
  memberName: '',
  address: '',
  mobileNumber: '',
  numberOfSheets: '1',
  relatedPersonName: '',
  relatedPersonRelationship: 'FATHER',
  shopName: '',
  nomineeName: '',
  nomineeRelationship: '',
  nomineePhone: '',
  insuranceNumber: '',
};

/**
 * Edit Member Screen (Phase 5.7)
 *
 * Route: /members/[memberNumber]/edit
 * Consumes:
 *   - GET  /api/v1/members/:memberNumber/profile (loading current data)
 *   - PATCH /api/v1/members/number/:memberNumber (saving updates)
 *
 * Guarantees:
 * - Pre-populates form with verified real member data
 * - Member Number is strictly immutable (rendered read-only and excluded from update payload)
 * - Required-field validation for identity, contact, relationship, and positive sheet count
 * - Unsaved changes confirmation dialog if modified
 * - Prevents duplicate form submissions
 * - Localized feedback with redirection back to Member Profile
 */
export default function EditMemberPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, error: authError } = useAuth();
  const { t } = useTranslation();
  const notification = useNotification();

  const rawParam = params?.memberNumber;
  const memberNumber = typeof rawParam === 'string'
    ? decodeURIComponent(rawParam)
    : Array.isArray(rawParam)
      ? decodeURIComponent(rawParam[0])
      : '';

  // Member Profile & Loading State
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [apiError, setApiError] = useState<unknown | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Form & Dirty State
  const [formData, setFormData] = useState<MemberFormState>(emptyFormState);
  const [initialData, setInitialData] = useState<MemberFormState>(emptyFormState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Fetch initial profile
  useEffect(() => {
    let isCancelled = false;

    async function load() {
      if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
        return;
      }

      if (!memberNumber) {
        setDataLoading(false);
        setApiError(
          new ApiRequestError({
            status: 404,
            code: 'NOT_FOUND',
            message: 'Member number not specified',
          })
        );
        return;
      }

      setDataLoading(true);
      setApiError(null);

      try {
        const result = await fetchMemberProfile(memberNumber);
        if (!isCancelled) {
          setProfile(result);
          const loadedForm: MemberFormState = {
            memberName: result.memberName || '',
            address: result.address || '',
            mobileNumber: result.mobileNumber || '',
            numberOfSheets: String(result.numberOfSheets || 1),
            relatedPersonName: result.relatedPersonName || '',
            relatedPersonRelationship: result.relatedPersonRelationship || 'FATHER',
            shopName: result.shopName || '',
            nomineeName: result.nomineeName || '',
            nomineeRelationship: result.nomineeRelationship || '',
            nomineePhone: result.nomineePhone || '',
            insuranceNumber: result.insuranceNumber || '',
          };
          setFormData(loadedForm);
          setInitialData(loadedForm);
        }
      } catch (err) {
        if (!isCancelled) {
          setApiError(err);
        }
      } finally {
        if (!isCancelled) {
          setDataLoading(false);
        }
      }
    }

    void load();

    return () => {
      isCancelled = true;
    };
  }, [user, memberNumber, refreshIndex]);

  // Auth gate checks
  if (authLoading) {
    return <LoadingState fullscreen label={t('common.loading')} />;
  }

  if (!user || authError) {
    const fromPath = `/members/${encodeURIComponent(memberNumber || '')}/edit`;
    router.replace(`/login?from=${encodeURIComponent(fromPath)}`);
    return <LoadingState fullscreen label={t('authentication.authenticating')} />;
  }

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return (
      <AppShell>
        <PageContainer>
          <ErrorState
            title={t('feedback.accessDenied')}
            message={t('feedback.accessDenied')}
            action={
              <Button onClick={() => router.push('/dashboard')}>
                {t('navigation.dashboard')}
              </Button>
            }
          />
        </PageContainer>
      </AppShell>
    );
  }

  const breadcrumbs = [
    { label: t('navigation.dashboard'), href: '/dashboard' },
    { label: t('members.title'), href: '/members' },
    { label: profile?.memberName || memberNumber, href: `/members/${encodeURIComponent(memberNumber)}` },
    { label: t('members.editMember') },
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

  // Dirty check: has any field changed from initialData?
  const isDirty = Boolean(
    formData.memberName !== initialData.memberName ||
    formData.address !== initialData.address ||
    formData.mobileNumber !== initialData.mobileNumber ||
    formData.numberOfSheets !== initialData.numberOfSheets ||
    formData.relatedPersonName !== initialData.relatedPersonName ||
    formData.relatedPersonRelationship !== initialData.relatedPersonRelationship ||
    formData.shopName !== initialData.shopName ||
    formData.nomineeName !== initialData.nomineeName ||
    formData.nomineeRelationship !== initialData.nomineeRelationship ||
    formData.nomineePhone !== initialData.nomineePhone ||
    formData.insuranceNumber !== initialData.insuranceNumber
  );

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      router.push(`/members/${encodeURIComponent(memberNumber)}`);
    }
  };

  const handleFieldChange = (field: keyof MemberFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.memberName.trim()) {
      errors.memberName = t('members.errMemberNameRequired');
    }
    if (!formData.address.trim()) {
      errors.address = t('members.errAddressRequired');
    }
    if (!formData.mobileNumber.trim()) {
      errors.mobileNumber = t('members.errMobileNumberRequired');
    }
    if (!formData.relatedPersonName.trim()) {
      errors.relatedPersonName = t('members.errRelatedPersonNameRequired');
    }
    const sheetsNum = Number(formData.numberOfSheets);
    if (isNaN(sheetsNum) || !Number.isInteger(sheetsNum) || sheetsNum <= 0) {
      errors.numberOfSheets = t('members.errNumberOfSheetsInvalid');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);

    // Note: Member Number is immutable and is NEVER sent in update payload
    const input: UpdateMemberInput = {
      memberName: formData.memberName.trim(),
      relatedPersonName: formData.relatedPersonName.trim(),
      relatedPersonRelationship: formData.relatedPersonRelationship,
      address: formData.address.trim(),
      mobileNumber: formData.mobileNumber.trim(),
      numberOfSheets: Number(formData.numberOfSheets),
      shopName: formData.shopName.trim() || null,
      nomineeName: formData.nomineeName.trim() || null,
      nomineeRelationship: formData.nomineeRelationship.trim() || null,
      nomineePhone: formData.nomineePhone.trim() || null,
      insuranceNumber: formData.insuranceNumber.trim() || null,
    };

    try {
      await updateMember(memberNumber, input);
      notification.success(t('members.memberUpdatedSuccess'));
      router.push(`/members/${encodeURIComponent(memberNumber)}`);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        if (err.status === 400 && err.details && typeof err.details === 'object' && 'errors' in err.details) {
          const detailErrors = (err.details as { errors: Array<{ field: string; message: string }> }).errors;
          if (Array.isArray(detailErrors)) {
            const mapped: Record<string, string> = {};
            for (const item of detailErrors) {
              if (item.field) {
                mapped[item.field] = item.message;
              }
            }
            setFieldErrors((prev) => ({ ...prev, ...mapped }));
          }
          setGeneralError(getSafeErrorMessage(err, t));
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

  // Determine error states
  const hasError = Boolean(apiError);
  const safeErr = apiError ? toSafeUserError(apiError) : null;
  const is404 = Boolean(hasError && (safeErr?.status === 404 || safeErr?.code === 'NOT_FOUND'));

  return (
    <AppShell>
      <PageContainer>
        <div className={styles.container}>
          {/* Breadcrumbs */}
          <Breadcrumbs items={breadcrumbs} />

          {/* Navigation Bar */}
          <nav className={styles.navBar} aria-label="Page navigation">
            <button
              type="button"
              onClick={handleCancel}
              className={styles.backButton}
              aria-label={t('members.backToProfile')}
            >
              <svg
                className={styles.backIcon}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 10H5M10 15l-5-5 5-5" />
              </svg>
              <span>{t('members.backToProfile')}</span>
            </button>
          </nav>

          {/* 404 State */}
          {is404 && (
            <div className={styles.sectionCard} role="alert">
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrapper} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h1 className={styles.sectionTitle}>{t('members.memberNotFoundTitle')}</h1>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-espresso-700)' }}>
                {t('members.memberNotFoundDesc', { memberNumber })}
              </p>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Button onClick={() => router.push('/members')}>
                  {t('members.backToMembers')}
                </Button>
              </div>
            </div>
          )}

          {/* General API Error State */}
          {hasError && !is404 && (
            <ErrorState
              error={apiError}
              onRetry={() => setRefreshIndex((i) => i + 1)}
              action={
                <Button variant="outline" onClick={() => router.push(`/members/${encodeURIComponent(memberNumber)}`)}>
                  {t('members.backToProfile')}
                </Button>
              }
            />
          )}

          {/* Loading Skeleton */}
          {dataLoading && !hasError && (
            <div className={styles.container} aria-label={t('members.loadingMemberData')} role="status" aria-live="polite">
              <div className={styles.skeletonCard} />
              <div className={styles.skeletonCard} />
              <div className={styles.skeletonCard} />
            </div>
          )}

          {/* Form Content */}
          {!dataLoading && !hasError && profile && (
            <>
              {/* Header Card */}
              <header className={styles.headerCard}>
                <div className={styles.headerTextGroup}>
                  <h1 className={styles.headerTitle}>{t('members.editMemberTitle')}</h1>
                  <p className={styles.headerSubtitle}>{t('members.editMemberSubtitle')}</p>
                </div>
                <span className={styles.memberNumberBadge} aria-label={`${t('members.colMemberNumber')}: ${profile.memberNumber}`}>
                  {profile.memberNumber}
                </span>
              </header>

              {/* General Form Error Alert */}
              {generalError && (
                <Alert
                  variant="error"
                  onDismiss={() => setGeneralError(null)}
                  aria-live="assertive"
                >
                  {generalError}
                </Alert>
              )}

              {/* Form */}
              <form className={styles.form} onSubmit={handleSubmit} noValidate>
                {/* Section 1: Basic Information */}
                <section className={styles.sectionCard} aria-labelledby="section-basic-title">
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIconWrapper} aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <h2 id="section-basic-title" className={styles.sectionTitle}>
                      {t('members.sectionBasic')}
                    </h2>
                  </div>

                  <div className={styles.fieldGrid}>
                    {/* Member Number: IMMUTABLE & READ-ONLY */}
                    <div>
                      <Input
                        id="memberNumber"
                        label={t('members.colMemberNumber')}
                        value={profile.memberNumber}
                        disabled
                        readOnly
                        helperText={t('members.memberNumberImmutableNote')}
                        aria-readonly="true"
                      />
                    </div>

                    <div>
                      <Input
                        id="memberName"
                        label={t('members.colMemberName')}
                        required
                        value={formData.memberName}
                        onChange={(e) => handleFieldChange('memberName', e.target.value)}
                        error={fieldErrors.memberName}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div>
                      <Input
                        id="mobileNumber"
                        type="tel"
                        label={t('members.colMobileNumber')}
                        required
                        value={formData.mobileNumber}
                        onChange={(e) => handleFieldChange('mobileNumber', e.target.value)}
                        error={fieldErrors.mobileNumber}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className={styles.spanFull}>
                      <Input
                        id="address"
                        label={t('members.colAddress')}
                        required
                        value={formData.address}
                        onChange={(e) => handleFieldChange('address', e.target.value)}
                        error={fieldErrors.address}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </section>

                {/* Section 2: Related Person */}
                <section className={styles.sectionCard} aria-labelledby="section-related-title">
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIconWrapper} aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <polyline points="17 11 19 13 23 9" />
                      </svg>
                    </div>
                    <h2 id="section-related-title" className={styles.sectionTitle}>
                      {t('members.sectionRelatedPerson')}
                    </h2>
                  </div>

                  <div className={styles.fieldGrid}>
                    <div>
                      <Input
                        id="relatedPersonName"
                        label={t('members.colRelatedPersonName')}
                        required
                        value={formData.relatedPersonName}
                        onChange={(e) => handleFieldChange('relatedPersonName', e.target.value)}
                        error={fieldErrors.relatedPersonName}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div>
                      <Select
                        id="relatedPersonRelationship"
                        label={t('members.colRelationship')}
                        required
                        options={relationshipOptions}
                        value={formData.relatedPersonRelationship}
                        onChange={(e) => handleFieldChange('relatedPersonRelationship', e.target.value as RelationshipType)}
                        error={fieldErrors.relatedPersonRelationship}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </section>

                {/* Section 3: Business Information */}
                <section className={styles.sectionCard} aria-labelledby="section-business-title">
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIconWrapper} aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                    </div>
                    <h2 id="section-business-title" className={styles.sectionTitle}>
                      {t('members.sectionBusiness')}
                    </h2>
                  </div>

                  <div className={styles.fieldGrid}>
                    <div>
                      <Input
                        id="shopName"
                        label={t('members.colShopName')}
                        value={formData.shopName}
                        onChange={(e) => handleFieldChange('shopName', e.target.value)}
                        error={fieldErrors.shopName}
                        placeholder="e.g. Senthil Provisions (optional)"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div>
                      <Input
                        id="numberOfSheets"
                        type="number"
                        min="1"
                        step="1"
                        label={t('members.colNumberOfSheets')}
                        required
                        value={formData.numberOfSheets}
                        onChange={(e) => handleFieldChange('numberOfSheets', e.target.value)}
                        error={fieldErrors.numberOfSheets}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </section>

                {/* Section 4: Nominee Information */}
                <section className={styles.sectionCard} aria-labelledby="section-nominee-title">
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIconWrapper} aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <h2 id="section-nominee-title" className={styles.sectionTitle}>
                      {t('members.sectionNominee')}
                    </h2>
                  </div>

                  <div className={styles.fieldGrid}>
                    <div>
                      <Input
                        id="nomineeName"
                        label={t('members.colNomineeName')}
                        value={formData.nomineeName}
                        onChange={(e) => handleFieldChange('nomineeName', e.target.value)}
                        error={fieldErrors.nomineeName}
                        placeholder="e.g. S. Meena (optional)"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div>
                      <Input
                        id="nomineeRelationship"
                        label={t('members.colNomineeRelationship')}
                        value={formData.nomineeRelationship}
                        onChange={(e) => handleFieldChange('nomineeRelationship', e.target.value)}
                        error={fieldErrors.nomineeRelationship}
                        placeholder="e.g. Wife (optional)"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className={styles.spanFull}>
                      <Input
                        id="nomineePhone"
                        type="tel"
                        label={t('members.colNomineePhone')}
                        value={formData.nomineePhone}
                        onChange={(e) => handleFieldChange('nomineePhone', e.target.value)}
                        error={fieldErrors.nomineePhone}
                        placeholder="e.g. 9842100002 (optional)"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </section>

                {/* Section 5: Insurance Information */}
                <section className={styles.sectionCard} aria-labelledby="section-insurance-title">
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIconWrapper} aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <h2 id="section-insurance-title" className={styles.sectionTitle}>
                      {t('members.sectionInsurance')}
                    </h2>
                  </div>

                  <div className={styles.fieldGrid}>
                    <div className={styles.spanFull}>
                      <Input
                        id="insuranceNumber"
                        label={t('members.colInsuranceNumber')}
                        value={formData.insuranceNumber}
                        onChange={(e) => handleFieldChange('insuranceNumber', e.target.value)}
                        error={fieldErrors.insuranceNumber}
                        placeholder="e.g. INS-001 (optional)"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </section>

                {/* Form Actions Footer */}
                <footer className={styles.actionsBar}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    {t('members.cancel')}
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t('members.savingChanges') : t('members.saveChanges')}
                  </Button>
                </footer>
              </form>

              {/* Unsaved Changes Confirmation Dialog */}
              <ConfirmDialog
                isOpen={showDiscardConfirm}
                onClose={() => setShowDiscardConfirm(false)}
                onConfirm={() => router.push(`/members/${encodeURIComponent(memberNumber)}`)}
                title={t('members.discardChangesTitle')}
                description={t('members.discardChangesDesc')}
                confirmLabel={t('members.discardConfirm')}
                cancelLabel={t('members.keepEditing')}
                variant="warning"
              />
            </>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}
