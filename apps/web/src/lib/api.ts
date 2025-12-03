// Always hit the backend API (port 4000 by default)
const getApiBase = () => process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const API_BASE = getApiBase();

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  _retry?: boolean;
};

const getStorage = () => (typeof window === 'undefined' ? null : window.sessionStorage);
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const isAuthPath = (path: string) =>
  path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register') || path.startsWith('/api/auth/refresh');

let backendUnavailableLogged = false;

export async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, _retry } = opts;
  const url = `${API_BASE}${path}`;
  const storage = getStorage();
  const accessToken = storage?.getItem(ACCESS_TOKEN_KEY) || null;
  const refreshToken = storage?.getItem(REFRESH_TOKEN_KEY) || null;
  
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
        ...(accessToken && !isAuthPath ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    
    const text = await res.text();
    let data: any = {};
    
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        // If response is not JSON, use text as message
        data = { message: text };
      }
    }
    
    if (!res.ok) {
      const msg = data?.message || `HTTP ${res.status}: ${res.statusText}`;
      console.error(`[API] Request failed: ${method} ${url} - ${msg}`);
      if (res.status === 401) {
        console.warn('[API] Unauthorized – will let auth layer handle redirect / logout');
        if (!isAuthPath(path) && !_retry && refreshToken) {
          try {
            const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
              credentials: 'include',
            });
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              const nextAccess = refreshData?.accessToken;
              const nextRefresh = refreshData?.refreshToken;
              if (nextAccess) storage?.setItem(ACCESS_TOKEN_KEY, nextAccess);
              if (nextRefresh) storage?.setItem(REFRESH_TOKEN_KEY, nextRefresh);
              // retry original request once
              return apiFetch<T>(path, { ...opts, _retry: true });
            }
          } catch (refreshErr) {
            // fall through to clear tokens
            console.error('[API] Refresh token request failed', refreshErr);
          }
          storage?.removeItem(ACCESS_TOKEN_KEY);
          storage?.removeItem(REFRESH_TOKEN_KEY);
        }
      }
      
      // Check for connection/server errors
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        const connectionError = {
          code: 'BACKEND_UNAVAILABLE',
          message: 'Backend API server is not running. Please start the API server on port 4000.',
        };
        try {
          (globalThis as any).__toast?.error?.(connectionError.message);
        } catch {}
        const err = new Error(connectionError.message);
        (err as any).code = connectionError.code;
        throw err;
      }
      
      try {
        (globalThis as any).__toast?.error?.(msg);
      } catch {}
      throw new Error(msg);
    }
    
    return data as T;
  } catch (error: any) {
    // Check for network/connection errors
    if (error?.message?.includes('Failed to fetch') || 
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('ECONNREFUSED') ||
        error?.name === 'TypeError') {
      const connectionError = {
        code: 'BACKEND_UNAVAILABLE',
        message: 'Backend API server is not running. Please start the API server on port 4000.',
      };
      if (!backendUnavailableLogged) {
        console.error(`[API] Connection error: ${method} ${url}`, error);
        backendUnavailableLogged = true;
      }
      try {
        (globalThis as any).__toast?.error?.(connectionError.message);
      } catch {}
      const err = new Error(connectionError.message);
      (err as any).code = connectionError.code;
      throw err;
    }
    
    // Re-throw if it's already our Error
    if (error instanceof Error && error.message) {
      throw error;
    }
    // Otherwise, wrap in a new error
    const msg = error?.message || `Failed to fetch: ${method} ${url}`;
    console.error(`[API] Request error: ${method} ${url}`, error);
    throw new Error(msg);
  }
}

export const apiPost = <T = unknown>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body });

export const apiGet = <T = unknown>(path: string) => apiFetch<T>(path, { method: 'GET' });

export const apiPut = <T = unknown>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body });

export const apiDelete = <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' });

export async function apiUpload<T = unknown>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  if (!res.ok) {
    const msg = (data as any)?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
