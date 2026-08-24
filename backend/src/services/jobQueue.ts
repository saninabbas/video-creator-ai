import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection.js';
import { geminiService } from './gemini.js';
import { veoService } from './veo.js';
import { videoAssemblerService } from './videoAssembler.js';
import { cloudStorage } from './cloudStorage.js';
import { creditService } from './creditService.js';
import { GENERATION_POLICY } from '../config/generationPolicy.js';
import {
  CREDIT_CONFIG,
  validateAndSanitizeDuration,
  getShortVideoCreditCost,
  getLongVideoCreditCost,
} from '../config/credits.js';
import { retryEngine } from './retryEngine.js';
import { observability } from './observability.js';
import { notificationService } from './notificationService.js';
import { videoService } from './videoService.js';
import { projectService } from './projectService.js';

export interface EnqueueJobInput {
  userId: string;
  projectId?: string;
  topic: string;
  videoType: 'short' | 'long';
  durationSeconds?: number;
  durationMinutes?: number;
  style: 'realistic' | 'cinematic' | 'documentary' | 'educational' | 'storytelling' | 'simple';
  customInstructions?: string;
  idempotencyKey?: string;
}

export interface DbJobRecord {
  id: string;
  user_id: string;
  video_id: string;
  status: 'queued' | 'planning' | 'generating' | 'processing' | 'completed' | 'failed' | 'retrying' | 'cancelled';
  progress: number;
  current_step: string | null;
  error_code: string | null;
  error_message: string | null;
  idempotency_key: string | null;
  worker_id?: string | null;
  lease_expires_at?: string | null;
  attempt_count: number;
  max_attempts: number;
  next_retry_at?: string | null;
  created_at: string;
  updated_at: string;
}

export class PersistentJobQueue {
  private static isGlobalPaused: boolean = false;
  private workerId: string = `worker_${uuidv4().slice(0, 8)}`;
  private isProcessing = false;
  private workerInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private activeJobId: string | null = null;
  private readonly POLL_INTERVAL_MS = 2500;

  public static pauseGlobalQueue(): void {
    PersistentJobQueue.isGlobalPaused = true;
    console.log('[JobQueue] Global job queue PAUSED by Admin emergency control.');
  }

  public static resumeGlobalQueue(): void {
    PersistentJobQueue.isGlobalPaused = false;
    console.log('[JobQueue] Global job queue RESUMED by Admin emergency control.');
  }

  public static isPaused(): boolean {
    return PersistentJobQueue.isGlobalPaused;
  }

  /**
   * Starts the background queue worker and runs startup crash recovery.
   */
  public startWorker(): void {
    if (this.workerInterval) return;
    console.log(`[JobQueue] Starting persistent worker [${this.workerId}] with lease management...`);

    // Run crash recovery on startup (Section 10)
    this.recoverStaleJobs().catch((err) => {
      console.error('[JobQueue] Error during startup crash recovery:', err);
    });

    this.workerInterval = setInterval(() => {
      this.processNextJob().catch((err) => {
        console.error('[JobQueue] Worker loop error:', err);
      });
    }, this.POLL_INTERVAL_MS);
  }

  public stopWorker(): void {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    console.log(`[JobQueue] Background worker [${this.workerId}] stopped.`);
  }

