import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
import { VideoJob, JobStatus } from '../types/job.js';
import { CreateLongVideoOptions, geminiDirector } from '../ai/gemini/geminiDirector.js';
import { veoClient } from '../ai/veo/veoClient.js';
import { voiceService } from '../ai/voice/voiceService.js';
import { subtitleGenerator } from '../ai/assembly/subtitleGenerator.js';
import { videoAssembler } from '../ai/assembly/videoAssembler.js';
import { storageManager } from '../storage/localStorage.js';
import { Scene } from '../types/script.js';
import { config } from '../config/env.js';

export class LongVideoPipeline {
  /**
   * Executes the full 8-minute to 30-minute Long Video creation pipeline.
   */
  public async execute(
    options: CreateLongVideoOptions,
    onProgress?: (job: VideoJob) => void
  ): Promise<VideoJob> {
    const jobId = uuidv4();
    const targetSeconds = options.durationMinutes * 60;
    console.log(`[LongPipeline] Starting Long Video Job (${options.durationMinutes} min / ${targetSeconds}s): ${jobId}`);

    const job: VideoJob = {
      id: jobId,
      idea: options.idea,
      type: 'long',
      durationTargetSeconds: targetSeconds,
      style: options.style,
      platform: 'youtube_long',
      status: 'queued',
      userFacingStatus: 'Initiating your long-form video...',
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
      console.log(`[LongPipeline] [${job.id}] Status: ${status} (${progress}%) - "${userMessage}"`);
      onProgress?.(job);
    };

    try {
      // 1. Deep Planning & Scripting with Gemini AI Director
      updateStatus('planning', 'Directing documentary structure & chapters...', 10);
      const script = await geminiDirector.planLongVideo(options);
      job.script = script;
      storageManager.writeScriptJson(job.id, script);

      // 2. Scene Breakdown & Visual Bible
      updateStatus('scripting', 'Building Visual Bible & scene storyboard...', 20);
      const allScenes: Scene[] = script.chapters.flatMap((ch) => ch.scenes);
      job.scenesProgress = allScenes.map((s) => ({
        sceneNumber: s.sceneNumber,
        status: 'pending',
      }));

      // 3. Audio & Voice Narration
      updateStatus('generating', 'Synthesizing documentary voiceover...', 30);
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

      // 4. Multi-Scene Visual Generation (Controlled Concurrency with Veo 3.1)
      updateStatus('generating', 'Creating cinematic scenes with Veo 3.1...', 40);
      const limit = pLimit(config.MAX_CONCURRENT_VEO_JOBS);
      const sceneVideoPaths: string[] = new Array(allScenes.length);

      const tasks = allScenes.map((scene, idx) => {
        return limit(async () => {
          const sceneIndex = idx + 1;
          const sceneVideoPath = storageManager.getSceneVideoPath(job.id, scene.sceneNumber);
          job.scenesProgress[idx].status = 'generating';

          console.log(`[LongPipeline] Generating Scene ${sceneIndex}/${allScenes.length}: "${scene.title}" (${scene.visualType})`);

          try {
            if (config.GEMINI_API_KEY && config.GEMINI_API_KEY.length > 5) {
              const operation = await veoClient.startVideoGeneration({
                prompt: `${scene.veoPrompt}. Art Style: ${script.visualBible.artStyle}. Lighting: ${script.visualBible.lightingDirection}. Environment: ${script.visualBible.settingAndEnvironment}`,
                aspectRatio: '16:9',
                resolution: '720p',
                durationSeconds: scene.estimatedDurationSeconds,
              });
              job.scenesProgress[idx].operationName = operation.name;

              const completedOp = await veoClient.pollOperation(operation);
              await veoClient.downloadVideo(completedOp, sceneVideoPath);
            } else {
              await videoAssembler.generateTestSceneClip(
                sceneVideoPath,
                scene.estimatedDurationSeconds,
                '16:9',
                scene.title
              );
            }

            job.scenesProgress[idx].status = 'completed';
            job.scenesProgress[idx].videoPath = sceneVideoPath;
            sceneVideoPaths[idx] = sceneVideoPath;
          } catch (sceneErr: any) {
            console.error(`[LongPipeline] Scene ${scene.sceneNumber} generation failed:`, sceneErr.message);
            job.scenesProgress[idx].status = 'failed';
            job.scenesProgress[idx].error = sceneErr.message;
            // Generate fallback clip to ensure long video assembly succeeds
            await videoAssembler.generateTestSceneClip(
              sceneVideoPath,
              scene.estimatedDurationSeconds,
              '16:9',
              scene.title
            );
            sceneVideoPaths[idx] = sceneVideoPath;
          }

          const completedCount = job.scenesProgress.filter((s) => s.status === 'completed' || s.status === 'failed').length;
          const progressVal = 40 + Math.round((completedCount / allScenes.length) * 35);
          updateStatus('generating', `Generated ${completedCount} of ${allScenes.length} scenes...`, progressVal);
        });
      });

      await Promise.all(tasks);

      // 5. Subtitle Generation
      updateStatus('assembling', 'Generating chapter subtitles...', 80);
      const subtitlesPath = storageManager.getSubtitlesPath(job.id);
      subtitleGenerator.generateSrt(script, subtitlesPath);
      job.subtitlesPath = subtitlesPath;

      // 6. Video Assembly (FFmpeg 16:9 Concat & Audio Mux)
      updateStatus('assembling', 'Assembling master 16:9 video...', 85);
      const finalVideoPath = storageManager.getFinalVideoPath(job.id);
      const thumbnailPath = storageManager.getThumbnailPath(job.id);

      const assembled = await videoAssembler.assembleVideo({
        sceneVideoPaths,
        sceneAudioPaths,
        outputPath: finalVideoPath,
        thumbnailOutputPath: thumbnailPath,
        aspectRatio: '16:9',
        subtitlesPath,
      });

      job.outputVideoPath = assembled.videoPath;
      job.thumbnailPath = assembled.thumbnailPath;

      // 7. Quality Control Verification (Section 40)
      updateStatus('processing', 'Finishing your YouTube master package...', 95);
      if (assembled.metadata.durationSeconds <= 0 || assembled.metadata.sizeBytes <= 0) {
        throw new Error('Video quality check failed: invalid file output size or duration.');
      }

      // 8. Completed
      job.completedAt = new Date();
      updateStatus('completed', 'Your video is ready 🎉', 100);
      return job;
    } catch (err: any) {
      console.error(`[LongPipeline] Pipeline error for job ${job.id}:`, err);
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

export const longVideoPipeline = new LongVideoPipeline();
