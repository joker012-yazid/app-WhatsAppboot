"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from './api';

type User = { id: string; name: string; email: string; role: string } | null;

type AuthContextValue = {
  user: User;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  accessToken: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

const getStorage = () => (typeof window === 'undefined' ? null : window.localStorage);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveTokens = useCallback((access: string, refresh?: string) => {
    const storage = getStorage();
    setAccessToken(access);
    storage?.setItem(ACCESS_KEY, access);
    if (refresh) {
      setRefreshToken(refresh);
      storage?.setItem(REFRESH_KEY, refresh);
    }
  }, []);

  const clearTokens = useCallback(() => {
    const storage = getStorage();
    setAccessToken(null);
    setRefreshToken(null);
    storage?.removeItem(ACCESS_KEY);
    storage?.removeItem(REFRESH_KEY);
  }, []);

  const fetchMe = useCallback(async () => {
    if (!accessToken) throw new Error('No access token');
    const me = await apiGet<{ id: string; name: string; email: string; role: string }>(
      '/api/auth/me',
      accessToken,
    );
    setUser(me);
  }, [accessToken]);

  const tryRefresh = useCallback(async () => {
    if (!refreshToken) return false;
    try {
      const data = await apiPost<{ accessToken: string }>(
        '/api/auth/refresh',
        { refreshToken },
        null,
      );
      saveTokens(data.accessToken);
      return true;
    } catch {
      return false;
    }
  }, [refreshToken, saveTokens]);

  const login = useCallback<AuthContextValue['login']>(async (email, password) => {
    setError(null);
    const data = await apiPost<{
      user: { id: string; name: string; email: string; role: string };
      accessToken: string;
      refreshToken: string;
    }>(
      '/api/auth/login',
      { email, password },
      null,
    );
    setUser(data.user);
    saveTokens(data.accessToken, data.refreshToken);
  }, [saveTokens]);

  const logout = useCallback(async () => {
    try {
      if (refreshToken) {
        await apiPost('/api/auth/logout', { refreshToken }, null);
      }
    } finally {
      clearTokens();
      setUser(null);
    }
  }, [refreshToken, clearTokens]);

  useEffect(() => {
    const storage = getStorage();
    const a = storage?.getItem(ACCESS_KEY) || null;
    const r = storage?.getItem(REFRESH_KEY) || null;
    setAccessToken(a);
    setRefreshToken(r);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        if (!accessToken && refreshToken) {
          const ok = await tryRefresh();
          if (!ok) return;
        }
        if (accessToken) {
          await fetchMe();
        }
      } catch (e: any) {
        // Attempt refresh on 401-like errors
        const ok = await tryRefresh();
        if (ok) {
          try {
            await fetchMe();
          } catch (e2: any) {
            setError(e2?.message || 'Failed to fetch profile');
          }
        } else {
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
  }, [accessToken, refreshToken, tryRefresh, fetchMe, clearTokens]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, error, login, logout, accessToken }),
    [user, loading, error, login, logout, accessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

