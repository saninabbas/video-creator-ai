import { v4 as uuidv4 } from 'uuid';
import { geminiService, VideoPlan } from './gemini.js';
import { veoService } from './veo.js';
import { videoAssemblerService } from './videoAssembler.js';
import { storageService } from './storage.js';
import fs from 'fs';
import path from 'path';

export type JobStatus = 'queued' | 'planning' | 'generating' | 'processing' | 'completed' | 'failed';

export interface CreateVideoRequest {
  topic: string;
  videoType: 'short' | 'long';
  durationSeconds?: number;
  durationMinutes?: number;
  style: 'realistic' | 'cinematic' | 'documentary' | 'educational' | 'storytelling' | 'simple';
  customInstructions?: string;
}

export interface VideoJobRecord {
  id: string;
  topic: string;
  videoType: 'short' | 'long';
  durationSeconds: number;
  style: string;
  status: JobStatus;
  progress: number;
  plan?: VideoPlan;
  sceneFiles: string[];
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: {
    userMessage: string;
    internalError?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export class VideoPipelineManager {
  private jobs = new Map<string, VideoJobRecord>();

  public createJob(request: CreateVideoRequest): VideoJobRecord {
    const jobId = uuidv4();
    const durationSeconds =
      request.videoType === 'long'
        ? (request.durationMinutes || 8) * 60
        : request.durationSeconds || 30;

    const job: VideoJobRecord = {
      id: jobId,
      topic: request.topic,
      videoType: request.videoType,
      durationSeconds,
      style: request.style,
      status: 'queued',
      progress: 0,
      sceneFiles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);
    console.log(`[Pipeline] Job created: id="${jobId}" topic="${job.topic}" type="${job.videoType}" duration=${durationSeconds}s`);

    // Kick off asynchronous execution without blocking HTTP response
    this.runPipelineAsync(jobId, request);

    return job;
  }

  public getJob(jobId: string): VideoJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  public listJobs(): VideoJobRecord[] {
    return Array.from(this.jobs.values());
  }

  private async runPipelineAsync(jobId: string, request: CreateVideoRequest): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const updateStatus = (status: JobStatus, progress: number) => {
      job.status = status;
      job.progress = progress;
      job.updatedAt = new Date();
      console.log(`[Pipeline] Job ${jobId} -> status="${status}" progress=${progress}%`);
    };

    try {
      // 1. Planning with Gemini
      updateStatus('planning', 15);
      const plan = await geminiService.generateVideoPlan({
        topic: request.topic,
        videoType: request.videoType,
        durationMinutes: request.durationMinutes,
        durationSeconds: request.durationSeconds,
        style: request.style,
        customInstructions: request.customInstructions,
      });

      job.plan = plan;
      console.log(`[Pipeline] Plan generated: "${plan.title}" with ${plan.chapters.length} chapters`);

      // 2. Generating Scenes with Veo 3.1
      updateStatus('generating', 30);

      const allScenes = plan.chapters.flatMap((ch) => ch.scenes);
      const jobDir = storageService.getJobDir(jobId);
      const scenesDir = path.join(jobDir, 'scenes');
      if (!fs.existsSync(scenesDir)) fs.mkdirSync(scenesDir, { recursive: true });

      const sceneFilePaths: string[] = [];

      for (let i = 0; i < allScenes.length; i++) {
        const scene = allScenes[i];
        const sceneNum = scene.sceneNumber || i + 1;
        const sceneOutPath = path.join(scenesDir, `scene_${sceneNum}.mp4`);

        console.log(`[Pipeline] Generating scene ${i + 1}/${allScenes.length}: "${scene.visualPrompt.substring(0, 60)}..."`);

        // Scene generation with retry logic (Section 15)
        let sceneSuccess = false;
        let lastSceneErr: any = null;

        for (let retry = 0; retry < 2; retry++) {
          try {
            const sceneResult = await veoService.generateScene({
              prompt: scene.visualPrompt,
              aspectRatio: request.videoType === 'short' ? '9:16' : '16:9',
              resolution: '720p',
              durationSeconds: scene.durationSeconds,
              outputFilePath: sceneOutPath,
              onProgress: (statusText) => {
                const baseProgress = 30 + Math.round((i / allScenes.length) * 45);
                job.progress = baseProgress;
              },
            });
            sceneFilePaths.push(sceneResult.videoFilePath);
            sceneSuccess = true;
            break;
          } catch (err: any) {
            lastSceneErr = err;
            console.warn(`[Pipeline] Scene ${sceneNum} attempt ${retry + 1} failed:`, err.message);
            if (err.message?.includes('MISSING_CREDENTIALS')) throw err;
          }
        }

        if (!sceneSuccess) {
          throw new Error(`Scene ${sceneNum} generation failed: ${lastSceneErr?.message || 'Unknown error'}`);
        }

        const sceneProgress = 30 + Math.round(((i + 1) / allScenes.length) * 45);
        updateStatus('generating', sceneProgress);
      }

      job.sceneFiles = sceneFilePaths;

      // 3. Assembling Video Clips (Section 13)
      updateStatus('processing', 80);
      const finalMp4Path = path.join(jobDir, 'final_video.mp4');
      const thumbnailPath = path.join(jobDir, 'thumbnail.jpg');

      await videoAssemblerService.assembleClips({
        clipPaths: sceneFilePaths,
        outputPath: finalMp4Path,
        thumbnailPath,
        aspectRatio: request.videoType === 'short' ? '9:16' : '16:9',
      });

      // 4. Storing Assets (Section 7)
      const storedVideo = await storageService.uploadVideo(jobId, 'final_video.mp4', finalMp4Path);
      const storedThumb = await storageService.uploadVideo(jobId, 'thumbnail.jpg', thumbnailPath);

      job.videoUrl = storedVideo.url;
      job.thumbnailUrl = storedThumb.url;
      job.completedAt = new Date();

      updateStatus('completed', 100);
      console.log(`[Pipeline] Job ${jobId} completed successfully! Video URL: ${job.videoUrl}`);
    } catch (err: any) {
      console.error(`[Pipeline] Job ${jobId} failed:`, err.message);
      job.status = 'failed';
      job.updatedAt = new Date();
      job.error = {
        userMessage: "We couldn't finish generating your video. Please try again.",
        internalError: err.message || String(err),
      };
    }
  }
}

export const videoPipelineManager = new VideoPipelineManager();
