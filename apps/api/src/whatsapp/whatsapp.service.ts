import fs from 'node:fs';
import path from 'node:path';
import makeWASocket, {
  DisconnectReason,
  type WAMessage,
  type WASocket,
  useMultiFileAuthState,
  type BaileysEventMap,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';

import env from '../config/env';
import { handleCustomerResponse } from '../services/workflow';

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
const LOGGER = pino({ level: env.WHATSAPP_LOG_LEVEL || 'info' });

type WhatsAppState = {
  status: ConnectionStatus;
  hasQR: boolean;
  qrImage: string | null;
  lastError: string | null;
};

const waState: WhatsAppState = {
  status: 'disconnected',
  hasQR: false,
  qrImage: null,
  lastError: null,
};

let sock: WASocket | null = null;
let isStarting = false;
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

const setConnectionStatus = (partial: Partial<WhatsAppState>) => {
  Object.assign(waState, partial);
  LOGGER.info({ state: waState }, '[WhatsApp] state updated');
};

export const getConnectionStatus = () => ({
  status: waState.status,
  hasQR: waState.hasQR,
  lastError: waState.lastError,
});

export const getCurrentQR = () => waState.qrImage;

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
  const ev = socket.ev;

  const mapDisconnectReason = (error?: Boom | Error | unknown): string => {
    const boom = error as Boom | undefined;
    const statusCode = boom?.output?.statusCode;
    const message = (error as any)?.message as string | undefined;

    switch (statusCode) {
      case DisconnectReason.loggedOut:
        return 'You have been logged out from this device.';
      case DisconnectReason.connectionClosed:
        return 'Connection closed. Please try again.';
      case DisconnectReason.connectionLost:
        return 'Network error while talking to WhatsApp.';
      case DisconnectReason.connectionReplaced:
        return 'This session was replaced by another login.';
      case DisconnectReason.timedOut:
        return 'Connection timed out.';
      default:
        if (message?.includes('ENOTFOUND')) return 'Network error while resolving WhatsApp servers.';
        return message || 'Connection failure. Please try again.';
    }
  };

  ev.on('connection.update', (update: BaileysEventMap['connection.update']) => {
    LOGGER.info({ connection: update.connection, hasQR: Boolean(update.qr) }, '[WhatsApp] connection.update');
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      setConnectionStatus({
        status: 'qr_ready',
        hasQR: true,
        qrImage: qr,
        lastError: null,
      });
      LOGGER.info('[WhatsApp] QR received');
      return;
    }

    if (connection === 'open') {
      setConnectionStatus({
        status: 'connected',
        hasQR: false,
        qrImage: null,
        lastError: null,
      });
      LOGGER.info('[WhatsApp] Connected');
      return;
    }

    if (connection === 'connecting') {
      setConnectionStatus({
        status: 'connecting',
        lastError: null,
      });
      LOGGER.info('[WhatsApp] Connecting...');
      return;
    }

    if (connection === 'close') {
      const err = (lastDisconnect as any)?.error;
      const statusCode = (err as Boom | undefined)?.output?.statusCode;
      const friendlyMessage = mapDisconnectReason(err);
      LOGGER.error({ statusCode, error: err }, '[WhatsApp] connection closed');
      setConnectionStatus({
        status: 'disconnected',
        hasQR: false,
        qrImage: null,
        lastError: friendlyMessage,
      });
      sock = null;
      return;
    }
  });

  ev.on('messages.upsert', ({ messages }: BaileysEventMap['messages.upsert']) => {
    messages.forEach((m: WAMessage) => {
      const text = parseText(m);
      if (!text) return;
      const chatId = m.key.remoteJid!;
      const chatMessage: ChatMessage = {
        id: m.key.id || `${Date.now()}`,
        chatId,
        text,
        timestamp: (typeof m.messageTimestamp === 'number' ? m.messageTimestamp : Number(m.messageTimestamp) || Date.now()) * 1000,
        fromMe: Boolean(m.key.fromMe),
      };
      pushMessage(chatMessage);
      
      // Handle incoming customer messages (not from us)
      if (!m.key.fromMe && text) {
        const phone = chatId.replace('@s.whatsapp.net', '');
        handleCustomerResponse(phone, text).catch((error) => {
          LOGGER.error({ error, phone }, '[WhatsApp] Error handling customer response');
        });
      }
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

export const startWhatsAppClient = async (forceNewSession?: boolean) => {
  if (waState.status === 'connected' && sock && !forceNewSession) {
    return sock;
  }
  if (isStarting) return sock;
  isStarting = true;

  setConnectionStatus({
    status: 'connecting',
    hasQR: false,
    qrImage: null,
    lastError: null,
  });

  if (forceNewSession) {
    clearAuthDir();
    resetMessageStore();
    if (sock) {
      try {
        await sock.logout();
      } catch (err) {
        LOGGER.error({ err }, '[WhatsApp] logout during forceNewSession failed');
      }
      sock = null;
    }
  }

  try {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    
    // Fetch latest version info from WhatsApp
    const { version, isLatest } = await fetchLatestBaileysVersion();
    LOGGER.info({ version, isLatest }, '[WhatsApp] Baileys version info');
    
    sock = makeWASocket({
      version,
      auth: state,
      logger: LOGGER,
      printQRInTerminal: false,
      browser: ['Chrome (Linux)', '', ''],
      markOnlineOnConnect: false,
      defaultQueryTimeoutMs: undefined,
      keepAliveIntervalMs: 30000,
      emitOwnEvents: false,
      fireInitQueries: true,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      getMessage: async () => undefined,
      patchMessageBeforeSending: (message) => {
        const requiresPatch = !!(
          message.buttonsMessage ||
          message.templateMessage ||
          message.listMessage
        );
        if (requiresPatch) {
          message = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {},
                },
                ...message,
              },
            },
          };
        }
        return message;
      },
    });

    bindSocketEvents(sock);
    sock.ev.on('creds.update', saveCreds);
    LOGGER.info({ forceNewSession, sessionDir: SESSION_DIR }, '[WhatsApp] start requested');
  } catch (error: any) {
    const friendly = error?.message || 'Failed to initialize WhatsApp session.';
    setConnectionStatus({
      status: 'disconnected',
      hasQR: false,
      qrImage: null,
      lastError: friendly,
    });
    LOGGER.error({ err: error }, '[WhatsApp] start error');
    sock = null;
    throw error;
  } finally {
    isStarting = false;
  }

  return sock;
};

export const resetWhatsApp = async () => {
  if (sock) {
    try {
      await sock.logout();
    } catch (err) {
      LOGGER.error({ err }, '[WhatsApp] logout during reset failed');
    }
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('messages.upsert');
    } catch (err) {
      LOGGER.error({ err }, '[WhatsApp] remove listeners during reset failed');
    }
    sock = null;
  }
  clearAuthDir();
  resetMessageStore();
  setConnectionStatus({
    status: 'disconnected',
    hasQR: false,
    qrImage: null,
    lastError: null,
  });
  return { status: waState.status };
};

export const sendMessageToChat = async (chatId: string, text: string) => {
  if (!sock) throw new Error('WhatsApp not initialized');
  await sock.sendMessage(chatId, { text });
};

export const getWhatsAppState = () => ({ ...waState });
