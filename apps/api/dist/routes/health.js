"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        await prisma_1.default.$queryRaw `SELECT 1`;
        res.json({ status: 'ok', database: true, timestamp: new Date().toISOString() });
    }
    catch (error) {
        console.error('Health check error', error);
        res.status(500).json({ status: 'error', database: false });
    }
});
// GET /api/health/stats - Dashboard statistics
router.get('/stats', auth_1.requireAuth, async (_req, res) => {
    try {
        const [customers, devices, jobs, jobsByStatus] = await Promise.all([
            prisma_1.default.customer.count(),
            prisma_1.default.device.count(),
            prisma_1.default.job.count(),
            prisma_1.default.job.groupBy({
                by: ['status'],
                _count: { status: true },
            }),
        ]);
        const statusCounts = jobsByStatus.reduce((acc, item) => {
            acc[item.status] = item._count.status;
            return acc;
        }, {});
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
    }
    catch (error) {
        console.error('Stats error', error);
        res.status(500).json({ message: 'Failed to fetch statistics' });
    }
});
exports.default = router;
