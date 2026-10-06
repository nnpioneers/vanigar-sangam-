'use client';

import { useContext } from 'react';
import {
  NotificationContext,
  type NotificationContextValue,
} from '@/components/feedback/NotificationProvider';

/**
 * Hook to access and trigger system notifications (toast messages).
 *
 * @throws {Error} if used outside `<NotificationProvider>`.
 */
export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
