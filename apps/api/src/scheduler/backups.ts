import cron from 'node-cron';

import { createBackup } from '../services/backup';
import { getSetting } from '../services/settings';

let task: cron.ScheduledTask | null = null;

const schedule = async () => {
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
      createBackup({ manual: false })
        .then((result) => console.log(`[backup] automated backup created: ${result.filename}`))
        .catch((error) => console.error('[backup] automated backup failed', error));
    },
    {
      timezone: 'Asia/Kuala_Lumpur',
    },
  );
  console.log(`[backup] scheduler active (cron: ${cronExpression})`);
};

export const startBackupScheduler = async () => {
  try {
    await schedule();
  } catch (error) {
    console.error('[backup] failed to start scheduler', error);
  }
};

export const restartBackupScheduler = async () => {
  try {
    await schedule();
  } catch (error) {
    console.error('[backup] failed to restart scheduler', error);
  }
};
