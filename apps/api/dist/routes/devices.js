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
const createSchema = zod_1.z.object({
    customerId: zod_1.z.string().uuid(),
    deviceType: zod_1.z.string().min(1),
    brand: zod_1.z.string().optional().or(zod_1.z.literal('')),
    model: zod_1.z.string().optional().or(zod_1.z.literal('')),
    serialNumber: zod_1.z.string().optional().or(zod_1.z.literal('')),
    notes: zod_1.z.string().optional().or(zod_1.z.literal('')),
});
const updateSchema = createSchema.partial();
// GET /api/devices?customerId=...
router.get('/', auth_1.requireAuth, async (req, res) => {
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    const where = customerId ? { customerId } : undefined;
    const devices = await prisma_1.default.device.findMany({
        where,
        include: { customer: true, _count: { select: { jobs: true } } },
        orderBy: { createdAt: 'desc' },
    });
    res.json(devices);
});
// GET /api/devices/:id
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    const id = String(req.params.id);
    try {
        const device = await prisma_1.default.device.findUnique({
            where: { id },
            include: { customer: true, jobs: { include: { customer: true } }, },
        });
        if (!device)
            return res.status(404).json({ message: 'Device not found' });
        return res.json(device);
    }
    catch (e) {
        return res.status(404).json({ message: 'Device not found' });
    }
});
// POST /api/devices
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const data = parsed.data;
    // ensure customer exists
    const customer = await prisma_1.default.customer.findUnique({ where: { id: data.customerId } });
    if (!customer)
        return res.status(404).json({ message: 'Customer not found' });
    const created = await prisma_1.default.device.create({
        data: {
            customerId: data.customerId,
            deviceType: data.deviceType,
            brand: data.brand || null,
            model: data.model || null,
            serialNumber: data.serialNumber || null,
            notes: data.notes || null,
        },
    });
    res.status(201).json(created);
});
// PUT /api/devices/:id
router.put('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
    const id = String(req.params.id);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    try {
        const updated = await prisma_1.default.device.update({
            where: { id },
            data: {
                ...parsed.data,
                brand: parsed.data.brand === '' ? null : parsed.data.brand,
                model: parsed.data.model === '' ? null : parsed.data.model,
                serialNumber: parsed.data.serialNumber === '' ? null : parsed.data.serialNumber,
                notes: parsed.data.notes === '' ? null : parsed.data.notes,
            },
        });
        res.json(updated);
    }
    catch (e) {
        res.status(404).json({ message: 'Device not found' });
    }
});
// DELETE /api/devices/:id
router.delete('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER'), async (req, res) => {
    const id = String(req.params.id);
    try {
        const jobCount = await prisma_1.default.job.count({ where: { deviceId: id } });
        if (jobCount > 0) {
            return res.status(409).json({ message: `Cannot delete device with ${jobCount} linked job(s)` });
        }
        await prisma_1.default.device.delete({ where: { id } });
        res.status(204).send();
    }
    catch (e) {
        res.status(404).json({ message: 'Device not found' });
    }
});
exports.default = router;
