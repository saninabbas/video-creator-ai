import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.string().default('3000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  VEO_MODEL: z.string().default('veo-3.1-generate-preview'),
  STORAGE_DIR: z.string().default('./storage/media'),
  MAX_CONCURRENT_VEO_JOBS: z.string().default('2').transform((v) => parseInt(v, 10)),
  VEO_POLL_INTERVAL_MS: z.string().default('10000').transform((v) => parseInt(v, 10)),
  VEO_MAX_POLL_TIME_MS: z.string().default('300000').transform((v) => parseInt(v, 10)),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const config: EnvConfig = envSchema.parse(process.env);
