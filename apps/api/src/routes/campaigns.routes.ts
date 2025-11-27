import { Router } from 'express';
import { z } from 'zod';
import { CampaignKind, CampaignStatus, CustomerType } from '@prisma/client';

import { requireAuth, requireRole } from '../middleware/auth';
import {
  ApiError,
  cancelCampaign,
  createCampaign,
  createCampaignPreset,
  getCampaignDetails,
  listCampaignPresets,
  listCampaignRecipients,
  listCampaigns,
  pauseCampaign,
  previewCampaign,
  resumeCampaign,
  startCampaign,
  updateCampaign,
  deleteCampaignPreset,
} from '../services/campaigns.service';

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

const statusQuerySchema = z.object({
  status: z.nativeEnum(CampaignStatus).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const idParamSchema = z.object({ id: z.string().min(1) });

const handleError = (res: import('express').Response, error: unknown) => {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ message: error.message });
  }
  console.error('[campaign] unexpected error', error);
  return res.status(500).json({ message: 'Internal server error' });
};

router.use(requireAuth, requireRole('ADMIN', 'MANAGER'));

router.get('/', async (req, res) => {
  const parsedStatus = statusQuerySchema.safeParse(req.query);
  if (!parsedStatus.success) return res.status(400).json({ message: 'Invalid status filter' });
  try {
    const campaigns = await listCampaigns(parsedStatus.data.status);
    return res.json(campaigns);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/preview', async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid preview payload' });
  try {
    const { filters, limit } = parsed.data;
    const preview = await previewCampaign(filters || {}, limit || 50);
    return res.json({
      totalCustomers: preview.total,
      sample: preview.targets,
      manualTargets: preview.manualTargets,
      manualCount: preview.manualCount,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/presets', async (_req, res) => {
  try {
    const presets = await listCampaignPresets();
    return res.json(presets);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/presets', async (req, res) => {
  const parsed = presetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid preset payload' });
  try {
    const preset = await createCampaignPreset({
      name: parsed.data.name,
      description: parsed.data.description,
      filters: parsed.data.filters || {},
      createdById: req.user?.sub,
    });
    return res.status(201).json(preset);
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/presets/:id', async (req, res) => {
  const parsed = idParamSchema.safeParse({ id: req.params.id });
  if (!parsed.success) return res.status(400).json({ message: 'Invalid preset id' });
  try {
    await deleteCampaignPreset(parsed.data.id);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  try {
    const campaign = await createCampaign({ ...parsed.data }, req.user?.sub);
    return res.status(201).json(campaign);
  } catch (error) {
    return handleError(res, error);
  }
});

router.put('/:id', async (req, res) => {
  const parsedId = idParamSchema.safeParse({ id: req.params.id });
  if (!parsedId.success) return res.status(400).json({ message: 'Invalid campaign id' });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  try {
    const updated = await updateCampaign(parsedId.data.id, parsed.data);
    return res.json(updated);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  const parsedId = idParamSchema.safeParse({ id: req.params.id });
  if (!parsedId.success) return res.status(400).json({ message: 'Invalid campaign id' });
  try {
    const details = await getCampaignDetails(parsedId.data.id);
    return res.json(details);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id/recipients', async (req, res) => {
  const parsedId = idParamSchema.safeParse({ id: req.params.id });
  if (!parsedId.success) return res.status(400).json({ message: 'Invalid campaign id' });
  const pagination = paginationSchema.safeParse({ page: req.query.page, pageSize: req.query.pageSize });
  if (!pagination.success) return res.status(400).json({ message: 'Invalid pagination' });
  try {
    const { items, total } = await listCampaignRecipients(parsedId.data.id, pagination.data.page, pagination.data.pageSize);
    return res.json({ items, total, page: pagination.data.page, pageSize: pagination.data.pageSize });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/start', async (req, res) => {
  const parsedId = idParamSchema.safeParse({ id: req.params.id });
  if (!parsedId.success) return res.status(400).json({ message: 'Invalid campaign id' });
  try {
    const result = await startCampaign(parsedId.data.id);
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/pause', async (req, res) => {
  const parsedId = idParamSchema.safeParse({ id: req.params.id });
  if (!parsedId.success) return res.status(400).json({ message: 'Invalid campaign id' });
  try {
    const result = await pauseCampaign(parsedId.data.id);
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/resume', async (req, res) => {
  const parsedId = idParamSchema.safeParse({ id: req.params.id });
  if (!parsedId.success) return res.status(400).json({ message: 'Invalid campaign id' });
  try {
    const result = await resumeCampaign(parsedId.data.id);
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/cancel', async (req, res) => {
  const parsedId = idParamSchema.safeParse({ id: req.params.id });
  if (!parsedId.success) return res.status(400).json({ message: 'Invalid campaign id' });
  try {
    const result = await cancelCampaign(parsedId.data.id);
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
});

// TODO(api-naming): consider PATCH /campaigns/:id with { status } for start/pause/resume/cancel to remove verb routes.

export default router;
