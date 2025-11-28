"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getWhatsappChats,
  getWhatsappMessages,
  getWhatsappStatus,
  initWhatsappSession,
  resetWhatsappSession,
  sendWhatsappMessage,
  type WhatsappChatSummary,
  type WhatsappConnectionStatus,
  type WhatsappMessage,
} from '@/lib/whatsapp';

export type FilterType = 'all' | 'unread' | 'groups';

type HookState = {
  status: WhatsappConnectionStatus | null;
  chats: WhatsappChatSummary[];
  selectedChatId: string | null;
  messages: WhatsappMessage[];
  filter: FilterType;
  loadingStatus: boolean;
  loadingChats: boolean;
  loadingMessages: boolean;
  sending: boolean;
};

const initialState: HookState = {
  status: null,
  chats: [],
  selectedChatId: null,
  messages: [],
  filter: 'all',
  loadingStatus: false,
  loadingChats: false,
  loadingMessages: false,
  sending: false,
};

export function useWhatsappChat() {
  const [state, setState] = useState<HookState>(initialState);
  const pollingStatusRef = useRef<NodeJS.Timeout | null>(null);
  const pollingChatsRef = useRef<NodeJS.Timeout | null>(null);

  const refreshStatus = useCallback(async () => {
    setState((s) => ({ ...s, loadingStatus: true }));
    try {
      const status = await getWhatsappStatus();
      console.debug('[WhatsApp][status]', status);
      setState((s) => ({ ...s, status, loadingStatus: false }));
    } catch (error: any) {
      console.error('[WhatsApp][status] error', error);
      setState((s) => ({ ...s, loadingStatus: false, status: { status: 'error', qrImage: null, hasQR: false, lastError: error?.message } }));
    }
  }, []);

  const startSession = useCallback(
    async (forceNew?: boolean) => {
      setState((s) => ({ ...s, loadingStatus: true }));
      try {
        const res = await initWhatsappSession(forceNew);
        console.debug('[WhatsApp][init]', res);
      } catch (error) {
        console.error('[WhatsApp][init] error', error);
      } finally {
        await refreshStatus();
      }
    },
    [refreshStatus],
  );

  const resetSession = useCallback(async () => {
    setState((s) => ({ ...s, loadingStatus: true, chats: [], messages: [], selectedChatId: null }));
    try {
      const res = await resetWhatsappSession();
      console.debug('[WhatsApp][reset]', res);
    } catch (error) {
      console.error('[WhatsApp][reset] error', error);
    } finally {
      await refreshStatus();
    }
  }, [refreshStatus]);

  const loadChats = useCallback(async () => {
    setState((s) => ({ ...s, loadingChats: true }));
    try {
      const { chats } = await getWhatsappChats();
      console.debug('[WhatsApp][chats]', chats);
      setState((s) => ({ ...s, chats, loadingChats: false }));
    } catch (error: any) {
      setState((s) => ({ ...s, loadingChats: false }));
      throw error;
    }
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    setState((s) => ({ ...s, loadingMessages: true }));
    try {
      const { messages } = await getWhatsappMessages(chatId);
      console.debug('[WhatsApp][messages]', chatId, messages.length);
      setState((s) => ({ ...s, messages, loadingMessages: false }));
    } catch (error: any) {
      setState((s) => ({ ...s, loadingMessages: false }));
      throw error;
    }
  }, []);

  const selectChat = useCallback(
    (chatId: string) => {
      setState((s) => ({ ...s, selectedChatId: chatId }));
      loadMessages(chatId).catch(() => {});
    },
    [loadMessages],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !state.selectedChatId) return false;
      setState((s) => ({ ...s, sending: true }));
      try {
        await sendWhatsappMessage(state.selectedChatId, trimmed);
        await loadMessages(state.selectedChatId);
        await loadChats();
        return true;
      } finally {
        setState((s) => ({ ...s, sending: false }));
      }
    },
    [loadChats, loadMessages, state.selectedChatId],
  );

  useEffect(() => {
    refreshStatus();
    return () => {
      if (pollingStatusRef.current) clearInterval(pollingStatusRef.current);
      if (pollingChatsRef.current) clearInterval(pollingChatsRef.current);
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (pollingStatusRef.current) clearInterval(pollingStatusRef.current);
    pollingStatusRef.current = setInterval(() => {
      setState((s) => s); // keep state reference
      refreshStatus();
    }, 4000);
    return () => {
      if (pollingStatusRef.current) clearInterval(pollingStatusRef.current);
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (state.status?.status !== 'connected') {
      if (pollingChatsRef.current) clearInterval(pollingChatsRef.current);
      return;
    }
    loadChats();
    if (pollingChatsRef.current) clearInterval(pollingChatsRef.current);
    pollingChatsRef.current = setInterval(() => {
      loadChats();
    }, 12000);
    return () => {
      if (pollingChatsRef.current) clearInterval(pollingChatsRef.current);
    };
  }, [loadChats, state.status?.status]);

  const filteredChats = useMemo(() => {
    return state.chats.filter((c) => {
      if (state.filter === 'unread') return c.unreadCount > 0;
      if (state.filter === 'groups') return c.isGroup;
      return true;
    });
  }, [state.chats, state.filter]);

  return {
    ...state,
    chats: filteredChats,
    allChats: state.chats,
    selectedChat: state.chats.find((c) => c.id === state.selectedChatId) || null,
    setFilter: (filter: FilterType) => setState((s) => ({ ...s, filter })),
    refreshStatus,
    startSession,
    resetSession,
    loadChats,
    selectChat,
    sendMessage,
  };
}
