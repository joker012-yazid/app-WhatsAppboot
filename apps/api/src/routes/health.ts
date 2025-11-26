import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check error', error);
    res.status(500).json({ status: 'error', database: false });
  }
});

export default router;
