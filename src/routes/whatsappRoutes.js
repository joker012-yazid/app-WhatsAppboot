const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const authMiddleware = require('../middleware/auth');

// All WhatsApp routes require authentication
router.use(authMiddleware);

// Initialize WhatsApp connection
router.post('/initialize', whatsappController.initialize);

// Get QR code for pairing
router.get('/qr', whatsappController.getQR);

// Get connection status
router.get('/status', whatsappController.getStatus);

// Send message
router.post('/send', whatsappController.sendMessage);

// Send template message
router.post('/send-template', whatsappController.sendTemplate);

// Disconnect
router.post('/disconnect', whatsappController.disconnect);

// Clear session (for troubleshooting)
router.post('/clear-session', whatsappController.clearSession);

module.exports = router;

