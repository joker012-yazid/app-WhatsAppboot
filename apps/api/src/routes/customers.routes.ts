import { Router } from 'express';
import { z } from 'zod';
import { Prisma, CustomerType } from '@prisma/client';
import crypto from 'node:crypto';

import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const normalizeTags = (tags?: string[]) =>
  (tags || [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/\s+/g, ' ').toUpperCase());

// Device schema
const deviceSchema = z.object({
  deviceType: z.string().min(1, 'Jenis device diperlukan'),
  deviceBrand: z.string().min(1, 'Jenama device diperlukan'),
  deviceModel: z.string().optional().or(z.literal('')),
  serialNumber: z.string().optional().or(z.literal('')),
  issueDescription: z.string().min(10, 'Penerangan masalah diperlukan'),
});

// Public registration schema (with devices array)
const publicRegisterSchema = z.object({
  // Customer data
  name: z.string().min(2, 'Nama mesti sekurang-kurangnya 2 huruf'),
  phone: z.string().min(10, 'Nombor telefon tidak sah').max(15),
  email: z.string().email().optional().or(z.literal('')),
  // Devices array (at least 1 device required)
  devices: z.array(deviceSchema).min(1, 'Sekurang-kurangnya satu device diperlukan'),
});

// PUBLIC ENDPOINT - Customer self-registration with device (no auth required)
router.post('/register', async (req, res) => {
  try {
    const parsed = publicRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return res.status(400).json({ 
        message: 'Invalid payload',
        error: firstError?.message || 'Sila semak maklumat yang dimasukkan'
      });
    }

    const { name, phone, email, devices } = parsed.data;

    // Clean phone number - remove all non-digits for consistent storage
    const cleanPhone = phone.replace(/\D/g, '');

    // Check if customer already exists
    let customer = await prisma.customer.findUnique({ 
      where: { phone: cleanPhone } 
    }).catch(() => null);

    const isExistingCustomer = !!customer;

    if (!customer) {
      // Create new customer
      customer = await prisma.customer.create({
        data: {
          name,
          phone: cleanPhone,
          email: email || null,
          notes: null,
          type: 'REGULAR',
          tags: ['WALK-IN', 'QR-REGISTERED'],
        },
      });
    } else {
      // Update customer name if different
      if (customer.name !== name) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { name }
        });
      }
    }

    // Create devices and jobs for each device
    const createdDevices = [];
    const createdJobs = [];

    for (const deviceData of devices) {
      // Create device for customer
      const device = await prisma.device.create({
        data: {
          customerId: customer.id,
          deviceType: deviceData.deviceType,
          brand: deviceData.deviceBrand,
          model: deviceData.deviceModel || null,
          serialNumber: deviceData.serialNumber || null,
          notes: deviceData.issueDescription,
        },
      });

      // Create a job/ticket for the service request
      const job = await prisma.job.create({
        data: {
          customerId: customer.id,
          deviceId: device.id,
          title: `${deviceData.deviceType} ${deviceData.deviceBrand}${deviceData.deviceModel ? ' ' + deviceData.deviceModel : ''} - ${name}`,
          description: deviceData.issueDescription,
          status: 'PENDING',
          priority: 'NORMAL',
          qrToken: crypto.randomUUID(),
          qrExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 days
        },
      });

      createdDevices.push(device);
      createdJobs.push(job);
    }

    return res.status(201).json({ 
      success: true,
      message: `Pendaftaran berjaya! ${devices.length} device${devices.length > 1 ? 's' : ''} telah didaftarkan.`,
      customerId: customer.id,
      deviceIds: createdDevices.map(d => d.id),
      jobIds: createdJobs.map(j => j.id),
      isExistingCustomer
    });
  } catch (error) {
    console.error('Customer registration error:', error);
    return res.status(500).json({ 
      message: 'Pendaftaran gagal',
      error: 'Ralat server. Sila cuba lagi.'
    });
  }
});

// Schemas
const tagsSchema = z.array(z.string().min(1)).optional();
const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  type: z.nativeEnum(CustomerType).optional(),
  tags: tagsSchema,
});

const updateSchema = createSchema.partial();

// GET /api/customers?search=...
router.get('/', requireAuth, async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const where: Prisma.CustomerWhereInput | undefined = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { phone: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { email: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
        ],
      }
    : undefined;
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { devices: true, jobs: true } } },
  });
  return res.json(customers);
});

// POST /api/customers
router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const { name, phone, email, notes, type, tags } = parsed.data;
  // enforce unique phone
  const exists = await prisma.customer.findUnique({ where: { phone } }).catch(() => null);
  if (exists) return res.status(409).json({ message: 'Customer with this phone already exists' });

  const created = await prisma.customer.create({
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
router.get('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      devices: { orderBy: { createdAt: 'desc' } },
      jobs: { include: { device: true }, orderBy: { createdAt: 'desc' } },
      _count: { select: { devices: true, jobs: true } },
    },
  });
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  return res.json(customer);
});

// PUT /api/customers/:id
router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const id = String(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  try {
    const updateData: Prisma.CustomerUpdateInput = {
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
    const updated = await prisma.customer.update({
      where: { id },
      data: updateData,
    });
    return res.json(updated);
  } catch (e) {
    return res.status(404).json({ message: 'Customer not found' });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const id = String(req.params.id);
  try {
    const [deviceCount, jobCount] = await Promise.all([
      prisma.device.count({ where: { customerId: id } }),
      prisma.job.count({ where: { customerId: id } }),
    ]);
    if (deviceCount > 0 || jobCount > 0) {
      return res
        .status(409)
        .json({ message: `Cannot delete customer with ${deviceCount} device(s) and ${jobCount} job(s)` });
    }
    await prisma.customer.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    return res.status(404).json({ message: 'Customer not found' });
  }
});

export default router;
