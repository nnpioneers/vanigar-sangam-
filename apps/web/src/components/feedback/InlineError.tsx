'use client';

import React from 'react';
import { Alert } from '../ui/alert/Alert';
import { useTranslation } from '@/hooks/useTranslation';
import { getSafeErrorMessage } from '@/lib/error-utils';

export interface InlineErrorProps {
  error?: unknown;
  message?: string;
  title?: string;
  onDismiss?: () => void;
  className?: string;
}

export function InlineError({
  error,
  message,
  title,
  onDismiss,
  className = '',
}: InlineErrorProps) {
  const { t } = useTranslation();

  const resolvedMessage = message || (error ? getSafeErrorMessage(error, t) : t('feedback.unexpectedError'));

  return (
    <Alert
      variant="error"
      title={title}
      onDismiss={onDismiss}
      className={className}
    >
      {resolvedMessage}
    </Alert>
  );
}
