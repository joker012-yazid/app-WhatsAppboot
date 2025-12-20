import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  customerId: z.string().uuid(),
  deviceType: z.string().min(1),
  brand: z.string().optional().or(z.literal('')),
  model: z.string().optional().or(z.literal('')),
  serialNumber: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

const updateSchema = createSchema.partial();

// GET /api/devices?customerId=...
router.get('/', requireAuth, async (req, res) => {
  const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
  const where: Prisma.DeviceWhereInput | undefined = customerId ? { customerId } : undefined;
  const devices = await prisma.device.findMany({
    where,
    include: { customer: true, _count: { select: { jobs: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(devices);
});

// GET /api/devices/:id
router.get('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    const device = await prisma.device.findUnique({
      where: { id },
      include: { customer: true, jobs: { include: { customer: true } }, },
    });
    if (!device) return res.status(404).json({ message: 'Device not found' });
    return res.json(device);
  } catch (e) {
    return res.status(404).json({ message: 'Device not found' });
  }
});

// POST /api/devices
router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const data = parsed.data;

  // ensure customer exists
  const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const created = await prisma.device.create({
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
router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res) => {
  const id = String(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  try {
    const updated = await prisma.device.update({
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
  } catch (e) {
    res.status(404).json({ message: 'Device not found' });
  }
});

// DELETE /api/devices/:id
router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const id = String(req.params.id);
  try {
    const jobCount = await prisma.job.count({ where: { deviceId: id } });
    if (jobCount > 0) {
      return res.status(409).json({ message: `Cannot delete device with ${jobCount} linked job(s)` });
    }
    await prisma.device.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    res.status(404).json({ message: 'Device not found' });
  }
});

export default router;
