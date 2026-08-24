import { Router, Request, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { videoService } from '../services/videoService.js';
import { jobQueue } from '../services/jobQueue.js';
import { geminiDirector } from '../ai/gemini/geminiDirector.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { generationLimiter } from '../security/rateLimiter.js';
import { db } from '../database/connection.js';
import { validateAndSanitizeDuration } from '../config/credits.js';
import { config } from '../config/env.js';

export const videoRouter = Router();
videoRouter.use(requireAuth);

const createVideoSchema = z.object({
  topic: z.string().min(3, 'Topic must be at least 3 characters long.').max(500),
  videoType: z.enum(['short', 'long']).default('short'),
  durationSeconds: z.number().int().optional(),
  durationMinutes: z.number().int().optional(),
  style: z.enum(['realistic', 'cinematic', 'documentary', 'educational', 'storytelling', 'simple']).default('cinematic'),
  projectId: z.string().optional(),
  customInstructions: z.string().max(1000).optional(),
});

/**
 * POST /api/videos/create
 * Initiates video generation, enforces server-side duration limits & pricing, deducts credits, and returns queued job ID.
 */
videoRouter.post(['/create', '/'], generationLimiter.middleware(10), async (req: Request, res: Response) => {
  try {
    const validated = createVideoSchema.parse(req.body);

    // Hard Generation Limits & Duration Pricing Validation (Tasks 1, 2, 3)
    const durationCheck = validateAndSanitizeDuration(
      validated.videoType,
      validated.durationSeconds,
      validated.durationMinutes
    );

    if (!durationCheck.valid) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DURATION',
          message: durationCheck.error || 'Invalid video duration specified.',
        },
      });
    }

    const enqueued = await jobQueue.enqueue({
      userId: req.user!.id,
      projectId: validated.projectId,
      topic: validated.topic,
      videoType: validated.videoType,
      durationSeconds: durationCheck.durationSeconds,
      style: validated.style,
      customInstructions: validated.customInstructions,
    });

    res.status(202).json({
      success: true,
      message: 'Video generation started.',
      jobId: enqueued.jobId,
      videoId: enqueued.videoId,
      status: enqueued.status,
      creditsDebited: durationCheck.creditCost,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.errors[0]?.message } });
    }
    if (err.message?.includes('INSUFFICIENT_CREDITS')) {
      return res.status(402).json({
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: "You don't have enough credits for this video creation.",
        },
      });
    }
    if (err.message?.includes('INVALID_DURATION')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DURATION',
          message: err.message,
        },
      });
    }
    console.error('[VideoRoutes] Create video error:', err);
    res.status(500).json({ error: { code: 'CREATION_FAILED', message: 'Failed to start video generation.' } });
  }
});

/**
 * GET /api/videos
 */
videoRouter.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const videos = await videoService.getUserVideos(req.user!.id, limit);
    res.json({ videos });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'FETCH_ERROR', message: 'Failed to retrieve videos.' } });
  }
});

/**
 * GET /api/videos/:id
 */
videoRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const videoId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const video = await videoService.getVideoById(req.user!.id, videoId);

    if (!video) {
      return res.status(404).json({ error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found.' } });
    }

    const scenes = await videoService.getVideoScenes(videoId);
    const videoData = { ...video, scenes };
    res.json({
      success: true,
      video: videoData,
      data: videoData,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'FETCH_ERROR', message: 'Failed to fetch video.' } });
  }
});

/**
 * GET /api/videos/:id/stream (Task 9 - Authenticated Media Streaming & IDOR Protection)
 */
videoRouter.get('/:id/stream', async (req: Request, res: Response) => {
  try {
    const videoId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    // Ownership check: only owner can stream
    const video = await videoService.getVideoById(req.user!.id, videoId);

    if (!video) {
      return res.status(404).json({ error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found or access denied.' } });
    }

    if (!video.videoUrl) {
      return res.status(400).json({ error: { code: 'MEDIA_NOT_READY', message: 'Video has not finished processing yet.' } });
    }

    // Resolve file path safely
    const cleanRelative = video.videoUrl.replace(/^\/media\//, '').replace(/^media\//, '');
    const absolutePath = path.resolve(config.STORAGE_DIR, cleanRelative);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'Underlying media file was not found on disk.' } });
    }

    res.sendFile(absolutePath);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'STREAM_ERROR', message: 'Failed to stream video.' } });
  }
});

/**
 * GET /api/videos/:id/status
 */
videoRouter.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const videoId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const video = await videoService.getVideoById(req.user!.id, videoId);

    if (!video) {
      return res.status(404).json({ error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found.' } });
    }

    const job = await db.queryOne<any>(
      'SELECT * FROM video_jobs WHERE video_id = $1 ORDER BY created_at DESC LIMIT 1',
      [videoId]
    );

    const scenes = await videoService.getVideoScenes(videoId);

    res.json({
      id: video.id,
      type: video.type,
      title: video.title,
      status: job?.status || video.status,
      progress: job?.progress || (video.status === 'completed' ? 100 : 0),
      currentStep: job?.current_step || 'Processing...',
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      scenes,
      error: job?.status === 'failed' ? "We couldn't finish generating this video." : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'STATUS_ERROR', message: 'Failed to fetch status.' } });
  }
});

/**
 * POST /api/videos/:id/improve
 */
videoRouter.post('/:id/improve', async (req: Request, res: Response) => {
  try {
    const videoId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const video = await videoService.getVideoById(req.user!.id, videoId);

    if (!video) {
      return res.status(404).json({ error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found.' } });
    }

    const project = video.projectId ? await db.queryOne<any>('SELECT script_json FROM projects WHERE id = $1', [video.projectId]) : null;
    const script = project?.script_json ? JSON.parse(project.script_json) : null;

    if (!script) {
      return res.status(400).json({ error: { code: 'SCRIPT_NOT_FOUND', message: 'No script found for this video.' } });
    }

    const improvements = await geminiDirector.analyzeAndImprove(script);
    res.json({
      message: `${improvements.length} improvements found.`,
      improvements,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'IMPROVE_ERROR', message: 'Failed to analyze improvements.' } });
  }
});

/**
 * POST /api/videos/:id/create-shorts
 */
videoRouter.post('/:id/create-shorts', async (req: Request, res: Response) => {
  try {
    const videoId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const count = parseInt(String(req.body.count || '5'), 10);
    const video = await videoService.getVideoById(req.user!.id, videoId);

    if (!video) {
      return res.status(404).json({ error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found.' } });
    }

    const project = video.projectId ? await db.queryOne<any>('SELECT script_json FROM projects WHERE id = $1', [video.projectId]) : null;
    const script = project?.script_json ? JSON.parse(project.script_json) : null;

    if (!script) {
      return res.status(400).json({ error: { code: 'SCRIPT_NOT_FOUND', message: 'No script found for this video.' } });
    }

    const moments = await geminiDirector.extractShortMoments(script, count);
    res.json({
      message: `${moments.length} short-form moments found.`,
      moments,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'EXTRACT_SHORTS_ERROR', message: 'Failed to extract short moments.' } });
  }
});

/**
 * DELETE /api/videos/:id
 */
videoRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const videoId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await videoService.deleteVideo(req.user!.id, videoId);

    if (!deleted) {
      return res.status(404).json({ error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found.' } });
    }

    res.json({ message: 'Video deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'DELETE_ERROR', message: 'Failed to delete video.' } });
  }
});
