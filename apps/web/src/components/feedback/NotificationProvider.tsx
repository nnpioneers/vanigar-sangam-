'use client';

import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import styles from './Notification.module.css';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number; // Duration in ms; 0 or negative disables auto-dismiss
}

export interface NotificationContextValue {
  notifications: NotificationItem[];
  showNotification: (item: Omit<NotificationItem, 'id'>) => string;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

const DEFAULT_DURATION = 5000; // 5 seconds
const MAX_NOTIFICATIONS = 5;

function renderIcon(type: NotificationType) {
  switch (type) {
    case 'success':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    case 'error':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
    case 'warning':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      );
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Clear timer if active
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setNotifications([]);
  }, []);

  const showNotification = useCallback(
    (item: Omit<NotificationItem, 'id'>) => {
      const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = item.duration !== undefined ? item.duration : DEFAULT_DURATION;

      const newItem: NotificationItem = {
        ...item,
        id,
        duration,
      };

      setNotifications((prev) => {
        const updated = [...prev, newItem];
        if (updated.length > MAX_NOTIFICATIONS) {
          // Remove oldest
          const [oldest, ...rest] = updated;
          if (oldest) {
            const timer = timersRef.current.get(oldest.id);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(oldest.id);
            }
          }
          return rest;
        }
        return updated;
      });

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, title?: string) => {
      return showNotification({ type: 'success', message, title });
    },
    [showNotification]
  );

  const error = useCallback(
    (message: string, title?: string) => {
      return showNotification({ type: 'error', message, title, duration: 7000 });
    },
    [showNotification]
  );

  const warning = useCallback(
    (message: string, title?: string) => {
      return showNotification({ type: 'warning', message, title, duration: 6000 });
    },
    [showNotification]
  );

  const info = useCallback(
    (message: string, title?: string) => {
      return showNotification({ type: 'info', message, title });
    },
    [showNotification]
  );

  // Clean up all timers on unmount
  useEffect(() => {
    const currentTimers = timersRef.current;
    return () => {
      currentTimers.forEach((t) => clearTimeout(t));
      currentTimers.clear();
    };
  }, []);

  const value: NotificationContextValue = {
    notifications,
    showNotification,
    success,
    error,
    warning,
    info,
    dismiss,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="System Notifications"
        className={styles.container}
      >
        {notifications.map((item) => (
          <div
            key={item.id}
            role={item.type === 'error' ? 'alert' : 'status'}
            className={`${styles.item} ${styles[item.type]}`}
          >
            <span className={styles.iconWrapper} aria-hidden="true">
              {renderIcon(item.type)}
            </span>
            <div className={styles.content}>
              {item.title && <h5 className={styles.title}>{item.title}</h5>}
              <p className={styles.message}>{item.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className={styles.closeButton}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
