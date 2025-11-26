"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const node_crypto_1 = require("node:crypto");
const multer_1 = __importDefault(require("multer"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const queues_1 = require("../queues");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const createSchema = zod_1.z.object({
    customerId: zod_1.z.string().uuid(),
    deviceId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional().or(zod_1.z.literal('')),
    priority: zod_1.z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    quotedAmount: zod_1.z.number().optional(),
    dueDate: zod_1.z.string().datetime().optional(),
});
const updateSchema = zod_1.z.object({
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional().or(zod_1.z.literal('')),
    status: zod_1.z.enum(['PENDING', 'QUOTED', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
    priority: zod_1.z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    quotedAmount: zod_1.z.number().nullable().optional(),
    approvedAmount: zod_1.z.number().nullable().optional(),
    diagnosis: zod_1.z.string().optional().or(zod_1.z.literal('')),
    dueDate: zod_1.z.string().datetime().nullable().optional(),
});
// Utilities
const buildQrUrl = (req, token) => {
    const host = req.get('host') || 'localhost:4000';
    const proto = req.headers['x-forwarded-proto']?.toString() || req.protocol || 'http';
    return `${proto}://${host}/public/register/index.html?token=${token}`;
};
// Multer storage for job photos (shared uploads at repo root)
const uploadsDir = node_path_1.default.resolve(process.cwd(), '../../uploads');
if (!node_fs_1.default.existsSync(uploadsDir))
    node_fs_1.default.mkdirSync(uploadsDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = node_path_1.default.extname(file.originalname);
        cb(null, `${(0, node_crypto_1.randomUUID)()}${ext}`);
    },
});
const fileFilter = (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/'))
        return cb(null, true);
    return cb(new Error('Only image files are allowed'));
};
const upload = (0, multer_1.default)({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024, files: 6 } });
// Public register endpoints
router.get('/register/:token', async (req, res) => {
    const token = String(req.params.token);
    const job = await prisma_1.default.job.findUnique({ where: { qrToken: token }, include: { customer: true, device: true } });
    if (!job)
        return res.status(404).json({ message: 'Invalid or expired token' });
    if (job.qrExpiresAt && job.qrExpiresAt < new Date())
        return res.status(410).json({ message: 'Registration link has expired' });
    return res.json({ job });
});
router.post('/register/:token', async (req, res) => {
    const token = String(req.params.token);
    const { name, phone, device_type, model, accept_terms } = req.body || {};
    if (!accept_terms)
        return res.status(400).json({ message: 'Terms must be accepted' });
    const job = await prisma_1.default.job.findUnique({ where: { qrToken: token } });
    if (!job)
        return res.status(404).json({ message: 'Invalid or expired token' });
    if (job.qrExpiresAt && job.qrExpiresAt < new Date())
        return res.status(410).json({ message: 'Registration link has expired' });
    if (name && phone) {
        await prisma_1.default.customer.update({ where: { id: job.customerId }, data: { name, phone } });
    }
    if (device_type || model) {
        await prisma_1.default.device.update({ where: { id: job.deviceId }, data: { deviceType: device_type || undefined, model: model || undefined } });
    }
    return res.json({ message: 'Registration completed' });
});
// Authenticated routes
router.get('/', auth_1.requireAuth, async (req, res) => {
    const { status, customer, from, to } = req.query;
    const where = {};
    if (status)
        where.status = status;
    if (customer)
        where.customer = { name: { contains: customer, mode: 'insensitive' } };
    if (from || to) {
        const created = {};
        if (from)
            created.gte = new Date(from);
        if (to)
            created.lte = new Date(to);
        where.createdAt = created;
    }
    const host = req.get('host') || 'localhost:4000';
    const proto = req.headers['x-forwarded-proto']?.toString() || req.protocol || 'http';
    const jobs = await prisma_1.default.job.findMany({
        where,
        include: {
            customer: true,
            device: true,
            photos: { take: 1, orderBy: { createdAt: 'desc' } },
            _count: { select: { photos: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    const data = jobs.map((j) => {
        const thumb = j.photos?.[0]
            ? `${proto}://${host}${j.photos[0].filePath.startsWith('/') ? '' : '/'}${j.photos[0].filePath}`
            : null;
        // strip photos array from list payload
        const { photos, _count, ...rest } = j;
        return { ...rest, thumbnailUrl: thumb, photoCount: _count?.photos ?? 0 };
    });
    res.json(data);
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const data = parsed.data;
    // Verify relations
    const [customer, device] = await Promise.all([
        prisma_1.default.customer.findUnique({ where: { id: data.customerId } }),
        prisma_1.default.device.findUnique({ where: { id: data.deviceId } }),
    ]);
    if (!customer || !device)
        return res.status(404).json({ message: 'Customer or device not found' });
    const qrToken = (0, node_crypto_1.randomUUID)();
    const qrExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const job = await prisma_1.default.job.create({
        data: {
            customerId: data.customerId,
            deviceId: data.deviceId,
            title: data.title,
            description: data.description || null,
            priority: data.priority || 'NORMAL',
            quotedAmount: data.quotedAmount ?? null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            qrToken,
            qrExpiresAt,
        },
    });
    const qrUrl = buildQrUrl(req, qrToken);
    return res.status(201).json({ job, qr_url: qrUrl });
});
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    const id = String(req.params.id);
    const job = await prisma_1.default.job.findUnique({ where: { id }, include: { customer: true, device: true } });
    if (!job)
        return res.status(404).json({ message: 'Job not found' });
    const qrUrl = buildQrUrl(req, job.qrToken);
    return res.json({ job, qr_url: qrUrl });
});
router.put('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
    const id = String(req.params.id);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const data = parsed.data;
    try {
        const existing = await prisma_1.default.job.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ message: 'Job not found' });
        const updated = await prisma_1.default.job.update({
            where: { id },
            data: {
                ...('title' in data ? { title: data.title } : {}),
                ...('description' in data ? { description: data.description || null } : {}),
                ...('status' in data ? { status: data.status } : {}),
                ...('priority' in data ? { priority: data.priority } : {}),
                ...('quotedAmount' in data ? { quotedAmount: data.quotedAmount ?? null } : {}),
                ...('approvedAmount' in data ? { approvedAmount: data.approvedAmount ?? null } : {}),
                ...('diagnosis' in data ? { diagnosis: data.diagnosis || null } : {}),
                ...('dueDate' in data ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
            },
        });
        if (data.status && data.status !== existing.status) {
            await prisma_1.default.jobStatusHistory.create({
                data: {
                    jobId: id,
                    status: data.status,
                    notes: `Status updated from ${existing.status} to ${data.status}`,
                },
            });
            if (data.status === 'QUOTED') {
                const DAY = 24 * 60 * 60 * 1000;
                await (0, queues_1.enqueueReminder)(id, 'QUOTE_DAY_1', DAY);
                await (0, queues_1.enqueueReminder)(id, 'QUOTE_DAY_20', 20 * DAY);
                await (0, queues_1.enqueueReminder)(id, 'QUOTE_DAY_30', 30 * DAY);
            }
        }
        return res.json(updated);
    }
    catch (e) {
        return res.status(404).json({ message: 'Job not found' });
    }
});
// Job status history
router.get('/:id/history', auth_1.requireAuth, async (req, res) => {
    const id = String(req.params.id);
    const rows = await prisma_1.default.jobStatusHistory.findMany({
        where: { jobId: id },
        orderBy: { createdAt: 'desc' },
    });
    return res.json(rows);
});
// Reissue QR token
router.post('/:id/qr/renew', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
    const id = String(req.params.id);
    const job = await prisma_1.default.job.findUnique({ where: { id } });
    if (!job)
        return res.status(404).json({ message: 'Job not found' });
    const qrToken = (0, node_crypto_1.randomUUID)();
    const qrExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const updated = await prisma_1.default.job.update({ where: { id }, data: { qrToken, qrExpiresAt } });
    const qrUrl = buildQrUrl(req, updated.qrToken);
    return res.json({ qr_url: qrUrl });
});
router.delete('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER'), async (req, res) => {
    const id = String(req.params.id);
    try {
        await prisma_1.default.job.delete({ where: { id } });
        return res.status(204).send();
    }
    catch (e) {
        return res.status(404).json({ message: 'Job not found' });
    }
});
// Photos
router.get('/:id/photos', auth_1.requireAuth, async (req, res) => {
    const id = String(req.params.id);
    const host = req.get('host') || 'localhost:4000';
    const proto = req.headers['x-forwarded-proto']?.toString() || req.protocol || 'http';
    const rows = await prisma_1.default.jobPhoto.findMany({ where: { jobId: id }, orderBy: { createdAt: 'desc' } });
    const data = rows.map((p) => ({
        ...p,
        url: `${proto}://${host}${p.filePath.startsWith('/') ? '' : '/'}${p.filePath}`,
    }));
    return res.json(data);
});
router.post('/:id/photos', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER', 'TECHNICIAN'), upload.array('photos', 6), async (req, res) => {
    const id = String(req.params.id);
    const job = await prisma_1.default.job.findUnique({ where: { id } });
    if (!job)
        return res.status(404).json({ message: 'Job not found' });
    const label = req.body?.label || null;
    const files = req.files || [];
    const saved = [];
    for (const f of files) {
        const rel = `/uploads/${node_path_1.default.basename(f.path)}`;
        const rec = await prisma_1.default.jobPhoto.create({ data: { jobId: id, label, filePath: rel } });
        saved.push({ ...rec, url: `${req.protocol}://${req.get('host')}${rel}` });
    }
    return res.status(201).json(saved);
});
router.delete('/:id/photos/:photoId', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
    const { id, photoId } = req.params;
    const photo = await prisma_1.default.jobPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.jobId !== id)
        return res.status(404).json({ message: 'Photo not found' });
    try {
        const full = node_path_1.default.resolve(process.cwd(), '../../', photo.filePath.replace(/^\/+/, ''));
        if (node_fs_1.default.existsSync(full))
            node_fs_1.default.unlinkSync(full);
    }
    catch { }
    await prisma_1.default.jobPhoto.delete({ where: { id: photoId } });
    return res.status(204).send();
});
exports.default = router;
