import React from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    startAdornment,
    endAdornment,
    required,
    disabled,
    id,
    className = '',
    wrapperClassName = '',
    ...props
  },
  ref
) {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const containerClasses = [
    styles.inputContainer,
    error ? styles.hasError : '',
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`${styles.wrapper} ${wrapperClassName}`.trim()}>
      {label && (
        <div className={styles.labelRow}>
          <label htmlFor={inputId} className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        </div>
      )}

      <div className={containerClasses}>
        {startAdornment && <span className={styles.startAdornment}>{startAdornment}</span>}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`${styles.input} ${className}`.trim()}
          {...props}
        />
        {endAdornment && <span className={styles.endAdornment}>{endAdornment}</span>}
      </div>

      {error ? (
        <span id={errorId} role="alert" className={styles.errorMessage}>
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} className={styles.helperText}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
});
