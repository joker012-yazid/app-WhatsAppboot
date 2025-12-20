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
const workflow_1 = require("../services/workflow");
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
    status: zod_1.z.enum(['AWAITING_QUOTE', 'QUOTATION_SENT', 'APPROVED', 'REPAIRING', 'COMPLETED', 'CANCELLED']).optional(),
    priority: zod_1.z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    quotedAmount: zod_1.z.number().nullable().optional(),
    approvedAmount: zod_1.z.number().nullable().optional(),
    diagnosis: zod_1.z.string().optional().or(zod_1.z.literal('')),
    dueDate: zod_1.z.string().datetime().nullable().optional(),
});
// Utilities
const buildQrUrl = (req, token) => {
    // Use PUBLIC_BASE_URL from environment if available, otherwise fallback to request host
    const publicBaseUrl = process.env.PUBLIC_BASE_URL;
    if (publicBaseUrl) {
        return `${publicBaseUrl}/public/progress/index.html?token=${token}`;
    }
    // Fallback to dynamic host detection
    const host = req.get('host') || 'localhost:4000';
    const proto = req.headers['x-forwarded-proto']?.toString() || req.protocol || 'http';
    return `${proto}://${host}/public/progress/index.html?token=${token}`;
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
    const { fullName, phoneNumber, deviceType, deviceModel, deviceNotes, termsAccepted } = req.body || {};
    // Validate required fields
    if (!termsAccepted) {
        return res.status(400).json({ error: 'Terms and conditions must be accepted' });
    }
    if (!fullName || !phoneNumber || !deviceType || !deviceModel) {
        return res.status(400).json({ error: 'All required fields must be filled' });
    }
    const job = await prisma_1.default.job.findUnique({ where: { qrToken: token } });
    if (!job)
        return res.status(404).json({ error: 'Invalid or expired token' });
    if (job.qrExpiresAt && job.qrExpiresAt < new Date()) {
        return res.status(410).json({ error: 'Registration link has expired' });
    }
    // Update customer information
    if (fullName && phoneNumber) {
        await prisma_1.default.customer.update({
            where: { id: job.customerId },
            data: {
                name: fullName,
                phone: phoneNumber
            }
        });
    }
    // Update device information
    if (deviceType || deviceModel) {
        await prisma_1.default.device.update({
            where: { id: job.deviceId },
            data: {
                deviceType: deviceType || undefined,
                model: deviceModel || undefined,
                notes: deviceNotes || undefined
            }
        });
    }
    // Update job status to AWAITING_QUOTE (customer has registered)
    await prisma_1.default.job.update({
        where: { id: job.id },
        data: {
            status: 'AWAITING_QUOTE',
            description: deviceNotes || job.description
        }
    });
    // Send confirmation WhatsApp message
    await (0, workflow_1.sendRegistrationConfirmation)(job.id);
    return res.json({
        success: true,
        message: 'Registration completed successfully',
        jobId: job.id
    });
});
// Public progress endpoint - allows customers to view job progress via QR code
router.get('/progress/:token', async (req, res) => {
    const token = String(req.params.token);
    const job = await prisma_1.default.job.findUnique({
        where: { qrToken: token },
        include: {
            customer: true,
            device: true
        }
    });
    if (!job) {
        return res.status(404).json({ message: 'Invalid token' });
    }
    // Check if token has expired
    if (job.qrExpiresAt && job.qrExpiresAt < new Date()) {
        return res.status(410).json({ message: 'Progress link has expired. Please contact the service center for a new link.' });
    }
    // Get status history
    const history = await prisma_1.default.jobStatusHistory.findMany({
        where: { jobId: job.id },
        orderBy: { createdAt: 'desc' },
    });
    // Get photos with URLs (relative paths for proxy compatibility)
    const photosRaw = await prisma_1.default.jobPhoto.findMany({
        where: { jobId: job.id },
        orderBy: { createdAt: 'desc' }
    });
    const photos = photosRaw.map((p) => ({
        id: p.id,
        label: p.label,
        url: p.filePath.startsWith('/') ? p.filePath : `/${p.filePath}`,
        createdAt: p.createdAt,
    }));
    return res.json({
        job: {
            id: job.id,
            title: job.title,
            description: job.description,
            status: job.status,
            priority: job.priority,
            diagnosis: job.diagnosis,
            dueDate: job.dueDate,
            createdAt: job.createdAt,
            customer: {
                name: job.customer.name,
            },
            device: {
                deviceType: job.device.deviceType,
                brand: job.device.brand,
                model: job.device.model,
            },
        },
        history,
        photos,
    });
});
// Authenticated routes
router.get('/', auth_1.requireAuth, async (req, res) => {
    const { status, customer, from, to } = req.query;
    const currentUser = req.user; // User info dari requireAuth middleware
    const where = {};
    // Filter berdasarkan ownership
    if (currentUser.role === 'ADMIN') {
        // Admin nampak semua jobs
        // No additional filter needed
    }
    else {
        // User biasa - apply ownership logic
        where.OR = [
            // Jobs di AWAITING_QUOTE yang belum ada owner (boleh diambil sesiapa)
            {
                status: 'AWAITING_QUOTE',
                ownerUserId: null
            },
            // Jobs yang user ni adalah owner
            {
                ownerUserId: currentUser.id
            }
        ];
    }
    // Additional filters
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
    const jobs = await prisma_1.default.job.findMany({
        where,
        include: {
            customer: true,
            device: true,
            owner: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            },
            photos: { take: 1, orderBy: { createdAt: 'desc' } },
            _count: { select: { photos: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    const data = jobs.map((j) => {
        // Use relative URLs for proxy compatibility
        const firstPhoto = j.photos?.[0];
        const thumb = firstPhoto
            ? (firstPhoto.filePath.startsWith('/') ? firstPhoto.filePath : `/${firstPhoto.filePath}`)
            : null;
        // strip photos array from list payload
        const { photos, _count, ...rest } = j;
        return {
            ...rest,
            thumbnailUrl: thumb,
            photoCount: _count?.photos ?? 0,
            ownerName: j.owner?.name,
            isOwner: j.ownerUserId === currentUser.id
        };
    });
    res.json(data);
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'USER'), async (req, res) => {
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
router.put('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'USER'), async (req, res) => {
    const id = String(req.params.id);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const data = parsed.data;
    const currentUser = req.user;
    try {
        const existing = await prisma_1.default.job.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ message: 'Job not found' });
        // Check ownership permissions
        if (currentUser.role !== 'ADMIN') {
            // If job has an owner, only the owner can update it
            if (existing.ownerUserId && existing.ownerUserId !== currentUser.id) {
                return res.status(403).json({ message: 'Anda bukan owner job ini' });
            }
        }
        // Prepare update data
        let updateData = {
            ...('title' in data ? { title: data.title } : {}),
            ...('description' in data ? { description: data.description || null } : {}),
            ...('status' in data ? { status: data.status } : {}),
            ...('priority' in data ? { priority: data.priority } : {}),
            ...('quotedAmount' in data ? { quotedAmount: data.quotedAmount ?? null } : {}),
            ...('approvedAmount' in data ? { approvedAmount: data.approvedAmount ?? null } : {}),
            ...('diagnosis' in data ? { diagnosis: data.diagnosis || null } : {}),
            ...('dueDate' in data ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
        };
        // Ownership logic: Set owner when moving from AWAITING_QUOTE to QUOTATION_SENT
        if (data.status === 'QUOTATION_SENT' &&
            existing.status === 'AWAITING_QUOTE' &&
            !existing.ownerUserId) {
            updateData.ownerUserId = currentUser.id;
            updateData.assignedAt = new Date();
        }
        const updated = await prisma_1.default.job.update({
            where: { id },
            data: updateData,
        });
        // Create history entry when status OR diagnosis changes
        const statusChanged = data.status && data.status !== existing.status;
        const diagnosisChanged = 'diagnosis' in data && data.diagnosis !== existing.diagnosis;
        if (statusChanged || diagnosisChanged) {
            // Include the diagnosis (catatan + fasa) in the history
            const currentDiagnosis = data.diagnosis || existing.diagnosis || '';
            await prisma_1.default.jobStatusHistory.create({
                data: {
                    jobId: id,
                    status: (data.status || existing.status),
                    notes: currentDiagnosis || (statusChanged ? `Status updated from ${existing.status} to ${data.status}` : null),
                },
            });
            // Trigger workflow automation (only if status actually changed)
            if (statusChanged && data.status) {
                await (0, workflow_1.onJobStatusChange)(id, data.status, existing.status);
            }
            // Schedule reminders for quotations
            if (data.status === 'QUOTATION_SENT') {
                const DAY = 24 * 60 * 60 * 1000;
                await (0, queues_1.enqueueReminder)(id, 'QUOTE_DAY_1', DAY);
                await (0, queues_1.enqueueReminder)(id, 'QUOTE_DAY_20', 20 * DAY);
                await (0, queues_1.enqueueReminder)(id, 'QUOTE_DAY_30', 30 * DAY);
            }
        }
        return res.json(updated);
    }
    catch (e) {
        console.error('Update job error:', e);
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
// Delete history entry
router.delete('/:id/history/:historyId', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'USER'), async (req, res) => {
    const { id, historyId } = req.params;
    try {
        // Verify history entry belongs to this job
        const historyEntry = await prisma_1.default.jobStatusHistory.findUnique({
            where: { id: historyId },
        });
        if (!historyEntry || historyEntry.jobId !== id) {
            return res.status(404).json({ message: 'History entry not found' });
        }
        await prisma_1.default.jobStatusHistory.delete({
            where: { id: historyId },
        });
        return res.status(204).send();
    }
    catch (error) {
        console.error('Delete history error:', error);
        return res.status(500).json({ message: 'Failed to delete history entry' });
    }
});
// Update history entry notes
router.put('/:id/history/:historyId', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'USER'), async (req, res) => {
    const { id, historyId } = req.params;
    const { notes } = req.body;
    if (typeof notes !== 'string') {
        return res.status(400).json({ message: 'Notes must be a string' });
    }
    try {
        // Verify history entry belongs to this job
        const historyEntry = await prisma_1.default.jobStatusHistory.findUnique({
            where: { id: historyId },
        });
        if (!historyEntry || historyEntry.jobId !== id) {
            return res.status(404).json({ message: 'History entry not found' });
        }
        const updated = await prisma_1.default.jobStatusHistory.update({
            where: { id: historyId },
            data: { notes: notes || null },
        });
        return res.json(updated);
    }
    catch (error) {
        console.error('Update history error:', error);
        return res.status(500).json({ message: 'Failed to update history entry' });
    }
});
// Reissue QR token
router.post('/:id/qr/renew', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'USER'), async (req, res) => {
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
router.delete('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
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
    const rows = await prisma_1.default.jobPhoto.findMany({ where: { jobId: id }, orderBy: { createdAt: 'desc' } });
    // Return relative URLs for proxy compatibility
    const data = rows.map((p) => ({
        ...p,
        url: p.filePath.startsWith('/') ? p.filePath : `/${p.filePath}`,
    }));
    return res.json(data);
});
router.post('/:id/photos', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'USER'), upload.array('photos', 6), async (req, res) => {
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
        // Return relative URL for proxy compatibility
        saved.push({ ...rec, url: rel });
    }
    return res.status(201).json(saved);
});
router.put('/:id/photos/:photoId', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'USER'), async (req, res) => {
    const { id, photoId } = req.params;
    const { label } = req.body;
    const photo = await prisma_1.default.jobPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.jobId !== id)
        return res.status(404).json({ message: 'Photo not found' });
    const updated = await prisma_1.default.jobPhoto.update({
        where: { id: photoId },
        data: { label: label || null },
    });
    // Return relative URL for proxy compatibility
    return res.json({
        ...updated,
        url: updated.filePath.startsWith('/') ? updated.filePath : `/${updated.filePath}`,
    });
});
router.delete('/:id/photos/:photoId', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'USER'), async (req, res) => {
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
