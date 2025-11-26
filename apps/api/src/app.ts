import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import router from './routes';

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
  app.use(morgan('dev'));

  app.use('/api', router);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  return app;
};
