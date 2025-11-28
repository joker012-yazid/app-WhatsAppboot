"use client";

import { useEffect } from 'react';

export function Toast({
  message,
  variant = 'info',
  onClose,
  duration = 2500,
}: {
  message: string;
  variant?: 'info' | 'success' | 'error' | 'warning';
  onClose?: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(() => onClose && onClose(), duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  const accent =
    variant === 'success'
      ? 'border-emerald-500/60 text-emerald-50'
      : variant === 'error'
        ? 'border-red-500/60 text-red-50'
        : variant === 'warning'
          ? 'border-amber-500/60 text-amber-50'
          : 'border-slate-700 text-slate-50';

  return (
    <div
      className={`pointer-events-auto fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-slate-950/90 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur ${accent}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="text-sm">{message}</div>
        {onClose ? (
          <button
            className="ml-auto text-xs text-slate-300 opacity-80 transition hover:opacity-100"
            onClick={onClose}
            aria-label="Close"
          >
            x
          </button>
        ) : null}
      </div>
    </div>
  );
}
