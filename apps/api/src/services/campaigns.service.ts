import { CampaignRecipientStatus, CampaignStatus, Prisma } from '@prisma/client';

import prisma from '../lib/prisma';
import {
  businessHoursFromPayload,
  buildRecipientsForCampaign,
  CampaignFilters,
  extractTemplateVariables,
  normalizeFilters,
  persistCampaignFilters,
  previewRecipients,
  randomDelayFromPayload,
} from './campaigns';
import { enqueueCampaignRecipients } from '../queues';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const editableStatuses: CampaignStatus[] = ['DRAFT', 'PAUSED', 'SCHEDULED'];
const startableStatuses: CampaignStatus[] = ['DRAFT', 'SCHEDULED'];

export const parseFiltersFromCampaign = (campaign: { filters: Prisma.JsonValue | null }): CampaignFilters => {
  if (!campaign.filters) return {};
  return normalizeFilters(campaign.filters as CampaignFilters);
};

export async function listCampaigns(status?: CampaignStatus) {
  const campaigns = await prisma.campaign.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return campaigns;
}

export async function createCampaign(
  payload: {
    name: string;
    kind: Prisma.CampaignCreateInput['kind'];
    message: string;
    mediaUrl?: string;
    filters?: CampaignFilters | null;
    scheduledFor?: string | null;
    businessHours?: { start?: number; end?: number };
    dailyLimit?: number;
    randomDelay?: { min?: number; max?: number };
  },
  userId?: string,
) {
  const { start, end } = businessHoursFromPayload(payload.businessHours || undefined);
  const { min, max } = randomDelayFromPayload(payload.randomDelay || undefined);
  const filtersJson = payload.filters ? persistCampaignFilters(payload.filters) : undefined;
  const variables = extractTemplateVariables(payload.message);
  const record = await prisma.campaign.create({
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
      status: payload.scheduledFor ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT,
    },
  });
  console.log('[campaign] created', record.id);
  return record;
}

export async function updateCampaign(
  id: string,
  payload: {
    name?: string;
    kind?: Prisma.CampaignCreateInput['kind'];
    message?: string;
    mediaUrl?: string | null;
    filters?: CampaignFilters | null;
    scheduledFor?: string | null;
    businessHours?: { start?: number; end?: number } | null;
    dailyLimit?: number;
    randomDelay?: { min?: number; max?: number } | null;
  },
) {
  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Campaign not found');
  if (!editableStatuses.includes(existing.status)) {
    throw new ApiError(409, `Campaign cannot be edited while ${existing.status.toLowerCase()}`);
  }
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
    if (payload.scheduledFor && existing.status === CampaignStatus.DRAFT) {
      updateData.status = CampaignStatus.SCHEDULED;
    }
  }

  const updated = await prisma.campaign.update({ where: { id }, data: updateData });
  console.log('[campaign] updated', id);
  return updated;
}

export async function getCampaignDetails(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  if (!campaign) throw new ApiError(404, 'Campaign not found');

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
  return { campaign, stats, recentRecipients };
}

export async function listCampaignRecipients(id: string, page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    prisma.campaignRecipient.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.campaignRecipient.count({ where: { campaignId: id } }),
  ]);
  return { items, total };
}

export async function startCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new ApiError(404, 'Campaign not found');
  if (!startableStatuses.includes(campaign.status)) {
    throw new ApiError(409, `Campaign is ${campaign.status.toLowerCase()} and cannot be started`);
  }

  const filters = parseFiltersFromCampaign(campaign);
  const { rows, total } = await buildRecipientsForCampaign(campaignId, filters);
  if (!total) throw new ApiError(400, 'No recipients match the selected filters');

  await prisma.$transaction([
    prisma.campaignRecipient.deleteMany({ where: { campaignId } }),
    prisma.campaignRecipient.createMany({ data: rows }),
    prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.RUNNING,
        startedAt: new Date(),
        targetCount: total,
        sentCount: 0,
        failedCount: 0,
      },
    }),
    prisma.campaignEvent.create({
      data: { campaignId, type: 'campaign.started', details: { targetCount: total } },
    }),
  ]);

  console.log('[campaign] started', campaignId, 'targetCount', total);
  await enqueueCampaignRecipients(campaignId);
  return { message: 'Campaign started', targetCount: total };
}

export async function pauseCampaign(id: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new ApiError(404, 'Campaign not found');
  if (campaign.status !== CampaignStatus.RUNNING) {
    throw new ApiError(409, 'Only running campaigns can be paused');
  }
  await prisma.$transaction([
    prisma.campaign.update({ where: { id }, data: { status: CampaignStatus.PAUSED } }),
    prisma.campaignEvent.create({ data: { campaignId: id, type: 'campaign.paused' } }),
  ]);
  console.log('[campaign] paused', id);
  return { message: 'Campaign paused' };
}

export async function resumeCampaign(id: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new ApiError(404, 'Campaign not found');
  if (campaign.status !== CampaignStatus.PAUSED) {
    throw new ApiError(409, 'Only paused campaigns can be resumed');
  }
  await prisma.$transaction([
    prisma.campaign.update({ where: { id }, data: { status: CampaignStatus.RUNNING } }),
    prisma.campaignEvent.create({ data: { campaignId: id, type: 'campaign.resumed' } }),
  ]);
  await enqueueCampaignRecipients(id);
  console.log('[campaign] resumed', id);
  return { message: 'Campaign resumed' };
}

export async function cancelCampaign(id: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new ApiError(404, 'Campaign not found');
  if (campaign.status === CampaignStatus.CANCELLED || campaign.status === CampaignStatus.COMPLETED) {
    throw new ApiError(409, `Campaign already ${campaign.status.toLowerCase()}`);
  }
  await prisma.$transaction([
    prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.CANCELLED, completedAt: new Date() },
    }),
    prisma.campaignRecipient.updateMany({
      where: { campaignId: id, status: { in: [CampaignRecipientStatus.PENDING, CampaignRecipientStatus.SCHEDULED] } },
      data: { status: CampaignRecipientStatus.CANCELLED },
    }),
    prisma.campaignEvent.create({ data: { campaignId: id, type: 'campaign.cancelled' } }),
  ]);
  console.log('[campaign] cancelled', id);
  return { message: 'Campaign cancelled' };
}

export async function previewCampaign(filters: CampaignFilters | undefined, limit: number | undefined) {
  const preview = await previewRecipients(filters || {}, limit || 50);
  return preview;
}

export async function createCampaignPreset(payload: {
  name: string;
  description?: string | null;
  filters?: CampaignFilters | null;
  createdById?: string;
}) {
  const preset = await prisma.campaignPreset.create({
    data: {
      name: payload.name,
      description: payload.description || null,
      filters: persistCampaignFilters(payload.filters || {}) || {},
      createdById: payload.createdById,
    },
  });
  console.log('[campaign] preset created', preset.id);
  return preset;
}

export async function deleteCampaignPreset(id: string) {
  await prisma.campaignPreset.delete({ where: { id } }).catch(() => null);
}

export async function listCampaignPresets() {
  const presets = await prisma.campaignPreset.findMany({ orderBy: { createdAt: 'desc' } });
  return presets;
}
