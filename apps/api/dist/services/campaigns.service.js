"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFiltersFromCampaign = exports.ApiError = void 0;
exports.listCampaigns = listCampaigns;
exports.createCampaign = createCampaign;
exports.updateCampaign = updateCampaign;
exports.getCampaignDetails = getCampaignDetails;
exports.listCampaignRecipients = listCampaignRecipients;
exports.startCampaign = startCampaign;
exports.pauseCampaign = pauseCampaign;
exports.resumeCampaign = resumeCampaign;
exports.cancelCampaign = cancelCampaign;
exports.previewCampaign = previewCampaign;
exports.createCampaignPreset = createCampaignPreset;
exports.deleteCampaignPreset = deleteCampaignPreset;
exports.listCampaignPresets = listCampaignPresets;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../lib/prisma"));
const campaigns_1 = require("./campaigns");
const queues_1 = require("../queues");
class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.ApiError = ApiError;
const editableStatuses = ['DRAFT', 'PAUSED', 'SCHEDULED'];
const startableStatuses = ['DRAFT', 'SCHEDULED'];
const parseFiltersFromCampaign = (campaign) => {
    if (!campaign.filters)
        return {};
    return (0, campaigns_1.normalizeFilters)(campaign.filters);
};
exports.parseFiltersFromCampaign = parseFiltersFromCampaign;
async function listCampaigns(status) {
    const campaigns = await prisma_1.default.campaign.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    return campaigns;
}
async function createCampaign(payload, userId) {
    const { start, end } = (0, campaigns_1.businessHoursFromPayload)(payload.businessHours || undefined);
    const { min, max } = (0, campaigns_1.randomDelayFromPayload)(payload.randomDelay || undefined);
    const filtersJson = payload.filters ? (0, campaigns_1.persistCampaignFilters)(payload.filters) : undefined;
    const variables = (0, campaigns_1.extractTemplateVariables)(payload.message);
    const record = await prisma_1.default.campaign.create({
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
            randomDelayMin: min ?? 30,
            randomDelayMax: max ?? 60,
            variables,
            createdById: userId,
            status: payload.scheduledFor ? client_1.CampaignStatus.SCHEDULED : client_1.CampaignStatus.DRAFT,
        },
    });
    console.log('[campaign] created', record.id);
    return record;
}
async function updateCampaign(id, payload) {
    const existing = await prisma_1.default.campaign.findUnique({ where: { id } });
    if (!existing)
        throw new ApiError(404, 'Campaign not found');
    if (!editableStatuses.includes(existing.status)) {
        throw new ApiError(409, `Campaign cannot be edited while ${existing.status.toLowerCase()}`);
    }
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
        if (payload.scheduledFor && existing.status === client_1.CampaignStatus.DRAFT) {
            updateData.status = client_1.CampaignStatus.SCHEDULED;
        }
    }
    const updated = await prisma_1.default.campaign.update({ where: { id }, data: updateData });
    console.log('[campaign] updated', id);
    return updated;
}
async function getCampaignDetails(id) {
    const campaign = await prisma_1.default.campaign.findUnique({
        where: { id },
        include: { events: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!campaign)
        throw new ApiError(404, 'Campaign not found');
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
    return { campaign, stats, recentRecipients };
}
async function listCampaignRecipients(id, page, pageSize) {
    const [items, total] = await Promise.all([
        prisma_1.default.campaignRecipient.findMany({
            where: { campaignId: id },
            orderBy: { createdAt: 'asc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma_1.default.campaignRecipient.count({ where: { campaignId: id } }),
    ]);
    return { items, total };
}
async function startCampaign(campaignId) {
    const campaign = await prisma_1.default.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign)
        throw new ApiError(404, 'Campaign not found');
    if (!startableStatuses.includes(campaign.status)) {
        throw new ApiError(409, `Campaign is ${campaign.status.toLowerCase()} and cannot be started`);
    }
    const filters = (0, exports.parseFiltersFromCampaign)(campaign);
    const { rows, total } = await (0, campaigns_1.buildRecipientsForCampaign)(campaignId, filters);
    if (!total)
        throw new ApiError(400, 'No recipients match the selected filters');
    await prisma_1.default.$transaction([
        prisma_1.default.campaignRecipient.deleteMany({ where: { campaignId } }),
        prisma_1.default.campaignRecipient.createMany({ data: rows }),
        prisma_1.default.campaign.update({
            where: { id: campaignId },
            data: {
                status: client_1.CampaignStatus.RUNNING,
                startedAt: new Date(),
                targetCount: total,
                sentCount: 0,
                failedCount: 0,
            },
        }),
        prisma_1.default.campaignEvent.create({
            data: { campaignId, type: 'campaign.started', details: { targetCount: total } },
        }),
    ]);
    console.log('[campaign] started', campaignId, 'targetCount', total);
    await (0, queues_1.enqueueCampaignRecipients)(campaignId);
    return { message: 'Campaign started', targetCount: total };
}
async function pauseCampaign(id) {
    const campaign = await prisma_1.default.campaign.findUnique({ where: { id } });
    if (!campaign)
        throw new ApiError(404, 'Campaign not found');
    if (campaign.status !== client_1.CampaignStatus.RUNNING) {
        throw new ApiError(409, 'Only running campaigns can be paused');
    }
    await prisma_1.default.$transaction([
        prisma_1.default.campaign.update({ where: { id }, data: { status: client_1.CampaignStatus.PAUSED } }),
        prisma_1.default.campaignEvent.create({ data: { campaignId: id, type: 'campaign.paused' } }),
    ]);
    console.log('[campaign] paused', id);
    return { message: 'Campaign paused' };
}
async function resumeCampaign(id) {
    const campaign = await prisma_1.default.campaign.findUnique({ where: { id } });
    if (!campaign)
        throw new ApiError(404, 'Campaign not found');
    if (campaign.status !== client_1.CampaignStatus.PAUSED) {
        throw new ApiError(409, 'Only paused campaigns can be resumed');
    }
    await prisma_1.default.$transaction([
        prisma_1.default.campaign.update({ where: { id }, data: { status: client_1.CampaignStatus.RUNNING } }),
        prisma_1.default.campaignEvent.create({ data: { campaignId: id, type: 'campaign.resumed' } }),
    ]);
    await (0, queues_1.enqueueCampaignRecipients)(id);
    console.log('[campaign] resumed', id);
    return { message: 'Campaign resumed' };
}
async function cancelCampaign(id) {
    const campaign = await prisma_1.default.campaign.findUnique({ where: { id } });
    if (!campaign)
        throw new ApiError(404, 'Campaign not found');
    if (campaign.status === client_1.CampaignStatus.CANCELLED || campaign.status === client_1.CampaignStatus.COMPLETED) {
        throw new ApiError(409, `Campaign already ${campaign.status.toLowerCase()}`);
    }
    await prisma_1.default.$transaction([
        prisma_1.default.campaign.update({
            where: { id },
            data: { status: client_1.CampaignStatus.CANCELLED, completedAt: new Date() },
        }),
        prisma_1.default.campaignRecipient.updateMany({
            where: { campaignId: id, status: { in: [client_1.CampaignRecipientStatus.PENDING, client_1.CampaignRecipientStatus.SCHEDULED] } },
            data: { status: client_1.CampaignRecipientStatus.CANCELLED },
        }),
        prisma_1.default.campaignEvent.create({ data: { campaignId: id, type: 'campaign.cancelled' } }),
    ]);
    console.log('[campaign] cancelled', id);
    return { message: 'Campaign cancelled' };
}
async function previewCampaign(filters, limit) {
    const preview = await (0, campaigns_1.previewRecipients)(filters || {}, limit || 50);
    return preview;
}
async function createCampaignPreset(payload) {
    const preset = await prisma_1.default.campaignPreset.create({
        data: {
            name: payload.name,
            description: payload.description || null,
            filters: (0, campaigns_1.persistCampaignFilters)(payload.filters || {}) || {},
            createdById: payload.createdById,
        },
    });
    console.log('[campaign] preset created', preset.id);
    return preset;
}
async function deleteCampaignPreset(id) {
    await prisma_1.default.campaignPreset.delete({ where: { id } }).catch(() => null);
}
async function listCampaignPresets() {
    const presets = await prisma_1.default.campaignPreset.findMany({ orderBy: { createdAt: 'desc' } });
    return presets;
}
