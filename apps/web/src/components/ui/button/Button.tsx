import React from 'react';
import { Spinner } from '../spinner/Spinner';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled = false,
    className = '',
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const variantClass = styles[variant] || styles.primary;
  const sizeClass = styles[size] || styles.md;
  const widthClass = fullWidth ? styles.fullWidth : '';

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      className={`${styles.button} ${variantClass} ${sizeClass} ${widthClass} ${className}`.trim()}
      {...props}
    >
      {isLoading ? (
        <Spinner size={size === 'lg' ? 'md' : 'sm'} color={variant === 'primary' || variant === 'danger' ? 'white' : 'current'} />
      ) : leftIcon ? (
        <span className={styles.icon}>{leftIcon}</span>
      ) : null}
      <span>{children}</span>
      {!isLoading && rightIcon ? <span className={styles.icon}>{rightIcon}</span> : null}
    </button>
  );
});
