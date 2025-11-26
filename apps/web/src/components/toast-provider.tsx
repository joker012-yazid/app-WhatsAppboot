"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Toast } from './toast';

type Variant = 'info' | 'success' | 'error' | 'warning';

type ToastItem = {
  id: number;
  message: string;
  variant: Variant;
  duration?: number;
};

type ToastContextValue = {
  show: (message: string, options?: { variant?: Variant; duration?: number }) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastContextValue['show']>((message, options) => {
    const id = Math.floor(Date.now() + Math.random() * 1000);
    const item: ToastItem = {
      id,
      message,
      variant: options?.variant ?? 'info',
      duration: options?.duration ?? 2500,
    };
    setToasts((prev) => [...prev, item]);
  }, []);

  const api = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (m, d) => show(m, { variant: 'success', duration: d }),
      error: (m, d) => show(m, { variant: 'error', duration: d }),
      info: (m, d) => show(m, { variant: 'info', duration: d }),
      warning: (m, d) => show(m, { variant: 'warning', duration: d }),
    }),
    [show],
  );

  useEffect(() => {
    (globalThis as any).__toast = api;
    return () => {
      if ((globalThis as any).__toast === api) {
        delete (globalThis as any).__toast;
      }
    };
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} variant={t.variant} duration={t.duration} onClose={() => remove(t.id)} />
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
