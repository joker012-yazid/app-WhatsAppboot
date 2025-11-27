import { Queue, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { CampaignRecipientStatus, Prisma } from '@prisma/client';

import prisma from '../lib/prisma';
import env from '../config/env';
import { DO_NOT_CONTACT_TAGS, renderCampaignMessage } from '../services/campaigns';

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ - must be null
});

export const reminderQueue = new Queue('reminders', { connection });
export const messageQueue = new Queue('messages', { connection });
export const campaignQueue = new Queue('campaign-messages', { connection });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Process reminders: create JobMessage entries (placeholder for WhatsApp sends)
new Worker(
  'reminders',
  async (job: any) => {
    const { jobId, kind } = job.data as { jobId: string; kind: string };
    const j = await prisma.job.findUnique({ where: { id: jobId }, include: { customer: true } });
    if (!j) return;
    const content = `Reminder (${kind}): Hi ${j.customer.name}, this is a reminder regarding your job "${j.title}".`;
    await prisma.jobMessage.create({ data: { jobId, role: 'AGENT', content } });
    await prisma.reminder.create({ data: { jobId, kind } as any });
    return { ok: true };
  },
  { connection },
);

// Process messages: placeholder for actual WhatsApp integration
new Worker(
  'messages',
  async (job: any) => {
    const { jobId, content, role } = job.data as { jobId: string; content: string; role?: 'AGENT' | 'SYSTEM' };
    await prisma.jobMessage.create({ data: { jobId, role: (role as any) || 'AGENT', content } });
    return { ok: true };
  },
  { connection },
);

