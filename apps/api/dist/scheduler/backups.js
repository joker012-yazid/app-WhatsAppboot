"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restartBackupScheduler = exports.startBackupScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const backup_1 = require("../services/backup");
const settings_1 = require("../services/settings");
let task = null;
let isRunningBackup = false;
const runBackup = async () => {
    if (isRunningBackup) {
        console.log('[backup] run skipped - already in progress');
        return;
    }
    isRunningBackup = true;
    const start = Date.now();
    try {
        const result = await (0, backup_1.createBackup)({ manual: false });
        console.log('[backup] automated backup created', { filename: result.filename, durationMs: Date.now() - start });
    }
    catch (error) {
        console.error('[backup] automated backup failed', error);
    }
    finally {
        isRunningBackup = false;
    }
};
const schedule = async () => {
    try {
        const backupSettings = await (0, settings_1.getSetting)('backup');
        const [hour, minute] = backupSettings.schedule.split(':').map((value) => Number(value));
        const cronExpression = `0 ${Number.isFinite(minute) ? minute : 0} ${Number.isFinite(hour) ? hour : 2} * * *`;
        if (task) {
            task.stop();
            task = null;
        }
        task = node_cron_1.default.schedule(cronExpression, () => {
            runBackup().catch((error) => console.error('[backup] scheduled run error', error));
        }, {
            timezone: 'Asia/Kuala_Lumpur',
        });
        console.log(`[backup] scheduler active (cron: ${cronExpression})`);
    }
    catch (error) {
        console.error('[backup] failed to schedule backup', error);
        throw error;
    }
};
const startBackupScheduler = async () => {
    try {
        await schedule();
    }
    catch (error) {
        console.error('[backup] failed to start scheduler', error);
        // Don't throw - allow server to start even if backup scheduler fails
    }
};
exports.startBackupScheduler = startBackupScheduler;
const restartBackupScheduler = async () => {
    try {
        await schedule();
    }
    catch (error) {
        console.error('[backup] failed to restart scheduler', error);
    }
};
exports.restartBackupScheduler = restartBackupScheduler;
