import { apiFetch } from './api';

export type WhatsappConnectionStatus = {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'error';
  qrImage: string | null;
  hasQR: boolean;
  lastError?: string | null;
};

export type WhatsappChatSummary = {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessage?: {
    text: string;
    timestamp: number;
    fromMe: boolean;
  };
};

export type WhatsappMessage = {
  id: string;
  chatId: string;
  text: string;
  timestamp: number;
  fromMe: boolean;
};

export async function initWhatsappSession(forceNewSession?: boolean) {
  return apiFetch<{ success: boolean; status: string; message: string }>('/api/whatsapp/session/init', {
    method: 'POST',
    body: { forceNewSession },
  });
}

export async function getWhatsappStatus(): Promise<WhatsappConnectionStatus> {
  return apiFetch<WhatsappConnectionStatus>('/api/whatsapp/session/status');
}

export async function resetWhatsappSession() {
  return apiFetch<{ success: boolean; status: string }>('/api/whatsapp/session/reset', { method: 'POST' });
}

export async function getWhatsappChats(): Promise<{ chats: WhatsappChatSummary[] }> {
  return apiFetch<{ chats: WhatsappChatSummary[] }>('/api/whatsapp/chats');
}

export async function getWhatsappMessages(chatId: string): Promise<{ chatId: string; messages: WhatsappMessage[] }> {
  return apiFetch<{ chatId: string; messages: WhatsappMessage[] }>(`/api/whatsapp/chats/${encodeURIComponent(chatId)}/messages`);
}

export async function sendWhatsappMessage(chatId: string, text: string): Promise<void> {
  await apiFetch('/api/whatsapp/chats/' + encodeURIComponent(chatId) + '/messages', {
    method: 'POST',
    body: { text },
  });
}