// Campaign worker with anti-ban constraints
new Worker(
  'campaign-messages',
  async (job: any) => {
    const { campaignId, recipientId } = job.data as { campaignId: string; recipientId: string };
    const [campaign, recipient] = await Promise.all([
      prisma.campaign.findUnique({ where: { id: campaignId } }),
      prisma.campaignRecipient.findUnique({ where: { id: recipientId }, include: { customer: true } }),
    ]);
    if (!campaign || !recipient) return { skipped: 'missing' };
    const terminalStatuses: CampaignRecipientStatus[] = [
      CampaignRecipientStatus.SENT,
      CampaignRecipientStatus.DELIVERED,
      CampaignRecipientStatus.FAILED,
      CampaignRecipientStatus.CANCELLED,
    ];
    if (
      terminalStatuses.includes(recipient.status)
    ) {
      console.log('[campaign-worker] skip duplicate send for recipient', recipientId, 'status', recipient.status);
      return { skipped: recipient.status };
    }
    if (['CANCELLED', 'FAILED', 'COMPLETED'].includes(campaign.status)) {
      return { skipped: 'campaign_inactive' };
    }
    if (campaign.status === 'PAUSED') {
      return { deferred: 'paused' };
    }

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = campaign.businessHoursStart ?? 9 * 60;
    const endMinutes = campaign.businessHoursEnd ?? 18 * 60;
    if (minutes < startMinutes || minutes > endMinutes) {
      const target = new Date(now);
      if (minutes > endMinutes) target.setDate(target.getDate() + 1);
      target.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
      await campaignQueue.add('campaign-send', { campaignId, recipientId }, { delay: target.getTime() - now.getTime(), attempts: 3, removeOnComplete: true });
      await prisma.campaignRecipient.update({ where: { id: recipientId }, data: { status: CampaignRecipientStatus.SCHEDULED } });
      return { deferred: 'business_hours' };
    }

    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sentToday = await prisma.campaignRecipient.count({ where: { campaignId, sentAt: { gte: dayStart } } });
    if (sentToday >= (campaign.dailyLimit || 150)) {
      const tomorrow = new Date(dayStart);
      tomorrow.setDate(tomorrow.getDate() + 1);
      await campaignQueue.add('campaign-send', { campaignId, recipientId }, { delay: tomorrow.getTime() - now.getTime(), attempts: 3, removeOnComplete: true });
      await prisma.campaignRecipient.update({ where: { id: recipientId }, data: { status: CampaignRecipientStatus.SCHEDULED } });
      return { deferred: 'daily_limit' };
    }

    if (recipient.customer?.tags?.some((tag) => DO_NOT_CONTACT_TAGS.includes(tag.toUpperCase()))) {
      await prisma.$transaction([
        prisma.campaignRecipient.update({ where: { id: recipientId }, data: { status: CampaignRecipientStatus.SKIPPED, error: 'opt_out' } }),
        prisma.campaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } }),
        prisma.campaignEvent.create({ data: { campaignId, type: 'campaign.skipped', details: { recipientId, reason: 'opt_out' } } }),
      ]);
      return { skipped: 'opt_out' };
    }

    const message = renderCampaignMessage(campaign.message, { name: recipient.name, phone: recipient.phone }, { campaign_name: campaign.name });

    try {
      await prisma.$transaction([
        prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: {
            status: CampaignRecipientStatus.SENT,
            sentAt: now,
            lastAttemptAt: now,
            attempts: { increment: 1 },
            error: null,
          },
        }),
        prisma.campaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } }),
        prisma.campaignEvent.create({
          data: { campaignId, type: 'campaign.message_sent', details: { recipientId, phone: recipient.phone, message } },
        }),
      ]);
    } catch (error) {
      const errMsg = (error as Error).message || 'failed to send';
      await prisma.$transaction([
        prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: {
            status: CampaignRecipientStatus.FAILED,
            error: errMsg,
            lastAttemptAt: now,
            attempts: { increment: 1 },
          },
        }),
        prisma.campaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } }),
        prisma.campaignEvent.create({ data: { campaignId, type: 'campaign.message_failed', details: { recipientId, error: errMsg } } }),
      ]);
      throw error;
    }

    const delaySeconds = randomBetween(Math.max(1, campaign.randomDelayMin || 30), Math.max(1, campaign.randomDelayMax || 60));
    await wait(delaySeconds * 1000);

    const remaining = await prisma.campaignRecipient.count({
      where: { campaignId, status: { in: [CampaignRecipientStatus.PENDING, CampaignRecipientStatus.SCHEDULED] } },
    });
    if (remaining === 0) {
      await prisma.$transaction([
        prisma.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED', completedAt: new Date() } }),
        prisma.campaignEvent.create({ data: { campaignId, type: 'campaign.completed' } }),
      ]);
    }

    return { ok: true };
  },
  { connection, concurrency: 1 },
);

export async function enqueueReminder(jobId: string, kind: string, delayMs: number, opts?: JobsOptions) {
  await reminderQueue.add('reminder', { jobId, kind }, { delay: delayMs, attempts: 3, removeOnComplete: true, ...(opts || {}) });
}

export async function enqueueCampaignRecipients(campaignId: string, specificIds?: string[]) {
  const where: Prisma.CampaignRecipientWhereInput = { campaignId };
  if (specificIds?.length) {
    where.id = { in: specificIds };
  } else {
    where.status = { in: [CampaignRecipientStatus.PENDING, CampaignRecipientStatus.SCHEDULED] };
  }
  const recipients = await prisma.campaignRecipient.findMany({ where, select: { id: true } });
  if (!recipients.length) {
    console.log('[campaign] enqueue skipped - no pending recipients', campaignId);
    return;
  }
  if (!specificIds?.length) {
    await prisma.campaignRecipient.updateMany({
      where: { campaignId, status: CampaignRecipientStatus.PENDING },
      data: { status: CampaignRecipientStatus.SCHEDULED },
    });
  }
  await Promise.all(
    recipients.map((recipient) =>
      campaignQueue.add('campaign-send', { campaignId, recipientId: recipient.id }, { attempts: 3, removeOnComplete: true }),
    ),
  );
  console.log('[campaign] enqueued recipients', { campaignId, count: recipients.length });
}
