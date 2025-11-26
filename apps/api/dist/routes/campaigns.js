"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const campaigns_1 = require("../services/campaigns");
const queues_1 = require("../queues");
const router = (0, express_1.Router)();
const filtersSchema = zod_1.z
    .object({
    customerTypes: zod_1.z.array(zod_1.z.nativeEnum(client_1.CustomerType)).optional(),
    tags: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    excludeTags: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    lastVisitDays: zod_1.z.number().int().positive().optional(),
    inactiveDays: zod_1.z.number().int().positive().optional(),
    search: zod_1.z.string().optional(),
    manualPhones: zod_1.z.array(zod_1.z.string().min(4)).optional(),
})
    .optional();
const businessHoursSchema = zod_1.z
    .object({
    start: zod_1.z.number().int().min(0).max(1439).optional(),
    end: zod_1.z.number().int().min(0).max(1439).optional(),
})
    .optional();
const delaySchema = zod_1.z
    .object({
    min: zod_1.z.number().int().min(1).max(600).optional(),
    max: zod_1.z.number().int().min(1).max(900).optional(),
})
    .optional();
const createSchema = zod_1.z.object({
    name: zod_1.z.string().min(3),
    kind: zod_1.z.nativeEnum(client_1.CampaignKind).default('PROMOTIONAL'),
    message: zod_1.z.string().min(5),
    mediaUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    filters: filtersSchema,
    scheduledFor: zod_1.z.string().datetime().optional(),
    businessHours: businessHoursSchema,
    dailyLimit: zod_1.z.number().int().min(1).max(500).optional(),
    randomDelay: delaySchema,
});
const updateSchema = createSchema.partial();
const previewSchema = zod_1.z.object({
    filters: filtersSchema,
    limit: zod_1.z.number().int().min(5).max(100).optional(),
});
const presetSchema = zod_1.z.object({
    name: zod_1.z.string().min(3),
    description: zod_1.z.string().optional(),
    filters: filtersSchema,
});
const parseFiltersFromCampaign = (campaign) => {
    if (!campaign.filters)
        return {};
    return (0, campaigns_1.normalizeFilters)(campaign.filters);
};
const editableStatuses = ['DRAFT', 'PAUSED', 'SCHEDULED'];
router.use(auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER'));
router.get('/', async (req, res) => {
    const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
    const statusFilter = statusParam && client_1.CampaignStatus[statusParam] ? statusParam : undefined;
    const campaigns = await prisma_1.default.campaign.findMany({
        where: statusFilter ? { status: statusFilter } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    return res.json(campaigns);
});
router.post('/preview', async (req, res) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid preview payload' });
    const { filters, limit } = parsed.data;
    const preview = await (0, campaigns_1.previewRecipients)(filters || {}, limit || 50);
    return res.json({
        totalCustomers: preview.total,
        sample: preview.targets,
        manualTargets: preview.manualTargets,
        manualCount: preview.manualCount,
    });
});
router.get('/presets', async (_req, res) => {
    const presets = await prisma_1.default.campaignPreset.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json(presets);
});
router.post('/presets', async (req, res) => {
    const parsed = presetSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid preset payload' });
    const filtersPayload = parsed.data.filters || {};
    const preset = await prisma_1.default.campaignPreset.create({
        data: {
            name: parsed.data.name,
            description: parsed.data.description || null,
            filters: (0, campaigns_1.persistCampaignFilters)(filtersPayload) || {},
            createdById: req.user?.sub,
        },
    });
    return res.status(201).json(preset);
});
router.delete('/presets/:id', async (req, res) => {
    const id = String(req.params.id);
    await prisma_1.default.campaignPreset.delete({ where: { id } }).catch(() => null);
    return res.status(204).send();
});
router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const payload = parsed.data;
    const { start, end } = (0, campaigns_1.businessHoursFromPayload)(payload.businessHours || undefined);
    const { min, max } = (0, campaigns_1.randomDelayFromPayload)(payload.randomDelay || undefined);
    const filtersJson = payload.filters ? (0, campaigns_1.persistCampaignFilters)(payload.filters) : undefined;
    const variables = (0, campaigns_1.extractTemplateVariables)(payload.message);
    const campaign = await prisma_1.default.campaign.create({
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
});
router.put('/:id', async (req, res) => {
    const id = String(req.params.id);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const existing = await prisma_1.default.campaign.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ message: 'Campaign not found' });
    if (!editableStatuses.includes(existing.status)) {
        return res.status(409).json({ message: `Campaign cannot be edited while ${existing.status.toLowerCase()}` });
    }
    const payload = parsed.data;
    const updateData = {};
    if (payload.name)
        updateData.name = payload.name;
    if (payload.kind)
        updateData.kind = payload.kind;
    if (payload.message) {
        updateData.message = payload.message;
        updateData.variables = (0, campaigns_1.extractTemplateVariables)(payload.message);
    }
    if (typeof payload.mediaUrl !== 'undefined')
        updateData.mediaUrl = payload.mediaUrl || null;
    if (payload.filters)
        updateData.filters = (0, campaigns_1.persistCampaignFilters)(payload.filters);
    if (payload.businessHours) {
        const hours = (0, campaigns_1.businessHoursFromPayload)(payload.businessHours);
        updateData.businessHoursStart = hours.start;
        updateData.businessHoursEnd = hours.end;
    }
    if (payload.randomDelay) {
        const delay = (0, campaigns_1.randomDelayFromPayload)(payload.randomDelay);
        updateData.randomDelayMin = delay.min;
        updateData.randomDelayMax = delay.max;
    }
    if (typeof payload.dailyLimit !== 'undefined')
        updateData.dailyLimit = payload.dailyLimit;
    if (typeof payload.scheduledFor !== 'undefined') {
        updateData.scheduledFor = payload.scheduledFor ? new Date(payload.scheduledFor) : null;
        if (payload.scheduledFor && existing.status === 'DRAFT') {
            updateData.status = 'SCHEDULED';
        }
    }
    const updated = await prisma_1.default.campaign.update({ where: { id }, data: updateData });
    return res.json(updated);
});
router.get('/:id', async (req, res) => {
    const id = String(req.params.id);
    const campaign = await prisma_1.default.campaign.findUnique({
        where: { id },
        include: { events: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!campaign)
        return res.status(404).json({ message: 'Campaign not found' });
    const counts = await prisma_1.default.campaignRecipient.groupBy({
        by: ['status'],
        where: { campaignId: id },
        _count: { _all: true },
    });
    const stats = counts.reduce((acc, row) => {
        acc[row.status] = row._count._all;
        return acc;
    }, {});
    const recentRecipients = await prisma_1.default.campaignRecipient.findMany({
        where: { campaignId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
    });
    return res.json({ campaign, stats, recentRecipients });
});
router.get('/:id/recipients', async (req, res) => {
    const id = String(req.params.id);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 25));
    const [items, total] = await Promise.all([
        prisma_1.default.campaignRecipient.findMany({
            where: { campaignId: id },
            orderBy: { createdAt: 'asc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma_1.default.campaignRecipient.count({ where: { campaignId: id } }),
    ]);
    return res.json({ items, total, page, pageSize });
});
router.post('/:id/start', async (req, res) => {
    const id = String(req.params.id);
    const campaign = await prisma_1.default.campaign.findUnique({ where: { id } });
    if (!campaign)
        return res.status(404).json({ message: 'Campaign not found' });
    if (!editableStatuses.includes(campaign.status) && campaign.status !== 'RUNNING') {
        return res.status(409).json({ message: `Campaign is ${campaign.status.toLowerCase()} and cannot be started` });
    }
    const filters = parseFiltersFromCampaign(campaign);
    const { rows, total } = await (0, campaigns_1.buildRecipientsForCampaign)(id, filters);
    if (!total)
        return res.status(400).json({ message: 'No recipients match the selected filters' });
    await prisma_1.default.$transaction([
        prisma_1.default.campaignRecipient.deleteMany({ where: { campaignId: id } }),
        prisma_1.default.campaignRecipient.createMany({ data: rows }),
        prisma_1.default.campaign.update({
            where: { id },
            data: {
                status: 'RUNNING',
                startedAt: new Date(),
                targetCount: total,
                sentCount: 0,
                failedCount: 0,
            },
        }),
        prisma_1.default.campaignEvent.create({ data: { campaignId: id, type: 'campaign.started', details: { targetCount: total } } }),
    ]);
    await (0, queues_1.enqueueCampaignRecipients)(id);
    return res.json({ message: 'Campaign started', targetCount: total });
});
router.post('/:id/pause', async (req, res) => {
    const id = String(req.params.id);
    const campaign = await prisma_1.default.campaign.findUnique({ where: { id } });
    if (!campaign)
        return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status !== 'RUNNING') {
        return res.status(409).json({ message: 'Only running campaigns can be paused' });
    }
    await prisma_1.default.$transaction([
        prisma_1.default.campaign.update({ where: { id }, data: { status: 'PAUSED' } }),
        prisma_1.default.campaignEvent.create({ data: { campaignId: id, type: 'campaign.paused' } }),
    ]);
    return res.json({ message: 'Campaign paused' });
});
router.post('/:id/resume', async (req, res) => {
    const id = String(req.params.id);
    const campaign = await prisma_1.default.campaign.findUnique({ where: { id } });
    if (!campaign)
        return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status !== 'PAUSED') {
        return res.status(409).json({ message: 'Only paused campaigns can be resumed' });
    }
    await prisma_1.default.$transaction([
        prisma_1.default.campaign.update({ where: { id }, data: { status: 'RUNNING' } }),
        prisma_1.default.campaignEvent.create({ data: { campaignId: id, type: 'campaign.resumed' } }),
    ]);
    await (0, queues_1.enqueueCampaignRecipients)(id);
    return res.json({ message: 'Campaign resumed' });
});
router.post('/:id/cancel', async (req, res) => {
    const id = String(req.params.id);
    const campaign = await prisma_1.default.campaign.findUnique({ where: { id } });
    if (!campaign)
        return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status === 'CANCELLED' || campaign.status === 'COMPLETED') {
        return res.status(409).json({ message: `Campaign already ${campaign.status.toLowerCase()}` });
    }
    await prisma_1.default.$transaction([
        prisma_1.default.campaign.update({ where: { id }, data: { status: 'CANCELLED', completedAt: new Date() } }),
        prisma_1.default.campaignRecipient.updateMany({
            where: { campaignId: id, status: { in: ['PENDING', 'SCHEDULED'] } },
            data: { status: client_1.CampaignRecipientStatus.CANCELLED },
        }),
        prisma_1.default.campaignEvent.create({ data: { campaignId: id, type: 'campaign.cancelled' } }),
    ]);
    return res.json({ message: 'Campaign cancelled' });
});
exports.default = router;
