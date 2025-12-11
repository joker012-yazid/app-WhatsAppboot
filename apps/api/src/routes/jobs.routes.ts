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
  status: z.enum(['PENDING', 'QUOTED', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  quotedAmount: z.number().nullable().optional(),
  approvedAmount: z.number().nullable().optional(),
  diagnosis: z.string().optional().or(z.literal('')),
  dueDate: z.string().datetime().nullable().optional(),
});

// Utilities
const buildQrUrl = (req: import('express').Request, token: string) => {
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
  
  // Update job status to PENDING (customer has registered)
  await prisma.job.update({
    where: { id: job.id },
    data: { 
      status: 'PENDING',
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
  
  // Check if token has expired
  if (job.qrExpiresAt && job.qrExpiresAt < new Date()) {
    return res.status(410).json({ message: 'Progress link has expired. Please contact the service center for a new link.' });
  }
  
  // Get status history
  const history = await prisma.jobStatusHistory.findMany({
    where: { jobId: job.id },
    orderBy: { createdAt: 'desc' },
  });
  
  // Get photos with URLs
  const host = req.get('host') || 'localhost:4000';
  const proto = req.headers['x-forwarded-proto']?.toString() || req.protocol || 'http';
  const photosRaw = await prisma.jobPhoto.findMany({ 
    where: { jobId: job.id }, 
    orderBy: { createdAt: 'desc' } 
  });
  
  const photos = photosRaw.map((p) => ({
    id: p.id,
    label: p.label,
    url: `${proto}://${host}${p.filePath.startsWith('/') ? '' : '/'}${p.filePath}`,
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
  const where: Prisma.JobWhereInput = {};
  if (status) where.status = status as any;
  if (customer) where.customer = { name: { contains: customer, mode: 'insensitive' } };
  if (from || to) {
    const created: Prisma.DateTimeFilter = {};
    if (from) created.gte = new Date(from);
    if (to) created.lte = new Date(to);
    where.createdAt = created;
  }

  const host = req.get('host') || 'localhost:4000';
  const proto = req.headers['x-forwarded-proto']?.toString() || req.protocol || 'http';
  const jobs = await prisma.job.findMany({
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
    const thumb = (j as any).photos?.[0]
      ? `${proto}://${host}${(j as any).photos[0].filePath.startsWith('/') ? '' : '/'}${(j as any).photos[0].filePath}`
      : null;
    // strip photos array from list payload
    const { photos, _count, ...rest } = j as any;
    return { ...rest, thumbnailUrl: thumb, photoCount: _count?.photos ?? 0 };
  });
  res.json(data);
});

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
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

router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
  const id = String(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const data = parsed.data;

  try {
    const existing = await prisma.job.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Job not found' });
    const updated = await prisma.job.update({
      where: { id },
      data: {
        ...('title' in data ? { title: data.title! } : {}),
        ...('description' in data ? { description: data.description || null } : {}),
        ...('status' in data ? { status: data.status as any } : {}),
        ...('priority' in data ? { priority: data.priority as any } : {}),
        ...('quotedAmount' in data ? { quotedAmount: data.quotedAmount ?? null } : {}),
        ...('approvedAmount' in data ? { approvedAmount: data.approvedAmount ?? null } : {}),
        ...('diagnosis' in data ? { diagnosis: data.diagnosis || null } : {}),
        ...('dueDate' in data ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      },
    });
    if (data.status && data.status !== existing.status) {
      await prisma.jobStatusHistory.create({
        data: {
          jobId: id,
          status: data.status as any,
          notes: `Status updated from ${existing.status} to ${data.status}`,
        },
      });
      
      // Trigger workflow automation
      await onJobStatusChange(id, data.status, existing.status);
      
      // Schedule reminders for quotations
      if (data.status === 'QUOTED') {
        const DAY = 24 * 60 * 60 * 1000;
        await enqueueReminder(id, 'QUOTE_DAY_1', DAY);
        await enqueueReminder(id, 'QUOTE_DAY_20', 20 * DAY);
        await enqueueReminder(id, 'QUOTE_DAY_30', 30 * DAY);
      }
    }
    return res.json(updated);
  } catch (e) {
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

// Reissue QR token
router.post('/:id/qr/renew', requireAuth, requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
  const id = String(req.params.id);
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return res.status(404).json({ message: 'Job not found' });
  const qrToken = randomUUID();
  const qrExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const updated = await prisma.job.update({ where: { id }, data: { qrToken, qrExpiresAt } });
  const qrUrl = buildQrUrl(req, updated.qrToken);
  return res.json({ qr_url: qrUrl });
});

router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
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
  const host = req.get('host') || 'localhost:4000';
  const proto = req.headers['x-forwarded-proto']?.toString() || req.protocol || 'http';
  const rows = await prisma.jobPhoto.findMany({ where: { jobId: id }, orderBy: { createdAt: 'desc' } });
  const data = rows.map((p) => ({
    ...p,
    url: `${proto}://${host}${p.filePath.startsWith('/') ? '' : '/'}${p.filePath}`,
  }));
  return res.json(data);
});

router.post(
  '/:id/photos',
  requireAuth,
  requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'),
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
      saved.push({ ...rec, url: `${req.protocol}://${req.get('host')}${rel}` });
    }
    return res.status(201).json(saved);
  },
);

router.delete('/:id/photos/:photoId', requireAuth, requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
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
