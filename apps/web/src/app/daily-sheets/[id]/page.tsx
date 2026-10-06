'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { AppShell, PageContainer, Breadcrumbs } from '@/components/layout';
import { Button, Badge } from '@/components/ui';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { getDailySheetById, type DailySheet } from '@/lib/api';
import { getSafeErrorMessage } from '@/lib/error-utils';
import Link from 'next/link';

export default function DailySheetDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const [sheet, setSheet] = useState<DailySheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?from=${encodeURIComponent(`/daily-sheets/${id}`)}`);
    }
  }, [user, authLoading, router, id]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getDailySheetById(id);
        if (!ignore) setSheet(data);
      } catch (err) {
        if (!ignore) setError(err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [user, id]);

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getModeLabel = (mode: string | null) => {
    switch (mode) {
      case 'CASH': return t('dailySheets.modeCash');
      case 'ONLINE': return t('dailySheets.modeOnline');
      case 'BANK_TRANSFER': return t('dailySheets.modeBankTransfer');
      case 'CHEQUE': return t('dailySheets.modeCheque');
      case 'OTHER': return t('dailySheets.modeOther');
      default: return mode || 'N/A';
    }
  };

  if (authLoading || (!user && loading)) {
    return <LoadingState label={t('common.loading')} fullscreen />;
  }

  return (
    <AppShell>
      <PageContainer>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Breadcrumbs
              items={[
                { label: t('navigation.dashboard'), href: '/dashboard' },
                { label: t('collections.title'), href: '/collections' },
                { label: t('dailySheets.title') },
              ]}
            />
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{t('dailySheets.title')} Details</h1>
          </div>

          {loading ? (
            <LoadingState label={t('common.loading')} />
          ) : error ? (
            <ErrorState
              title={t('common.noData')}
              message={getSafeErrorMessage(error)}
            />
          ) : sheet ? (
            <div style={{ background: 'var(--color-neutral-0)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', border: '1px solid var(--color-neutral-200)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-4)' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{sheet.businessDate}</h2>
                  <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>
                    ID: {sheet.id}
                  </div>
                </div>
                <div>
                  {sheet.isCorrected ? (
                    <Badge variant="danger">{t('collections.correctedBadge')}</Badge>
                  ) : (
                    <Badge variant="success">{t('collections.activeBadge')}</Badge>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>{t('collections.colMember')}</div>
                  <div style={{ fontWeight: 500 }}>
                    <Link href={`/members/${sheet.memberNumber}`} style={{ color: 'var(--color-primary-600)', textDecoration: 'none' }}>
                      {sheet.memberName} ({sheet.memberNumber})
                    </Link>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>{t('dailySheets.modeLabel')}</div>
                  <div style={{ fontWeight: 500 }}>{getModeLabel(sheet.paymentMode)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', background: 'var(--color-neutral-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>Total Due</div>
                  <div style={{ fontWeight: 600 }}>{formatCurrency(sheet.totalDuePaise)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>Actual Paid</div>
                  <div style={{ fontWeight: 700, color: 'var(--color-success-600)' }}>{formatCurrency(sheet.actualPaidPaise)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>Balance</div>
                  <div style={{ fontWeight: 600 }}>{formatCurrency(sheet.balanceRemainingPaise)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>Status</div>
                  <div style={{ fontWeight: 500 }}>{sheet.status}</div>
                </div>
              </div>

              {sheet.isCorrected && sheet.correctionReason && (
                <div style={{ background: 'var(--color-danger-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-danger-100)', marginTop: 'var(--space-4)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-danger-700)', marginBottom: 'var(--space-2)' }}>Correction Info</div>
                  <div style={{ color: 'var(--color-danger-900)' }}>Reason: {sheet.correctionReason}</div>
                </div>
              )}

              <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)' }}>
                <Button variant="outline" onClick={() => router.back()}>
                  {t('common.back')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </PageContainer>
    </AppShell>
  );
}
