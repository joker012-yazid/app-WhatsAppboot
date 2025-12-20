const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../utils/database');
const templateService = require('./templateService');

// Sanitize logs to strip broken emoji/mojibake for cross-platform consoles
const LOG_SANITIZE = (process.env.LOG_SANITIZE ?? '1') !== '0';
if (LOG_SANITIZE) {
  const stripNonAscii = (s) => {
    let out = String(s);
    // Remove non-ASCII (emoji, replacement chars)
    out = out.replace(/[^\x00-\x7F]/g, '');
    // Trim leading spaces
    out = out.replace(/^\s+/, '');
    // Drop known mojibake prefixes like dY-`, dY"?, dYs?, etc.
    out = out.replace(/^dY[\-`"'\?S]*/i, '');
    // Remove any remaining non-alnum junk at the very start (allow [ or ()
    out = out.replace(/^[^A-Za-z0-9\[\(]+/, '');
    // Collapse multiple spaces
    out = out.replace(/\s{2,}/g, ' ');
    return out;
  };

  const sanitizeArgs = (args) =>
    args.map((a) => (typeof a === 'string' ? stripNonAscii(a) : a));

  const _log = console.log.bind(console);
  const _error = console.error.bind(console);
  const _warn = console.warn.bind(console);
  const _info = console.info.bind(console);

  console.log = (...args) => _log(...sanitizeArgs(args));
  console.error = (...args) => _error(...sanitizeArgs(args));
  console.warn = (...args) => _warn(...sanitizeArgs(args));
  console.info = (...args) => _info(...sanitizeArgs(args));
}

const db = getDb();

// Session storage path
const SESSION_PATH = path.resolve(process.cwd(), 'whatsapp-sessions');

// Ensure session directory exists
if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

let socket = null;
let isConnecting = false;
let connectionStatus = 'disconnected'; // disconnected, connecting, connected, qr_ready
let currentQR = null; // Store current QR code string

// Logger untuk Baileys
const logger = pino({ level: 'silent' }); // Set to 'info' or 'debug' for more logs

/**
 * Initialize WhatsApp connection
 */
const initializeWhatsApp = async (forceNewSession = false) => {
  if (isConnecting) {
    return { success: false, message: 'Connection already in progress' };
  }

  if (socket && connectionStatus === 'connected') {
    return { success: true, message: 'Already connected' };
  }

  try {
    // Reset previous connection
    if (socket) {
      try {
        await socket.end(undefined);
      } catch (e) {
        // Ignore errors when closing
      }
      socket = null;
    }

    // Clear session if forced - MORE AGGRESSIVE
    if (forceNewSession) {
      console.log('🗑️🗑️🗑️ Force clearing session (AGGRESSIVE MODE)...');
      
      // First disconnect if socket exists
      if (socket) {
        try {
          await socket.end(undefined);
        } catch (e) {
          // Ignore
        }
        socket = null;
      }
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove ALL session files
      if (fs.existsSync(SESSION_PATH)) {
        try {
          // Try to remove entire directory
          fs.rmSync(SESSION_PATH, { recursive: true, force: true });
          console.log('✅ Removed entire session directory');
        } catch (e) {
          console.log('⚠️ Could not remove directory, trying individual files...');
          // Fallback: remove individual files
          const files = fs.readdirSync(SESSION_PATH);
          for (const file of files) {
            try {
              const filePath = path.join(SESSION_PATH, file);
              const stats = fs.statSync(filePath);
              if (stats.isFile()) {
                fs.unlinkSync(filePath);
                console.log('  ✅ Deleted file:', file);
              } else if (stats.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
                console.log('  ✅ Deleted directory:', file);
              }
            } catch (err) {
              console.error('  ❌ Error deleting:', file, err.message);
            }
          }
        }
        
        // Recreate empty directory
        if (!fs.existsSync(SESSION_PATH)) {
          fs.mkdirSync(SESSION_PATH, { recursive: true });
          console.log('✅ Recreated empty session directory');
        }
      } else {
        // Create directory if it doesn't exist
        fs.mkdirSync(SESSION_PATH, { recursive: true });
        console.log('✅ Created session directory');
      }
      
      // Verify it's empty
      const remainingFiles = fs.existsSync(SESSION_PATH) ? fs.readdirSync(SESSION_PATH) : [];
      console.log('📦 Session directory now has', remainingFiles.length, 'files');
      
      if (remainingFiles.length > 0) {
        console.log('⚠️ WARNING: Session directory still has files:', remainingFiles);
      } else {
        console.log('✅✅✅ Session directory is CLEAR - ready for fresh QR generation');
      }
    }

    isConnecting = true;
    connectionStatus = 'connecting';
    currentQR = null;

    console.log('🚀 Initializing WhatsApp...');
    console.log('📁 Session path:', SESSION_PATH);
    
    // Check if session exists
    const sessionExists = fs.existsSync(SESSION_PATH) && fs.readdirSync(SESSION_PATH).length > 0;
    console.log('📦 Session exists:', sessionExists);
    
    if (sessionExists && !forceNewSession) {
      console.log('⚠️ Session exists - might connect directly without QR. Use clear session first if you need QR.');
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    const { version } = await fetchLatestBaileysVersion();
    
    console.log('📱 Baileys version:', version.join('.'));
    
    // Check if state has credentials (means already authenticated)
    const hasCredentials = state.creds && state.creds.me;
    console.log('🔐 Has existing credentials:', !!hasCredentials);
    
    if (hasCredentials && !forceNewSession) {
      console.log('⚠️⚠️⚠️ WARNING: State has credentials! This means Baileys will try to reconnect without generating QR.');
      console.log('   User ID:', state.creds.me?.id);
      console.log('   💡 SOLUTION: Use "Clear & Initialize" to force new QR generation');
    } else if (!hasCredentials) {
      console.log('✅ No existing credentials - QR code WILL be generated');
    }

    console.log('🔌 Creating WhatsApp socket...');
    
    // Create socket
    socket = makeWASocket({
      version,
      logger: pino({ level: 'info' }), // Enable logging to see QR in terminal
      printQRInTerminal: true, // Print QR in terminal for debugging
      auth: state,
      browser: ['WhatsApp Bot POS', 'Chrome', '1.0.0'],
      getMessage: async (key) => {
        // Store messages in database if needed
        return null;
      }
    });

    console.log('✅ Socket created. Setting up event handlers...');

    // CRITICAL: Setup event handlers IMMEDIATELY after socket creation
    // Save credentials when updated
    socket.ev.on('creds.update', saveCreds);

    // Handle connection updates - MUST be set up IMMEDIATELY
    socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr, isNewLogin, qrTimeout } = update;

      // Log ALL updates for debugging - including undefined values
      console.log('📡 Connection update received:', JSON.stringify({
        connection: connection || 'undefined',
        hasQR: !!qr,
        isNewLogin: isNewLogin || false,
        qrLength: qr ? qr.length : 0,
        qrTimeout: qrTimeout || null,
        hasLastDisconnect: !!lastDisconnect
      }));

      // CRITICAL: Check for QR code FIRST - before any other checks
      // QR can be a string or might come in different formats
      if (qr) {
        const qrString = typeof qr === 'string' ? qr : String(qr);
        
        if (qrString && qrString.length > 0) {
          // QR code generated - store it for frontend
          currentQR = qrString;
          connectionStatus = 'qr_ready';
          isConnecting = false;
          console.log('✅✅✅ QR Code CAPTURED! ✅✅✅');
          console.log('✅ QR Code Type:', typeof qr);
          console.log('✅ QR Code Length:', qrString.length);
          console.log('✅ QR Code (first 100 chars):', qrString.substring(0, 100));
          console.log('✅ QR Code stored in currentQR variable');
          console.log('✅ Status set to qr_ready');
          console.log('✅ currentQR variable now contains:', currentQR ? `QR CODE (${currentQR.length} chars)` : 'NULL');
          
          // Verify it's stored
          if (currentQR && currentQR.length > 0) {
            console.log('✅✅✅ VERIFICATION: currentQR is stored correctly!');
          } else {
            console.log('❌❌❌ ERROR: currentQR is NOT stored correctly!');
          }
          
          return; // IMPORTANT: Return early to prevent other handlers
        } else {
          console.log('⚠️ QR exists but is empty or invalid:', qr);
        }
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        console.log('❌ Connection closed. Status code:', statusCode, 'Should reconnect:', shouldReconnect);
        
        if (shouldReconnect) {
          connectionStatus = 'disconnected';
          currentQR = null;
          socket = null;
          isConnecting = false;
          console.log('Connection closed. Will reconnect...');
          setTimeout(() => {
            if (connectionStatus === 'disconnected') {
              initializeWhatsApp();
            }
          }, 3000);
        } else {
          connectionStatus = 'disconnected';
          currentQR = null;
          socket = null;
          isConnecting = false;
          console.log('Logged out. Please reconnect manually.');
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        currentQR = null;
        isConnecting = false;
        console.log('✅ WhatsApp connected successfully!');
      } else if (connection === 'connecting') {
        connectionStatus = 'connecting';
        console.log('🔄 Connecting to WhatsApp...');
      } else if (connection) {
        // Log other connection states
        console.log('📊 Connection state:', connection);
      }
      
      // Additional check: If we've been connecting for too long without QR, log warning
      if (connectionStatus === 'connecting' && !currentQR && isConnecting) {
        console.log('⚠️ Still connecting but no QR code yet. This might mean:');
        console.log('   1. Session exists and trying to reconnect (most likely)');
        console.log('   2. QR code will come soon');
        console.log('   3. Need to clear session to force new QR');
        console.log('   💡 If this persists, the session was not properly cleared.');
      }
      
      // If connection is 'open' but we never got QR, it means it reconnected with existing session
      if (connection === 'open' && !currentQR && !hasCredentials) {
        console.log('⚠️ Connected without QR - this should not happen if session was cleared');
      }
    });
    
    console.log('✅ Event handlers setup complete. Waiting for connection updates...');
    
    // CRITICAL: Add immediate check and periodic checks for QR
    // Sometimes QR comes very quickly before event handler is ready
    const checkForQR = () => {
      // Check socket state directly if possible
      if (socket && socket.user) {
        console.log('📱 Socket user exists - might be already authenticated');
      }
    };
    
    // Check immediately
    setTimeout(checkForQR, 500);
    
    // Add a timeout to check if QR is generated after a delay
    setTimeout(() => {
      if (connectionStatus === 'connecting' && !currentQR) {
        console.log('⚠️⚠️⚠️ WARNING: No QR code after 5 seconds!');
        console.log('   Current status:', connectionStatus);
        console.log('   Has QR:', !!currentQR);
        console.log('   Is connecting:', isConnecting);
        console.log('   Socket exists:', !!socket);
        
        // Check if we need to force new session
        if (sessionExists && !forceNewSession) {
          console.log('💡 SUGGESTION: Session exists. Try clearing session first.');
        }
        
        // Try to force QR regeneration by restarting
        console.log('💡 Attempting to force QR generation...');
      }
    }, 5000);
    
    // Another check after 10 seconds
    setTimeout(() => {
      if (connectionStatus === 'connecting' && !currentQR) {
        console.log('⚠️⚠️⚠️ CRITICAL: Still no QR after 10 seconds!');
        console.log('   This usually means:');
        console.log('   1. Session exists and Baileys is trying to reconnect');
        console.log('   2. QR was generated but event handler missed it');
        console.log('   3. Network/connection issue');
        console.log('   💡 SOLUTION: Clear session and try again');
      }
    }, 10000);

    // Handle incoming messages
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        await handleIncomingMessage(msg);
      }
    });

    return { success: true, message: 'WhatsApp initialized' };
  } catch (error) {
    isConnecting = false;
    connectionStatus = 'disconnected';
    console.error('WhatsApp initialization error:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Get QR code for authentication
 */
const getQRCode = async () => {
  console.log('🔍 Getting QR code...');
  console.log('   Current status:', connectionStatus);
  console.log('   Has QR:', !!currentQR);
  console.log('   QR length:', currentQR ? currentQR.length : 0);
  console.log('   Is connecting:', isConnecting);
  console.log('   Socket exists:', !!socket);
  
  // If QR already available, return it immediately
  if (currentQR && currentQR.length > 0 && connectionStatus === 'qr_ready') {
    console.log('✅✅✅ QR code already available! Returning immediately.');
    console.log('   QR length:', currentQR.length);
    return { 
      qr: currentQR, 
      status: connectionStatus,
      isReady: true
    };
  }
  
  // If not initialized, initialize first
  if (!socket) {
    console.log('⚠️ Socket not found. Initializing with force new session...');
    await initializeWhatsApp(true); // ALWAYS force new session when initializing from getQR
    // Wait a bit for socket to be ready and QR to be generated
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check again after waiting
    if (currentQR && currentQR.length > 0) {
      console.log('✅ QR code found after initialization!');
      return { 
        qr: currentQR, 
        status: connectionStatus,
        isReady: true
      };
    }
  }

  // If already connected, return immediately
  if (connectionStatus === 'connected') {
    console.log('✅ Already connected');
    return {
      qr: null,
      status: connectionStatus,
      isReady: false,
      message: 'Already connected'
    };
  }

  // Check if QR is available right now (might have been generated while we were waiting)
  if (currentQR && currentQR.length > 0 && connectionStatus === 'qr_ready') {
    console.log('✅✅✅ QR code found! Length:', currentQR.length);
    return { 
      qr: currentQR, 
      status: connectionStatus,
      isReady: true
    };
  }

  // If still connecting, return current status (frontend will poll)
  console.log('📊 Current state:');
  console.log('   Status:', connectionStatus);
  console.log('   Has QR:', !!currentQR);
  console.log('   Is connecting:', isConnecting);
  console.log('   Socket exists:', !!socket);
  
  // Check if we've been connecting too long - might need to clear session
  const needsClearSession = connectionStatus === 'connecting' && !currentQR;
  
  // If connecting for too long without QR, suggest restart
  let message = '';
  if (connectionStatus === 'connecting') {
    if (needsClearSession) {
      message = 'Still connecting but no QR code yet. This usually means session exists and Baileys is trying to reconnect. Please use "Clear & Initialize" to force new QR generation.';
    } else {
      message = 'Still connecting... QR code will appear automatically when ready.';
    }
  } else if (connectionStatus === 'disconnected') {
    message = 'Not connected. Please initialize first.';
  } else {
    message = 'Waiting for QR code...';
  }
  
  return { 
    qr: currentQR, 
    status: connectionStatus,
    isReady: currentQR !== null && currentQR.length > 0 && connectionStatus === 'qr_ready',
    message: message,
    needsClearSession: needsClearSession,
    debugInfo: {
      hasSocket: !!socket,
      isConnecting: isConnecting,
      hasQR: !!currentQR,
      qrLength: currentQR ? currentQR.length : 0
    }
  };
};

/**
 * Send text message
 */
const sendMessage = async (phoneNumber, message, jobId = null) => {
  if (!socket || connectionStatus !== 'connected') {
    return { success: false, message: 'WhatsApp not connected' };
  }

  try {
    // Format phone number (remove + and spaces, add country code if needed)
    const formattedNumber = formatPhoneNumber(phoneNumber);
    const jid = `${formattedNumber}@s.whatsapp.net`;

    await socket.sendMessage(jid, { text: message });

    // Store message in database
    if (jobId) {
      const { v4: uuidv4 } = require('uuid');
      const id = uuidv4();
      const now = require('dayjs')().toISOString();
      
      db.prepare(
        'INSERT INTO job_messages (id, job_id, direction, message, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(id, jobId, 'outbound', message, now);
    }

    return { success: true, message: 'Message sent successfully' };
  } catch (error) {
    console.error('Send message error:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Send message with template variables
 */
const sendTemplateMessage = async (phoneNumber, templateId, variables = {}, jobId = null) => {
  const template = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(templateId);
  
  if (!template) {
    return { success: false, message: 'Template not found' };
  }

  const renderedMessage = templateService.renderTemplate(template.body, variables);
  return await sendMessage(phoneNumber, renderedMessage, jobId);
};

/**
 * Handle incoming messages
 */
const handleIncomingMessage = async (msg) => {
  try {
    if (!msg.key.fromMe && msg.message) {
      const phoneNumber = msg.key.remoteJid.split('@')[0];
      const messageText = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         '';

      // Find related job by customer phone
      const customer = db.prepare('SELECT * FROM customers WHERE phone LIKE ?').get(`%${phoneNumber}%`);
      
      if (customer) {
        // Find active job for this customer
        const job = db.prepare(
          'SELECT * FROM jobs WHERE customer_id = ? AND status IN (?, ?, ?) ORDER BY created_at DESC LIMIT 1'
        ).get(customer.id, 'quoted', 'pending', 'in_progress');

        if (job) {
          // Store message
          const { v4: uuidv4 } = require('uuid');
          const id = uuidv4();
          const now = require('dayjs')().toISOString();
          
          db.prepare(
            'INSERT INTO job_messages (id, job_id, direction, message, created_at) VALUES (?, ?, ?, ?, ?)'
          ).run(id, job.id, 'inbound', messageText, now);

          // Check for approval/rejection keywords
          const upperMessage = messageText.toUpperCase();
          if (upperMessage.includes('SETUJU') || upperMessage.includes('APPROVE') || upperMessage.includes('YA')) {
            // Update job status to approved
            db.prepare(
              'UPDATE jobs SET status = ?, approved_amount = ?, updated_at = ? WHERE id = ?'
            ).run('approved', job.quoted_amount, now, job.id);

            // Send confirmation message
            const template = db.prepare(
              'SELECT * FROM message_templates WHERE category = ? LIMIT 1'
            ).get('approved');
            
            if (template) {
              const message = templateService.renderTemplate(template.body, {
                name: customer.name,
                amount: job.quoted_amount
              });
              await sendMessage(phoneNumber, message, job.id);
            }
          } else if (upperMessage.includes('TAK SETUJU') || upperMessage.includes('REJECT') || upperMessage.includes('TIDAK')) {
            // Update job status to rejected
            db.prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?').run('rejected', now, job.id);

            // Send rejection confirmation
            const template = db.prepare(
              'SELECT * FROM message_templates WHERE category = ? LIMIT 1'
            ).get('rejected');
            
            if (template) {
              const message = templateService.renderTemplate(template.body, {
                name: customer.name
              });
              await sendMessage(phoneNumber, message, job.id);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Handle incoming message error:', error);
  }
};

/**
 * Get connection status
 */
const getConnectionStatus = () => {
  return {
    status: connectionStatus,
    isConnected: connectionStatus === 'connected',
    isConnecting: connectionStatus === 'connecting' || isConnecting
  };
};

/**
 * Disconnect WhatsApp
 */
const disconnectWhatsApp = async () => {
  try {
    if (socket) {
      try {
        await socket.end(undefined);
      } catch (e) {
        // Ignore errors when closing
      }
      socket = null;
    }
    connectionStatus = 'disconnected';
    currentQR = null;
    isConnecting = false;
    return { success: true, message: 'Disconnected successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

/**
 * Clear WhatsApp session (for troubleshooting)
 */
const clearSession = async () => {
  try {
    console.log('🗑️🗑️🗑️ Starting AGGRESSIVE session clear...');
    
    // Disconnect first
    await disconnectWhatsApp();
    
    // Wait a bit before clearing files
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Remove session files - ULTRA AGGRESSIVE CLEANUP
    if (fs.existsSync(SESSION_PATH)) {
      console.log('📁 Session directory exists, removing...');
      
      try {
        // Try to remove entire directory first (most effective)
        fs.rmSync(SESSION_PATH, { recursive: true, force: true });
        console.log('✅✅✅ Removed entire session directory');
      } catch (e) {
        console.log('⚠️ Could not remove directory in one go, trying individual files...');
        
        // Fallback: remove individual files
        const files = fs.readdirSync(SESSION_PATH);
        console.log('🗑️ Found', files.length, 'files/directories to delete');
        
        let deletedCount = 0;
        for (const file of files) {
          try {
            const filePath = path.join(SESSION_PATH, file);
            const stats = fs.statSync(filePath);
            
            if (stats.isFile()) {
              fs.unlinkSync(filePath);
              console.log('  ✅ Deleted file:', file);
              deletedCount++;
            } else if (stats.isDirectory()) {
              // If it's a directory, remove recursively
              fs.rmSync(filePath, { recursive: true, force: true });
              console.log('  ✅ Deleted directory:', file);
              deletedCount++;
            }
          } catch (err) {
            console.error('  ❌ Error deleting:', file, err.message);
          }
        }
        
        console.log(`✅ Deleted ${deletedCount} session files/directories`);
      }
    } else {
      console.log('ℹ️ Session directory does not exist (already cleared)');
    }
    
    // Recreate empty directory
    if (!fs.existsSync(SESSION_PATH)) {
      fs.mkdirSync(SESSION_PATH, { recursive: true });
      console.log('✅ Recreated empty session directory');
    }
    
    // Verify it's empty
    const remainingFiles = fs.existsSync(SESSION_PATH) ? fs.readdirSync(SESSION_PATH) : [];
    if (remainingFiles.length === 0) {
      console.log('✅✅✅ Session directory is CLEAR - ready for fresh QR generation');
    } else {
      console.log('⚠️⚠️⚠️ WARNING: Session directory still has files:', remainingFiles);
      console.log('   Attempting second cleanup...');
      
      // Try one more time
      for (const file of remainingFiles) {
        try {
          const filePath = path.join(SESSION_PATH, file);
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log('  ✅ Deleted (retry):', file);
        } catch (e) {
          console.error('  ❌ Still cannot delete:', file);
        }
      }
    }
    
    // Reset state
    currentQR = null;
    connectionStatus = 'disconnected';
    isConnecting = false;
    socket = null;
    
    console.log('✅✅✅ Session cleared successfully - ready for fresh QR generation');
    return { success: true, message: 'Session cleared successfully' };
  } catch (error) {
    console.error('❌ Clear session error:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Format phone number
 */
const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with country code (Malaysia: 60)
  if (cleaned.startsWith('0')) {
    cleaned = '60' + cleaned.substring(1);
  }
  
  // If doesn't start with country code, assume Malaysia
  if (!cleaned.startsWith('60') && cleaned.length < 10) {
    cleaned = '60' + cleaned;
  }
  
  return cleaned;
};

module.exports = {
  initializeWhatsApp,
  getQRCode,
  sendMessage,
  sendTemplateMessage,
  getConnectionStatus,
  disconnectWhatsApp,
  clearSession,
  formatPhoneNumber
};


