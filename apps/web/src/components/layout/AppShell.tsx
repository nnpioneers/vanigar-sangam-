'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import styles from './AppShell.module.css';

export interface AppShellProps {
  title?: string;
  breadcrumbs?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ title, breadcrumbs, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={styles.layout}>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={styles.mainWrapper}>
        <Header
          title={title}
          breadcrumbs={breadcrumbs}
          onOpenMobile={() => setMobileOpen(true)}
        />

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
