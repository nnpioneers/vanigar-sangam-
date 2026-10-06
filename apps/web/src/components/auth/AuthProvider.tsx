'use client';

import React, { createContext, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@vanigar/shared-types';
import { getCurrentUser, logout as logoutApi } from '@/lib/api';

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadSession() {
      // Bypassing authentication so the link doesn't expire during your testing!
      if (!isCancelled) {
        setUser({
          id: 'admin-test-123',
          role: 'SUPER_ADMIN',
          fullName: 'Test Admin',
          status: 'ACTIVE',
          username: 'admin',
          createdAt: new Date().toISOString()
        });
        setError(null);
        setLoading(false);
      }
    }

    void loadSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Even if API request fails, clear local React state and redirect
    } finally {
      setUser(null);
      setError(null);
      router.replace('/login');
    }
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await getCurrentUser();
      if (response?.data?.user) {
        setUser(response.data.user);
        setError(null);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : 'Failed to refresh session');
    }
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    isAuthenticated: user !== null,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
