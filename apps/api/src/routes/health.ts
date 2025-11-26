import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

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

// GET /api/health/stats - Dashboard statistics
router.get('/stats', requireAuth, async (_req, res) => {
  try {
    const [customers, devices, jobs, jobsByStatus] = await Promise.all([
      prisma.customer.count(),
      prisma.device.count(),
      prisma.job.count(),
      prisma.job.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    const statusCounts = jobsByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );

    res.json({
      customers,
      devices,
      jobs,
      jobsByStatus: {
        PENDING: statusCounts.PENDING || 0,
        QUOTED: statusCounts.QUOTED || 0,
        APPROVED: statusCounts.APPROVED || 0,
        IN_PROGRESS: statusCounts.IN_PROGRESS || 0,
        COMPLETED: statusCounts.COMPLETED || 0,
        REJECTED: statusCounts.REJECTED || 0,
      },
    });
  } catch (error) {
    console.error('Stats error', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

export default router;
