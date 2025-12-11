/**
 * Workflow Automation Service
 * 
 * Handles automatic WhatsApp message sending based on job status changes
 * and customer response detection for the repair workflow.
 */

import prisma from '../lib/prisma';
import { sendMessageToChat, getConnectionStatus } from '../whatsapp/whatsapp.service';
import { generateSalesResponse } from './ai';
import pino from 'pino';

const logger = pino({ level: 'info' });

/**
 * Message Templates
 * Variables: {customerName}, {deviceType}, {diagnosis}, {amount}, {jobId}
 */
const MESSAGE_TEMPLATES = {
  // After QR registration completed
  REGISTRATION_CONFIRMED: `Terima kasih *{customerName}*! 🙏

Kami telah terima maklumat peranti anda:
📱 Jenis: {deviceType}
🔧 Model: {deviceModel}

Peranti anda sedang dalam proses pemeriksaan. Kami akan hubungi anda dengan quotation segera.

Ref: #{jobId}`,

  // When status changes to QUOTED
  QUOTATION_SENT: `Assalamualaikum *{customerName}*,

Berikut adalah quotation untuk pembaikan peranti anda:

📱 Peranti: {deviceType} {deviceModel}
🔍 Diagnosis: {diagnosis}
💰 Kos Pembaikan: RM{amount}

Untuk meneruskan pembaikan, sila reply:
✅ *SETUJU* - untuk approve
❌ *TAK SETUJU* - untuk reject

Quotation ini sah selama 30 hari.
Ref: #{jobId}`,

  // Reminder Day 1
  REMINDER_DAY_1: `Hi *{customerName}*,

Reminder: Kami masih menunggu keputusan anda untuk quotation pembaikan peranti {deviceType}.

💰 Kos: RM{amount}
🔍 Diagnosis: {diagnosis}

Sila reply:
✅ *SETUJU* - untuk proceed
❌ *TAK SETUJU* - untuk cancel

Ref: #{jobId}`,

  // Reminder Day 20
  REMINDER_DAY_20: `Hi *{customerName}*,

Quotation untuk pembaikan {deviceType} anda masih pending approval.

💰 Kos: RM{amount}

⚠️ Quotation akan expire dalam 10 hari lagi.

Reply *SETUJU* untuk proceed atau *TAK SETUJU* untuk cancel.

Ref: #{jobId}`,

  // Reminder Day 30
  REMINDER_DAY_30: `Hi *{customerName}*,

Ini adalah reminder terakhir untuk quotation pembaikan {deviceType} anda.

💰 Kos: RM{amount}

🚨 Quotation akan expire hari ini.

Sila reply *SETUJU* atau *TAK SETUJU* sekarang.

Ref: #{jobId}`,

  // When customer approves
  APPROVED: `Terima kasih *{customerName}*! ✅

Quotation anda telah diluluskan. Pembaikan akan bermula sekarang.

📱 {deviceType} {deviceModel}
💰 Kos: RM{amount}

Kami akan update anda tentang progress pembaikan.

Ref: #{jobId}`,

  // When customer rejects
  REJECTED: `Terima kasih *{customerName}* atas maklumbalas anda.

Quotation untuk {deviceType} anda telah dibatalkan.

Anda boleh ambil peranti anda di kedai kami pada waktu bekerja.

Ref: #{jobId}`,

  // When status changes to IN_PROGRESS
  IN_PROGRESS: `Hi *{customerName}*,

Pembaikan untuk {deviceType} anda kini sedang dalam proses. 🔧

Kami akan update anda dengan gambar progress tidak lama lagi.

Ref: #{jobId}`,

  // When technician uploads progress photos
  PROGRESS_UPDATE: `Hi *{customerName}*,

Update: Pembaikan {deviceType} anda sedang berjalan lancar! 👍

[Photo akan attach di sini]

Kami akan maklumkan bila siap.

Ref: #{jobId}`,

  // When status changes to COMPLETED
  COMPLETED: `Alhamdulillah! *{customerName}* ✅

Pembaikan {deviceType} anda telah SELESAI!

📱 Peranti: {deviceType} {deviceModel}
💰 Jumlah Bayaran: RM{amount}

Sila datang ke kedai untuk ambil peranti anda.

Waktu Operasi:
📅 Isnin - Jumaat: 9 AM - 6 PM
📅 Sabtu: 9 AM - 2 PM

Ref: #{jobId}`,

  // After customer picks up (DELIVERED status)
  THANK_YOU: `Terima kasih *{customerName}*! 🙏

Terima kasih kerana mempercayai kami untuk pembaikan {deviceType} anda.

Jika ada sebarang masalah, sila hubungi kami.

💬 Bantu kami improve! Share feedback anda:
⭐⭐⭐⭐⭐

Ref: #{jobId}`,
};

