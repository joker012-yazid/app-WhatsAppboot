// In development, use relative URLs to leverage Next.js proxy (same-origin = cookies work)
// In production or when explicitly set, use the full API URL
const getApiBase = () => {
  // Server-side: use full URL
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  }
  // Client-side in development: use relative URL to leverage Next.js proxy
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_API_BASE_URL) {
    return '';
  }
  // Client-side with explicit API URL: use it (for production or custom setups)
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
};

export const API_BASE = getApiBase();

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, headers } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  if (!res.ok) {
    const msg = (data as any)?.message || `HTTP ${res.status}`;
    try {
      (globalThis as any).__toast?.error?.(msg);
    } catch {}
    throw new Error(msg);
  }
  return data;
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
