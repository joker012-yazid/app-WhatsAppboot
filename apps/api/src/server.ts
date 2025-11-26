import { createServer } from 'http';

import prisma from './lib/prisma';
import env from './config/env';
import { createApp } from './app';
import { startReminderScheduler } from './scheduler/reminders';
import { startBackupScheduler } from './scheduler/backups';

const app = createApp();
const server = createServer(app);

const port = Number(env.PORT);

// Ensure database connection before starting server
prisma.$connect()
  .then(() => {
    server.listen(port, () => {
      console.log(`API listening on port ${port}`);
    });

    // Start background schedulers & queues after database is connected
    startReminderScheduler();
    startBackupScheduler().catch((error) => console.error('[backup] scheduler error', error));
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  });

const shutdown = async (signal: NodeJS.Signals) => {
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

