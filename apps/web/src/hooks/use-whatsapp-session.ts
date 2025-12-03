"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getWhatsappStatus,
  initWhatsappSession,
  resetWhatsappSession,
  type WhatsappConnectionStatus,
} from '@/lib/whatsapp';

export function useWhatsappSession() {
  const [status, setStatus] = useState<WhatsappConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugStatusJson, setDebugStatusJson] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const lastLoggedStatus = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const nextStatus = await getWhatsappStatus();
      const serialized = JSON.stringify(nextStatus);
      if (lastLoggedStatus.current !== serialized) {
        console.log('[WhatsApp] status changed', {
          status: nextStatus.status,
          hasQR: nextStatus.hasQR,
          error: nextStatus.lastError ?? 'none',
        });
        lastLoggedStatus.current = serialized;
      }
      setStatus(nextStatus);
      setDebugStatusJson(JSON.stringify(nextStatus, null, 2));
    } catch (err: any) {
      console.error('[WhatsApp][session] status error', err);
      const errorStatus: WhatsappConnectionStatus = {
        status: 'error',
        qrImage: null,
        hasQR: false,
        lastError: err?.message || 'Failed to fetch WhatsApp status',
      };
      lastLoggedStatus.current = JSON.stringify(errorStatus);
      setStatus(errorStatus);
      setDebugStatusJson(JSON.stringify(errorStatus, null, 2));
    }
  }, []);

  const startSession = useCallback(
    async (forceNew = false) => {
      if (status?.status === 'connecting' || status?.status === 'connected' || status?.status === 'qr_ready') return;
      setLoading(true);
      setIsConnecting(true);
      try {
        await initWhatsappSession(forceNew);
        await refresh();
      } catch (err: any) {
        console.error('[WhatsApp][session] init error', err);
        const errorStatus: WhatsappConnectionStatus = {
          status: 'error',
          qrImage: null,
          hasQR: false,
          lastError: err?.message || 'Failed to start WhatsApp session',
        };
        setStatus(errorStatus);
        setDebugStatusJson(JSON.stringify(errorStatus, null, 2));
      } finally {
        setLoading(false);
        setIsConnecting(false);
      }
    },
    [refresh, status?.status],
  );

  const reset = useCallback(async () => {
    setLoading(true);
    try {
      await resetWhatsappSession();
      const disconnectedStatus: WhatsappConnectionStatus = {
        status: 'disconnected',
        qrImage: null,
        hasQR: false,
        lastError: null,
      };
      setStatus(disconnectedStatus);
      setDebugStatusJson(JSON.stringify(disconnectedStatus, null, 2));
    } catch (err: any) {
      console.error('[WhatsApp][session] reset error', err);
      const errorStatus: WhatsappConnectionStatus = {
        status: 'error',
        qrImage: null,
        hasQR: false,
        lastError: err?.message || 'Failed to reset WhatsApp session',
      };
      setStatus(errorStatus);
      setDebugStatusJson(JSON.stringify(errorStatus, null, 2));
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
      }, 3000);
      return () => clearInterval(id);
    }
  }, [status, refresh]);

  return { status, loading, startSession, reset, refresh, debugStatusJson, isConnecting };
}
