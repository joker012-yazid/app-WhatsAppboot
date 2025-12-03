"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const qrcode_1 = __importDefault(require("qrcode"));
const whatsapp_service_1 = require("../whatsapp/whatsapp.service");
const router = (0, express_1.Router)();
router.post('/session/init', async (req, res) => {
    try {
        const { forceNewSession } = req.body || {};
        console.log('[WhatsApp][HTTP] init called', { forceNewSession });
        await (0, whatsapp_service_1.startWhatsAppClient)(Boolean(forceNewSession));
        const state = (0, whatsapp_service_1.getWhatsAppState)();
        res.json({ success: true, status: 'ok', message: 'WhatsApp session initialization started.', state });
    }
    catch (error) {
        console.error('[WhatsApp][HTTP] init error', error);
        res.status(500).json({ success: false, status: 'error', message: 'Failed to start WhatsApp session', error: error?.message });
    }
});
router.get('/session/status', async (_req, res) => {
    try {
        const status = (0, whatsapp_service_1.getConnectionStatus)();
        let qrImage = null;
        const qr = (0, whatsapp_service_1.getCurrentQR)();
        if ((status.status === 'connecting' || status.status === 'qr_ready') && qr) {
            qrImage = await qrcode_1.default.toDataURL(qr);
        }
        res.json({ ...status, qrImage });
    }
    catch (error) {
        console.error('[WhatsApp][HTTP] status error', error);
        res.status(500).json({ success: false, status: 'error', message: 'Failed to fetch WhatsApp status', error: error?.message });
    }
});
router.post('/session/reset', async (_req, res) => {
    try {
        const result = await (0, whatsapp_service_1.resetWhatsApp)();
        res.json({ success: true, status: result.status });
    }
    catch (error) {
        console.error('[WhatsApp][HTTP] reset error', error);
        res.status(500).json({ success: false, status: 'error', message: 'Failed to reset WhatsApp session', error: error?.message });
    }
});
router.get('/debug', (_req, res) => {
    try {
        const status = (0, whatsapp_service_1.getConnectionStatus)();
        res.json({
            status,
            hasQR: status.hasQR,
            qrPreview: status.hasQR ? 'QR available (hidden for security)' : 'no QR',
            env: {
                sessionDir: process.env.WHATSAPP_SESSION_DIR || 'whatsapp-sessions',
                logLevel: process.env.WHATSAPP_LOG_LEVEL || 'info',
            },
        });
    }
    catch (error) {
        console.error('[WhatsApp][HTTP] debug error', error);
        res.status(500).json({ success: false, status: 'error', message: 'Failed to fetch debug information', error: error?.message });
    }
});
router.post('/connect', async (_req, res) => {
    try {
        await (0, whatsapp_service_1.startWhatsAppClient)();
        const state = (0, whatsapp_service_1.getWhatsAppState)();
        res.json(state);
    }
    catch (error) {
        console.error('[WhatsApp][HTTP] connect error', error);
        res.status(500).json({
            status: 'disconnected',
            hasQR: false,
            qrImage: null,
            lastError: error?.message || 'Connection Failure',
        });
    }
});
router.get('/qr', async (_req, res) => {
    try {
        const qr = (0, whatsapp_service_1.getCurrentQR)();
        if (!qr)
            return res.status(404).json({ message: 'QR not available' });
        const qrImage = await qrcode_1.default.toDataURL(qr);
        res.json({ qrImage });
    }
    catch (error) {
        console.error('[WhatsApp][HTTP] qr error', error);
        res.status(500).json({ success: false, status: 'error', message: 'Failed to fetch QR', error: error?.message });
    }
});
router.post('/start', async (_req, res) => {
    try {
        await (0, whatsapp_service_1.startWhatsAppClient)();
        const state = (0, whatsapp_service_1.getWhatsAppState)();
        res.json(state);
    }
    catch (error) {
        console.error('[WhatsApp][HTTP] start error', error);
        res.status(500).json({
            status: 'disconnected',
            hasQR: false,
            qrImage: null,
            lastError: error?.message || 'Connection Failure',
        });
    }
});
router.get('/chats', (_req, res, next) => {
    try {
        const chats = (0, whatsapp_service_1.getChatSummaries)();
        res.json({ chats });
    }
    catch (error) {
        next(error);
    }
});
router.get('/chats/:chatId/messages', (req, res, next) => {
    try {
        const { chatId } = req.params;
        const messages = (0, whatsapp_service_1.getMessagesForChat)(chatId);
        res.json({ chatId, messages });
    }
    catch (error) {
        next(error);
    }
});
router.post('/chats/:chatId/messages', async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const { text } = req.body || {};
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ message: 'Text is required' });
        }
        await (0, whatsapp_service_1.sendMessageToChat)(chatId, text);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
/**
 * Manual test (Phase 1):
 * 1) docker compose up -d postgres redis
 * 2) cd apps/api && npm install && npm run dev
 * 3) Hit POST /whatsapp/session/init then GET /whatsapp/session/status to fetch QR
 * 4) Scan QR with WhatsApp on phone, wait for status=connected
 * 5) Use /whatsapp/chats and /whatsapp/chats/:chatId/messages to view/send messages
 */
