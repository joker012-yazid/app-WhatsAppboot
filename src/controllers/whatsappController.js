const whatsappService = require('../services/whatsappService');
const QRCode = require('qrcode');

/**
 * Initialize WhatsApp connection
 */
const initialize = async (req, res) => {
  try {
    // Check if force new session is requested
    const forceNewSession = req.body.forceNewSession === true;
    const result = await whatsappService.initializeWhatsApp(forceNewSession);
    res.json(result);
  } catch (error) {
    console.error('Initialize error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get QR code for authentication
 */
const getQR = async (req, res) => {
  try {
    const result = await whatsappService.getQRCode();
    
    if (result.isReady && result.qr) {
      // Generate QR code as image
      try {
        const qrImage = await QRCode.toDataURL(result.qr);
        res.json({
          success: true,
          qr: result.qr,
          qrImage: qrImage,
          status: result.status
        });
      } catch (qrError) {
        console.error('QR Code generation error:', qrError);
        res.json({
          success: true,
          qr: result.qr,
          qrImage: null,
          status: result.status,
          message: 'QR code available but image generation failed. QR string: ' + result.qr.substring(0, 50) + '...'
        });
      }
    } else {
      res.json({
        success: false,
        qr: null,
        qrImage: null,
        status: result.status,
        message: result.message || (result.status === 'connected' ? 'Already connected' : 'QR code not ready yet. Please wait and try again.'),
        needsClearSession: result.needsClearSession || false
      });
    }
  } catch (error) {
    console.error('Get QR error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get QR code' });
  }
};

/**
 * Get connection status
 */
const getStatus = (req, res) => {
  try {
    const status = whatsappService.getConnectionStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send message
 */
const sendMessage = async (req, res) => {
  try {
    const { phoneNumber, message, jobId } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'phoneNumber and message are required'
      });
    }

    const result = await whatsappService.sendMessage(phoneNumber, message, jobId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send template message
 */
const sendTemplate = async (req, res) => {
  try {
    const { phoneNumber, templateId, variables, jobId } = req.body;

    if (!phoneNumber || !templateId) {
      return res.status(400).json({
        success: false,
        message: 'phoneNumber and templateId are required'
      });
    }

    const result = await whatsappService.sendTemplateMessage(
      phoneNumber,
      templateId,
      variables || {},
      jobId
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Disconnect WhatsApp
 */
const disconnect = async (req, res) => {
  try {
    const result = await whatsappService.disconnectWhatsApp();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Clear session (for troubleshooting)
 */
const clearSession = async (req, res) => {
  try {
    const result = await whatsappService.clearSession();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  initialize,
  getQR,
  getStatus,
  sendMessage,
  sendTemplate,
  disconnect,
  clearSession
};

