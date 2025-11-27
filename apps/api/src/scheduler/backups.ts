import cron from 'node-cron';

import { createBackup } from '../services/backup';
import { getSetting } from '../services/settings';

let task: cron.ScheduledTask | null = null;
let isRunningBackup = false;

const runBackup = async () => {
  if (isRunningBackup) {
    console.log('[backup] run skipped - already in progress');
    return;
  }
  isRunningBackup = true;
  const start = Date.now();
  try {
    const result = await createBackup({ manual: false });
    console.log('[backup] automated backup created', { filename: result.filename, durationMs: Date.now() - start });
  } catch (error) {
    console.error('[backup] automated backup failed', error);
  } finally {
    isRunningBackup = false;
  }
};

const schedule = async () => {
  try {
    const backupSettings = await getSetting('backup');
    const [hour, minute] = backupSettings.schedule.split(':').map((value) => Number(value));
    const cronExpression = `0 ${Number.isFinite(minute) ? minute : 0} ${Number.isFinite(hour) ? hour : 2} * * *`;
    if (task) {
      task.stop();
      task.destroy();
      task = null;
    }
    task = cron.schedule(
      cronExpression,
      () => {
        runBackup().catch((error) => console.error('[backup] scheduled run error', error));
      },
      {
        timezone: 'Asia/Kuala_Lumpur',
      },
    );
    console.log(`[backup] scheduler active (cron: ${cronExpression})`);
  } catch (error) {
    console.error('[backup] failed to schedule backup', error);
    throw error;
  }
};

export const startBackupScheduler = async () => {
  try {
    await schedule();
  } catch (error) {
    console.error('[backup] failed to start scheduler', error);
    // Don't throw - allow server to start even if backup scheduler fails
  }
};

export const restartBackupScheduler = async () => {
  try {
    await schedule();
  } catch (error) {
    console.error('[backup] failed to restart scheduler', error);
  }
};
