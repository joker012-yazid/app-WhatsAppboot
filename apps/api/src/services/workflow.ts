/**
 * Workflow Automation Service
 * 
 * Handles automatic WhatsApp message sending based on job status changes
 * and customer response detection for the repair workflow.
 */

import prisma from '../lib/prisma';
import { sendMessageToChat, getConnectionStatus } from '../whatsapp/whatsapp.service';
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

    // Find customer by phone
    const customer = await prisma.customer.findFirst({
      where: {
        phone: {
          contains: normalizedPhone,
        },
      },
    });

    if (!customer) {
      logger.info({ phone }, '[Workflow] Customer not found for incoming message');
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

    if (!job) {
      logger.info({ customerId: customer.id }, '[Workflow] No pending quotation found');
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
      logger.info({ text }, '[Workflow] Message does not contain approval/rejection keywords');
    }

    // Log incoming message
    await prisma.message.create({
      data: {
        customerId: customer.id,
        direction: 'INBOUND',
        content: messageText,
        status: 'RECEIVED',
        receivedAt: new Date(),
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message, phone }, '[Workflow] Error handling customer response');
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

export { MESSAGE_TEMPLATES };
