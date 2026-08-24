import { v4 as uuidv4 } from 'uuid';
import { VideoJob, JobStatus } from '../types/job.js';
import { CreateShortOptions, geminiDirector } from '../ai/gemini/geminiDirector.js';
import { veoClient } from '../ai/veo/veoClient.js';
import { voiceService } from '../ai/voice/voiceService.js';
import { subtitleGenerator } from '../ai/assembly/subtitleGenerator.js';
import { videoAssembler } from '../ai/assembly/videoAssembler.js';
import { storageManager } from '../storage/localStorage.js';
import { Scene } from '../types/script.js';
import { config } from '../config/env.js';

export class ShortVideoPipeline {
  /**
   * Executes the full Short video creation pipeline.
   */
  public async execute(
    options: CreateShortOptions,
    onProgress?: (job: VideoJob) => void
  ): Promise<VideoJob> {
    const jobId = uuidv4();
    console.log(`[ShortPipeline] Starting Short Video Job: ${jobId}`);

    const job: VideoJob = {
      id: jobId,
      idea: options.idea,
      type: 'short',
      durationTargetSeconds: options.durationSeconds,
      style: options.style,
      platform: options.platform,
      status: 'queued',
      userFacingStatus: 'Starting your video...',
      progressPercent: 5,
      scenesProgress: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updateStatus = (status: JobStatus, userMessage: string, progress: number) => {
      job.status = status;
      job.userFacingStatus = userMessage;
      job.progressPercent = progress;
      job.updatedAt = new Date();
      console.log(`[ShortPipeline] [${job.id}] Status: ${status} (${progress}%) - "${userMessage}"`);
      onProgress?.(job);
    };

    try {
      // 1. Planning with Gemini AI Director
      updateStatus('planning', 'Understanding your idea...', 15);
      const script = await geminiDirector.planShortVideo(options);
      job.script = script;
      storageManager.writeScriptJson(job.id, script);

      // 2. Scripting & Visual Bible Confirmation
      updateStatus('scripting', 'Writing script & planning scenes...', 25);
      const allScenes: Scene[] = script.chapters.flatMap((ch) => ch.scenes);
      job.scenesProgress = allScenes.map((s) => ({
        sceneNumber: s.sceneNumber,
        status: 'pending',
      }));

      // 3. Audio & Voice Narration Generation
      updateStatus('generating', 'Synthesizing voice narration...', 40);
      const sceneAudioPaths: string[] = [];
      for (const scene of allScenes) {
        const audioPath = storageManager.getSceneAudioPath(job.id, scene.sceneNumber);
        await voiceService.generateNarration(
          scene.narration,
          audioPath,
          scene.estimatedDurationSeconds
        );
        sceneAudioPaths.push(audioPath);
      }

      // 4. Scene Visual Generation (Veo 3.1)
      updateStatus('generating', 'Creating visuals with Veo 3.1...', 50);
      const sceneVideoPaths: string[] = [];

      for (let i = 0; i < allScenes.length; i++) {
        const scene = allScenes[i];
        const sceneIndex = i + 1;
        const sceneVideoPath = storageManager.getSceneVideoPath(job.id, scene.sceneNumber);
        job.scenesProgress[i].status = 'generating';

        console.log(`[ShortPipeline] Generating Scene ${sceneIndex}/${allScenes.length}: "${scene.title}"`);

        try {
          if (config.GEMINI_API_KEY && config.GEMINI_API_KEY.length > 5) {
            // Real Veo 3.1 generation
            const operation = await veoClient.startVideoGeneration({
              prompt: `${scene.veoPrompt}. Consistent style: ${script.visualBible.artStyle}, ${script.visualBible.lightingDirection}`,
              aspectRatio: '9:16',
              resolution: '720p',
              durationSeconds: scene.estimatedDurationSeconds,
            });
            job.scenesProgress[i].operationName = operation.name;

            const completedOp = await veoClient.pollOperation(operation, (msg) => {
              updateStatus('generating', `Creating scene ${sceneIndex} of ${allScenes.length}...`, 50 + Math.round((i / allScenes.length) * 25));
            });

            await veoClient.downloadVideo(completedOp, sceneVideoPath);
          } else {
            // Test generator mode for local testing without active API key
            console.log(`[ShortPipeline] Generating test clip for scene ${scene.sceneNumber} (${scene.estimatedDurationSeconds}s)`);
            await videoAssembler.generateTestSceneClip(
              sceneVideoPath,
              scene.estimatedDurationSeconds,
              '9:16',
              scene.title
            );
          }

          job.scenesProgress[i].status = 'completed';
          job.scenesProgress[i].videoPath = sceneVideoPath;
          sceneVideoPaths.push(sceneVideoPath);
        } catch (sceneErr: any) {
          console.error(`[ShortPipeline] Error on scene ${scene.sceneNumber}:`, sceneErr.message);
          job.scenesProgress[i].status = 'failed';
          job.scenesProgress[i].error = sceneErr.message;
          // Fallback test clip to prevent single scene failure from halting assembly
          await videoAssembler.generateTestSceneClip(
            sceneVideoPath,
            scene.estimatedDurationSeconds,
            '9:16',
            `Scene ${scene.sceneNumber}`
          );
          sceneVideoPaths.push(sceneVideoPath);
        }

        const sceneProgress = 50 + Math.round(((i + 1) / allScenes.length) * 25);
        updateStatus('generating', `Finished visuals for scene ${sceneIndex}/${allScenes.length}`, sceneProgress);
      }

      // 5. Subtitle Generation
      updateStatus('assembling', 'Generating synchronized captions...', 80);
      const subtitlesPath = storageManager.getSubtitlesPath(job.id);
      subtitleGenerator.generateSrt(script, subtitlesPath);
      job.subtitlesPath = subtitlesPath;

      // 6. Video Assembly (FFmpeg)
      updateStatus('assembling', 'Assembling final Short video...', 85);
      const finalVideoPath = storageManager.getFinalVideoPath(job.id);
      const thumbnailPath = storageManager.getThumbnailPath(job.id);

      const assembled = await videoAssembler.assembleVideo({
        sceneVideoPaths,
        sceneAudioPaths,
        outputPath: finalVideoPath,
        thumbnailOutputPath: thumbnailPath,
        aspectRatio: '9:16',
        subtitlesPath,
      });

      job.outputVideoPath = assembled.videoPath;
      job.thumbnailPath = assembled.thumbnailPath;

      // 7. Quality Control Verification (Section 40)
      updateStatus('processing', 'Finishing your video...', 95);
      if (assembled.metadata.durationSeconds <= 0 || assembled.metadata.sizeBytes <= 0) {
        throw new Error('Video quality check failed: invalid file output size or duration.');
      }

      // 8. Completed
      job.completedAt = new Date();
      updateStatus('completed', 'Your video is ready 🎉', 100);
      return job;
    } catch (err: any) {
      console.error(`[ShortPipeline] Pipeline error for job ${job.id}:`, err);
      job.status = 'failed';
      job.userFacingStatus = "We couldn't finish this video. Please try again.";
      job.error = {
        userMessage: "We couldn't finish this video. Please try again.",
        internalError: err.message || String(err),
      };
      job.updatedAt = new Date();
      onProgress?.(job);
      return job;
    }
  }
}

export const shortVideoPipeline = new ShortVideoPipeline();
