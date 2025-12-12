"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhatsAppState = exports.sendMessageToChat = exports.resetWhatsApp = exports.startWhatsAppClient = exports.getMessagesForChat = exports.getChatSummaries = exports.getCurrentQR = exports.getConnectionStatus = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const pino_1 = __importDefault(require("pino"));
const env_1 = __importDefault(require("../config/env"));
const workflow_1 = require("../services/workflow");
const repoRoot = node_path_1.default.resolve(process.cwd(), '..', '..');
const SESSION_DIR = node_path_1.default.resolve(repoRoot, env_1.default.WHATSAPP_SESSION_DIR || 'whatsapp-sessions');
const LOGGER = (0, pino_1.default)({ level: env_1.default.WHATSAPP_LOG_LEVEL || 'info' });
const waState = {
    status: 'disconnected',
    hasQR: false,
    qrImage: null,
    lastError: null,
};
let sock = null;
let isStarting = false;
const messageStore = new Map();
// Simple in-memory chat store (makeInMemoryStore may not be available in this baileys version)
const chatStore = new Map();
// Create a simple in-memory store implementation
const inMemoryStore = {
    chats: {
        all: () => Array.from(chatStore.values()),
    },
    bind: (ev) => {
        // Listen to chat updates and store them
        if (ev && typeof ev.on === 'function') {
            ev.on('chats.update', (chats) => {
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
const pushMessage = (msg) => {
    const list = messageStore.get(msg.chatId) || [];
    list.push(msg);
    const trimmed = list.slice(-100); // keep last 100 per chat
    messageStore.set(msg.chatId, trimmed);
};
const parseText = (wm) => {
    const content = wm.message;
    if (!content)
        return '';
    if (content.conversation)
        return content.conversation;
    if (content.extendedTextMessage?.text)
        return content.extendedTextMessage.text;
    if (content.imageMessage?.caption)
        return content.imageMessage.caption;
    if (content.videoMessage?.caption)
        return content.videoMessage.caption;
    return '';
};
const setConnectionStatus = (partial) => {
    Object.assign(waState, partial);
    LOGGER.info({ state: waState }, '[WhatsApp] state updated');
};
const getConnectionStatus = () => ({
    status: waState.status,
    hasQR: waState.hasQR,
    lastError: waState.lastError,
});
exports.getConnectionStatus = getConnectionStatus;
const getCurrentQR = () => waState.qrImage;
exports.getCurrentQR = getCurrentQR;
const getChatSummaries = () => {
    const chats = inMemoryStore?.chats?.all() || [];
    return chats.map((c) => {
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
exports.getChatSummaries = getChatSummaries;
const getMessagesForChat = (chatId) => {
    return messageStore.get(chatId) || [];
};
exports.getMessagesForChat = getMessagesForChat;
const bindSocketEvents = (socket) => {
    const ev = socket.ev;
    const mapDisconnectReason = (error) => {
        const boom = error;
        const statusCode = boom?.output?.statusCode;
        const message = error?.message;
        switch (statusCode) {
            case baileys_1.DisconnectReason.loggedOut:
                return 'You have been logged out from this device.';
            case baileys_1.DisconnectReason.connectionClosed:
                return 'Connection closed. Please try again.';
            case baileys_1.DisconnectReason.connectionLost:
                return 'Network error while talking to WhatsApp.';
            case baileys_1.DisconnectReason.connectionReplaced:
                return 'This session was replaced by another login.';
            case baileys_1.DisconnectReason.timedOut:
                return 'Connection timed out.';
            default:
                if (message?.includes('ENOTFOUND'))
                    return 'Network error while resolving WhatsApp servers.';
                return message || 'Connection failure. Please try again.';
        }
    };
    ev.on('connection.update', (update) => {
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
            const err = lastDisconnect?.error;
            const statusCode = err?.output?.statusCode;
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
    ev.on('messages.upsert', ({ messages }) => {
        messages.forEach((m) => {
            const text = parseText(m);
            if (!text)
                return;
            const chatId = m.key.remoteJid;
            const chatMessage = {
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
                (0, workflow_1.handleCustomerResponse)(phone, text).catch((error) => {
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
    if (node_fs_1.default.existsSync(SESSION_DIR)) {
        node_fs_1.default.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
};
const startWhatsAppClient = async (forceNewSession) => {
    if (waState.status === 'connected' && sock && !forceNewSession) {
        return sock;
    }
    if (isStarting)
        return sock;
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
            }
            catch (err) {
                LOGGER.error({ err }, '[WhatsApp] logout during forceNewSession failed');
            }
            sock = null;
        }
    }
    try {
        node_fs_1.default.mkdirSync(SESSION_DIR, { recursive: true });
        const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(SESSION_DIR);
        // Fetch latest version info from WhatsApp
        const { version, isLatest } = await (0, baileys_1.fetchLatestBaileysVersion)();
        LOGGER.info({ version, isLatest }, '[WhatsApp] Baileys version info');
        sock = (0, baileys_1.default)({
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
                const requiresPatch = !!(message.buttonsMessage ||
                    message.templateMessage ||
                    message.listMessage);
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
    }
    catch (error) {
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
    }
    finally {
        isStarting = false;
    }
    return sock;
};
exports.startWhatsAppClient = startWhatsAppClient;
const resetWhatsApp = async () => {
    if (sock) {
        try {
            await sock.logout();
        }
        catch (err) {
            LOGGER.error({ err }, '[WhatsApp] logout during reset failed');
        }
        try {
            sock.ev.removeAllListeners('connection.update');
            sock.ev.removeAllListeners('messages.upsert');
        }
        catch (err) {
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
exports.resetWhatsApp = resetWhatsApp;
const sendMessageToChat = async (chatId, text) => {
    if (!sock)
        throw new Error('WhatsApp not initialized');
    await sock.sendMessage(chatId, { text });
};
exports.sendMessageToChat = sendMessageToChat;
const getWhatsAppState = () => ({ ...waState });
exports.getWhatsAppState = getWhatsAppState;
