import { Router } from 'express';
import { z } from 'zod';
import {
  CampaignKind,
  CampaignRecipientStatus,
  CampaignStatus,
  CustomerType,
  Prisma,
} from '@prisma/client';

import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  businessHoursFromPayload,
  buildRecipientsForCampaign,
  CampaignFilters,
  extractTemplateVariables,
  normalizeFilters,
  previewRecipients,
  randomDelayFromPayload,
  persistCampaignFilters,
} from '../services/campaigns';
import { enqueueCampaignRecipients } from '../queues';

const router = Router();

const filtersSchema = z
  .object({
    customerTypes: z.array(z.nativeEnum(CustomerType)).optional(),
    tags: z.array(z.string().min(1)).optional(),
    excludeTags: z.array(z.string().min(1)).optional(),
    lastVisitDays: z.number().int().positive().optional(),
    inactiveDays: z.number().int().positive().optional(),
    search: z.string().optional(),
    manualPhones: z.array(z.string().min(4)).optional(),
  })
  .optional();

const businessHoursSchema = z
  .object({
    start: z.number().int().min(0).max(1439).optional(),
    end: z.number().int().min(0).max(1439).optional(),
  })
  .optional();

const delaySchema = z
  .object({
    min: z.number().int().min(1).max(600).optional(),
    max: z.number().int().min(1).max(900).optional(),
  })
  .optional();

const createSchema = z.object({
  name: z.string().min(3),
  kind: z.nativeEnum(CampaignKind).default('PROMOTIONAL'),
  message: z.string().min(5),
  mediaUrl: z.string().url().optional().or(z.literal('')),
  filters: filtersSchema,
  scheduledFor: z.string().datetime().optional(),
  businessHours: businessHoursSchema,
  dailyLimit: z.number().int().min(1).max(500).optional(),
  randomDelay: delaySchema,
});

const updateSchema = createSchema.partial();

const previewSchema = z.object({
  filters: filtersSchema,
  limit: z.number().int().min(5).max(100).optional(),
});

const presetSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  filters: filtersSchema,
});

const parseFiltersFromCampaign = (campaign: { filters: Prisma.JsonValue | null }): CampaignFilters => {
  if (!campaign.filters) return {};
  return normalizeFilters(campaign.filters as CampaignFilters);
};

const editableStatuses: CampaignStatus[] = ['DRAFT', 'PAUSED', 'SCHEDULED'];

router.use(requireAuth, requireRole('ADMIN', 'MANAGER'));

const listCampaigns = async (req: import('express').Request, res: import('express').Response) => {
  const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
  const statusFilter = statusParam && (CampaignStatus as any)[statusParam] ? (statusParam as CampaignStatus) : undefined;
  const campaigns = await prisma.campaign.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return res.json(campaigns);
};

const previewCampaignRecipients = async (req: import('express').Request, res: import('express').Response) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid preview payload' });
  const { filters, limit } = parsed.data;
  const preview = await previewRecipients(filters || {}, limit || 50);
  return res.json({
    totalCustomers: preview.total,
    sample: preview.targets,
    manualTargets: preview.manualTargets,
    manualCount: preview.manualCount,
  });
};

const listCampaignPresets = async (_req: import('express').Request, res: import('express').Response) => {
  const presets = await prisma.campaignPreset.findMany({ orderBy: { createdAt: 'desc' } });
  return res.json(presets);
};

const createCampaignPreset = async (req: import('express').Request, res: import('express').Response) => {
  const parsed = presetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid preset payload' });
  const filtersPayload = parsed.data.filters || {};
  const preset = await prisma.campaignPreset.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      filters: persistCampaignFilters(filtersPayload) || {},
      createdById: req.user?.sub,
    },
  });
  return res.status(201).json(preset);
};

const deleteCampaignPreset = async (req: import('express').Request, res: import('express').Response) => {
  const id = String(req.params.id);
  await prisma.campaignPreset.delete({ where: { id } }).catch(() => null);
  return res.status(204).send();
};

const createCampaign = async (req: import('express').Request, res: import('express').Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const payload = parsed.data;
  const { start, end } = businessHoursFromPayload(payload.businessHours || undefined);
  const { min, max } = randomDelayFromPayload(payload.randomDelay || undefined);
  const filtersJson = payload.filters ? persistCampaignFilters(payload.filters) : undefined;
  const variables = extractTemplateVariables(payload.message);
  const campaign = await prisma.campaign.create({
    data: {
      name: payload.name,
      kind: payload.kind,
      message: payload.message,
      mediaUrl: payload.mediaUrl || null,
      filters: filtersJson,
      scheduledFor: payload.scheduledFor ? new Date(payload.scheduledFor) : null,
      businessHoursStart: start,
      businessHoursEnd: end,
      dailyLimit: payload.dailyLimit ?? 150,
      randomDelayMin: min,
      randomDelayMax: max,
      variables,
      createdById: req.user?.sub,
      status: payload.scheduledFor ? 'SCHEDULED' : 'DRAFT',
    },
  });
  return res.status(201).json(campaign);
};

