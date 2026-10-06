'use client';

import React, { useEffect } from 'react';
import { ErrorState } from '@/components/feedback/ErrorState';

export interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root-level unexpected error boundary.
 * Renders a full-screen safe error display with retry capabilities.
 */
export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      console.error('[Root Error Boundary Caught]:', error);
    }
  }, [error]);

  return <ErrorState error={error} onRetry={reset} fullscreen />;
}
