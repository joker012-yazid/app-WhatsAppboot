import prisma from '../lib/prisma';
import { enqueueReminder } from '../queues';

const DAY_MS = 24 * 60 * 60 * 1000;

let reminderInterval: NodeJS.Timeout | null = null;
let sweepRunning = false;

export async function scheduleQuoteReminders() {
  const quoted = await prisma.jobStatusHistory.findMany({
    where: { status: 'QUOTED' },
    orderBy: { createdAt: 'desc' },
  });

  const now = Date.now();
  let enqueued = 0;
  for (const h of quoted) {
    const ageDays = Math.floor((now - new Date(h.createdAt).getTime()) / DAY_MS);
    const existing = await prisma.reminder.findMany({ where: { jobId: h.jobId } });
    const kinds = new Set(existing.map((r) => r.kind));
    if (ageDays >= 1 && !kinds.has('QUOTE_DAY_1')) {
      await enqueueReminder(h.jobId, 'QUOTE_DAY_1', 0);
      enqueued += 1;
    }
    if (ageDays >= 20 && !kinds.has('QUOTE_DAY_20')) {
      await enqueueReminder(h.jobId, 'QUOTE_DAY_20', 0);
      enqueued += 1;
    }
    if (ageDays >= 30 && !kinds.has('QUOTE_DAY_30')) {
      await enqueueReminder(h.jobId, 'QUOTE_DAY_30', 0);
      enqueued += 1;
    }
  }
  return enqueued;
}

async function runReminderSweep() {
  if (sweepRunning) {
    console.log('[scheduler] reminder sweep skipped - already running');
    return;
  }
  sweepRunning = true;
  const start = Date.now();
  try {
    const enqueued = await scheduleQuoteReminders();
    console.log('[scheduler] reminder sweep complete', { enqueued, durationMs: Date.now() - start });
  } catch (error) {
    console.error('[scheduler] reminder error', error);
  } finally {
    sweepRunning = false;
  }
}

export function startReminderScheduler() {
  if (reminderInterval) {
    console.log('[scheduler] reminder scheduler already active');
    return;
  }
  reminderInterval = setInterval(() => {
    runReminderSweep().catch((error) => console.error('[scheduler] reminder interval error', error));
  }, 60 * 60 * 1000);
  runReminderSweep().catch((error) => console.error('[scheduler] reminder bootstrap error', error));
}

