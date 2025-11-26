"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const node_path_1 = __importDefault(require("node:path"));
const zod_1 = require("zod");
// Load .env from workspace; then fallback to repo root if needed
(0, dotenv_1.config)();
if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
    const rootEnv = node_path_1.default.resolve(process.cwd(), '../../.env');
    (0, dotenv_1.config)({ path: rootEnv });
}
// Duration format: number followed by unit (ms, s, m, h, d)
// Examples: "15m", "7d", "30s", "1h", "500ms"
const durationRegex = /^\d+(ms|s|m|h|d)$/i;
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z
        .string()
        .regex(/^\d+$/)
        .default('4000'),
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: zod_1.z.string().min(1, 'REDIS_URL is required'),
    JWT_ACCESS_SECRET: zod_1.z.string().min(1, 'JWT_ACCESS_SECRET is required'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(1, 'JWT_REFRESH_SECRET is required'),
    ACCESS_TOKEN_TTL: zod_1.z
        .string()
        .regex(durationRegex, 'ACCESS_TOKEN_TTL must be in format: <number>(ms|s|m|h|d), e.g., "15m" or "1h"')
        .default('15m'),
    REFRESH_TOKEN_TTL: zod_1.z
        .string()
        .regex(durationRegex, 'REFRESH_TOKEN_TTL must be in format: <number>(ms|s|m|h|d), e.g., "7d" or "30d"')
        .default('7d'),
    OPENAI_API_KEY: zod_1.z.string().optional(),
    OPENAI_BASE_URL: zod_1.z.string().optional(),
});
const env = envSchema.parse(process.env);
exports.default = env;
