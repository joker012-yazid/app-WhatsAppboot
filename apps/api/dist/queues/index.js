"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignQueue = exports.messageQueue = exports.reminderQueue = void 0;
exports.enqueueReminder = enqueueReminder;
exports.enqueueCampaignRecipients = enqueueCampaignRecipients;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../lib/prisma"));
const env_1 = __importDefault(require("../config/env"));
const campaigns_1 = require("../services/campaigns");
const connection = new ioredis_1.default(env_1.default.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ - must be null
});
exports.reminderQueue = new bullmq_1.Queue('reminders', { connection });
exports.messageQueue = new bullmq_1.Queue('messages', { connection });
exports.campaignQueue = new bullmq_1.Queue('campaign-messages', { connection });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
// Process reminders: create JobMessage entries (placeholder for WhatsApp sends)
new bullmq_1.Worker('reminders', async (job) => {
    const { jobId, kind } = job.data;
    const j = await prisma_1.default.job.findUnique({ where: { id: jobId }, include: { customer: true } });
    if (!j)
        return;
    const content = `Reminder (${kind}): Hi ${j.customer.name}, this is a reminder regarding your job "${j.title}".`;
    await prisma_1.default.jobMessage.create({ data: { jobId, role: 'AGENT', content } });
    await prisma_1.default.reminder.create({ data: { jobId, kind } });
    return { ok: true };
}, { connection });
// Process messages: placeholder for actual WhatsApp integration
new bullmq_1.Worker('messages', async (job) => {
    const { jobId, content, role } = job.data;
    await prisma_1.default.jobMessage.create({ data: { jobId, role: role || 'AGENT', content } });
    return { ok: true };
}, { connection });
// Campaign worker with anti-ban constraints
new bullmq_1.Worker('campaign-messages', async (job) => {
    const { campaignId, recipientId } = job.data;
    const [campaign, recipient] = await Promise.all([
        prisma_1.default.campaign.findUnique({ where: { id: campaignId } }),
        prisma_1.default.campaignRecipient.findUnique({ where: { id: recipientId }, include: { customer: true } }),
    ]);
    if (!campaign || !recipient)
        return { skipped: 'missing' };
    const terminalStatuses = [
        client_1.CampaignRecipientStatus.SENT,
        client_1.CampaignRecipientStatus.DELIVERED,
        client_1.CampaignRecipientStatus.FAILED,
        client_1.CampaignRecipientStatus.CANCELLED,
    ];
    if (terminalStatuses.includes(recipient.status)) {
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
        if (minutes > endMinutes)
            target.setDate(target.getDate() + 1);
        target.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
        await exports.campaignQueue.add('campaign-send', { campaignId, recipientId }, { delay: target.getTime() - now.getTime(), attempts: 3, removeOnComplete: true });
        await prisma_1.default.campaignRecipient.update({ where: { id: recipientId }, data: { status: client_1.CampaignRecipientStatus.SCHEDULED } });
        return { deferred: 'business_hours' };
    }
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sentToday = await prisma_1.default.campaignRecipient.count({ where: { campaignId, sentAt: { gte: dayStart } } });
    if (sentToday >= (campaign.dailyLimit || 150)) {
        const tomorrow = new Date(dayStart);
        tomorrow.setDate(tomorrow.getDate() + 1);
        await exports.campaignQueue.add('campaign-send', { campaignId, recipientId }, { delay: tomorrow.getTime() - now.getTime(), attempts: 3, removeOnComplete: true });
        await prisma_1.default.campaignRecipient.update({ where: { id: recipientId }, data: { status: client_1.CampaignRecipientStatus.SCHEDULED } });
        return { deferred: 'daily_limit' };
    }
    if (recipient.customer?.tags?.some((tag) => campaigns_1.DO_NOT_CONTACT_TAGS.includes(tag.toUpperCase()))) {
        await prisma_1.default.$transaction([
            prisma_1.default.campaignRecipient.update({ where: { id: recipientId }, data: { status: client_1.CampaignRecipientStatus.SKIPPED, error: 'opt_out' } }),
            prisma_1.default.campaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } }),
            prisma_1.default.campaignEvent.create({ data: { campaignId, type: 'campaign.skipped', details: { recipientId, reason: 'opt_out' } } }),
        ]);
        return { skipped: 'opt_out' };
    }
    const message = (0, campaigns_1.renderCampaignMessage)(campaign.message, { name: recipient.name, phone: recipient.phone }, { campaign_name: campaign.name });
    try {
        await prisma_1.default.$transaction([
            prisma_1.default.campaignRecipient.update({
                where: { id: recipientId },
                data: {
                    status: client_1.CampaignRecipientStatus.SENT,
                    sentAt: now,
                    lastAttemptAt: now,
                    attempts: { increment: 1 },
                    error: null,
                },
            }),
            prisma_1.default.campaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } }),
            prisma_1.default.campaignEvent.create({
                data: { campaignId, type: 'campaign.message_sent', details: { recipientId, phone: recipient.phone, message } },
            }),
        ]);
    }
    catch (error) {
        const errMsg = error.message || 'failed to send';
        await prisma_1.default.$transaction([
            prisma_1.default.campaignRecipient.update({
                where: { id: recipientId },
                data: {
                    status: client_1.CampaignRecipientStatus.FAILED,
                    error: errMsg,
                    lastAttemptAt: now,
                    attempts: { increment: 1 },
                },
            }),
            prisma_1.default.campaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } }),
            prisma_1.default.campaignEvent.create({ data: { campaignId, type: 'campaign.message_failed', details: { recipientId, error: errMsg } } }),
        ]);
        throw error;
    }
    const delaySeconds = randomBetween(Math.max(1, campaign.randomDelayMin || 30), Math.max(1, campaign.randomDelayMax || 60));
    await wait(delaySeconds * 1000);
    const remaining = await prisma_1.default.campaignRecipient.count({
        where: { campaignId, status: { in: [client_1.CampaignRecipientStatus.PENDING, client_1.CampaignRecipientStatus.SCHEDULED] } },
    });
    if (remaining === 0) {
        await prisma_1.default.$transaction([
            prisma_1.default.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED', completedAt: new Date() } }),
            prisma_1.default.campaignEvent.create({ data: { campaignId, type: 'campaign.completed' } }),
        ]);
    }
    return { ok: true };
}, { connection, concurrency: 1 });
async function enqueueReminder(jobId, kind, delayMs, opts) {
    await exports.reminderQueue.add('reminder', { jobId, kind }, { delay: delayMs, attempts: 3, removeOnComplete: true, ...(opts || {}) });
}
async function enqueueCampaignRecipients(campaignId, specificIds) {
    const where = { campaignId };
    if (specificIds?.length) {
        where.id = { in: specificIds };
    }
    else {
        where.status = { in: [client_1.CampaignRecipientStatus.PENDING, client_1.CampaignRecipientStatus.SCHEDULED] };
    }
    const recipients = await prisma_1.default.campaignRecipient.findMany({ where, select: { id: true } });
    if (!recipients.length) {
        console.log('[campaign] enqueue skipped - no pending recipients', campaignId);
        return;
    }
    if (!specificIds?.length) {
        await prisma_1.default.campaignRecipient.updateMany({
            where: { campaignId, status: client_1.CampaignRecipientStatus.PENDING },
            data: { status: client_1.CampaignRecipientStatus.SCHEDULED },
        });
    }
    await Promise.all(recipients.map((recipient) => exports.campaignQueue.add('campaign-send', { campaignId, recipientId: recipient.id }, { attempts: 3, removeOnComplete: true })));
    console.log('[campaign] enqueued recipients', { campaignId, count: recipients.length });
}
