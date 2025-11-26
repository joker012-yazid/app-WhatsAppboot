"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const dayInMs = 24 * 60 * 60 * 1000;
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const querySchema = zod_1.z.object({
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
});
const parseDateInput = (value) => {
    if (!value)
        return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return undefined;
    return parsed;
};
const buildDaySequence = (start, end) => {
    const days = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        days.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
};
const jobStatuses = ['PENDING', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'];
const jobPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
router.get('/summary', auth_1.requireAuth, async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid query parameters' });
    }
    const fromInput = parseDateInput(parsed.data.from);
    const toInput = parseDateInput(parsed.data.to);
    let rangeEnd = endOfDay(toInput ?? new Date());
    let rangeStart = startOfDay(fromInput ?? new Date(rangeEnd.getTime() - 6 * dayInMs));
    if (rangeStart > rangeEnd) {
        const tmp = rangeStart;
        rangeStart = startOfDay(rangeEnd);
        rangeEnd = endOfDay(tmp);
    }
    const dayLabels = buildDaySequence(rangeStart, rangeEnd);
    try {
        const [jobsInRange, completedJobs, newCustomerRecords, returningCustomers, campaigns, runningCampaigns, recipientGroups, topCustomerGroups,] = await Promise.all([
            prisma_1.default.job.findMany({
                where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
                select: { id: true, status: true, createdAt: true, updatedAt: true, priority: true },
            }),
            prisma_1.default.job.findMany({
                where: { status: 'COMPLETED', updatedAt: { gte: rangeStart, lte: rangeEnd } },
                select: { id: true, approvedAmount: true, updatedAt: true, createdAt: true, customerId: true },
            }),
            prisma_1.default.customer.findMany({
                where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
                select: { id: true, createdAt: true },
            }),
            prisma_1.default.customer.count({
                where: {
                    createdAt: { lt: rangeStart },
                    jobs: { some: { createdAt: { gte: rangeStart, lte: rangeEnd } } },
                },
            }),
            prisma_1.default.campaign.findMany({
                where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
                select: { id: true, name: true, status: true, sentCount: true, failedCount: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.campaign.count({ where: { status: { in: ['RUNNING', 'SCHEDULED'] } } }),
            prisma_1.default.campaignRecipient.groupBy({
                by: ['status'],
                where: { updatedAt: { gte: rangeStart, lte: rangeEnd } },
                _count: { status: true },
            }),
            prisma_1.default.job.groupBy({
                by: ['customerId'],
                where: { status: 'COMPLETED', updatedAt: { gte: rangeStart, lte: rangeEnd } },
                _sum: { approvedAmount: true },
                _count: { _all: true },
                orderBy: { _sum: { approvedAmount: 'desc' } },
                take: 5,
            }),
        ]);
        const topCustomerIds = topCustomerGroups.map((group) => group.customerId).filter((id) => Boolean(id));
        const topCustomerDetails = await prisma_1.default.customer.findMany({
            where: { id: { in: topCustomerIds } },
            select: { id: true, name: true, phone: true },
        });
        const topCustomers = topCustomerGroups.map((group) => {
            const details = topCustomerDetails.find((c) => c.id === group.customerId);
            return {
                id: group.customerId,
                name: details?.name ?? 'Unknown customer',
                phone: details?.phone ?? null,
                totalRevenue: Number(group._sum.approvedAmount ?? 0),
                jobs: group._count._all,
            };
        });
        const salesBuckets = new Map();
        for (const job of completedJobs) {
            const key = job.updatedAt.toISOString().slice(0, 10);
            const bucket = salesBuckets.get(key) || { revenue: 0, jobs: 0 };
            bucket.revenue += Number(job.approvedAmount ?? 0);
            bucket.jobs += 1;
            salesBuckets.set(key, bucket);
        }
        const customerBuckets = new Map();
        for (const customer of newCustomerRecords) {
            const key = customer.createdAt.toISOString().slice(0, 10);
            customerBuckets.set(key, (customerBuckets.get(key) || 0) + 1);
        }
        const salesPerDay = dayLabels.map((date) => {
            const key = date.toISOString().slice(0, 10);
            const bucket = salesBuckets.get(key) || { revenue: 0, jobs: 0 };
            return { date: date.toISOString(), revenue: Number(bucket.revenue.toFixed(2)), jobs: bucket.jobs };
        });
        const customerTrend = dayLabels.map((date) => {
            const key = date.toISOString().slice(0, 10);
            return { date: date.toISOString(), newCustomers: customerBuckets.get(key) || 0 };
        });
        const totalRevenue = completedJobs.reduce((acc, job) => acc + Number(job.approvedAmount ?? 0), 0);
        const transactions = completedJobs.length;
        const averageSale = transactions ? totalRevenue / transactions : 0;
        const statusBreakdown = jobStatuses.reduce((acc, status) => {
            acc[status] = 0;
            return acc;
        }, {});
        const priorityBreakdown = jobPriorities.reduce((acc, priority) => {
            acc[priority] = 0;
            return acc;
        }, {});
        for (const job of jobsInRange) {
            statusBreakdown[job.status] = (statusBreakdown[job.status] || 0) + 1;
            priorityBreakdown[job.priority] = (priorityBreakdown[job.priority] || 0) + 1;
        }
        const completedWithinRange = jobsInRange.filter((job) => job.status === 'COMPLETED');
        const completionRate = jobsInRange.length ? (completedWithinRange.length / jobsInRange.length) * 100 : 0;
        const turnaroundTotalMs = completedWithinRange.reduce((acc, job) => acc + Math.max(0, job.updatedAt.getTime() - job.createdAt.getTime()), 0);
        const averageTurnaroundHours = completedWithinRange.length
            ? turnaroundTotalMs / completedWithinRange.length / (60 * 60 * 1000)
            : 0;
        const recipientsByStatus = recipientGroups.reduce((acc, current) => {
            acc[current.status] = current._count.status;
            return acc;
        }, {});
        res.json({
            range: {
                from: rangeStart.toISOString(),
                to: rangeEnd.toISOString(),
                days: dayLabels.length,
            },
            sales: {
                totalRevenue: Number(totalRevenue.toFixed(2)),
                transactions,
                averageSale: Number(averageSale.toFixed(2)),
                perDay: salesPerDay,
                topCustomers,
            },
            jobs: {
                total: jobsInRange.length,
                completed: completedWithinRange.length,
                completionRate: Number(completionRate.toFixed(2)),
                averageTurnaroundHours: Number(averageTurnaroundHours.toFixed(2)),
                statusBreakdown,
                priorityBreakdown,
            },
            customers: {
                new: newCustomerRecords.length,
                returning: returningCustomers,
                retentionRate: Number(((returningCustomers / Math.max(1, returningCustomers + newCustomerRecords.length)) * 100).toFixed(2)),
                trend: customerTrend,
            },
            messaging: {
                campaignsCreated: campaigns.length,
                runningNow: runningCampaigns,
                recipientsByStatus,
                recentCampaigns: campaigns,
                sent: recipientsByStatus.SENT || 0,
                failed: recipientsByStatus.FAILED || 0,
            },
            inventory: {
                supported: false,
                message: 'Inventory module ships in Phase 4. Use urgent jobs as a proxy for stock pressure until then.',
                proxyUrgentJobs: jobsInRange.filter((job) => job.priority === 'URGENT').length,
            },
        });
    }
    catch (error) {
        console.error('Report summary error', error);
        res.status(500).json({ message: 'Failed to load report summary' });
    }
});
exports.default = router;
