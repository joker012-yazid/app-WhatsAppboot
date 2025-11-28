"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
};

type PendingConfirm = ConfirmOptions & { id: number; resolve: (v: boolean) => void };

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<PendingConfirm | null>(null);
  const [mounted, setMounted] = useState(false);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // Prevent hydration mismatch by only rendering portal after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const confirm = useCallback<ConfirmContextValue['confirm']>((options) => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        id: Date.now(),
        resolve,
        title: options.title ?? 'Confirm action',
        description: options.description ?? 'Are you sure you want to proceed? This action cannot be undone.',
        confirmText: options.confirmText ?? 'Confirm',
        cancelText: options.cancelText ?? 'Cancel',
        variant: options.variant ?? 'default',
      });
    });
  }, []);

  const api = useMemo(() => ({ confirm }), [confirm]);

  const onClose = useCallback((val: boolean) => {
    setDialog((current) => {
      if (!current) return null;
      current.resolve(val);
      return null;
    });
  }, []);

  // Focus management & keyboard handling
  useEffect(() => {
    if (!dialog) return;

    previouslyFocused.current = (document.activeElement as HTMLElement) || null;
    // Focus confirm button by default after paint
    const t = setTimeout(() => {
      (confirmBtnRef.current || cancelBtnRef.current)?.focus();
    }, 0);

    const handleKey = (e: KeyboardEvent) => {
      if (!dialog) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(false);
        return;
      }
      if (e.key === 'Enter') {
        // Avoid submitting from textarea inputs if any (none in this dialog)
        e.preventDefault();
        onClose(true);
        return;
      }
      if (e.key === 'Tab') {
        const focusables = [cancelBtnRef.current, confirmBtnRef.current].filter(
          Boolean,
        ) as HTMLElement[];
        if (focusables.length === 0) return;
        const idx = focusables.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey) {
          // backwards
          const next = idx <= 0 ? focusables[focusables.length - 1] : focusables[idx - 1];
          e.preventDefault();
          next.focus();
        } else {
          const next = idx === -1 || idx >= focusables.length - 1 ? focusables[0] : focusables[idx + 1];
          e.preventDefault();
          next.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handleKey);
      // Restore focus to the previously focused element
      try {
        previouslyFocused.current?.focus();
      } catch {}
    };
  }, [dialog, onClose]);

  const dialogContent = mounted && dialog ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onClose(false)} />
      <div
        className="relative z-10 w-full max-w-sm rounded-xl border border-slate-800 bg-slate-950/90 p-5 shadow-2xl shadow-black/40 outline-none backdrop-blur"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        tabIndex={-1}
      >
        <h3 id="confirm-title" className="mb-1 text-lg font-semibold text-slate-50">
          {dialog.title}
        </h3>
        <p id="confirm-desc" className="mb-4 text-sm text-slate-300">
          {dialog.description}
        </p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelBtnRef}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            onClick={() => onClose(false)}
          >
            {dialog.cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            className={`rounded-md px-3 py-1.5 text-sm text-white transition ${
              dialog.variant === 'destructive'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-sky-600 hover:bg-sky-500'
            }`}
            onClick={() => onClose(true)}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {mounted && typeof document !== 'undefined' && dialogContent
        ? createPortal(dialogContent, document.body)
        : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}
