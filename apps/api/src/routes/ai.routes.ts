import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { generateAiResponse } from '../services/ai';

const router = Router();

const askSchema = z.object({
  jobId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  message: z.string().min(1),
});

router.get('/job/:jobId/messages', requireAuth, async (req, res) => {
  const jobId = String(req.params.jobId);
  const convo = await prisma.aiConversation.findFirst({ where: { jobId }, orderBy: { createdAt: 'desc' } });
  if (!convo) return res.json({ conversationId: null, messages: [] });
  const messages = await prisma.aiMessage.findMany({ where: { conversationId: convo.id }, orderBy: { createdAt: 'asc' } });
  return res.json({ conversationId: convo.id, messages });
});

router.post('/ask', requireAuth, async (req, res) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const { jobId, customerId, message } = parsed.data;

  // Build context from job/customer history
  let context = '';
  if (jobId) {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { customer: true, device: true } });
    if (job) {
      context += `Job: ${job.title}\nStatus: ${job.status}\nPriority: ${job.priority}\nCustomer: ${job.customer.name}\nDevice: ${job.device.deviceType} ${job.device.brand || ''} ${job.device.model || ''}\n`;
      const lastMsgs = await prisma.jobMessage.findMany({ where: { jobId }, orderBy: { createdAt: 'desc' }, take: 10 });
      if (lastMsgs.length) {
        context += `\nRecent messages:\n` + lastMsgs.reverse().map((m: any) => `- ${m.role}: ${m.content}`).join('\n');
      }
    }
  }

  // Reuse latest conversation for job if available, else create new
  let conversation = null as any;
  if (jobId) {
    conversation = await prisma.aiConversation.findFirst({ where: { jobId }, orderBy: { createdAt: 'desc' } });
  }
  if (!conversation) {
    conversation = await prisma.aiConversation.create({ data: { jobId: jobId || null, customerId: customerId || null } });
  }

  await prisma.aiMessage.create({
    data: { conversationId: conversation.id, role: 'USER', content: message },
  });

  const system = 'You are a helpful assistant for a repair service. Answer concisely and professionally.';
  const prompt = `${context}\n\nUser: ${message}`;
  const reply = await generateAiResponse({ prompt, system });

  await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: 'ASSISTANT', content: reply } });

  return res.json({ conversationId: conversation.id, reply });
});

export default router;
