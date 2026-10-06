'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import {
  getFilteredNavigation,
  type NavItem,
} from './navigation.config';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

function renderNavIcon(name: string) {
  switch (name) {
    case 'home':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case 'users':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case 'clipboard':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      );
    case 'banknotes':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case 'credit-card':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    case 'shield-check':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case 'cash':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'chart-bar':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'lock-closed':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useTranslation();

  const navGroups = getFilteredNavigation(user?.role);

  const isItemActive = (item: NavItem) => {
    if (item.path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === item.path || pathname?.startsWith(`${item.path}/`);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`.trim()}
        aria-label="Application navigation"
      >
        <Link href="/dashboard" className={styles.brandSection} onClick={onCloseMobile}>
          <div className={styles.brandEmblem}>VS</div>
          {!collapsed && (
            <div className={styles.brandText}>
              <span className={styles.brandName}>{t('common.appName')}</span>
              <span className={styles.brandSub}>Lappaikudikadu</span>
            </div>
          )}
        </Link>

        <nav className={styles.navSection}>
          {navGroups.map((group) => (
            <div key={group.id} className={styles.navGroup}>
              {!collapsed && (
                <span className={styles.groupTitle}>{t(group.titleKey)}</span>
              )}
              {group.items.map((item) => {
                const active = isItemActive(item);

                return (
                  <Link
                    key={item.id}
                    href={item.path}
                    onClick={onCloseMobile}
                    className={`${styles.navItem} ${active ? styles.active : ''}`.trim()}
                    title={collapsed ? t(item.labelKey) : undefined}
                  >
                    <span className={styles.navIcon}>{renderNavIcon(item.iconName)}</span>
                    {!collapsed && <span className={styles.navLabel}>{t(item.labelKey)}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {onToggleCollapse && (
          <div className={styles.footerSection}>
            <button
              type="button"
              onClick={onToggleCollapse}
              className={styles.collapseButton}
              aria-label={collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  transform: collapsed ? 'rotate(180deg)' : 'none',
                  transition: 'transform var(--transition-fast)',
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              {!collapsed && <span>{t('navigation.collapseSidebar')}</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
