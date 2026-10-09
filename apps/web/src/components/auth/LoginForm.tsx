'use client';

import React, { useState, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AUTH_ERROR_CODES } from '@vanigar/shared-types';
import { ApiRequestError, login } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import styles from './login.module.css';

export function LoginForm() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    const errors: { username?: string; password?: string } = {};

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      errors.username = 'Username is required';
    } else if (trimmedUsername.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    setFieldErrors(errors);

    if (errors.username) {
      usernameInputRef.current?.focus();
      return;
    }
    if (errors.password) {
      passwordInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        username: trimmedUsername,
        password,
      });

      // Successful login: session cookie is set in browser by backend.
      // Refresh AuthContext before navigating so dashboard doesn't render an unauthenticated ErrorState.
      await refreshUser();

      // Navigate to authenticated dashboard route.
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setIsSubmitting(false);

      if (err instanceof ApiRequestError) {
        switch (err.code) {
          case AUTH_ERROR_CODES.INVALID_CREDENTIALS:
            setErrorMessage('Invalid username or password.');
            passwordInputRef.current?.focus();
            break;
          case AUTH_ERROR_CODES.ACCOUNT_INACTIVE:
            setErrorMessage('Your account is inactive. Please contact the administrator.');
            break;
          case AUTH_ERROR_CODES.ACCOUNT_SUSPENDED:
            setErrorMessage('Your account has been suspended. Please contact the administrator.');
            break;
          default:
            setErrorMessage('Unable to sign in right now. Please try again.');
            break;
        }
      } else {
        setErrorMessage('Unable to sign in right now. Please try again.');
      }
    }
  };

  return (
    <div className={styles.loginCard}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Welcome Back</h2>
        <div className={styles.goldAccent} aria-hidden="true" />
        <p className={styles.cardSubtitle}>
          Login to access Vanigar Sangam
          <br />
          Management System
        </p>
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div className={styles.errorBanner} role="alert" aria-live="assertive">
          <svg
            className={styles.errorIcon}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Login Form */}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {/* Username field */}
        <div className={styles.fieldGroup}>
          <label htmlFor="username" className={styles.label}>
            Username / ID
          </label>
          <div className={styles.inputWrapper}>
            <svg
              className={styles.inputIcon}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <input
              id="username"
              name="username"
              type="text"
              ref={usernameInputRef}
              autoComplete="username"
              placeholder="Username / ID"
              disabled={isSubmitting}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (fieldErrors.username) {
                  setFieldErrors((prev) => ({ ...prev, username: undefined }));
                }
              }}
              className={`${styles.input} ${fieldErrors.username ? styles.inputError : ''}`}
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={fieldErrors.username ? 'username-error' : undefined}
            />
          </div>
          {fieldErrors.username && (
            <span id="username-error" className={styles.fieldErrorText} role="alert">
              {fieldErrors.username}
            </span>
          )}
        </div>

        {/* Password field */}
        <div className={styles.fieldGroup}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <div className={styles.inputWrapper}>
            <svg
              className={styles.inputIcon}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              ref={passwordInputRef}
              autoComplete="current-password"
              placeholder="Password"
              disabled={isSubmitting}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              className={styles.togglePasswordBtn}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showPassword ? (
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                  />
                </svg>
              ) : (
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <span id="password-error" className={styles.fieldErrorText} role="alert">
              {fieldErrors.password}
            </span>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              <span>Signing in...</span>
            </>
          ) : (
            <span>Login &rarr;</span>
          )}
        </button>

        {/* Below button security indicator */}
        <div className={styles.secureNote}>
          <svg
            className={styles.secureIcon}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>Secure Access</span>
        </div>

        {/* Divider & card footer */}
        <hr className={styles.cardDivider} />

        <p className={styles.cardFooter}>Vanigar Sangam &nbsp;|&nbsp; Labbaikudikadu</p>
      </form>
    </div>
  );
}
