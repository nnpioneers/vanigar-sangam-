import React from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  wrapperClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    error,
    helperText,
    options,
    required,
    disabled,
    id,
    className = '',
    wrapperClassName = '',
    children,
    ...props
  },
  ref
) {
  const generatedId = React.useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  const containerClasses = [
    styles.selectContainer,
    error ? styles.hasError : '',
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`${styles.wrapper} ${wrapperClassName}`.trim()}>
      {label && (
        <div className={styles.labelRow}>
          <label htmlFor={selectId} className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        </div>
      )}

      <div className={containerClasses}>
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`${styles.select} ${className}`.trim()}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <span className={styles.arrow} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </span>
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
