import { config } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load .env from workspace; then fallback to repo root if needed
config();
if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
  const rootEnv = path.resolve(process.cwd(), '../../.env');
  config({ path: rootEnv });
}

// Duration format: number followed by unit (ms, s, m, h, d)
// Examples: "15m", "7d", "30s", "1h", "500ms"
const durationRegex = /^\d+(ms|s|m|h|d)$/i;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .regex(/^\d+$/)
    .default('4000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  ACCESS_TOKEN_TTL: z
    .string()
    .regex(durationRegex, 'ACCESS_TOKEN_TTL must be in format: <number>(ms|s|m|h|d), e.g., "15m" or "1h"')
    .default('15m'),
  REFRESH_TOKEN_TTL: z
    .string()
    .regex(durationRegex, 'REFRESH_TOKEN_TTL must be in format: <number>(ms|s|m|h|d), e.g., "7d" or "30d"')
    .default('7d'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
});

const env = envSchema.parse(process.env);

export default env;