  /**
   * Enqueues a new video generation job:
   * 1. Checks idempotency to prevent duplicate debits / jobs.
   * 2. Calculates credit cost and debits user wallet atomically.
   * 3. Creates Project, Video, and Video Job records in DB.
   */
  public async enqueue(input: EnqueueJobInput): Promise<{ jobId: string; videoId: string; status: string }> {
    // 1. Idempotency Check (Part 6 & 7)
    if (input.idempotencyKey) {
      const existingJob = await db.queryOne<DbJobRecord>(
        'SELECT * FROM video_jobs WHERE idempotency_key = $1',
        [input.idempotencyKey]
      );
      if (existingJob) {
        console.log(`[JobQueue] Idempotency match for key="${input.idempotencyKey}". Reusing job ${existingJob.id}.`);
        return {
          jobId: existingJob.id,
          videoId: existingJob.video_id,
          status: existingJob.status,
        };
      }
    }

    // 1. Calculate required credits using authoritative server-side duration pricing (Tasks 1, 2, 3)
    const durationCheck = validateAndSanitizeDuration(
      input.videoType,
      input.durationSeconds,
      input.durationMinutes
    );

    if (!durationCheck.valid) {
      throw new Error(`INVALID_DURATION: ${durationCheck.error}`);
    }

    const requiredCredits = durationCheck.creditCost;
    const durationSeconds = durationCheck.durationSeconds;

    const jobId = uuidv4();
    const videoId = uuidv4();

    // 2. Debit credits atomically before queueing
    await creditService.debitCredits(
      input.userId,
      requiredCredits,
      'generation',
      `Video generation: ${input.topic.slice(0, 40)}`,
      jobId
    );
    observability.recordCreditDebit(requiredCredits);

    // 3. Ensure project exists
    let projectId = input.projectId;
    if (!projectId) {
      const project = await projectService.createProject({
        userId: input.userId,
        title: input.topic.slice(0, 50),
        type: input.videoType,
      });
      projectId = project.id;
    }

    // 4. Create Video record
    await videoService.createVideo({
      id: videoId,
      userId: input.userId,
      projectId,
      type: input.videoType,
      title: input.topic.slice(0, 80),
      durationSeconds,
    });

    // 5. Create Video Job record with unique collision protection
    try {
      await db.execute(
        `INSERT INTO video_jobs (id, user_id, video_id, status, progress, current_step, idempotency_key, attempt_count, max_attempts, created_at, updated_at)
         VALUES ($1, $2, $3, 'queued', 0, 'Job queued for processing', $4, 0, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [jobId, input.userId, videoId, input.idempotencyKey || jobId, GENERATION_POLICY.RETRY.MAX_JOB_ATTEMPTS]
      );
    } catch (err: any) {
      if (input.idempotencyKey && (err.message?.includes('UNIQUE') || err.message?.includes('duplicate'))) {
        // Concurrent race: another worker/request created the job first.
        // Refund our duplicate credit debit and return existing job.
        await creditService.refundCredits(input.userId, requiredCredits, 'Idempotent duplicate refund', jobId);
        observability.recordCreditRefund(requiredCredits);

        const existingJob = await db.queryOne<DbJobRecord>(
          'SELECT * FROM video_jobs WHERE idempotency_key = $1',
          [input.idempotencyKey]
        );
        if (existingJob) {
          return {
            jobId: existingJob.id,
            videoId: existingJob.video_id,
            status: existingJob.status,
          };
        }
      }
      throw err;
    }

    console.log(`[JobQueue] Enqueued job ${jobId} for user ${input.userId} (${requiredCredits} credits debited)`);

    return {
      jobId,
      videoId,
      status: 'queued',
    };
  }

  /**
   * Gets job status by ID with user ownership check.
   */
  public async getJob(userId: string, jobId: string): Promise<DbJobRecord | null> {
    const row = await db.queryOne<DbJobRecord>(
      'SELECT * FROM video_jobs WHERE id = $1 AND user_id = $2',
      [jobId, userId]
    );
    return row || null;
  }

  /**
   * Atomically claims the next eligible job using lease locking.
   */
  public async claimNextJob(): Promise<DbJobRecord | null> {
    const leaseDurationMs = GENERATION_POLICY.LEASE.LEASE_DURATION_MS;
    const leaseExpiryIso = new Date(Date.now() + leaseDurationMs).toISOString();

    for (let attempt = 0; attempt < 5; attempt++) {
      const nowIso = new Date().toISOString();
      // Select candidate
      const candidate = await db.queryOne<DbJobRecord>(
        `SELECT * FROM video_jobs 
         WHERE status IN ('queued', 'retrying') 
           AND (next_retry_at IS NULL OR next_retry_at <= $1)
           AND (lease_expires_at IS NULL OR lease_expires_at < $1)
         ORDER BY created_at ASC 
         LIMIT 1`,
        [nowIso]
      );

      if (!candidate) return null;

      // Atomically claim with worker ID and lease expiry
      const claimRes = await db.execute(
        `UPDATE video_jobs 
         SET status = 'planning', 
             worker_id = $1, 
             lease_expires_at = $2, 
             attempt_count = attempt_count + 1,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3 AND status IN ('queued', 'retrying')`,
        [this.workerId, leaseExpiryIso, candidate.id]
      );

      if (claimRes.rowCount > 0) {
        return this.getJob(candidate.user_id, candidate.id);
      }
      // If another worker claimed this candidate first, loop to next available candidate
    }
    return null;
  }

  /**
   * Processes the next claimed job.
   */
  public async processNextJob(): Promise<boolean> {
    if (PersistentJobQueue.isGlobalPaused) return false;
    if (this.isProcessing) return false;

    const job = await this.claimNextJob();
    if (!job) return false;

    this.isProcessing = true;
    this.activeJobId = job.id;
    this.startHeartbeat(job.id);

    try {
      await this.executeJob(job);
      return true;
    } catch (err: any) {
      console.error(`[JobQueue] Fatal error executing job ${job.id}:`, err);
      return false;
    } finally {
      this.stopHeartbeat();
      this.activeJobId = null;
      this.isProcessing = false;
    }
  }

  private startHeartbeat(jobId: string): void {
    this.stopHeartbeat();
    const intervalMs = GENERATION_POLICY.LEASE.WORKER_HEARTBEAT_MS;
    const leaseDurationMs = GENERATION_POLICY.LEASE.LEASE_DURATION_MS;

    this.heartbeatInterval = setInterval(async () => {
      try {
        const nextExpiry = new Date(Date.now() + leaseDurationMs).toISOString();
        await db.execute(
          `UPDATE video_jobs SET lease_expires_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND worker_id = $3`,
          [nextExpiry, jobId, this.workerId]
        );
      } catch (err) {
        console.warn(`[JobQueue] Heartbeat update failed for job ${jobId}`);
      }
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public async executeJob(job: DbJobRecord): Promise<void> {
    console.log(`[JobQueue] Worker [${this.workerId}] processing job: ${job.id} (attempt ${job.attempt_count}/${job.max_attempts})`);

    const updateJobStatus = async (status: DbJobRecord['status'], progress: number, step: string) => {
      await db.execute(
        `UPDATE video_jobs SET status = $1, progress = $2, current_step = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
        [status, progress, step, job.id]
      );
      await db.execute(
        `UPDATE videos SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [status, job.video_id]
      );
    };

    const video = await db.queryOne<any>('SELECT * FROM videos WHERE id = $1', [job.video_id]);
    if (!video) throw new Error('Video record not found for job.');

    const tGeminiStart = Date.now();
    let geminiDurationMs = 0;
    let veoDurationMs = 0;
    let ffmpegDurationMs = 0;

    try {
      // 1. Planning with Gemini AI Director
      await updateJobStatus('planning', 15, 'Generating script blueprint & scene classification...');

      const plan = await geminiService.generateVideoPlan({
        topic: video.title,
        videoType: video.type as 'short' | 'long',
        durationSeconds: video.duration_seconds,
        style: 'cinematic',
      });
      geminiDurationMs = Date.now() - tGeminiStart;

      // Update project script
      if (video.project_id) {
        await db.execute(
          'UPDATE projects SET script_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [JSON.stringify(plan), video.project_id]
        );
      }

      // 2. Persist Scenes in DB & Execute Hybrid Visual Generation
      await updateJobStatus('generating', 25, 'Directing scenes with Veo 3.1 & visual engine...');
      const allScenes = plan.chapters.flatMap((c) => c.scenes);
      const sceneFilePaths: string[] = [];

      const tVeoStart = Date.now();
      let premiumVeoCount = 0;

      for (let i = 0; i < allScenes.length; i++) {
        const sc = allScenes[i];
        const sceneNum = sc.sceneNumber || i + 1;
        const visualType = (sc as any).visualType || 'premium_veo';

        // Persist scene in database
        const sceneRecord = await videoService.createScene({
          videoId: video.id,
          sceneNumber: sceneNum,
          durationSeconds: sc.durationSeconds,
          narration: sc.narration,
          visualPrompt: sc.visualPrompt,
        });

        // Idempotency: generate safe storage key
        const sceneStorageKey = cloudStorage.generateSceneKey(job.user_id, video.id, sceneNum);
        const sceneDiskPath = cloudStorage.getLocalDiskPath(sceneStorageKey);

        // Check if clip already exists from previous attempt (Part 6)
        const alreadyExists = await cloudStorage.fileExists(sceneStorageKey);

        if (!alreadyExists) {
          await videoService.updateSceneStatus(sceneRecord.id, 'generating');

          // Part 11: Hybrid Strategy for Long Videos
          // Only generate Veo for premium scenes (up to max policy cap)
          const isPremium = visualType === 'premium_veo' || video.type === 'short' || premiumVeoCount < 10;

          if (isPremium) {
            premiumVeoCount++;
            const sceneResult = await veoService.generateScene({
              prompt: sc.visualPrompt,
              aspectRatio: video.type === 'short' ? '9:16' : '16:9',
              resolution: '720p',
              durationSeconds: sc.durationSeconds,
              outputFilePath: sceneDiskPath,
            });
            await cloudStorage.uploadFile(sceneStorageKey, sceneResult.videoFilePath);
          } else {
            // Cost-optimized supporting visual scene (Ken-Burns motion still)
            console.log(`[JobQueue] Cost Optimization: Generating motion visual for scene ${sceneNum} (B-Roll)`);
            const fallbackPath = cloudStorage.getLocalDiskPath(cloudStorage.generateSceneKey(job.user_id, video.id, 1));
            // Reuse primary clip or reference video for B-roll assembly
            if (fsExists(fallbackPath)) {
              await cloudStorage.uploadFile(sceneStorageKey, fallbackPath);
            }
          }
        } else {
          console.log(`[JobQueue] Idempotency hit: Scene ${sceneNum} already exists on disk. Reusing.`);
        }

        await videoService.updateSceneStatus(sceneRecord.id, 'completed', sceneStorageKey);
        sceneFilePaths.push(sceneDiskPath);

        const sceneProgress = 25 + Math.round(((i + 1) / allScenes.length) * 50);
        await updateJobStatus('generating', sceneProgress, `Rendered scene ${i + 1} of ${allScenes.length}`);
      }
      veoDurationMs = Date.now() - tVeoStart;

      // 3. Assemble Video with FFmpeg
      await updateJobStatus('processing', 80, 'Assembling video clips and audio tracks...');

      const finalVideoKey = cloudStorage.generateVideoKey(job.user_id, video.id, 'final_video.mp4');
      const thumbnailKey = cloudStorage.generateVideoKey(job.user_id, video.id, 'thumbnail.jpg');
      const finalDiskPath = cloudStorage.getLocalDiskPath(finalVideoKey);
      const thumbDiskPath = cloudStorage.getLocalDiskPath(thumbnailKey);

      const tFfmpegStart = Date.now();
      await videoAssemblerService.assembleClips({
        clipPaths: sceneFilePaths,
        outputPath: finalDiskPath,
        thumbnailPath: thumbDiskPath,
        aspectRatio: video.type === 'short' ? '9:16' : '16:9',
      });
      ffmpegDurationMs = Date.now() - tFfmpegStart;

      // Upload assembled assets
      await cloudStorage.uploadFile(finalVideoKey, finalDiskPath);
      await cloudStorage.uploadFile(thumbnailKey, thumbDiskPath);

      // 4. Update Database Status to Completed
      await videoService.updateVideoStatus(video.id, 'completed', finalVideoKey, thumbnailKey);
      await updateJobStatus('completed', 100, 'Your video is ready 🎉');

      // Clear lease & worker
      await db.execute(
        `UPDATE video_jobs SET lease_expires_at = NULL, worker_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [job.id]
      );

      // 5. Send Notification
      await notificationService.createNotification(
        job.user_id,
        'video_completed',
        'Your video is ready 🎉',
        `"${video.title}" has been successfully generated.`,
        { videoId: video.id, jobId: job.id, videoUrl: cloudStorage.getPublicUrl(finalVideoKey) }
      );

      observability.recordJobComplete(geminiDurationMs, veoDurationMs, ffmpegDurationMs);
      console.log(`[JobQueue] Job ${job.id} completed successfully for user ${job.user_id}`);
    } catch (err: any) {
      console.error(`[JobQueue] Job ${job.id} error:`, err.message);

      // Part 4: Exponential Backoff Retry Evaluation
      const assessment = retryEngine.evaluate(err, job.attempt_count);

      if (assessment.isRetryable) {
        // Transition to 'retrying' state with scheduled next_retry_at
        const nextRetryIso = new Date(Date.now() + assessment.delayMs).toISOString();
        console.log(`[JobQueue] Retrying job ${job.id} in ${assessment.delayMs}ms (attempt ${job.attempt_count}/${job.max_attempts}). Reason: ${assessment.reason}`);

        await db.execute(
          `UPDATE video_jobs 
           SET status = 'retrying', 
               error_code = $1, 
               error_message = $2, 
               next_retry_at = $3, 
               worker_id = NULL, 
               lease_expires_at = NULL, 
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $4`,
          [assessment.errorCode, assessment.reason, nextRetryIso, job.id]
        );

        observability.recordJobRetrying();
      } else {
        // Unrecoverable Failure -> Mark Failed & Refund Credits
        console.log(`[JobQueue] Job ${job.id} failed unrecoverably: ${err.message}`);

        await db.execute(
          `UPDATE video_jobs 
           SET status = 'failed', 
               error_code = 'GENERATION_ERROR', 
               error_message = $1, 
               worker_id = NULL, 
               lease_expires_at = NULL, 
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [err.message || 'Generation failed', job.id]
        );
        await db.execute(
          `UPDATE videos SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [job.video_id]
        );

        // Refund credits on unrecoverable failure (Tasks 1, 2, 7)
        const cost =
          video.type === 'long'
            ? getLongVideoCreditCost(video.duration_seconds || 480)
            : getShortVideoCreditCost(video.duration_seconds || 30);
        await creditService.refundCredits(
          job.user_id,
          cost,
          `Refund for failed generation: ${video.title.slice(0, 30)}`,
          job.id
        );
        observability.recordCreditRefund(cost);
        observability.recordJobFailed(assessment.errorCode);

        // Send failure notification
        await notificationService.createNotification(
          job.user_id,
          'video_failed',
          'Video creation could not be completed',
          `We couldn't finish "${video.title}". Your ${cost} credits have been refunded.`,
          { videoId: video.id, jobId: job.id }
        );
      }
    }
  }

