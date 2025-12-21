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
    // Validate required relations exist
    if (!job.customer || !job.device) {
        return res.status(500).json({ message: 'Job data is incomplete. Please contact the service center.' });
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
        console.log('[JOBS] 🔍 Admin user - fetching all jobs:', {
            userId: currentUser.sub,
            userEmail: currentUser.email,
            role: currentUser.role
        });
        // No additional filter needed
    }
    else {
        // User biasa - apply ownership logic
        console.log('[JOBS] 🔍 Regular user - applying ownership filter:', {
            userId: currentUser.sub,
            userEmail: currentUser.email,
            role: currentUser.role
        });
        where.OR = [
            // Jobs di AWAITING_QUOTE yang belum ada owner (boleh diambil sesiapa)
            {
                status: 'AWAITING_QUOTE',
                ownerUserId: null
            },
            // SEMUA jobs yang user ni adalah owner (regardless of status)
            {
                ownerUserId: currentUser.sub
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
    // Log debugging info about jobs retrieved
    console.log('[JOBS] 📊 Jobs retrieved:', {
        userId: currentUser.sub,
        userEmail: currentUser.email,
        role: currentUser.role,
        totalJobsFound: jobs.length,
        jobsByStatus: jobs.reduce((acc, job) => {
            acc[job.status] = (acc[job.status] || 0) + 1;
            return acc;
        }, {}),
        jobDetails: jobs.map(job => ({
            id: job.id,
            title: job.title,
            status: job.status,
            ownerUserId: job.ownerUserId,
            isOwner: job.ownerUserId === currentUser.sub,
            ownerName: job.owner?.name,
            visibility: job.ownerUserId === currentUser.sub ? 'OWNED_BY_USER' :
                (job.status === 'AWAITING_QUOTE' && !job.ownerUserId) ? 'AVAILABLE' :
                    'NOT_VISIBLE'
        }))
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
            isOwner: j.ownerUserId === currentUser.sub
        };
    });
    console.log('[JOBS] ✅ Returning jobs to user:', {
        userId: currentUser.sub,
        userEmail: currentUser.email,
        jobsReturned: data.length,
        jobsByStatus: data.reduce((acc, job) => {
            acc[job.status] = (acc[job.status] || 0) + 1;
            return acc;
        }, {})
    });
    res.json(data);
});
// Debug endpoint for job ownership
router.get('/debug/:id', auth_1.requireAuth, async (req, res) => {
    const id = String(req.params.id);
    const currentUser = req.user;
    const job = await prisma_1.default.job.findUnique({
        where: { id },
        include: {
            customer: { select: { name: true } },
            device: { select: { deviceType: true, brand: true, model: true } },
            owner: { select: { id: true, name: true, email: true, username: true } }
        }
    });
    if (!job) {
        return res.status(404).json({
            success: false,
            message: 'Job not found'
        });
    }
    const isOwner = job.ownerUserId === currentUser.sub;
    const isAdmin = currentUser.role === 'ADMIN';
    const canView = isAdmin || (!job.ownerUserId && job.status === 'AWAITING_QUOTE') || isOwner;
    const canClaim = !job.ownerUserId && job.status === 'AWAITING_QUOTE' && !isAdmin;
    return res.json({
        success: true,
        job: {
            id: job.id,
            title: job.title,
            status: job.status,
            ownerUserId: job.ownerUserId,
            assignedAt: job.assignedAt,
            owner: job.owner,
            customer: job.customer,
            device: job.device
        },
        permissions: {
            isOwner,
            isAdmin,
            canView,
            canClaim,
            currentUser: {
                id: currentUser.sub,
                email: currentUser.email,
                username: currentUser.username,
                role: currentUser.role
            }
        },
        debug: {
            reasonForCanView: isAdmin ? 'Admin can see all jobs' :
                isOwner ? 'User owns this job' :
                    (!job.ownerUserId && job.status === 'AWAITING_QUOTE') ? 'Job is available for claiming' :
                        'No permission to view'
        }
    });
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
// Claim a job (for regular users)
router.put('/:id/claim', auth_1.requireAuth, async (req, res) => {
    const id = String(req.params.id);
    const currentUser = req.user;
    try {
        const existing = await prisma_1.default.job.findUnique({
            where: { id },
            include: { owner: { select: { id: true, name: true, email: true } } }
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }
        // Check if job can be claimed
        if (existing.ownerUserId) {
            return res.status(400).json({
                success: false,
                message: 'Job is already owned by another user',
                owner: existing.owner
            });
        }
        if (existing.status !== 'AWAITING_QUOTE') {
            return res.status(400).json({
                success: false,
                message: 'Job can only be claimed when in AWAITING_QUOTE status',
                currentStatus: existing.status
            });
        }
        if (currentUser.role === 'ADMIN') {
            return res.status(400).json({
                success: false,
                message: 'Admin users cannot claim jobs. Admins can see all jobs by default.'
            });
        }
        // Claim the job
        const updated = await prisma_1.default.job.update({
            where: { id },
            data: {
                ownerUserId: currentUser.sub,
                assignedAt: new Date()
            },
            include: {
                owner: { select: { id: true, name: true, email: true, username: true } }
            }
        });
        console.log('[JOBS] Job claimed via direct claim:', {
            jobId: id,
            jobTitle: existing.title,
            claimedBy: currentUser.sub,
            claimedByEmail: currentUser.email,
            claimedAt: updated.assignedAt
        });
        return res.json({
            success: true,
            message: 'Job successfully claimed',
            job: updated
        });
    }
    catch (error) {
        console.error('[JOBS] Error claiming job:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to claim job',
            error: error.message
        });
    }
});
// ============================================================================
// Helper Functions for Job Update (Refactored for clarity)
// ============================================================================
/**
 * Check if the current user has permission to update this job
 */
function checkUpdatePermissions(job, currentUser) {
    if (currentUser.role === 'ADMIN') {
        return { allowed: true };
    }
    // If job has an owner, only the owner can update it
    if (job.ownerUserId && job.ownerUserId !== currentUser.sub) {
        return { allowed: false, error: 'Anda bukan owner job ini' };
    }
    return { allowed: true };
}
/**
 * Build the update data object from request payload
 */
function buildUpdateData(data) {
    return {
        ...('title' in data ? { title: data.title } : {}),
        ...('description' in data ? { description: data.description || null } : {}),
        ...('status' in data ? { status: data.status } : {}),
        ...('priority' in data ? { priority: data.priority } : {}),
        ...('quotedAmount' in data ? { quotedAmount: data.quotedAmount ?? null } : {}),
        ...('approvedAmount' in data ? { approvedAmount: data.approvedAmount ?? null } : {}),
        ...('diagnosis' in data ? { diagnosis: data.diagnosis || null } : {}),
        ...('dueDate' in data ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
    };
}
/**
 * Determine if the job should be claimed by the current user
 * Returns ownership data to add to the update, or null if job should not be claimed
 */
function determineOwnershipClaim(existingJob, requestData, currentUser) {
    const shouldClaim = (currentUser.role !== 'ADMIN' &&
        existingJob.status === 'AWAITING_QUOTE' &&
        requestData.status &&
        requestData.status !== 'AWAITING_QUOTE' &&
        !existingJob.ownerUserId);
    if (shouldClaim) {
        console.log('[JOBS] ✅ Job will be claimed by user:', {
            jobId: existingJob.id,
            jobTitle: existingJob.title,
            claimedBy: currentUser.sub,
            claimedByEmail: currentUser.email,
            fromStatus: existingJob.status,
            toStatus: requestData.status
        });
        return {
            shouldClaim: true,
            ownershipData: {
                ownerUserId: currentUser.sub,
                assignedAt: new Date()
            }
        };
    }
    return { shouldClaim: false };
}
/**
 * Verify that ownership was properly saved to the database
 */
function verifyOwnershipSaved(updatedJob, expectedOwnerId) {
    if (!expectedOwnerId) {
        return { success: true };
    }
    const verificationPassed = updatedJob.ownerUserId === expectedOwnerId;
    console.log('[JOBS] ✅ Ownership verification:', {
        jobId: updatedJob.id,
        ownerSetInDb: updatedJob.ownerUserId,
        expectedOwnerId,
        verification: verificationPassed ? 'SUCCESS' : 'FAILED'
    });
    if (!verificationPassed) {
        console.error('[JOBS] ❌ CRITICAL: Ownership was not properly saved!', {
            jobId: updatedJob.id,
            expectedOwnerId,
            actualOwnerId: updatedJob.ownerUserId
        });
        return {
            success: false,
            error: 'Failed to claim job - ownership was not properly saved'
        };
    }
    return { success: true };
}
/**
 * Handle post-update operations: history, workflows, and reminders
 */
async function handlePostUpdateOperations(jobId, existingJob, requestData) {
    const statusChanged = requestData.status && requestData.status !== existingJob.status;
    const diagnosisChanged = 'diagnosis' in requestData && requestData.diagnosis !== existingJob.diagnosis;
    if (!statusChanged && !diagnosisChanged) {
        return;
    }
    // Create history entry
    const currentDiagnosis = requestData.diagnosis || existingJob.diagnosis || '';
    await prisma_1.default.jobStatusHistory.create({
        data: {
            jobId,
            status: (requestData.status || existingJob.status),
            notes: currentDiagnosis || (statusChanged ? `Status updated from ${existingJob.status} to ${requestData.status}` : null),
        },
    });
    // Trigger workflow automation (only if status actually changed)
    if (statusChanged && requestData.status) {
        await (0, workflow_1.onJobStatusChange)(jobId, requestData.status, existingJob.status);
    }
    // Schedule reminders for quotations
    if (requestData.status === 'QUOTATION_SENT') {
        const DAY = 24 * 60 * 60 * 1000;
        await (0, queues_1.enqueueReminder)(jobId, 'QUOTE_DAY_1', DAY);
        await (0, queues_1.enqueueReminder)(jobId, 'QUOTE_DAY_20', 20 * DAY);
        await (0, queues_1.enqueueReminder)(jobId, 'QUOTE_DAY_30', 30 * DAY);
    }
}
/**
 * Fetch and build the job response with ownership info
 */
async function buildJobResponse(jobId, currentUserId) {
    const jobWithOwner = await prisma_1.default.job.findUnique({
        where: { id: jobId },
        include: {
            customer: { select: { name: true } },
            device: { select: { deviceType: true, brand: true, model: true } },
            owner: { select: { id: true, name: true, email: true } }
        }
    });
    if (!jobWithOwner) {
        return null;
    }
    return {
        ...jobWithOwner,
        ownerName: jobWithOwner.owner?.name,
        isOwner: jobWithOwner.ownerUserId === currentUserId
    };
}
// ============================================================================
// Route Handlers
// ============================================================================
router.put('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'USER'), async (req, res) => {
    const id = String(req.params.id);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const data = parsed.data;
    const currentUser = req.user;
    try {
        // 1. Fetch existing job
        const existing = await prisma_1.default.job.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ message: 'Job not found' });
        // 2. Check permissions
        const permissionCheck = checkUpdatePermissions(existing, currentUser);
        if (!permissionCheck.allowed) {
            return res.status(403).json({ message: permissionCheck.error });
        }
        // 3. Build update data
        let updateData = buildUpdateData(data);
        // 4. Determine if job should be claimed
        const claimResult = determineOwnershipClaim(existing, data, currentUser);
        if (claimResult.shouldClaim && claimResult.ownershipData) {
            updateData = { ...updateData, ...claimResult.ownershipData };
        }
        // 5. Update job in database
        const updated = await prisma_1.default.job.update({
            where: { id },
            data: updateData,
        });
        // 6. Verify ownership was saved correctly (if applicable)
        const ownershipVerification = verifyOwnershipSaved(updated, updateData.ownerUserId || null);
        if (!ownershipVerification.success) {
            return res.status(500).json({
                message: ownershipVerification.error,
                error: 'OWNERSHIP_SAVE_FAILED'
            });
        }
        // 7. Handle post-update operations (history, workflows, reminders)
        await handlePostUpdateOperations(id, existing, data);
        // 8. Build and return response
        const response = await buildJobResponse(id, currentUser.id);
        if (!response) {
            return res.status(404).json({ message: 'Job not found after update' });
        }
        return res.json(response);
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
    const correlationId = req.correlationId;
    const currentUser = req.user;
    console.log(`[${correlationId}] [JOBS] Delete history request:`, {
        jobId: id,
        historyId,
        userId: currentUser.sub,
        userRole: currentUser.role
    });
    try {
        // Validate IDs format
        if (!id || !historyId || id.length < 10 || historyId.length < 10) {
            console.warn(`[${correlationId}] [JOBS] Invalid IDs:`, { id, historyId });
            return res.status(400).json({
                success: false,
                correlationId,
                message: 'Invalid job or history ID format'
            });
        }
        // Verify history entry belongs to this job
        const historyEntry = await prisma_1.default.jobStatusHistory.findUnique({
            where: { id: historyId },
        });
        if (!historyEntry) {
            console.warn(`[${correlationId}] [JOBS] History entry not found:`, { historyId });
            return res.status(404).json({
                success: false,
                correlationId,
                message: 'History entry not found'
            });
        }
        if (historyEntry.jobId !== id) {
            console.warn(`[${correlationId}] [JOBS] History entry belongs to different job:`, {
                historyId,
                actualJobId: historyEntry.jobId,
                requestedJobId: id
            });
            return res.status(404).json({
                success: false,
                correlationId,
                message: 'History entry not found for this job'
            });
        }
        // Delete the history entry
        await prisma_1.default.jobStatusHistory.delete({
            where: { id: historyId },
        });
        console.log(`[${correlationId}] [JOBS] ✅ History entry deleted successfully:`, {
            historyId,
            jobId: id,
            deletedBy: currentUser.sub
        });
        // Include correlation ID in response header
        res.setHeader('X-Correlation-ID', correlationId);
        return res.status(204).send();
    }
    catch (error) {
        console.error(`[${correlationId}] [JOBS] ❌ Delete history error:`, {
            error: error.message,
            jobId: id,
            historyId,
            userId: currentUser.sub,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        // Check for specific database errors
        if (error.code === 'P2025') {
            // Record not found
            return res.status(404).json({
                success: false,
                correlationId,
                message: 'History entry not found'
            });
        }
        if (error.code === 'P2002') {
            // Foreign key constraint
            return res.status(409).json({
                success: false,
                correlationId,
                message: 'Cannot delete history entry due to dependencies'
            });
        }
        res.setHeader('X-Correlation-ID', correlationId);
        return res.status(500).json({
            success: false,
            correlationId,
            message: 'Failed to delete history entry',
            ...(process.env.NODE_ENV === 'development' && {
                error: error.message,
                code: error.code
            })
        });
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
