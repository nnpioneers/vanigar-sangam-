'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/modal/Modal';
import { Button } from '../ui/button/Button';
import { useTranslation } from '@/hooks/useTranslation';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'warning';
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  isLoading = false,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [internalLoading, setInternalLoading] = useState(false);

  const resolvedTitle = title || t('feedback.confirmTitle');
  const resolvedDescription = description || t('feedback.confirmDefaultDesc');
  const resolvedConfirm = confirmLabel || t('feedback.confirm');
  const resolvedCancel = cancelLabel || t('feedback.cancel');

  const isExecuting = isLoading || internalLoading;

  const handleConfirm = async () => {
    try {
      setInternalLoading(true);
      await onConfirm();
    } finally {
      setInternalLoading(false);
      onClose();
    }
  };

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
      <Button
        variant="secondary"
        onClick={onClose}
        disabled={isExecuting}
      >
        {resolvedCancel}
      </Button>
      <Button
        variant={variant === 'danger' ? 'danger' : 'primary'}
        onClick={handleConfirm}
        isLoading={isExecuting}
      >
        {resolvedConfirm}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={isExecuting ? () => {} : onClose}
      title={resolvedTitle}
      description={resolvedDescription}
      size="sm"
      footer={footer}
    >
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-espresso-700)', lineHeight: 'var(--line-height-normal)' }}>
        {resolvedDescription}
      </p>
      {children}
    </Modal>
  );
}
