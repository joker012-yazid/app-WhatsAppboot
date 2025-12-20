import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Basic health check
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const correlationId = req.correlationId;

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    res.json({
      status: 'ok',
      database: true,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      correlationId,
      uptime: process.uptime()
    });
  } catch (error) {
    console.error(`[${correlationId}] [HEALTH] Check error:`, error);
    res.status(503).json({
      status: 'error',
      database: false,
      timestamp: new Date().toISOString(),
      correlationId,
      error: error.message
    });
  }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  const correlationId = req.correlationId;
  const startTime = Date.now();
  const checks: any = {
    database: false,
    tables: {},
    timestamp: new Date().toISOString(),
    correlationId,
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
      external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100
    }
  };

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;

    // Test critical tables
    const tables = ['User', 'Customer', 'Device', 'Job', 'JobStatusHistory'];
    for (const table of tables) {
      try {
        const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table}"`);
        checks.tables[table] = {
          accessible: true,
          count: (count as any)[0]?.count || 0
        };
      } catch (err) {
        checks.tables[table] = {
          accessible: false,
          error: err.message
        };
      }
    }

    const responseTime = Date.now() - startTime;
    checks.responseTime = `${responseTime}ms`;
    checks.status = 'ok';

    res.json(checks);
  } catch (error) {
    console.error(`[${correlationId}] [HEALTH] Detailed check error:`, error);
    checks.status = 'error';
    checks.error = error.message;
    res.status(503).json(checks);
  }
});

// Test DELETE endpoint availability
router.get('/delete-test', async (req, res) => {
  const correlationId = req.correlationId;

  try {
    // Test if we can query the history table (required for DELETE)
    await prisma.jobStatusHistory.findFirst({ take: 1 });

    res.json({
      status: 'ok',
      deleteEndpointAvailable: true,
      correlationId,
      timestamp: new Date().toISOString(),
      message: 'DELETE endpoint dependencies are available'
    });
  } catch (error) {
    console.error(`[${correlationId}] [HEALTH] DELETE test error:`, error);
    res.status(503).json({
      status: 'error',
      deleteEndpointAvailable: false,
      correlationId,
      timestamp: new Date().toISOString(),
      error: error.message
    });
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
