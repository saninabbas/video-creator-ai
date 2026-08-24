import { config } from './env.js';

export interface VideoTypePolicy {
  aspectRatio: '9:16' | '16:9';
  allowedDurations: number[]; // in seconds or minutes
  resolution: '720p' | '1080p';
  maxVeoSeconds: number; // Upper bound of Veo footage generated
  maxRetriesPerScene: number;
  providerTimeoutMs: number;
  creditCost: number;
  hybridStrategy: boolean;
}

export const GENERATION_POLICY = {
  SHORT: {
    aspectRatio: '9:16' as const,
    allowedDurations: [15, 30, 60, 90], // seconds
    resolution: '720p' as const,
    maxVeoSeconds: 60, // capped to preserve quotas
    maxRetriesPerScene: 3,
    providerTimeoutMs: 180000, // 3 minutes
    creditCost: 10,
    hybridStrategy: false, // 100% video footage for shorts
  },
  LONG: {
    aspectRatio: '16:9' as const,
    allowedDurations: [8, 10, 15, 20, 30], // minutes
    resolution: '720p' as const,
    maxVeoSeconds: 60, // e.g. 10-12 key premium scenes (5s each = 50-60s Veo total)
    maxRetriesPerScene: 3,
    providerTimeoutMs: 300000, // 5 minutes
    creditCost: 50,
    hybridStrategy: true, // Hybrid: Premium Veo + B-Roll/Motion Visuals + Narration
  },
  CONCURRENCY: {
    MAX_GEMINI: parseInt(process.env.MAX_GEMINI_CONCURRENCY || '10', 10),
    MAX_VEO: parseInt(process.env.MAX_VEO_CONCURRENCY || '4', 10),
    MAX_VOICE: parseInt(process.env.MAX_VOICE_CONCURRENCY || '8', 10),
    MAX_FFMPEG: parseInt(process.env.MAX_FFMPEG_CONCURRENCY || '2', 10),
  },
  RETRY: {
    MAX_JOB_ATTEMPTS: 3,
    BASE_DELAY_MS: 3000,
    MAX_DELAY_MS: 30000,
    JITTER_RATIO: 0.2, // +/- 20% random jitter to prevent thundering herds
  },
  LEASE: {
    WORKER_HEARTBEAT_MS: 5000,
    LEASE_DURATION_MS: 60000, // 60s lease before considered dead
  }
};
