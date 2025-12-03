"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from './api';

type User = { id: string; name: string; email: string; role: string } | null;
type AuthStatus = 'unauthenticated' | 'authenticating' | 'authenticated' | 'error';

type AuthContextValue = {
  user: User;
  status: AuthStatus;
  error: string | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getStorage = () => (typeof window === 'undefined' ? null : window.sessionStorage);
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User>(null);
  const [status, setStatus] = useState<AuthStatus>('authenticating');
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const loading = status === 'authenticating';

  const clearTokens = useCallback(() => {
    const storage = getStorage();
    storage?.removeItem(ACCESS_TOKEN_KEY);
    storage?.removeItem(REFRESH_TOKEN_KEY);
    setAccessToken(null);
  }, []);

  const loadStoredTokens = useCallback(() => {
    const storage = getStorage();
    if (!storage) return { access: null, refresh: null };
    return {
      access: storage.getItem(ACCESS_TOKEN_KEY),
      refresh: storage.getItem(REFRESH_TOKEN_KEY),
    };
  }, []);

  const storeTokens = useCallback((nextAccess?: string | null, nextRefresh?: string | null) => {
    const storage = getStorage();
    if (!storage) return;
    if (nextAccess) storage.setItem(ACCESS_TOKEN_KEY, nextAccess);
    if (nextRefresh) storage.setItem(REFRESH_TOKEN_KEY, nextRefresh);
  }, []);

  const fetchMe = useCallback(async () => {
    const me = await apiGet<{ success?: boolean; id: string; name: string; email: string; role: string }>('/api/auth/me');
    setUser(me);
    setStatus('authenticated');
    setError(null);
    return me;
  }, []);

  const tryRefresh = useCallback(async () => {
    const { refresh } = loadStoredTokens();
    const body = refresh ? { refreshToken: refresh } : {};
    try {
      const res = await apiPost<{ accessToken: string; refreshToken?: string }>('/api/auth/refresh', body);
      if (res?.accessToken) {
        storeTokens(res.accessToken, res.refreshToken ?? refresh ?? null);
        setAccessToken(res.accessToken);
        return true;
      }
      return false;
    } catch (err: any) {
      clearTokens();
      return false;
    }
  }, [clearTokens, loadStoredTokens, storeTokens]);

  const login = useCallback<AuthContextValue['login']>(async (email, password) => {
    setError(null);
    setStatus('authenticating');
    try {
      const res = await apiPost<{
        user: { id: string; name: string; email: string; role: string };
        accessToken?: string;
        refreshToken?: string;
      }>('/api/auth/login', { email, password });
      if (res?.accessToken) {
        storeTokens(res.accessToken, res.refreshToken ?? null);
        setAccessToken(res.accessToken);
      }
      const me = res?.user ? res.user : await fetchMe();
      setUser(me as any);
      setStatus('authenticated');
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      setError(msg);
      setStatus('unauthenticated');
      clearTokens();
      throw err;
    }
  }, [fetchMe, storeTokens, clearTokens]);

  const logout = useCallback(async () => {
    try {
      const { refresh } = loadStoredTokens();
      await apiPost('/api/auth/logout', refresh ? { refreshToken: refresh } : {});
    } finally {
      clearTokens();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [clearTokens, loadStoredTokens]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      setStatus('authenticating');
      try {
        const { access } = loadStoredTokens();
        let hasToken = Boolean(access);
        if (!hasToken) {
          hasToken = await tryRefresh();
        } else {
          setAccessToken(access || null);
        }
        if (hasToken) {
          await fetchMe();
          if (!cancelled) setStatus('authenticated');
        } else if (!cancelled) {
          setStatus('unauthenticated');
          setUser(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.message || 'Session expired. Please login again.';
          setError(msg);
          setStatus('unauthenticated');
          setUser(null);
          clearTokens();
        }
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, [tryRefresh, fetchMe, clearTokens, loadStoredTokens]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      status,
      error,
      login,
      logout,
      accessToken,
    }),
    [user, loading, status, error, login, logout, accessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
