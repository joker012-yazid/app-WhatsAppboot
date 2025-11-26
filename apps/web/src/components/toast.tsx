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

  const bg =
    variant === 'success'
      ? 'bg-emerald-600'
      : variant === 'error'
        ? 'bg-red-600'
        : variant === 'warning'
          ? 'bg-amber-600'
          : 'bg-zinc-800';

  return (
    <div className={`pointer-events-auto fixed bottom-4 right-4 z-50 max-w-sm rounded-md ${bg} px-4 py-3 text-white shadow-lg`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="text-sm">{message}</div>
        {onClose ? (
          <button className="ml-auto text-xs opacity-80 hover:opacity-100" onClick={onClose} aria-label="Close">
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}

