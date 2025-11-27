"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from './api';

type User = { id: string; name: string; email: string; role: string } | null;
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  user: User;
  loading: boolean;
  status: AuthStatus;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getStorage = () => (typeof window === 'undefined' ? null : window.sessionStorage);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const clearTokens = useCallback(() => {
    const storage = getStorage();
    storage?.clear();
  }, []);

  const fetchMe = useCallback(async () => {
    const me = await apiGet<{ success?: boolean; id: string; name: string; email: string; role: string }>(
      '/api/auth/me',
    );
    setUser(me);
    setStatus('authenticated');
    setError(null);
  }, []);

  const tryRefresh = useCallback(async () => {
    try {
      await apiPost<{ accessToken: string }>(
        '/api/auth/refresh',
        {},
      );
      return true;
    } catch {
      setStatus('unauthenticated');
      return false;
    }
  }, []);

  const login = useCallback<AuthContextValue['login']>(async (email, password) => {
    setError(null);
    await apiPost<{ user: { id: string; name: string; email: string; role: string } }>(
      '/api/auth/login',
      { email, password },
    );
    await fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout', {});
    } finally {
      clearTokens();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [clearTokens]);

  useEffect(() => {
    // nothing to preload; cookies will be sent automatically
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        await fetchMe();
      } catch (e: any) {
        const ok = await tryRefresh();
        if (ok) {
          try {
            await fetchMe();
          } catch (e2: any) {
            if (!cancelled) {
              setError(e2?.message || 'Failed to fetch profile');
              setStatus('unauthenticated');
              clearTokens();
            }
          }
        } else if (!cancelled) {
          const msg = e?.message || 'Session expired. Please login again.';
          setError(msg);
          setStatus('unauthenticated');
          clearTokens();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, [tryRefresh, fetchMe, clearTokens]);

  const value = useMemo<AuthContextValue>(() => ({ user, loading, status, error, login, logout }), [
    user,
    loading,
    status,
    error,
    login,
    logout,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
