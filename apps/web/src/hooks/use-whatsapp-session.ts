"use client";

import { useCallback, useEffect, useState } from 'react';

import {
  getWhatsappStatus,
  initWhatsappSession,
  resetWhatsappSession,
  type WhatsappConnectionStatus,
} from '@/lib/whatsapp';

export function useWhatsappSession() {
  const [status, setStatus] = useState<WhatsappConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await getWhatsappStatus();
      console.debug('[WhatsApp][session] status', s);
      setStatus(s);
    } catch (err) {
      console.error('[WhatsApp][session] status error', err);
    }
  }, []);

  const startSession = useCallback(
    async (forceNew = false) => {
      setLoading(true);
      try {
        const res = await initWhatsappSession(forceNew);
        console.debug('[WhatsApp][session] init', res);
        await refresh();
      } catch (err) {
        console.error('[WhatsApp][session] init error', err);
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  const reset = useCallback(async () => {
    setLoading(true);
    try {
      const res = await resetWhatsappSession();
      console.debug('[WhatsApp][session] reset', res);
      await refresh();
    } catch (err) {
      console.error('[WhatsApp][session] reset error', err);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!status) return;
    if (status.status === 'connecting' || status.status === 'qr_ready') {
      const id = setInterval(() => {
        refresh();
      }, 4000);
      return () => clearInterval(id);
    }
  }, [status, refresh]);

  return { status, loading, startSession, reset, refresh };
}