/**
 * Replace template variables with actual values
 */
function fillTemplate(template: string, data: Record<string, any>): string {
  let message = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{${key}}`;
    message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ''));
  }
  return message;
}

/**
 * Send WhatsApp message with template
 */
async function sendTemplateMessage(
  phone: string,
  templateKey: keyof typeof MESSAGE_TEMPLATES,
  variables: Record<string, any>
): Promise<boolean> {
  try {
    // Check WhatsApp connection
    const status = getConnectionStatus();
    if (status.status !== 'connected') {
      logger.warn({ status: status.status }, '[Workflow] WhatsApp not connected, cannot send message');
      return false;
    }

    // Format phone number for WhatsApp (add @s.whatsapp.net if not present)
    const chatId = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;

    // Get template and fill variables
    const template = MESSAGE_TEMPLATES[templateKey];
    const message = fillTemplate(template, variables);

    // Send message
    await sendMessageToChat(chatId, message);

    logger.info({ phone, templateKey, jobId: variables.jobId }, '[Workflow] Message sent successfully');
    return true;
  } catch (error: any) {
    logger.error({ error: error.message, phone, templateKey }, '[Workflow] Failed to send message');
    return false;
  }
}

/**
 * Handle job status change and send appropriate message
 */
export async function onJobStatusChange(
  jobId: string,
  newStatus: string,
  oldStatus: string | null
): Promise<void> {
  try {
    // Fetch job with customer and device info
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        device: true,
      },
    });

    if (!job) {
      logger.error({ jobId }, '[Workflow] Job not found');
      return;
    }

    const { customer, device } = job;

    // Prepare template variables
    const variables = {
      customerName: customer.name,
      deviceType: device.deviceType,
      deviceModel: device.model || '',
      diagnosis: job.diagnosis || 'Sedang diperiksa',
      amount: job.quotedAmount?.toFixed(2) || '0.00',
      jobId: jobId.substring(0, 8).toUpperCase(),
    };

    logger.info({ jobId, newStatus, oldStatus }, '[Workflow] Processing status change');

    // Send message based on new status
    let templateKey: keyof typeof MESSAGE_TEMPLATES | null = null;

    switch (newStatus) {
      case 'QUOTED':
        templateKey = 'QUOTATION_SENT';
        break;
      case 'APPROVED':
        templateKey = 'APPROVED';
        break;
      case 'REJECTED':
        templateKey = 'REJECTED';
        break;
      case 'IN_PROGRESS':
        templateKey = 'IN_PROGRESS';
        break;
      case 'COMPLETED':
        templateKey = 'COMPLETED';
        break;
      default:
        logger.info({ newStatus }, '[Workflow] No auto-message for this status');
        return;
    }

    if (templateKey) {
      const sent = await sendTemplateMessage(customer.phone, templateKey, variables);
      
      // Log message in database
      if (sent) {
        await prisma.message.create({
          data: {
            customerId: customer.id,
            direction: 'OUTBOUND',
            content: fillTemplate(MESSAGE_TEMPLATES[templateKey], variables),
            status: 'SENT',
            sentAt: new Date(),
          },
        });
      }
    }
  } catch (error: any) {
    logger.error({ error: error.message, jobId }, '[Workflow] Error in onJobStatusChange');
  }
}

/**
 * Send reminder message
 */
export async function sendReminderMessage(
  jobId: string,
  reminderType: 'QUOTE_DAY_1' | 'QUOTE_DAY_20' | 'QUOTE_DAY_30'
): Promise<boolean> {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        device: true,
      },
    });

    if (!job) {
      logger.error({ jobId }, '[Workflow] Job not found for reminder');
      return false;
    }

    // Don't send reminder if already approved/rejected
    if (job.status !== 'QUOTED') {
      logger.info({ jobId, status: job.status }, '[Workflow] Job no longer in QUOTED status, skipping reminder');
      return false;
    }

    const { customer, device } = job;

    const variables = {
      customerName: customer.name,
      deviceType: device.deviceType,
      deviceModel: device.model || '',
      diagnosis: job.diagnosis || 'Sedang diperiksa',
      amount: job.quotedAmount?.toFixed(2) || '0.00',
      jobId: jobId.substring(0, 8).toUpperCase(),
    };

    const templateKey = reminderType === 'QUOTE_DAY_1' 
      ? 'REMINDER_DAY_1' 
      : reminderType === 'QUOTE_DAY_20'
      ? 'REMINDER_DAY_20'
      : 'REMINDER_DAY_30';

    const sent = await sendTemplateMessage(customer.phone, templateKey, variables);

    if (sent) {
      // Mark reminder as sent
      await prisma.reminder.updateMany({
        where: { jobId, kind: reminderType, sentAt: null },
        data: { sentAt: new Date() },
      });

      // Log message
      await prisma.message.create({
        data: {
          customerId: customer.id,
          direction: 'OUTBOUND',
          content: fillTemplate(MESSAGE_TEMPLATES[templateKey], variables),
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    }

    return sent;
  } catch (error: any) {
    logger.error({ error: error.message, jobId, reminderType }, '[Workflow] Error sending reminder');
    return false;
  }
}

/**
 * Detect customer response and update job status
 * Handles incoming messages from customers
 */
export async function handleCustomerResponse(
  phone: string,
  messageText: string
): Promise<void> {
  try {
    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, '');

    // Find customer by phone using exact match (phone is unique)
    const customer = await prisma.customer.findUnique({
      where: {
        phone: normalizedPhone,
      },
    });

    if (!customer) {
      // New customer - respond with AI welcome message
      logger.info({ phone }, '[Workflow] New customer - generating AI welcome response');
      await handleNewCustomerAiResponse(phone, messageText);
      return;
    }

    // Find pending quotation for this customer
    const job = await prisma.job.findFirst({
      where: {
        customerId: customer.id,
        status: 'QUOTED',
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        device: true,
      },
    });

    // Log incoming message first
    await prisma.message.create({
      data: {
        customerId: customer.id,
        direction: 'INBOUND',
        content: messageText,
        status: 'RECEIVED',
        receivedAt: new Date(),
      },
    });

    if (!job) {
      // Existing customer without pending quotation - still provide AI response
      logger.info({ customerId: customer.id }, '[Workflow] No pending quotation, using AI for general response');
      await handleAiResponse(phone, customer, messageText, null);
      return;
    }

    // Detect approval/rejection keywords
    const text = messageText.toUpperCase().trim();
    const isApproval = text.includes('SETUJU') || text.includes('OK') || text.includes('APPROVE') || text.includes('YES');
    const isRejection = text.includes('TAK SETUJU') || text.includes('REJECT') || text.includes('NO') || text.includes('CANCEL');

    if (isApproval) {
      // Update job status to APPROVED
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'APPROVED',
          approvedAmount: job.quotedAmount,
        },
      });

      // Create status history
      await prisma.jobStatusHistory.create({
        data: {
          jobId: job.id,
          status: 'APPROVED',
          notes: 'Customer approved via WhatsApp',
        },
      });

      // Trigger approval message
      await onJobStatusChange(job.id, 'APPROVED', 'QUOTED');

      logger.info({ jobId: job.id, customerId: customer.id }, '[Workflow] Job approved by customer');
    } else if (isRejection) {
      // Update job status to REJECTED
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'REJECTED',
        },
      });

      // Create status history
      await prisma.jobStatusHistory.create({
        data: {
          jobId: job.id,
          status: 'REJECTED',
          notes: 'Customer rejected via WhatsApp',
        },
      });

      // Trigger rejection message
      await onJobStatusChange(job.id, 'REJECTED', 'QUOTED');

      logger.info({ jobId: job.id, customerId: customer.id }, '[Workflow] Job rejected by customer');
    } else {
      // Use AI to generate response for general inquiries
      logger.info({ text }, '[Workflow] Using AI to respond to general inquiry');
      await handleAiResponse(phone, customer, messageText, job);
    }
  } catch (error: any) {
    logger.error({ error: error.message, phone }, '[Workflow] Error handling customer response');
  }
}

/**
 * Handle AI-powered response for general customer inquiries
 */
async function handleAiResponse(
  phone: string,
  customer: { id: string; name: string; phone: string },
  messageText: string,
  job?: { id: string; status: string; device: { deviceType: string; model?: string | null } } | null
): Promise<void> {
  try {
    // Get recent conversation history (excluding the current message which was just logged)
    // Skip 1 to exclude the current message that was just saved
    const recentMessages = await prisma.message.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      skip: 1, // Skip the most recent (current) message to avoid duplicate
      take: 10,
    });

    const previousMessages = recentMessages
      .reverse()
      .map((m) => ({
        role: (m.direction === 'INBOUND' ? 'customer' : 'agent') as 'customer' | 'agent',
        content: m.content,
      }));

    // Generate AI response
    const aiResponse = await generateSalesResponse(messageText, {
      customerName: customer.name,
      previousMessages,
      hasQuotation: job?.status === 'QUOTED',
      deviceInfo: job ? `${job.device.deviceType} ${job.device.model || ''}`.trim() : undefined,
    });

    if (!aiResponse || aiResponse.startsWith('AI stub') || aiResponse.startsWith('AI provider error')) {
      logger.warn({ phone }, '[Workflow] AI response not available or error');
      return;
    }

    // Check WhatsApp connection
    const status = getConnectionStatus();
    if (status.status !== 'connected') {
      logger.warn({ status: status.status }, '[Workflow] WhatsApp not connected, cannot send AI response');
      return;
    }

    // Format phone number and send
    const chatId = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    await sendMessageToChat(chatId, aiResponse);

    // Log AI response
    await prisma.message.create({
      data: {
        customerId: customer.id,
        direction: 'OUTBOUND',
        content: aiResponse,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    logger.info({ phone, customerId: customer.id }, '[Workflow] AI response sent successfully');
  } catch (error: any) {
    logger.error({ error: error.message, phone }, '[Workflow] Error generating AI response');
  }
}

/**
 * Send registration confirmation message
 */
export async function sendRegistrationConfirmation(jobId: string): Promise<boolean> {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        device: true,
      },
    });

    if (!job) return false;

    const variables = {
      customerName: job.customer.name,
      deviceType: job.device.deviceType,
      deviceModel: job.device.model || '',
      jobId: jobId.substring(0, 8).toUpperCase(),
    };

    const sent = await sendTemplateMessage(job.customer.phone, 'REGISTRATION_CONFIRMED', variables);

    if (sent) {
      await prisma.message.create({
        data: {
          customerId: job.customer.id,
          direction: 'OUTBOUND',
          content: fillTemplate(MESSAGE_TEMPLATES.REGISTRATION_CONFIRMED, variables),
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    }

    return sent;
  } catch (error: any) {
    logger.error({ error: error.message, jobId }, '[Workflow] Error sending registration confirmation');
    return false;
  }
}

/**
 * Handle AI response for new customers (not yet in database)
 * Uses upsert pattern to handle concurrent requests safely
 */
async function handleNewCustomerAiResponse(phone: string, messageText: string): Promise<void> {
  try {
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Use upsert to handle concurrent requests - won't fail on duplicate
    let customer;
    let isNewCustomer = false;
    
    try {
      // Try to create new customer first
      customer = await prisma.customer.create({
        data: {
          name: `Lead ${normalizedPhone.slice(-4)}`, // Temporary name
          phone: normalizedPhone,
          type: 'NEW',
          tags: ['WHATSAPP_LEAD'],
        },
      });
      isNewCustomer = true;
      logger.info({ phone, customerId: customer.id }, '[Workflow] New customer lead created');
    } catch (createError: any) {
      // If unique constraint violation (P2002), find existing customer with exact match
      if (createError.code === 'P2002') {
        customer = await prisma.customer.findUnique({
          where: { phone: normalizedPhone },
        });
        if (!customer) {
          // Edge case: still not found, something went wrong
          throw new Error('Customer not found after unique constraint error');
        }
        logger.info({ phone, customerId: customer.id }, '[Workflow] Found existing customer (concurrent request)');
      } else {
        throw createError; // Re-throw other errors
      }
    }

    // Log the incoming message
    await prisma.message.create({
      data: {
        customerId: customer.id,
        direction: 'INBOUND',
        content: messageText,
        status: 'RECEIVED',
        receivedAt: new Date(),
      },
    });

    // For concurrent requests (customer already exists), get conversation history
    // and generate contextual response instead of welcome message
    const previousMessages = isNewCustomer ? [] : (
      await prisma.message.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        skip: 1, // Skip the just-logged message
        take: 10,
      })
    ).reverse().map((m) => ({
      role: (m.direction === 'INBOUND' ? 'customer' : 'agent') as 'customer' | 'agent',
      content: m.content,
    }));

    // Generate AI response
    const aiResponse = await generateSalesResponse(messageText, {
      customerName: isNewCustomer ? undefined : customer.name,
      previousMessages,
      hasQuotation: false,
    });

    if (!aiResponse || aiResponse.startsWith('AI stub') || aiResponse.startsWith('AI provider error')) {
      logger.warn({ phone }, '[Workflow] AI response not available for new customer');
      return;
    }

    // Check WhatsApp connection
    const status = getConnectionStatus();
    if (status.status !== 'connected') {
      logger.warn({ status: status.status }, '[Workflow] WhatsApp not connected');
      return;
    }

    // Send response
    const chatId = phone.includes('@') ? phone : `${normalizedPhone}@s.whatsapp.net`;
    await sendMessageToChat(chatId, aiResponse);

    // Log the outgoing AI response
    await prisma.message.create({
      data: {
        customerId: customer.id,
        direction: 'OUTBOUND',
        content: aiResponse,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    logger.info({ phone, customerId: customer.id }, '[Workflow] AI welcome response sent to new customer');
  } catch (error: any) {
    logger.error({ error: error.message, phone }, '[Workflow] Error sending AI response to new customer');
  }
}

export { MESSAGE_TEMPLATES };
