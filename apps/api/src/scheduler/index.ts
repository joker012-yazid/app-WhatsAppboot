import { startBackupScheduler } from './backups';
import { startReminderScheduler } from './reminders';

let initialized = false;

export async function initSchedulers() {
  if (initialized) {
    console.log('[scheduler] init already called, skipping');
    return;
  }
  initialized = true;
  console.log('[scheduler] initializing background schedulers');
  startReminderScheduler();
  await startBackupScheduler();
}
