import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { enqueueReminder } from '../queues';

import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { onJobStatusChange, sendRegistrationConfirmation } from '../services/workflow';

const router = Router();

const createSchema = z.object({
  customerId: z.string().uuid(),
  deviceId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional().or(z.literal('')),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  quotedAmount: z.number().optional(),
  dueDate: z.string().datetime().optional(),
});

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional().or(z.literal('')),
  status: z.enum(['AWAITING_QUOTE', 'QUOTATION_SENT', 'APPROVED', 'REPAIRING', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  quotedAmount: z.number().nullable().optional(),
  approvedAmount: z.number().nullable().optional(),
  diagnosis: z.string().optional().or(z.literal('')),
  dueDate: z.string().datetime().nullable().optional(),
});

// Utilities
const buildQrUrl = (req: import('express').Request, token: string) => {
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
const uploadsDir = path.resolve(process.cwd(), '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
  return cb(new Error('Only image files are allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024, files: 6 } });

// Public register endpoints
router.get('/register/:token', async (req, res) => {
  const token = String(req.params.token);
  const job = await prisma.job.findUnique({ where: { qrToken: token }, include: { customer: true, device: true } });
  if (!job) return res.status(404).json({ message: 'Invalid or expired token' });
  if (job.qrExpiresAt && job.qrExpiresAt < new Date()) return res.status(410).json({ message: 'Registration link has expired' });
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
  
  const job = await prisma.job.findUnique({ where: { qrToken: token } });
  if (!job) return res.status(404).json({ error: 'Invalid or expired token' });
  if (job.qrExpiresAt && job.qrExpiresAt < new Date()) {
    return res.status(410).json({ error: 'Registration link has expired' });
  }

  // Update customer information
  if (fullName && phoneNumber) {
    await prisma.customer.update({ 
      where: { id: job.customerId }, 
      data: { 
        name: fullName, 
        phone: phoneNumber 
      } 
    });
  }
  
  // Update device information
  if (deviceType || deviceModel) {
    await prisma.device.update({ 
      where: { id: job.deviceId }, 
      data: { 
        deviceType: deviceType || undefined, 
        model: deviceModel || undefined,
        notes: deviceNotes || undefined
      } 
    });
  }
  
  // Update job status to AWAITING_QUOTE (customer has registered)
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: 'AWAITING_QUOTE',
      description: deviceNotes || job.description
    }
  });
  
  // Send confirmation WhatsApp message
  await sendRegistrationConfirmation(job.id);
  
  return res.json({ 
    success: true,
    message: 'Registration completed successfully',
    jobId: job.id 
  });
});

// Public progress endpoint - allows customers to view job progress via QR code
router.get('/progress/:token', async (req, res) => {
  const token = String(req.params.token);
  
  const job = await prisma.job.findUnique({ 
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
  const history = await prisma.jobStatusHistory.findMany({
    where: { jobId: job.id },
    orderBy: { createdAt: 'desc' },
  });
  
  // Get photos with URLs (relative paths for proxy compatibility)
  const photosRaw = await prisma.jobPhoto.findMany({
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
router.get('/', requireAuth, async (req, res) => {
  const { status, customer, from, to } = req.query as Record<string, string | undefined>;
  const currentUser = req.user as any; // User info dari requireAuth middleware

  const where: Prisma.JobWhereInput = {};

  // Filter berdasarkan ownership
  if (currentUser.role === 'ADMIN') {
    // Admin nampak semua jobs
    console.log('[JOBS] 🔍 Admin user - fetching all jobs:', {
      userId: currentUser.sub,
      userEmail: currentUser.email,
      role: currentUser.role
    });
    // No additional filter needed
  } else {
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
  if (status) where.status = status as any;
  if (customer) where.customer = { name: { contains: customer, mode: 'insensitive' } };
  if (from || to) {
    const created: Prisma.DateTimeFilter = {};
    if (from) created.gte = new Date(from);
    if (to) created.lte = new Date(to);
    where.createdAt = created;
  }

  const jobs = await prisma.job.findMany({
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
    }, {} as Record<string, number>),
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
    const firstPhoto = (j as any).photos?.[0];
    const thumb = firstPhoto
      ? (firstPhoto.filePath.startsWith('/') ? firstPhoto.filePath : `/${firstPhoto.filePath}`)
      : null;
    // strip photos array from list payload
    const { photos, _count, ...rest } = j as any;
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
    }, {} as Record<string, number>)
  });

  res.json(data);
});

// Debug endpoint for job ownership
router.get('/debug/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const currentUser = req.user as any;

  const job = await prisma.job.findUnique({
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

router.post('/', requireAuth, requireRole('ADMIN', 'USER'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const data = parsed.data;

  // Verify relations
  const [customer, device] = await Promise.all([
    prisma.customer.findUnique({ where: { id: data.customerId } }),
    prisma.device.findUnique({ where: { id: data.deviceId } }),
  ]);
  if (!customer || !device) return res.status(404).json({ message: 'Customer or device not found' });

  const qrToken = randomUUID();
  const qrExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  const job = await prisma.job.create({
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

router.get('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const job = await prisma.job.findUnique({ where: { id }, include: { customer: true, device: true } });
  if (!job) return res.status(404).json({ message: 'Job not found' });
  const qrUrl = buildQrUrl(req, job.qrToken);
  return res.json({ job, qr_url: qrUrl });
});

// Claim a job (for regular users)
router.put('/:id/claim', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const currentUser = req.user as any;

  try {
    const existing = await prisma.job.findUnique({
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
    const updated = await prisma.job.update({
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

  } catch (error) {
    console.error('[JOBS] Error claiming job:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to claim job',
      error: error.message
    });
  }
});

router.put('/:id', requireAuth, requireRole('ADMIN', 'USER'), async (req, res) => {
  const id = String(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const data = parsed.data;
  const currentUser = req.user as any;

  try {
    const existing = await prisma.job.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Job not found' });

    // Check ownership permissions
    if (currentUser.role !== 'ADMIN') {
      // If job has an owner, only the owner can update it
      if (existing.ownerUserId && existing.ownerUserId !== currentUser.sub) {
        return res.status(403).json({ message: 'Anda bukan owner job ini' });
      }
    }

    // Prepare update data
    let updateData: any = {
      ...('title' in data ? { title: data.title! } : {}),
      ...('description' in data ? { description: data.description || null } : {}),
      ...('status' in data ? { status: data.status as any } : {}),
      ...('priority' in data ? { priority: data.priority as any } : {}),
      ...('quotedAmount' in data ? { quotedAmount: data.quotedAmount ?? null } : {}),
      ...('approvedAmount' in data ? { approvedAmount: data.approvedAmount ?? null } : {}),
      ...('diagnosis' in data ? { diagnosis: data.diagnosis || null } : {}),
      ...('dueDate' in data ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
    };

    // Ownership logic: Set owner when moving from AWAITING_QUOTE to another status
    console.log('[JOBS] Job update attempt:', {
      jobId: id,
      jobTitle: existing.title,
      currentOwner: existing.ownerUserId,
      currentStatus: existing.status,
      newStatus: data.status,
      requestedBy: currentUser.sub,
      requestedByRole: currentUser.role,
      requestedByEmail: currentUser.email
    });

    // Assign ownership when user moves job from AWAITING_QUOTE to any other status
    // This applies to NON-ADMIN users only (regular users claim jobs by moving them)
    const shouldClaimJob = (
      currentUser.role !== 'ADMIN' &&  // Only regular users can claim
      existing.status === 'AWAITING_QUOTE' &&  // Job must be in AWAITING_QUOTE
      data.status &&  // Status is being changed
      data.status !== 'AWAITING_QUOTE' &&  // Moving to a different status
      !existing.ownerUserId  // Job has no owner
    );

    if (shouldClaimJob) {
      updateData.ownerUserId = currentUser.sub;
      updateData.assignedAt = new Date();
      console.log('[JOBS] ✅ Job SUCCESSFULLY claimed by user:', {
        jobId: id,
        jobTitle: existing.title,
        claimedBy: currentUser.sub,
        claimedByEmail: currentUser.email,
        claimedByName: currentUser.name,
        claimedAt: updateData.assignedAt,
        fromStatus: existing.status,
        toStatus: data.status
      });
    } else {
      console.log('[JOBS] ❌ Job NOT claimed - conditions:', {
        shouldClaimJob,
        isNotAdmin: currentUser.role !== 'ADMIN',
        isFromAwaitingQuote: existing.status === 'AWAITING_QUOTE',
        hasStatusChange: !!data.status,
        isToDifferentStatus: data.status && data.status !== 'AWAITING_QUOTE',
        hasNoOwner: !existing.ownerUserId,
        currentOwner: existing.ownerUserId,
        fromStatus: existing.status,
        toStatus: data.status,
        currentUser: {
          id: currentUser.sub,
          role: currentUser.role,
          email: currentUser.email
        }
      });
    }

    // Log what data will be updated
    console.log('[JOBS] 📝 Applying update data:', {
      jobId: id,
      updateData: {
        status: updateData.status,
        ownerUserId: updateData.ownerUserId,
        assignedAt: updateData.assignedAt,
        diagnosis: updateData.diagnosis,
        quotedAmount: updateData.quotedAmount
      }
    });

    // Use transaction to ensure atomicity
    const updated = await prisma.$transaction(async (tx) => {
      const job = await tx.job.update({
        where: { id },
        data: updateData,
      });

      // Verify ownership was properly saved within transaction
      if (updateData.ownerUserId) {
        console.log('[JOBS] ✅ Ownership in transaction:', {
          jobId: id,
          jobTitle: job.title,
          ownerSetInDb: job.ownerUserId,
          ownerSetInUpdate: updateData.ownerUserId,
          assignedAt: job.assignedAt
        });
      }

      return job;
    });

    // Verify ownership was properly saved
    if (updateData.ownerUserId) {
      const verificationPassed = updated.ownerUserId === updateData.ownerUserId;
      console.log('[JOBS] ✅ Ownership verification:', {
        jobId: id,
        jobTitle: updated.title,
        ownerSetInDb: updated.ownerUserId,
        ownerSetInUpdate: updateData.ownerUserId,
        assignedAt: updated.assignedAt,
        verification: verificationPassed ? 'SUCCESS' : 'FAILED'
      });

      // If verification failed, this is a critical error
      if (!verificationPassed) {
        console.error('[JOBS] ❌ CRITICAL: Ownership was not properly saved to database!', {
          jobId: id,
          expectedOwnerId: updateData.ownerUserId,
          actualOwnerId: updated.ownerUserId
        });
        return res.status(500).json({
          message: 'Failed to claim job - ownership was not properly saved',
          error: 'OWNERSHIP_SAVE_FAILED'
        });
      }
    }

    // Create history entry when status OR diagnosis changes
    const statusChanged = data.status && data.status !== existing.status;
    const diagnosisChanged = 'diagnosis' in data && data.diagnosis !== existing.diagnosis;

    if (statusChanged || diagnosisChanged) {
      // Include the diagnosis (catatan + fasa) in the history
      const currentDiagnosis = data.diagnosis || existing.diagnosis || '';

      await prisma.jobStatusHistory.create({
        data: {
          jobId: id,
          status: (data.status || existing.status) as any,
          notes: currentDiagnosis || (statusChanged ? `Status updated from ${existing.status} to ${data.status}` : null),
        },
      });

      // Trigger workflow automation (only if status actually changed)
      if (statusChanged && data.status) {
        await onJobStatusChange(id, data.status, existing.status);
      }

      // Schedule reminders for quotations
      if (data.status === 'QUOTATION_SENT') {
        const DAY = 24 * 60 * 60 * 1000;
        await enqueueReminder(id, 'QUOTE_DAY_1', DAY);
        await enqueueReminder(id, 'QUOTE_DAY_20', 20 * DAY);
        await enqueueReminder(id, 'QUOTE_DAY_30', 30 * DAY);
      }
    }

    // Fetch updated job with owner info for response
    const jobWithOwner = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true } },
        device: { select: { deviceType: true, brand: true, model: true } },
        owner: { select: { id: true, name: true, email: true } }
      }
    });

    if (!jobWithOwner) {
      return res.status(404).json({ message: 'Job not found after update' });
    }

    // Add ownership info to the response
    const response = {
      ...jobWithOwner,
      ownerName: jobWithOwner.owner?.name,
      isOwner: jobWithOwner.ownerUserId === (req.user as any).id
    };

    console.log('[JOBS] 📤 Sending response with ownership info:', {
      jobId: id,
      jobTitle: response.title,
      ownerUserId: response.ownerUserId,
      isOwner: response.isOwner,
      ownerName: response.ownerName,
      status: response.status,
      assignedAt: response.assignedAt,
      currentUserRole: (req.user as any).role,
      currentUserId: (req.user as any).id
    });

    // Log final summary for easy tracking
    if (shouldClaimJob && response.ownerUserId === currentUser.sub) {
      console.log('[JOBS] 🎉 Job claim completed successfully:', {
        jobId: id,
        jobTitle: response.title,
        ownerId: response.ownerUserId,
        ownerName: response.ownerName,
        status: response.status,
        message: `User ${currentUser.email} successfully claimed job "${response.title}"`
      });
    }

    return res.json(response);
  } catch (e) {
    console.error('Update job error:', e);
    return res.status(404).json({ message: 'Job not found' });
  }
});

// Job status history
router.get('/:id/history', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const rows = await prisma.jobStatusHistory.findMany({
    where: { jobId: id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(rows);
});

// Delete history entry
router.delete('/:id/history/:historyId', requireAuth, requireRole('ADMIN', 'USER'), async (req, res) => {
  const { id, historyId } = req.params;
  const correlationId = req.correlationId;
  const currentUser = req.user as any;

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
    const historyEntry = await prisma.jobStatusHistory.findUnique({
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
    await prisma.jobStatusHistory.delete({
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
  } catch (error) {
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
router.put('/:id/history/:historyId', requireAuth, requireRole('ADMIN', 'USER'), async (req, res) => {
  const { id, historyId } = req.params;
  const { notes } = req.body;
  
  if (typeof notes !== 'string') {
    return res.status(400).json({ message: 'Notes must be a string' });
  }
  
  try {
    // Verify history entry belongs to this job
    const historyEntry = await prisma.jobStatusHistory.findUnique({
      where: { id: historyId },
    });
    
    if (!historyEntry || historyEntry.jobId !== id) {
      return res.status(404).json({ message: 'History entry not found' });
    }
    
    const updated = await prisma.jobStatusHistory.update({
      where: { id: historyId },
      data: { notes: notes || null },
    });
    
    return res.json(updated);
  } catch (error) {
    console.error('Update history error:', error);
    return res.status(500).json({ message: 'Failed to update history entry' });
  }
});

// Reissue QR token
router.post('/:id/qr/renew', requireAuth, requireRole('ADMIN', 'USER'), async (req, res) => {
  const id = String(req.params.id);
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return res.status(404).json({ message: 'Job not found' });
  const qrToken = randomUUID();
  const qrExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const updated = await prisma.job.update({ where: { id }, data: { qrToken, qrExpiresAt } });
  const qrUrl = buildQrUrl(req, updated.qrToken);
  return res.json({ qr_url: qrUrl });
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = String(req.params.id);
  try {
    await prisma.job.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    return res.status(404).json({ message: 'Job not found' });
  }
});

// Photos
router.get('/:id/photos', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const rows = await prisma.jobPhoto.findMany({ where: { jobId: id }, orderBy: { createdAt: 'desc' } });
  // Return relative URLs for proxy compatibility
  const data = rows.map((p) => ({
    ...p,
    url: p.filePath.startsWith('/') ? p.filePath : `/${p.filePath}`,
  }));
  return res.json(data);
});

router.post(
  '/:id/photos',
  requireAuth,
  requireRole('ADMIN', 'USER'),
  upload.array('photos', 6),
  async (req, res) => {
    const id = String(req.params.id);
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    const label = (req.body?.label as string) || null;
    const files = (req.files as Express.Multer.File[]) || [];
    const saved = [] as any[];
    for (const f of files) {
      const rel = `/uploads/${path.basename(f.path)}`;
      const rec = await prisma.jobPhoto.create({ data: { jobId: id, label, filePath: rel } });
      // Return relative URL for proxy compatibility
      saved.push({ ...rec, url: rel });
    }
    return res.status(201).json(saved);
  },
);

router.put('/:id/photos/:photoId', requireAuth, requireRole('ADMIN', 'USER'), async (req, res) => {
  const { id, photoId } = req.params as { id: string; photoId: string };
  const { label } = req.body;

  const photo = await prisma.jobPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.jobId !== id) return res.status(404).json({ message: 'Photo not found' });

  const updated = await prisma.jobPhoto.update({
    where: { id: photoId },
    data: { label: label || null },
  });

  // Return relative URL for proxy compatibility
  return res.json({
    ...updated,
    url: updated.filePath.startsWith('/') ? updated.filePath : `/${updated.filePath}`,
  });
});

router.delete('/:id/photos/:photoId', requireAuth, requireRole('ADMIN', 'USER'), async (req, res) => {
  const { id, photoId } = req.params as { id: string; photoId: string };
  const photo = await prisma.jobPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.jobId !== id) return res.status(404).json({ message: 'Photo not found' });
  try {
    const full = path.resolve(process.cwd(), '../../', photo.filePath.replace(/^\/+/, ''));
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch {}
  await prisma.jobPhoto.delete({ where: { id: photoId } });
  return res.status(204).send();
});

export default router;
