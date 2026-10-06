'use client';

import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '@/components/auth/AuthProvider';

/**
 * Custom React hook to consume the current authentication session state.
 *
 * @throws {Error} if invoked outside an `<AuthProvider>` tree.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
