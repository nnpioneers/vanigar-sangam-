import React from 'react';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  subtle?: boolean;
}

export function Card({
  hoverable = false,
  subtle = false,
  className = '',
  children,
  ...props
}: CardProps) {
  const classes = [
    styles.card,
    hoverable ? styles.hoverable : '',
    subtle ? styles.subtle : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.cardHeader} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`${styles.cardTitle} ${className}`.trim()} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`${styles.cardDescription} ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.cardContent} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.cardFooter} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
