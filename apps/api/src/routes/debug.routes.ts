import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// System diagnostics endpoint
router.get('/connection', requireAuth, async (req, res) => {
  const correlationId = req.correlationId;
  const currentUser = req.user as any;

  console.log(`[${correlationId}] [DEBUG] Connection test requested by:`, {
    userId: currentUser.id,
    userRole: currentUser.role,
    ip: req.ip
  });

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    correlationId,
    user: {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role
    },
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version
    }
  };

  try {
    // Test database connection
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    diagnostics.database = {
      connected: true,
      responseTime: `${Date.now() - dbStart}ms`
    };

    // Test table counts
    const [userCount, jobCount, historyCount] = await Promise.all([
      prisma.user.count(),
      prisma.job.count(),
      prisma.jobStatusHistory.count()
    ]);

    diagnostics.database.tables = {
      users: userCount,
      jobs: jobCount,
      jobHistory: historyCount
    };

    // Test recent activity
    const recentJobs = await prisma.job.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        ownerUserId: true
      }
    });

    diagnostics.recentActivity = {
      recentJobs: recentJobs.map(job => ({
        id: job.id,
        title: job.title,
        status: job.status,
        updatedAt: job.updatedAt,
        hasOwner: !!job.ownerUserId
      }))
    };

    res.json({
      status: 'ok',
      diagnostics,
      message: 'All systems operational'
    });

  } catch (error) {
    console.error(`[${correlationId}] [DEBUG] Connection test error:`, error);
    diagnostics.database = {
      connected: false,
      error: error.message
    };

    res.status(500).json({
      status: 'error',
      diagnostics,
      error: error.message
    });
  }
});

// Test DELETE functionality without deleting anything
router.get('/delete-test/:jobId/:historyId', requireAuth, async (req, res) => {
  const correlationId = req.correlationId;
  const { jobId, historyId } = req.params;
  const currentUser = req.user as any;

  console.log(`[${correlationId}] [DEBUG] DELETE test requested:`, {
    jobId,
    historyId,
    userId: currentUser.id,
    userRole: currentUser.role
  });

  const testResults: any = {
    timestamp: new Date().toISOString(),
    correlationId,
    jobId,
    historyId,
    user: {
      id: currentUser.id,
      role: currentUser.role
    }
  };

  try {
    // Check if job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        status: true,
        ownerUserId: true
      }
    });

    testResults.job = {
      exists: !!job,
      ...(job && {
        title: job.title,
        status: job.status,
        ownedByUser: job.ownerUserId === currentUser.id,
        hasOwner: !!job.ownerUserId
      })
    };

    if (!job) {
      return res.json({
        status: 'warning',
        testResults,
        message: 'Job not found - cannot test DELETE'
      });
    }

    // Check if history exists
    const history = await prisma.jobStatusHistory.findUnique({
      where: { id: historyId },
      select: {
        id: true,
        jobId: true,
        status: true,
        notes: true,
        createdAt: true
      }
    });

    testResults.history = {
      exists: !!history,
      ...(history && {
        belongsToJob: history.jobId === jobId,
        status: history.status,
        createdAt: history.createdAt
      })
    };

    if (!history) {
      return res.json({
        status: 'warning',
        testResults,
        message: 'History entry not found'
      });
    }

    if (history.jobId !== jobId) {
      return res.json({
        status: 'warning',
        testResults,
        message: 'History entry belongs to different job'
      });
    }

    // Test user permissions
    const canDelete = currentUser.role === 'ADMIN' ||
                     (currentUser.role === 'USER' && job.ownerUserId === currentUser.id);

    testResults.permissions = {
      canDelete,
      reason: currentUser.role === 'ADMIN' ? 'Admin can delete any' :
               job.ownerUserId === currentUser.id ? 'Owner can delete' :
               'Only owner or admin can delete'
    };

    if (!canDelete) {
      return res.json({
        status: 'warning',
        testResults,
        message: 'User does not have permission to delete this history entry'
      });
    }

    // All checks passed
    res.json({
      status: 'ok',
      testResults,
      message: 'DELETE would be successful - all validations passed'
    });

  } catch (error) {
    console.error(`[${correlationId}] [DEBUG] DELETE test error:`, error);
    testResults.error = error.message;

    res.status(500).json({
      status: 'error',
      testResults,
      error: error.message
    });
  }
});

export default router;