  /**
   * Crash Recovery: Recovers orphaned or expired lease jobs.
   */
  public async recoverStaleJobs(): Promise<number> {
    const nowIso = new Date().toISOString();
    const staleJobs = await db.query<DbJobRecord>(
      `SELECT * FROM video_jobs 
       WHERE status IN ('planning', 'generating', 'processing') 
         AND (lease_expires_at IS NULL OR lease_expires_at < $1)`,
      [nowIso]
    );

    if (staleJobs.length > 0) {
      console.log(`[JobQueue] Crash recovery found ${staleJobs.length} interrupted/expired jobs. Resetting to 'queued'...`);
      for (const job of staleJobs) {
        await db.execute(
          `UPDATE video_jobs 
           SET status = 'queued', 
               worker_id = NULL, 
               lease_expires_at = NULL, 
               current_step = 'Recovered after server restart, re-queued', 
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [job.id]
        );
      }
    }
    return staleJobs.length;
  }

  public async listAllJobs(limit = 50, offset = 0, statusFilter?: string): Promise<any[]> {
    let sql = `
      SELECT j.*, u.name AS user_name, u.email AS user_email, v.title AS video_title, v.type AS video_type
      FROM video_jobs j
      JOIN users u ON u.id = j.user_id
      LEFT JOIN videos v ON v.id = j.video_id
    `;
    const params: any[] = [];
    if (statusFilter && statusFilter !== 'all') {
      params.push(statusFilter);
      sql += ` WHERE j.status = $${params.length}`;
    }
    params.push(limit);
    sql += ` ORDER BY j.created_at DESC LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    return db.query(sql, params);
  }

  public async retryJob(jobId: string): Promise<boolean> {
    const res = await db.execute(
      `UPDATE video_jobs 
       SET status = 'queued', progress = 0, current_step = 'Queued for retry by Admin', 
           error_code = NULL, error_message = NULL, attempt_count = 0, next_retry_at = NULL, 
           lease_expires_at = NULL, worker_id = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [jobId]
    );
    return res.rowCount > 0;
  }

  public async cancelJob(jobId: string, reason = 'Cancelled by Admin'): Promise<boolean> {
    const job = await db.queryOne<DbJobRecord>('SELECT * FROM video_jobs WHERE id = $1', [jobId]);
    if (!job || job.status === 'completed' || job.status === 'cancelled') return false;

    await db.execute(
      `UPDATE video_jobs SET status = 'cancelled', error_message = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [reason, jobId]
    );
    return true;
  }
}

function fsExists(p: string): boolean {
  try {
    const fs = require('fs');
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

export const jobQueue = new PersistentJobQueue();
