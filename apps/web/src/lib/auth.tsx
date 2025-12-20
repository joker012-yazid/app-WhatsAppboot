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
  login: (identifier: string, password: string) => Promise<void>;
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
    const response = await apiGet<{ success: boolean; user: { id: string; name: string; email: string; role: string } }>('/api/auth/me');
    console.log('[AUTH] fetchMe response:', response);
    const user = response.user || response; // Handle both old and new response formats
    setUser(user);
    setStatus('authenticated');
    setError(null);
    return user;
  }, []);

  const tryRefresh = useCallback(async () => {
    const { refresh } = loadStoredTokens();
    // If no refresh token stored, don't try to refresh
    if (!refresh) {
      return false;
    }
    try {
      const res = await apiPost<{ accessToken: string; refreshToken?: string }>('/api/auth/refresh', { refreshToken: refresh });
      if (res?.accessToken) {
        storeTokens(res.accessToken, res.refreshToken ?? refresh);
        setAccessToken(res.accessToken);
        return true;
      }
      return false;
    } catch (err: any) {
      clearTokens();
      return false;
    }
  }, [clearTokens, loadStoredTokens, storeTokens]);

  const login = useCallback<AuthContextValue['login']>(async (identifier, password) => {
    setError(null);
    setStatus('authenticating');
    try {
      // Determine if identifier is email or username
      const isEmail = identifier.includes('@');

      // Build request body
      const requestBody: any = {
        password,
      };

      // Add either email or username
      if (isEmail) {
        requestBody.email = identifier;
      } else {
        requestBody.username = identifier;
      }

      const res = await apiPost<{
        user: { id: string; name: string; email: string; role: string };
        accessToken?: string;
        refreshToken?: string;
      }>('/api/auth/login', requestBody);
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
      if (refresh) {
        await apiPost('/api/auth/logout', { refreshToken: refresh });
      }
    } catch {
      // Ignore logout errors
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
        const { access, refresh } = loadStoredTokens();
        let hasToken = Boolean(access);
        
        // Only try to refresh if we have a refresh token
        if (!hasToken && refresh) {
          hasToken = await tryRefresh();
        } else if (access) {
          setAccessToken(access);
        }
        
        if (hasToken) {
          await fetchMe();
          if (!cancelled) setStatus('authenticated');
        } else if (!cancelled) {
          // No tokens at all - user is not authenticated
          setStatus('unauthenticated');
          setUser(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          // Only set error if it's not a simple "no auth" situation
          const msg = e?.message || '';
          const isBackendError = msg.includes('Backend API') || msg.includes('BACKEND_UNAVAILABLE');
          if (isBackendError) {
          setError(msg);
          }
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
