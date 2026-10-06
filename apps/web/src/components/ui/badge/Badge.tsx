import React from 'react';
import styles from './Badge.module.css';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'gold';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
  children,
  ...props
}: BadgeProps) {
  const variantClass = styles[variant] || styles.default;
  const sizeClass = styles[size] || styles.md;

  return (
    <span className={`${styles.badge} ${variantClass} ${sizeClass} ${className}`.trim()} {...props}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
