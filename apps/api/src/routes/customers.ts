import { Router } from 'express';
import { z } from 'zod';
import { Prisma, CustomerType } from '@prisma/client';

import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const normalizeTags = (tags?: string[]) =>
  (tags || [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/\s+/g, ' ').toUpperCase());

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
