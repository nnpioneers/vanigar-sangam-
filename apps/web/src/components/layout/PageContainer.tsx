import React from 'react';
import styles from './PageContainer.module.css';

export interface PageContainerProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: PageContainerProps) {
  return (
    <div className={`${styles.container} ${className}`.trim()}>
      {(title || actions) && (
        <div className={styles.header}>
          <div className={styles.titleArea}>
            {title && <h1 className={styles.title}>{title}</h1>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}

      <div className={styles.content}>{children}</div>
    </div>
  );
}
