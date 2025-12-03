"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleQuoteReminders = scheduleQuoteReminders;
exports.startReminderScheduler = startReminderScheduler;
const prisma_1 = __importDefault(require("../lib/prisma"));
const queues_1 = require("../queues");
const DAY_MS = 24 * 60 * 60 * 1000;
let reminderInterval = null;
let sweepRunning = false;
async function scheduleQuoteReminders() {
    const quoted = await prisma_1.default.jobStatusHistory.findMany({
        where: { status: 'QUOTED' },
        orderBy: { createdAt: 'desc' },
    });
    const now = Date.now();
    let enqueued = 0;
    for (const h of quoted) {
        const ageDays = Math.floor((now - new Date(h.createdAt).getTime()) / DAY_MS);
        const existing = await prisma_1.default.reminder.findMany({ where: { jobId: h.jobId } });
        const kinds = new Set(existing.map((r) => r.kind));
        if (ageDays >= 1 && !kinds.has('QUOTE_DAY_1')) {
            await (0, queues_1.enqueueReminder)(h.jobId, 'QUOTE_DAY_1', 0);
            enqueued += 1;
        }
        if (ageDays >= 20 && !kinds.has('QUOTE_DAY_20')) {
            await (0, queues_1.enqueueReminder)(h.jobId, 'QUOTE_DAY_20', 0);
            enqueued += 1;
        }
        if (ageDays >= 30 && !kinds.has('QUOTE_DAY_30')) {
            await (0, queues_1.enqueueReminder)(h.jobId, 'QUOTE_DAY_30', 0);
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
    }
    catch (error) {
        console.error('[scheduler] reminder error', error);
    }
    finally {
        sweepRunning = false;
    }
}
function startReminderScheduler() {
    if (reminderInterval) {
        console.log('[scheduler] reminder scheduler already active');
        return;
    }
    reminderInterval = setInterval(() => {
        runReminderSweep().catch((error) => console.error('[scheduler] reminder interval error', error));
    }, 60 * 60 * 1000);
    runReminderSweep().catch((error) => console.error('[scheduler] reminder bootstrap error', error));
}
