import { createServer } from 'http';

import env from './config/env';
import { createApp } from './app';

const app = createApp();
const server = createServer(app);

const port = Number(env.PORT);

server.listen(port, () => {
  console.log(`API listening on port ${port}`);
});

const shutdown = (signal: NodeJS.Signals) => {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
