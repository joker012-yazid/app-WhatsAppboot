import prisma from '../lib/prisma';
import { enqueueReminder } from '../queues';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function scheduleQuoteReminders() {
  // Find jobs that have QUOTED status in history and no reminders sent yet for each threshold
  const quoted = await prisma.jobStatusHistory.findMany({
    where: { status: 'QUOTED' },
    orderBy: { createdAt: 'desc' },
  });

  const now = Date.now();
  for (const h of quoted) {
    const ageDays = Math.floor((now - new Date(h.createdAt).getTime()) / DAY_MS);
    const existing = await prisma.reminder.findMany({ where: { jobId: h.jobId } });
    const kinds = new Set(existing.map((r) => r.kind));
    if (ageDays >= 1 && !kinds.has('QUOTE_DAY_1')) {
      await enqueueReminder(h.jobId, 'QUOTE_DAY_1', 0);
    }
    if (ageDays >= 20 && !kinds.has('QUOTE_DAY_20')) {
      await enqueueReminder(h.jobId, 'QUOTE_DAY_20', 0);
    }
    if (ageDays >= 30 && !kinds.has('QUOTE_DAY_30')) {
      await enqueueReminder(h.jobId, 'QUOTE_DAY_30', 0);
    }
  }
}

export function startReminderScheduler() {
  // Run every hour
  setInterval(() => {
    scheduleQuoteReminders().catch((e) => console.error('[scheduler] reminder error', e));
  }, 60 * 60 * 1000);
  // Kick once on boot (non-blocking)
  scheduleQuoteReminders().catch(() => undefined);
}

