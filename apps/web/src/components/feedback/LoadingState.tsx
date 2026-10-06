'use client';

import React from 'react';
import { Spinner } from '../ui/spinner/Spinner';
import { useTranslation } from '@/hooks/useTranslation';

export interface LoadingStateProps {
  label?: string;
  description?: string;
  fullscreen?: boolean;
  className?: string;
}

export function LoadingState({
  label,
  description,
  fullscreen = false,
  className = '',
}: LoadingStateProps) {
  const { t } = useTranslation();
  const displayLabel = label || t('feedback.loading');

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
        gap: 'var(--space-3)',
        padding: 'var(--space-6)',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '240px',
        width: '100%',
        gap: 'var(--space-3)',
        padding: 'var(--space-6)',
      };

  return (
    <div
      role="status"
      aria-live="polite"
      style={containerStyle}
      className={className}
    >
      <Spinner size="lg" color="primary" label={displayLabel} />
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-espresso-700)',
        }}
      >
        {displayLabel}
      </span>
      {description && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-espresso-400)',
            maxWidth: '320px',
            textAlign: 'center',
          }}
        >
          {description}
        </span>
      )}
    </div>
  );
}
