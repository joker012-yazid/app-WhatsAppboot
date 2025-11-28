import fs from 'node:fs';
import path from 'node:path';
import makeWASocket, {
  DisconnectReason,
  type WAMessage,
  type WASocket,
  useMultiFileAuthState,
  type BaileysEventMap,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';

import env from '../config/env';

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'error';

export type ChatSummary = {
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

export type ChatMessage = {
  id: string;
  chatId: string;
  text: string;
  timestamp: number;
  fromMe: boolean;
};

const repoRoot = path.resolve(process.cwd(), '..', '..');
const SESSION_DIR = path.resolve(repoRoot, env.WHATSAPP_SESSION_DIR || 'whatsapp-sessions');
const LOGGER = pino({ level: env.WHATSAPP_LOG_LEVEL || 'silent' });

let sock: WASocket | null = null;
let connectionStatus: ConnectionStatus = 'disconnected';
let currentQR: string | null = null;
let lastError: string | null = null;
const messageStore: Map<string, ChatMessage[]> = new Map();

// Simple in-memory chat store (makeInMemoryStore may not be available in this baileys version)
const chatStore = new Map<string, { id: string; name?: string; pushName?: string; subject?: string; unreadCount?: number }>();

// Create a simple in-memory store implementation
const inMemoryStore = {
  chats: {
    all: () => Array.from(chatStore.values()),
  },
  bind: (ev: any) => {
    // Listen to chat updates and store them
    if (ev && typeof ev.on === 'function') {
      ev.on('chats.update', (chats: any[]) => {
        if (Array.isArray(chats)) {
          chats.forEach((chat) => {
            if (chat && chat.id) {
              chatStore.set(chat.id, chat);
            }
          });
        }
      });
    }
  },
};

const resetMessageStore = () => {
  messageStore.clear();
};

const pushMessage = (msg: ChatMessage) => {
  const list = messageStore.get(msg.chatId) || [];
  list.push(msg);
  const trimmed = list.slice(-100); // keep last 100 per chat
  messageStore.set(msg.chatId, trimmed);
};

const parseText = (wm: WAMessage) => {
  const content = wm.message;
  if (!content) return '';
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;
  return '';
};

export const getConnectionStatus = () => ({
  status: connectionStatus,
  hasQR: Boolean(currentQR),
  lastError,
});

export const getCurrentQR = () => currentQR;

export const getChatSummaries = (): ChatSummary[] => {
  const chats = inMemoryStore?.chats?.all() || [];
  return chats.map((c: any) => {
    const messages = messageStore.get(c.id) || [];
    const lastMessage = messages[messages.length - 1];
    return {
      id: c.id,
      name: c.name || c.pushName || c.subject || c.id,
      isGroup: c.id.includes('@g.us'),
      unreadCount: c.unreadCount || 0,
      lastMessage: lastMessage
        ? {
            text: lastMessage.text,
            timestamp: lastMessage.timestamp,
            fromMe: lastMessage.fromMe,
          }
        : undefined,
    };
  });
};

export const getMessagesForChat = (chatId: string): ChatMessage[] => {
  return messageStore.get(chatId) || [];
};

const bindSocketEvents = (socket: WASocket) => {
  const ev = socket.ev as any as BaileysEventMap;

  ev.on('connection.update', (update) => {
    console.log('[WhatsApp] connection.update', update);
    const { connection, qr, lastDisconnect } = update;
    if (qr) {
      currentQR = qr;
      connectionStatus = 'qr_ready';
      console.log('[WhatsApp] QR ready');
    }
    if (connection === 'open') {
      connectionStatus = 'connected';
      currentQR = null;
      lastError = null;
      console.log('[WhatsApp] Connected');
    } else if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      connectionStatus = shouldReconnect ? 'disconnected' : 'error';
      lastError = (lastDisconnect?.error as any)?.message ?? null;
      currentQR = null;
      console.error('[WhatsApp] connection closed', statusCode, lastError);
    } else if (connection === 'connecting') {
      connectionStatus = 'connecting';
      console.log('[WhatsApp] Connecting...');
    }
  });

  ev.on('messages.upsert', ({ messages }) => {
    messages.forEach((m) => {
      const text = parseText(m);
      if (!text) return;
      const chatId = m.key.remoteJid!;
      const chatMessage: ChatMessage = {
        id: m.key.id || `${Date.now()}`,
        chatId,
        text,
        timestamp: (m.messageTimestamp?.low ?? m.messageTimestamp?.high ?? Date.now()) * 1000,
        fromMe: Boolean(m.key.fromMe),
      };
      pushMessage(chatMessage);
    });
  });

  if (inMemoryStore?.bind) {
    inMemoryStore.bind(socket.ev);
  }
};

const clearAuthDir = () => {
  if (fs.existsSync(SESSION_DIR)) {
    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
  }
};

export const initializeWhatsApp = async (forceNewSession?: boolean) => {
  if (sock && connectionStatus === 'connected' && !forceNewSession) {
    return { status: connectionStatus, message: 'Already connected' };
  }

  connectionStatus = 'connecting';
  currentQR = null;
  lastError = null;

  if (forceNewSession) {
    clearAuthDir();
    resetMessageStore();
    if (sock) {
      try {
        await sock.logout();
      } catch {
        // ignore
      }
      sock = null;
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  sock = makeWASocket({
    auth: state,
    logger: LOGGER,
    printQRInTerminal: false,
    browser: ['WhatsApp Bot POS', 'Desktop', '1.0.0'],
    markOnlineOnConnect: false,
  });

  bindSocketEvents(sock);
  sock.ev.on('creds.update', saveCreds);
  console.log('[WhatsApp] initialize requested', { forceNewSession, sessionDir: SESSION_DIR });

  return { status: connectionStatus, message: 'WhatsApp initialization started' };
};

export const resetWhatsApp = async () => {
  if (sock) {
    try {
      await sock.logout();
    } catch {
      // ignore
    }
    try {
      sock.ev.removeAllListeners();
    } catch {
      // ignore
    }
    sock = null;
  }
  clearAuthDir();
  resetMessageStore();
  connectionStatus = 'disconnected';
  currentQR = null;
  lastError = null;
  return { status: connectionStatus };
};

export const sendMessageToChat = async (chatId: string, text: string) => {
  if (!sock) throw new Error('WhatsApp not initialized');
  await sock.sendMessage(chatId, { text });
};
