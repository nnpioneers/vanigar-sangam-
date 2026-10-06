import React from 'react';
import styles from './Spinner.module.css';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'current' | 'gold' | 'white';
  label?: string;
}

export function Spinner({
  size = 'md',
  color = 'current',
  label = 'Loading...',
  className = '',
  ...props
}: SpinnerProps) {
  const sizeClass = styles[size] || styles.md;
  const colorClass = styles[color] || styles.current;

  return (
    <span
      role="status"
      aria-label={label}
      className={`${styles.spinner} ${sizeClass} ${colorClass} ${className}`.trim()}
      {...props}
    >
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
        {label}
      </span>
    </span>
  );
}
