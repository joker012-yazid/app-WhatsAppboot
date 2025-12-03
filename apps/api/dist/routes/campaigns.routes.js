"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const campaigns_service_1 = require("../services/campaigns.service");
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
const statusQuerySchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.CampaignStatus).optional(),
});
const paginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(10).max(100).default(25),
});
const idParamSchema = zod_1.z.object({ id: zod_1.z.string().min(1) });
const handleError = (res, error) => {
    if (error instanceof campaigns_service_1.ApiError) {
        return res.status(error.status).json({ message: error.message });
    }
    console.error('[campaign] unexpected error', error);
    return res.status(500).json({ message: 'Internal server error' });
};
router.use(auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER'));
router.get('/', async (req, res) => {
    const parsedStatus = statusQuerySchema.safeParse(req.query);
    if (!parsedStatus.success)
        return res.status(400).json({ message: 'Invalid status filter' });
    try {
        const campaigns = await (0, campaigns_service_1.listCampaigns)(parsedStatus.data.status);
        return res.json(campaigns);
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.post('/preview', async (req, res) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid preview payload' });
    try {
        const { filters, limit } = parsed.data;
        const preview = await (0, campaigns_service_1.previewCampaign)(filters || {}, limit || 50);
        return res.json({
            totalCustomers: preview.total,
            sample: preview.targets,
            manualTargets: preview.manualTargets,
            manualCount: preview.manualCount,
        });
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.get('/presets', async (_req, res) => {
    try {
        const presets = await (0, campaigns_service_1.listCampaignPresets)();
        return res.json(presets);
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.post('/presets', async (req, res) => {
    const parsed = presetSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid preset payload' });
    try {
        const preset = await (0, campaigns_service_1.createCampaignPreset)({
            name: parsed.data.name,
            description: parsed.data.description,
            filters: parsed.data.filters || {},
            createdById: req.user?.sub,
        });
        return res.status(201).json(preset);
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.delete('/presets/:id', async (req, res) => {
    const parsed = idParamSchema.safeParse({ id: req.params.id });
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid preset id' });
    try {
        await (0, campaigns_service_1.deleteCampaignPreset)(parsed.data.id);
        return res.status(204).send();
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    try {
        const campaign = await (0, campaigns_service_1.createCampaign)({ ...parsed.data }, req.user?.sub);
        return res.status(201).json(campaign);
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.put('/:id', async (req, res) => {
    const parsedId = idParamSchema.safeParse({ id: req.params.id });
    if (!parsedId.success)
        return res.status(400).json({ message: 'Invalid campaign id' });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    try {
        const updated = await (0, campaigns_service_1.updateCampaign)(parsedId.data.id, parsed.data);
        return res.json(updated);
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.get('/:id', async (req, res) => {
    const parsedId = idParamSchema.safeParse({ id: req.params.id });
    if (!parsedId.success)
        return res.status(400).json({ message: 'Invalid campaign id' });
    try {
        const details = await (0, campaigns_service_1.getCampaignDetails)(parsedId.data.id);
        return res.json(details);
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.get('/:id/recipients', async (req, res) => {
    const parsedId = idParamSchema.safeParse({ id: req.params.id });
    if (!parsedId.success)
        return res.status(400).json({ message: 'Invalid campaign id' });
    const pagination = paginationSchema.safeParse({ page: req.query.page, pageSize: req.query.pageSize });
    if (!pagination.success)
        return res.status(400).json({ message: 'Invalid pagination' });
    try {
        const { items, total } = await (0, campaigns_service_1.listCampaignRecipients)(parsedId.data.id, pagination.data.page, pagination.data.pageSize);
        return res.json({ items, total, page: pagination.data.page, pageSize: pagination.data.pageSize });
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.post('/:id/start', async (req, res) => {
    const parsedId = idParamSchema.safeParse({ id: req.params.id });
    if (!parsedId.success)
        return res.status(400).json({ message: 'Invalid campaign id' });
    try {
        const result = await (0, campaigns_service_1.startCampaign)(parsedId.data.id);
        return res.json(result);
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.post('/:id/pause', async (req, res) => {
    const parsedId = idParamSchema.safeParse({ id: req.params.id });
    if (!parsedId.success)
        return res.status(400).json({ message: 'Invalid campaign id' });
    try {
        const result = await (0, campaigns_service_1.pauseCampaign)(parsedId.data.id);
        return res.json(result);
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.post('/:id/resume', async (req, res) => {
    const parsedId = idParamSchema.safeParse({ id: req.params.id });
    if (!parsedId.success)
        return res.status(400).json({ message: 'Invalid campaign id' });
    try {
        const result = await (0, campaigns_service_1.resumeCampaign)(parsedId.data.id);
        return res.json(result);
    }
    catch (error) {
        return handleError(res, error);
    }
});
router.post('/:id/cancel', async (req, res) => {
    const parsedId = idParamSchema.safeParse({ id: req.params.id });
    if (!parsedId.success)
        return res.status(400).json({ message: 'Invalid campaign id' });
    try {
        const result = await (0, campaigns_service_1.cancelCampaign)(parsedId.data.id);
        return res.json(result);
    }
    catch (error) {
        return handleError(res, error);
    }
});
// TODO(api-naming): consider PATCH /campaigns/:id with { status } for start/pause/resume/cancel to remove verb routes.
exports.default = router;
