'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { AppShell, PageContainer, Breadcrumbs } from '@/components/layout';
import { Button, Badge, Spinner, EmptyState } from '@/components/ui';
import { fetchCollectionById, type Collection } from '@/lib/api/collections';
import { getSafeErrorMessage } from '@/lib/error-utils';
import Link from 'next/link';

export default function CollectionDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?from=${encodeURIComponent(`/collections/${id}`)}`);
    }
  }, [user, authLoading, router, id]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCollectionById(id);
        if (!ignore) setCollection(data);
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

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'CASH': return t('dailySheets.modeCash');
      case 'ONLINE': return t('dailySheets.modeOnline');
      case 'BANK_TRANSFER': return t('dailySheets.modeBankTransfer');
      case 'CHEQUE': return t('dailySheets.modeCheque');
      case 'OTHER': return t('dailySheets.modeOther');
      default: return mode;
    }
  };

  if (authLoading || (!user && loading)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
        <Spinner size="lg" />
      </div>
    );
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
                { label: t('collections.title') + ' Detail' },
              ]}
            />
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{t('collections.title')} Detail</h1>
          </div>

          {loading ? (
            <div style={{ padding: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <EmptyState
              title={t('common.noData')}
              description={getSafeErrorMessage(error)}
              action={<Button onClick={() => window.location.reload()}>Retry</Button>}
            />
          ) : collection ? (
            <div style={{ background: 'var(--color-neutral-0)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', border: '1px solid var(--color-neutral-200)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 'var(--space-4)' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{collection.businessDate}</h2>
                  <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
                    {t('collections.colId')}: <span style={{ fontFamily: 'monospace' }}>{collection.id}</span>
                  </div>
                </div>
                <div>
                  {collection.isCorrected ? (
                    <Badge variant="danger">{t('collections.correctedBadge')}</Badge>
                  ) : (
                    <Badge variant="success">{t('collections.activeBadge')}</Badge>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)' }}>
                
                {/* 1. Member Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-neutral-500)', textTransform: 'uppercase' }}>Member Information</h3>
                  <div style={{ fontWeight: 500, fontSize: 'var(--text-lg)' }}>
                    <Link href={`/members/${collection.memberNumber}`} style={{ color: 'var(--color-primary-600)', textDecoration: 'none' }}>
                      {collection.memberName}
                    </Link>
                  </div>
                  <div style={{ color: 'var(--color-neutral-600)', fontSize: 'var(--text-sm)' }}>
                    {collection.memberNumber}
                  </div>
                </div>

                {/* 2. Payment Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-neutral-500)', textTransform: 'uppercase' }}>Payment Information</h3>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-xl)', color: collection.isCorrected ? 'var(--color-neutral-400)' : 'var(--color-success-600)' }}>
                    {formatCurrency(collection.amountPaise)}
                  </div>
                  <div style={{ color: 'var(--color-neutral-600)', fontSize: 'var(--text-sm)' }}>
                    {t('dailySheets.modeLabel')}: {getModeLabel(collection.paymentMode)}
                  </div>
                </div>
              </div>

              {/* 3. Daily Sheet & Traceability */}
              <div style={{ background: 'var(--color-neutral-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-neutral-700)' }}>Traceability References</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                  <div>
                    <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>Originating Daily Sheet</div>
                    <Link href={`/daily-sheets/${collection.dailySheetId}`} style={{ color: 'var(--color-primary-600)', textDecoration: 'none', fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
                      {collection.dailySheetId}
                    </Link>
                  </div>
                  {collection.cashTransactionId && (
                    <div>
                      <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>Cash Ledger Transaction</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{collection.cashTransactionId}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Recorded Information */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', padding: 'var(--space-4) 0', borderTop: '1px solid var(--color-neutral-100)' }}>
                <div>
                  <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>Recorded By</div>
                  <div style={{ fontWeight: 500 }}>{collection.recordedByAdminName || 'Admin'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>Recorded Time</div>
                  <div style={{ fontWeight: 500 }}>{new Date(collection.collectedAt).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* 5. Correction Info */}
              {collection.isCorrected && (
                <div style={{ background: 'var(--color-danger-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-danger-100)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-danger-700)', marginBottom: 'var(--space-2)' }}>Correction Traceability</div>
                  <div style={{ color: 'var(--color-danger-900)', fontSize: 'var(--text-sm)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><strong>Reason:</strong> {collection.correctionReason}</div>
                    <div><strong>Corrected At:</strong> {collection.correctedAt ? new Date(collection.correctedAt).toLocaleString('en-IN') : 'N/A'}</div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-4)' }}>
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
