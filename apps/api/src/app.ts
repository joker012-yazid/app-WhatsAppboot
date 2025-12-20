import express from 'express';

import cors from 'cors';

import helmet from 'helmet';

import morgan from 'morgan';

import cookieParser from 'cookie-parser';

import path from 'node:path';

import fs from 'node:fs';

import router from './routes';

import { requestLogger, detectRateLimit } from './middleware/requestLogger';

// Declare __dirname for TypeScript (available at runtime in CommonJS)

// This ensures reliable path resolution regardless of process.cwd()

declare const __dirname: string;

// Get directory of current file for reliable path resolution

// Uses __dirname which is available at runtime in CommonJS

// This ensures the path is correct regardless of where the process starts

const getCurrentFileDir = (): string => {
  // At runtime in CommonJS, __dirname points to the directory of the compiled file

  // In development: apps/api/src (when using ts-node-dev)

  // In production: apps/api/dist (when running compiled JS)

  return __dirname;
};

export const createApp = () => {
  const app = express();

  // Static uploads (shared under repo root /uploads)

  // Resolve relative to this file's location, not process.cwd()

  // This ensures the path is correct regardless of where the process starts

  // __dirname points to apps/api/src (dev) or apps/api/dist (prod)

  const currentFileDir = getCurrentFileDir();

  // Walk up from apps/api/src (dev) or apps/api/dist (prod) to the repo root

  const repoRoot = path.resolve(currentFileDir, '..', '..', '..');

  const uploadsDir = path.resolve(repoRoot, 'uploads');

  const publicDir = path.resolve(repoRoot, 'public');

  // Serve static files BEFORE other middleware to ensure they're accessible

  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  app.use('/uploads', express.static(uploadsDir));

  // Static public files (for registration pages, etc.)

  if (fs.existsSync(publicDir)) {
    console.log(`[Static] Serving public files from: ${publicDir}`);

    const registerIndexPath = path.resolve(publicDir, 'register', 'index.html');

    console.log(`[Static] Register index.html path: ${registerIndexPath}`);

    console.log(
      `[Static] Register index.html exists: ${fs.existsSync(registerIndexPath)}`,
    );

    // List files in public directory for debugging

    try {
      const publicFiles = fs.readdirSync(publicDir, { withFileTypes: true });

      console.log(
        `[Static] Files in public dir:`,
        publicFiles.map((f) => ({
          name: f.name,
          isDirectory: f.isDirectory(),
        })),
      );

      const registerDir = path.join(publicDir, 'register');

      if (fs.existsSync(registerDir)) {
        const registerFiles = fs.readdirSync(registerDir);

        console.log(`[Static] Files in register dir:`, registerFiles);
      } else {
        console.warn(`[Static] Register directory not found: ${registerDir}`);
      }
    } catch (e) {
      console.error(`[Static] Error reading directories:`, e);
    }

    // Explicit route handler for register/index.html (must be before express.static)
    app.get('/public/register/index.html', (req, res) => {
      const filePath = path.resolve(publicDir, 'register', 'index.html');
      console.log(`[Route] Request received for /public/register/index.html`);

      if (fs.existsSync(filePath)) {
        res.sendFile(filePath, (err) => {
          if (err) {
            console.error(`[Route] Error sending file:`, err);
            if (!res.headersSent) {
              res.status(500).json({ message: 'Error serving file', error: err.message });
            }
          }
        });
      } else {
        res.status(404).json({ message: 'File not found', path: filePath });
      }
    });

    // Explicit route handler for progress/index.html (customer job progress page)
    app.get('/public/progress/index.html', (req, res) => {
      const filePath = path.resolve(publicDir, 'progress', 'index.html');
      console.log(`[Route] Request received for /public/progress/index.html`);

      if (fs.existsSync(filePath)) {
        res.sendFile(filePath, (err) => {
          if (err) {
            console.error(`[Route] Error sending progress file:`, err);
            if (!res.headersSent) {
              res.status(500).json({ message: 'Error serving file', error: err.message });
            }
          }
        });
      } else {
        res.status(404).json({ message: 'Progress page not found', path: filePath });
      }
    });

    // Use express.static for other public files

    app.use('/public', express.static(publicDir));
  } else {
    console.warn(`[Static] Public directory not found: ${publicDir}`);
  }

  // Configure helmet with relaxed settings for static files

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],

          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],

          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],

          fontSrc: ["'self'", 'https://fonts.gstatic.com'],

          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        },
      },
    }),
  );

  app.use(
    cors({
      origin: true,

      credentials: true,
    }),
  );

  app.use(express.json());

  app.use(express.urlencoded({ extended: true }));

  app.use(cookieParser());

  app.use(morgan('dev'));

  // Add request logging middleware
  app.use(requestLogger);
  app.use(detectRateLimit);

  app.use('/api', router);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Handle 404 - provide helpful message for common web app routes

  app.use((req, res, next) => {
    // Log static file requests for debugging

    if (req.path.startsWith('/public/')) {
      const requestedPath = req.path.replace('/public', '');

      const fullPath = path.join(publicDir, requestedPath);

      console.log(`[404] Static file request: ${req.path}`);

      console.log(`[404] Requested path: ${requestedPath}`);

      console.log(`[404] Resolved full path: ${fullPath}`);

      console.log(`[404] Public dir: ${publicDir}`);

      console.log(`[404] File exists: ${fs.existsSync(fullPath)}`);

      // List files in public directory for debugging

      if (fs.existsSync(publicDir)) {
        try {
          const files = fs.readdirSync(publicDir, { withFileTypes: true });

          console.log(
            `[404] Files in public dir:`,
            files.map((f) => f.name),
          );
        } catch (e) {
          console.error(`[404] Error reading public dir:`, e);
        }
      }

      return res.status(404).json({
        message: 'File not found',

        path: req.path,

        requestedPath: requestedPath,

        resolvedPath: fullPath,

        publicDir: publicDir,

        hint: 'Check that the file exists in the public directory',
      });
    }

    if (req.path.startsWith('/uploads/')) {
      return res.status(404).json({
        message: 'File not found',

        path: req.path,

        hint: 'Check that the file exists in the uploads directory',
      });
    }

    // Common Next.js routes that might be requested from API server

    const webAppRoutes = [
      '/login',
      '/dashboard',
      '/customers',
      '/devices',
      '/jobs',
    ];

    if (webAppRoutes.includes(req.path)) {
      return res.status(404).json({
        message: `Route '${req.path}' is a web app route, not an API endpoint. Use '/api/*' for API endpoints.`,

        hint: `For authentication, use POST /api/auth/login instead of ${req.path}`,
      });
    }

    res.status(404).json({ message: 'Not found' });
  });

  // Global error handler - must be last middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Error]', err);
    
    // Check if response was already sent
    if (res.headersSent) {
      return next(err);
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal server error';
    
    res.status(status).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  return app;
};
