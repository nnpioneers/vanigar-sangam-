'use client';

import React, { useEffect, useCallback } from 'react';
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  className = '',
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  const sizeClass = styles[size] || styles.md;

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-desc' : undefined}
        className={`${styles.modal} ${sizeClass} ${className}`.trim()}
      >
        {(title || description) && (
          <div className={styles.header}>
            <div className={styles.titleContainer}>
              {title && (
                <h3 id="modal-title" className={styles.title}>
                  {title}
                </h3>
              )}
              {description && (
                <p id="modal-desc" className={styles.description}>
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Close dialog"
              onClick={onClose}
              className={styles.closeButton}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