const updateCampaign = async (req: import('express').Request, res: import('express').Response) => {
  const id = String(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Campaign not found' });
  if (!editableStatuses.includes(existing.status)) {
    return res.status(409).json({ message: `Campaign cannot be edited while ${existing.status.toLowerCase()}` });
  }
  const payload = parsed.data;
  const updateData: Prisma.CampaignUpdateInput = {};
  if (payload.name) updateData.name = payload.name;
  if (payload.kind) updateData.kind = payload.kind;
  if (payload.message) {
    updateData.message = payload.message;
    updateData.variables = extractTemplateVariables(payload.message);
  }
  if (typeof payload.mediaUrl !== 'undefined') updateData.mediaUrl = payload.mediaUrl || null;
  if (payload.filters) updateData.filters = persistCampaignFilters(payload.filters);
  if (payload.businessHours) {
    const hours = businessHoursFromPayload(payload.businessHours);
    updateData.businessHoursStart = hours.start;
    updateData.businessHoursEnd = hours.end;
  }
  if (payload.randomDelay) {
    const delay = randomDelayFromPayload(payload.randomDelay);
    updateData.randomDelayMin = delay.min;
    updateData.randomDelayMax = delay.max;
  }
  if (typeof payload.dailyLimit !== 'undefined') updateData.dailyLimit = payload.dailyLimit;
  if (typeof payload.scheduledFor !== 'undefined') {
    updateData.scheduledFor = payload.scheduledFor ? new Date(payload.scheduledFor) : null;
    if (payload.scheduledFor && existing.status === 'DRAFT') {
      updateData.status = 'SCHEDULED';
    }
  }
  const updated = await prisma.campaign.update({ where: { id }, data: updateData });
  return res.json(updated);
};

const getCampaignDetails = async (req: import('express').Request, res: import('express').Response) => {
  const id = String(req.params.id);
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  const counts = await prisma.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId: id },
    _count: { _all: true },
  });
  const stats = counts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});
  const recentRecipients = await prisma.campaignRecipient.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  return res.json({ campaign, stats, recentRecipients });
};

const listCampaignRecipients = async (req: import('express').Request, res: import('express').Response) => {
  const id = String(req.params.id);
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 25));
  const [items, total] = await Promise.all([
    prisma.campaignRecipient.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.campaignRecipient.count({ where: { campaignId: id } }),
  ]);
  return res.json({ items, total, page, pageSize });
};

const startCampaign = async (req: import('express').Request, res: import('express').Response) => {
  const id = String(req.params.id);
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (!editableStatuses.includes(campaign.status) && campaign.status !== 'RUNNING') {
    return res.status(409).json({ message: `Campaign is ${campaign.status.toLowerCase()} and cannot be started` });
  }
  const filters = parseFiltersFromCampaign(campaign);
  const { rows, total } = await buildRecipientsForCampaign(id, filters);
  if (!total) return res.status(400).json({ message: 'No recipients match the selected filters' });

  await prisma.$transaction([
    prisma.campaignRecipient.deleteMany({ where: { campaignId: id } }),
    prisma.campaignRecipient.createMany({ data: rows }),
    prisma.campaign.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        targetCount: total,
        sentCount: 0,
        failedCount: 0,
      },
    }),
    prisma.campaignEvent.create({ data: { campaignId: id, type: 'campaign.started', details: { targetCount: total } } }),
  ]);

  await enqueueCampaignRecipients(id);
  return res.json({ message: 'Campaign started', targetCount: total });
};

const pauseCampaign = async (req: import('express').Request, res: import('express').Response) => {
  const id = String(req.params.id);
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (campaign.status !== 'RUNNING') {
    return res.status(409).json({ message: 'Only running campaigns can be paused' });
  }
  await prisma.$transaction([
    prisma.campaign.update({ where: { id }, data: { status: 'PAUSED' } }),
    prisma.campaignEvent.create({ data: { campaignId: id, type: 'campaign.paused' } }),
  ]);
  return res.json({ message: 'Campaign paused' });
};

const resumeCampaign = async (req: import('express').Request, res: import('express').Response) => {
  const id = String(req.params.id);
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (campaign.status !== 'PAUSED') {
    return res.status(409).json({ message: 'Only paused campaigns can be resumed' });
  }
  await prisma.$transaction([
    prisma.campaign.update({ where: { id }, data: { status: 'RUNNING' } }),
    prisma.campaignEvent.create({ data: { campaignId: id, type: 'campaign.resumed' } }),
  ]);
  await enqueueCampaignRecipients(id);
  return res.json({ message: 'Campaign resumed' });
};

const cancelCampaign = async (req: import('express').Request, res: import('express').Response) => {
  const id = String(req.params.id);
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (campaign.status === 'CANCELLED' || campaign.status === 'COMPLETED') {
    return res.status(409).json({ message: `Campaign already ${campaign.status.toLowerCase()}` });
  }
  await prisma.$transaction([
    prisma.campaign.update({ where: { id }, data: { status: 'CANCELLED', completedAt: new Date() } }),
    prisma.campaignRecipient.updateMany({
      where: { campaignId: id, status: { in: ['PENDING', 'SCHEDULED'] } },
      data: { status: CampaignRecipientStatus.CANCELLED },
    }),
    prisma.campaignEvent.create({ data: { campaignId: id, type: 'campaign.cancelled' } }),
  ]);
  return res.json({ message: 'Campaign cancelled' });
};

// TODO(api-naming): consider PATCH /campaigns/:id with { status } for start/pause/resume/cancel to remove verb routes.

router.get('/', listCampaigns);
router.post('/preview', previewCampaignRecipients);
router.get('/presets', listCampaignPresets);
router.post('/presets', createCampaignPreset);
router.delete('/presets/:id', deleteCampaignPreset);
router.post('/', createCampaign);
router.put('/:id', updateCampaign);
router.get('/:id', getCampaignDetails);
router.get('/:id/recipients', listCampaignRecipients);
router.post('/:id/start', startCampaign);
router.post('/:id/pause', pauseCampaign);
router.post('/:id/resume', resumeCampaign);
router.post('/:id/cancel', cancelCampaign);

export default router;
