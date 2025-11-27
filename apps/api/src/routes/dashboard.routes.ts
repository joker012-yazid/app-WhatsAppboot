import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

router.get('/', requireAuth, async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      revenueToday,
      pendingJobs,
      inProgressJobs,
      newCustomersToday,
      urgentJobs,
      campaignsRunning,
      completedJobs,
      newCustomers,
      jobStatusHistory,
      campaignEvents,
      jobsByStatus,
    ] = await Promise.all([
      prisma.job.aggregate({
        where: { status: 'COMPLETED', updatedAt: { gte: todayStart } },
        _sum: { approvedAmount: true },
      }),
      prisma.job.count({ where: { status: 'PENDING' } }),
      prisma.job.count({ where: { status: { in: ['APPROVED', 'IN_PROGRESS'] } } }),
      prisma.customer.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.job.count({ where: { priority: 'URGENT', status: { in: ['PENDING', 'APPROVED', 'IN_PROGRESS'] } } }),
      prisma.campaign.count({ where: { status: { in: ['SCHEDULED', 'RUNNING'] } } }),
      prisma.job.findMany({
        where: { status: 'COMPLETED', updatedAt: { gte: sevenDaysAgo } },
        select: { id: true, approvedAmount: true, updatedAt: true },
      }),
      prisma.customer.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { id: true, createdAt: true },
      }),
      prisma.jobStatusHistory.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: { job: { select: { id: true, title: true, status: true } } },
      }),
      prisma.campaignEvent.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: { campaign: { select: { id: true, name: true, status: true } } },
      }),
      prisma.job.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    const dayKey = (date: Date) => date.toISOString().slice(0, 10);
    const completedBuckets = new Map<string, { revenue: number; jobs: number }>();
    for (const job of completedJobs) {
      const key = dayKey(job.updatedAt);
      const bucket = completedBuckets.get(key) || { revenue: 0, jobs: 0 };
      bucket.revenue += Number(job.approvedAmount ?? 0);
      bucket.jobs += 1;
      completedBuckets.set(key, bucket);
    }

    const customerBuckets = new Map<string, number>();
    for (const customer of newCustomers) {
      const key = dayKey(customer.createdAt);
      customerBuckets.set(key, (customerBuckets.get(key) || 0) + 1);
    }

    const days: Date[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(todayStart);
      date.setDate(date.getDate() - i);
      days.push(date);
    }

    const salesTrend = days.map((date) => {
      const key = dayKey(date);
      const bucket = completedBuckets.get(key) || { revenue: 0, jobs: 0 };
      return {
        date: date.toISOString(),
        revenue: Number(bucket.revenue.toFixed(2)),
        jobs: bucket.jobs,
      };
    });

    const customerGrowth = days.map((date) => {
      const key = dayKey(date);
      return {
        date: date.toISOString(),
        newCustomers: customerBuckets.get(key) || 0,
      };
    });

    const statusCounts = jobsByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );

    const jobActivities = jobStatusHistory.map((entry) => ({
      id: `job-${entry.id}`,
      type: 'job',
      title: entry.job.title,
      status: entry.status,
      jobId: entry.job.id,
      timestamp: entry.createdAt,
      description: `Job marked as ${entry.status}`,
    }));

    const campaignActivities = campaignEvents.map((event) => ({
      id: `campaign-${event.id}`,
      type: 'campaign',
      title: event.campaign?.name || 'Campaign',
      status: event.type,
      campaignId: event.campaignId,
      timestamp: event.createdAt,
      description: event.type.replace(/_/g, ' '),
    }));

    const recentActivities = [...jobActivities, ...campaignActivities]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 12)
      .map((activity) => ({
        ...activity,
        timestamp: activity.timestamp.toISOString(),
      }));

    res.json({
      cards: {
        todaysRevenue: Number(revenueToday._sum.approvedAmount ?? 0),
        pendingJobs,
        activeJobs: inProgressJobs,
        newCustomers: newCustomersToday,
        urgentJobs,
        campaignsRunning,
      },
      salesTrend,
      customerGrowth,
      jobsByStatus: {
        PENDING: statusCounts.PENDING || 0,
        QUOTED: statusCounts.QUOTED || 0,
        APPROVED: statusCounts.APPROVED || 0,
        IN_PROGRESS: statusCounts.IN_PROGRESS || 0,
        COMPLETED: statusCounts.COMPLETED || 0,
        REJECTED: statusCounts.REJECTED || 0,
      },
      recentActivities,
    });
  } catch (error) {
    console.error('Dashboard metrics error', error);
    res.status(500).json({ message: 'Failed to load dashboard metrics' });
  }
});

export default router;
