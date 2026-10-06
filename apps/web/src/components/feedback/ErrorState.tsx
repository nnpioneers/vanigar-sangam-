'use client';

import React from 'react';
import { Button } from '../ui/button/Button';
import { useTranslation } from '@/hooks/useTranslation';
import { getSafeErrorMessage } from '@/lib/error-utils';

export interface ErrorStateProps {
  error?: unknown;
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
  fullscreen?: boolean;
  className?: string;
}

export function ErrorState({
  error,
  title,
  message,
  onRetry,
  action,
  fullscreen = false,
  className = '',
}: ErrorStateProps) {
  const { t } = useTranslation();

  const resolvedTitle = title || t('feedback.somethingWentWrong');
  const resolvedMessage = message || (error ? getSafeErrorMessage(error, t) : t('feedback.unexpectedError'));

  const containerStyle: React.CSSProperties = fullscreen
    ? {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--color-bg-app)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-modal)',
        gap: 'var(--space-4)',
        padding: 'var(--space-6)',
        textAlign: 'center',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        width: '100%',
        gap: 'var(--space-4)',
        padding: 'var(--space-8) var(--space-6)',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
        boxShadow: 'var(--shadow-xs)',
      };

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={containerStyle}
      className={className}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-danger-50)',
          border: '1px solid var(--color-danger-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-danger-600)',
        }}
        aria-hidden="true"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxWidth: '420px' }}>
        <h3
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-espresso-900)',
            margin: 0,
          }}
        >
          {resolvedTitle}
        </h3>
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-espresso-500)',
            lineHeight: 'var(--line-height-normal)',
            margin: 0,
          }}
        >
          {resolvedMessage}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('feedback.retry')}
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
