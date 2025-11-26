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
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

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

  const onClose = (val: boolean) => {
    if (!dialog) return;
    dialog.resolve(val);
    setDialog(null);
  };

  // Focus management & keyboard handling
  useEffect(() => {
    if (dialog) {
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
    }
  }, [dialog]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation">
          <div className="absolute inset-0 bg-black/40" onClick={() => onClose(false)} />
          <div
            className="relative z-10 w-full max-w-sm rounded-md border bg-card p-4 shadow-xl outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            tabIndex={-1}
          >
            <h3 id="confirm-title" className="mb-1 text-lg font-semibold">
              {dialog.title}
            </h3>
            <p id="confirm-desc" className="mb-4 text-sm text-muted-foreground">
              {dialog.description}
            </p>
            <div className="flex justify-end gap-2">
              <button
                ref={cancelBtnRef}
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={() => onClose(false)}
              >
                {dialog.cancelText}
              </button>
              <button
                ref={confirmBtnRef}
                className={`rounded-md px-3 py-1.5 text-sm text-white ${dialog.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`}
                onClick={() => onClose(true)}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}
