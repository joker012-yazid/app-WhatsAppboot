"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const normalizeTags = (tags) => (tags || [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/\s+/g, ' ').toUpperCase());
// Schemas
const tagsSchema = zod_1.z.array(zod_1.z.string().min(1)).optional();
const createSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    phone: zod_1.z.string().min(5),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    notes: zod_1.z.string().optional().or(zod_1.z.literal('')),
    type: zod_1.z.nativeEnum(client_1.CustomerType).optional(),
    tags: tagsSchema,
});
const updateSchema = createSchema.partial();
// GET /api/customers?search=...
router.get('/', auth_1.requireAuth, async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const where = search
        ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ],
        }
        : undefined;
    const customers = await prisma_1.default.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { devices: true, jobs: true } } },
    });
    return res.json(customers);
});
// POST /api/customers
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER'), async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const { name, phone, email, notes, type, tags } = parsed.data;
    // enforce unique phone
    const exists = await prisma_1.default.customer.findUnique({ where: { phone } }).catch(() => null);
    if (exists)
        return res.status(409).json({ message: 'Customer with this phone already exists' });
    const created = await prisma_1.default.customer.create({
        data: {
            name,
            phone,
            email: email || null,
            notes: notes || null,
            type: type || 'REGULAR',
            tags: normalizeTags(tags),
        },
    });
    return res.status(201).json(created);
});
// GET /api/customers/:id
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    const id = String(req.params.id);
    const customer = await prisma_1.default.customer.findUnique({
        where: { id },
        include: {
            devices: { orderBy: { createdAt: 'desc' } },
            jobs: { include: { device: true }, orderBy: { createdAt: 'desc' } },
            _count: { select: { devices: true, jobs: true } },
        },
    });
    if (!customer)
        return res.status(404).json({ message: 'Customer not found' });
    return res.json(customer);
});
// PUT /api/customers/:id
router.put('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER'), async (req, res) => {
    const id = String(req.params.id);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    try {
        const updateData = {
            ...parsed.data,
            email: parsed.data.email === '' ? null : parsed.data.email,
            notes: parsed.data.notes === '' ? null : parsed.data.notes,
        };
        if (typeof parsed.data.type !== 'undefined') {
            updateData.type = parsed.data.type;
        }
        if (typeof parsed.data.tags !== 'undefined') {
            updateData.tags = normalizeTags(parsed.data.tags);
        }
        const updated = await prisma_1.default.customer.update({
            where: { id },
            data: updateData,
        });
        return res.json(updated);
    }
    catch (e) {
        return res.status(404).json({ message: 'Customer not found' });
    }
});
// DELETE /api/customers/:id
router.delete('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER'), async (req, res) => {
    const id = String(req.params.id);
    try {
        const [deviceCount, jobCount] = await Promise.all([
            prisma_1.default.device.count({ where: { customerId: id } }),
            prisma_1.default.job.count({ where: { customerId: id } }),
        ]);
        if (deviceCount > 0 || jobCount > 0) {
            return res
                .status(409)
                .json({ message: `Cannot delete customer with ${deviceCount} device(s) and ${jobCount} job(s)` });
        }
        await prisma_1.default.customer.delete({ where: { id } });
        return res.status(204).send();
    }
    catch (e) {
        return res.status(404).json({ message: 'Customer not found' });
    }
});
exports.default = router;
