const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const config = require('./config');
const { getDb } = require('./utils/database');

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Stack:', reason?.stack || 'No stack trace');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit immediately, let the server try to handle it
});

// Handle SIGTERM and SIGINT for graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

try {
  require('./scripts/migrate');
} catch (error) {
  console.error('❌ Migration error:', error);
  console.error('Stack:', error.stack);
  // Continue anyway - migration might have already run
}

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const jobRoutes = require('./routes/jobRoutes');
const templateRoutes = require('./routes/templateRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use('/public', express.static(publicDir));

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.get('/', (req, res) => {
  try {
    const indexPath = path.resolve(process.cwd(), 'public/index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ message: 'Index page not found' });
    }
  } catch (error) {
    console.error('Error serving index page:', error);
    res.status(500).json({ message: 'Error serving page' });
  }
});

app.get('/health', (req, res) => {
  try {
    const db = getDb();
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
    res.json({ status: 'ok', users: userCount, customers: customerCount });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.use((err, req, res, next) => {
  console.error('❌ Express error handler:', err);
  console.error('Stack:', err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server with error handling
let serverStarted = false;

try {
  // Create server without callback - use event listeners instead
  // This prevents race condition where callback fires before error handler
  const server = app.listen(config.port);
  
  // CRITICAL: Set error handler FIRST - this will fire if port is in use
  // Use 'once' to ensure it only fires once and exits immediately
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${config.port} is already in use!`);
      console.error('Please stop the other process or change the PORT in .env file');
      console.error(`\nTo find the process using port ${config.port}, run:`);
      console.error(`  netstat -ano | findstr :${config.port}`);
      console.error(`\nThen stop it with:`);
      console.error(`  taskkill /PID <process_id> /F\n`);
    } else {
      console.error('❌ Server error:', error);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  });

  // Handle 'listening' event - ONLY fires if server successfully starts
  // This event will NOT fire if there's an error (like port in use)
  server.once('listening', () => {
    if (!serverStarted) {
      serverStarted = true;
      console.log(`✅ Server listening on port ${config.port}`);
      console.log(`🌐 Open http://localhost:${config.port} in your browser`);
    }
  });

  // Handle server close
  server.on('close', () => {
    if (serverStarted) {
      console.log('Server closed');
    }
  });
} catch (error) {
  console.error('❌ Failed to start server:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
}
