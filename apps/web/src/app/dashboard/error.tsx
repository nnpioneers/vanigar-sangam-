'use client';

import React, { useEffect } from 'react';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppShell, PageContainer } from '@/components/layout';

export interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Next.js error boundary for the Dashboard route hierarchy.
 * Preserves the application shell, visual identity, and safe error presentation.
 */
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    // In development only, log technical error details
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      console.error('[Dashboard Segment Error Caught]:', error);
    }
  }, [error]);

  return (
    <AppShell>
      <PageContainer>
        <ErrorState
          error={error}
          onRetry={reset}
        />
      </PageContainer>
    </AppShell>
  );
}
