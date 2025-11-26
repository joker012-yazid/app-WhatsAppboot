"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const prisma_1 = __importDefault(require("./lib/prisma"));
const env_1 = __importDefault(require("./config/env"));
const app_1 = require("./app");
const reminders_1 = require("./scheduler/reminders");
const backups_1 = require("./scheduler/backups");
const app = (0, app_1.createApp)();
const server = (0, http_1.createServer)(app);
const port = Number(env_1.default.PORT);
// Ensure database connection before starting server
prisma_1.default.$connect()
    .then(() => {
    server.listen(port, () => {
        console.log(`API listening on port ${port}`);
    });
    // Start background schedulers & queues after database is connected
    (0, reminders_1.startReminderScheduler)();
    (0, backups_1.startBackupScheduler)().catch((error) => console.error('[backup] scheduler error', error));
})
    .catch((error) => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
});
const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(async () => {
        try {
            await prisma_1.default.$disconnect();
            console.log('Database connection closed');
        }
        catch (error) {
            console.error('Error closing database connection:', error);
        }
        process.exit(0);
    });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
