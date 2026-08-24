import { z } from 'zod';
import { VideoScript } from './script.js';

export const JobStatusEnum = z.enum([
  'queued',
  'planning',
  'scripting',
  'generating',
  'assembling',
  'processing',
  'completed',
  'failed',
]);
export type JobStatus = z.infer<typeof JobStatusEnum>;

export interface SceneGenerationProgress {
  sceneNumber: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  operationName?: string;
  videoPath?: string;
  durationSeconds?: number;
  error?: string;
}

export interface VideoJob {
  id: string;
  idea: string;
  type: 'short' | 'long';
  durationTargetSeconds: number;
  style: string;
  platform: string;
  status: JobStatus;
  userFacingStatus: string;
  progressPercent: number;
  script?: VideoScript;
  scenesProgress: SceneGenerationProgress[];
  outputVideoPath?: string;
  thumbnailPath?: string;
  subtitlesPath?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: {
    userMessage: string;
    internalError: string;
  };
}
