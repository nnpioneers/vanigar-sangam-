'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './Header.module.css';

export interface HeaderProps {
  onOpenMobile?: () => void;
  title?: string;
  breadcrumbs?: React.ReactNode;
}

export function Header({ onOpenMobile, title, breadcrumbs }: HeaderProps) {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useTranslation();

  const getInitials = (name?: string) => {
    if (!name) return 'VS';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return t('authentication.superAdmin');
      case 'ADMIN':
        return t('authentication.admin');
      case 'CASHIER':
        return t('authentication.cashier');
      default:
        return role || '';
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        {onOpenMobile && (
          <button
            type="button"
            onClick={onOpenMobile}
            className={styles.mobileMenuBtn}
            aria-label="Open mobile navigation menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className={styles.titleArea}>
          {breadcrumbs}
          {title && !breadcrumbs && (
            <h1 style={{ fontSize: 'var(--font-size-lg)', fontFamily: 'var(--font-heading)', color: 'var(--color-espresso-900)' }}>
              {title}
            </h1>
          )}
        </div>
      </div>

      <div className={styles.rightSection}>
        {/* Language Switcher Toggle */}
        <div className={styles.langSwitcher} role="group" aria-label={t('common.language')}>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`${styles.langBtn} ${language === 'en' ? styles.active : ''}`.trim()}
            aria-pressed={language === 'en'}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('ta')}
            className={`${styles.langBtn} ${language === 'ta' ? styles.active : ''}`.trim()}
            aria-pressed={language === 'ta'}
          >
            தமிழ்
          </button>
        </div>

        {/* User Profile Badge */}
        {user && (
          <div className={styles.userBadge}>
            <div className={styles.avatar}>{getInitials(user.fullName)}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.fullName}</span>
              <span className={styles.userRole}>{getRoleLabel(user.role)}</span>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          type="button"
          onClick={() => logout()}
          className={styles.logoutBtn}
          title={t('authentication.logout')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>{t('authentication.logout')}</span>
        </button>
      </div>
    </header>
  );
}
