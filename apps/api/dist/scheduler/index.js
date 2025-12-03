"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSchedulers = initSchedulers;
const backups_1 = require("./backups");
const reminders_1 = require("./reminders");
let initialized = false;
async function initSchedulers() {
    if (initialized) {
        console.log('[scheduler] init already called, skipping');
        return;
    }
    initialized = true;
    console.log('[scheduler] initializing background schedulers');
    (0, reminders_1.startReminderScheduler)();
    await (0, backups_1.startBackupScheduler)();
}
