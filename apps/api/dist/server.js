"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const env_1 = __importDefault(require("./config/env"));
const app_1 = require("./app");
const reminders_1 = require("./scheduler/reminders");
const app = (0, app_1.createApp)();
const server = (0, http_1.createServer)(app);
const port = Number(env_1.default.PORT);
server.listen(port, () => {
    console.log(`API listening on port ${port}`);
});
// Start background schedulers & queues
(0, reminders_1.startReminderScheduler)();
const shutdown = (signal) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
