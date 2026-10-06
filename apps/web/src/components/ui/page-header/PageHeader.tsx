import React from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
}

export function PageHeader({ title, description, className = '', ...props }: PageHeaderProps) {
  return (
    <div className={`${styles.pageHeader} ${className}`.trim()} {...props}>
      <h1 className={styles.title}>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
