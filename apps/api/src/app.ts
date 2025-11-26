import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';

import router from './routes';

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

  app.use(helmet());
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

  // Static uploads (shared under repo root /uploads)
  // Resolve relative to this file's location, not process.cwd()
  // This ensures the path is correct regardless of where the process starts
  // __dirname points to apps/api/src (dev) or apps/api/dist (prod)
  const currentFileDir = getCurrentFileDir();
  const apiDir = path.resolve(currentFileDir, '..'); // apps/api
  const repoRoot = path.resolve(apiDir, '..'); // repo root
  const uploadsDir = path.resolve(repoRoot, 'uploads');
  
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  app.use('/api', router);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  return app;
};
