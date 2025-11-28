import { Router } from 'express';
import qrcode from 'qrcode';

import {
  getChatSummaries,
  getConnectionStatus,
  getCurrentQR,
  getMessagesForChat,
  initializeWhatsApp,
  resetWhatsApp,
  sendMessageToChat,
} from '../whatsapp/whatsapp.service';

const router = Router();

router.post('/session/init', async (req, res, next) => {
  try {
    const { forceNewSession } = req.body || {};
    console.log('[WhatsApp][HTTP] init called', { forceNewSession });
    const result = await initializeWhatsApp(Boolean(forceNewSession));
    res.json({ success: true, status: result.status, message: result.message });
  } catch (error) {
    console.error('[WhatsApp][HTTP] init error', error);
    next(error);
  }
});

router.get('/session/status', async (_req, res, next) => {
  try {
    const status = getConnectionStatus();
    let qrImage: string | null = null;
    if (status.status === 'qr_ready') {
      const qr = getCurrentQR();
      if (qr) {
        qrImage = await qrcode.toDataURL(qr);
      }
    }
    res.json({ ...status, qrImage });
  } catch (error) {
    console.error('[WhatsApp][HTTP] status error', error);
    next(error);
  }
});

router.post('/session/reset', async (_req, res, next) => {
  try {
    const result = await resetWhatsApp();
    res.json({ success: true, status: result.status });
  } catch (error) {
    console.error('[WhatsApp][HTTP] reset error', error);
    next(error);
  }
});

router.get('/chats', (_req, res, next) => {
  try {
    const chats = getChatSummaries();
    res.json({ chats });
  } catch (error) {
    next(error);
  }
});

router.get('/chats/:chatId/messages', (req, res, next) => {
  try {
    const { chatId } = req.params;
    const messages = getMessagesForChat(chatId);
    res.json({ chatId, messages });
  } catch (error) {
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
    await sendMessageToChat(chatId, text);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

/**
 * Manual test (Phase 1):
 * 1) docker compose up -d postgres redis
 * 2) cd apps/api && npm install && npm run dev
 * 3) Hit POST /whatsapp/session/init then GET /whatsapp/session/status to fetch QR
 * 4) Scan QR with WhatsApp on phone, wait for status=connected
 * 5) Use /whatsapp/chats and /whatsapp/chats/:chatId/messages to view/send messages
 */
