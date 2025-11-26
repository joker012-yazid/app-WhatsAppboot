import { config } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load .env from workspace; then fallback to repo root if needed
config();
if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
  const rootEnv = path.resolve(process.cwd(), '../../.env');
  config({ path: rootEnv });
}

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
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d')
});

const env = envSchema.parse(process.env);

export default env;
