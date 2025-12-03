"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const ai_1 = require("../services/ai");
const router = (0, express_1.Router)();
const askSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid().optional(),
    customerId: zod_1.z.string().uuid().optional(),
    message: zod_1.z.string().min(1),
});
router.get('/job/:jobId/messages', auth_1.requireAuth, async (req, res) => {
    const jobId = String(req.params.jobId);
    const convo = await prisma_1.default.aiConversation.findFirst({ where: { jobId }, orderBy: { createdAt: 'desc' } });
    if (!convo)
        return res.json({ conversationId: null, messages: [] });
    const messages = await prisma_1.default.aiMessage.findMany({ where: { conversationId: convo.id }, orderBy: { createdAt: 'asc' } });
    return res.json({ conversationId: convo.id, messages });
});
router.post('/ask', auth_1.requireAuth, async (req, res) => {
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const { jobId, customerId, message } = parsed.data;
    // Build context from job/customer history
    let context = '';
    if (jobId) {
        const job = await prisma_1.default.job.findUnique({ where: { id: jobId }, include: { customer: true, device: true } });
        if (job) {
            context += `Job: ${job.title}\nStatus: ${job.status}\nPriority: ${job.priority}\nCustomer: ${job.customer.name}\nDevice: ${job.device.deviceType} ${job.device.brand || ''} ${job.device.model || ''}\n`;
            const lastMsgs = await prisma_1.default.jobMessage.findMany({ where: { jobId }, orderBy: { createdAt: 'desc' }, take: 10 });
            if (lastMsgs.length) {
                context += `\nRecent messages:\n` + lastMsgs.reverse().map((m) => `- ${m.role}: ${m.content}`).join('\n');
            }
        }
    }
    // Reuse latest conversation for job if available, else create new
    let conversation = null;
    if (jobId) {
        conversation = await prisma_1.default.aiConversation.findFirst({ where: { jobId }, orderBy: { createdAt: 'desc' } });
    }
    if (!conversation) {
        conversation = await prisma_1.default.aiConversation.create({ data: { jobId: jobId || null, customerId: customerId || null } });
    }
    await prisma_1.default.aiMessage.create({
        data: { conversationId: conversation.id, role: 'USER', content: message },
    });
    const system = 'You are a helpful assistant for a repair service. Answer concisely and professionally.';
    const prompt = `${context}\n\nUser: ${message}`;
    const reply = await (0, ai_1.generateAiResponse)({ prompt, system });
    await prisma_1.default.aiMessage.create({ data: { conversationId: conversation.id, role: 'ASSISTANT', content: reply } });
    return res.json({ conversationId: conversation.id, reply });
});
exports.default = router;
