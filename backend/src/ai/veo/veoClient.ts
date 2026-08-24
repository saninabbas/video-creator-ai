import { getGenAIClient } from '../gemini/geminiClient.js';
import { config } from '../../config/env.js';
import { AspectRatio } from '../../types/script.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

export interface VeoGenerateOptions {
  prompt: string;
  aspectRatio: AspectRatio;
  resolution?: '720p' | '1080p';
  durationSeconds?: number;
  seed?: number;
  imagePromptPath?: string;
}

export interface VeoGenerationResult {
  operationName: string;
  videoUrl?: string;
  localVideoPath?: string;
  durationSeconds?: number;
}

export class VeoClient {
  private client = getGenAIClient();

  /**
   * Starts a Veo 3.1 video generation operation.
   */
  public async startVideoGeneration(options: VeoGenerateOptions): Promise<any> {
    console.log(`[VeoClient] Submitting video generation job. Model: ${config.VEO_MODEL}, AspectRatio: ${options.aspectRatio}`);
    console.log(`[VeoClient] Prompt: "${options.prompt.substring(0, 100)}..."`);

    try {
      const operation = await (this.client.models as any).generateVideos({
        model: config.VEO_MODEL,
        prompt: options.prompt,
        config: {
          aspectRatio: options.aspectRatio,
          resolution: options.resolution || '720p',
        },
      });

      console.log(`[VeoClient] Video generation started. Operation Name: ${operation.name}`);
      return operation;
    } catch (err: any) {
      console.error(`[VeoClient] Error starting Veo video generation:`, err.message || err);
      throw err;
    }
  }

  /**
   * Polls a Veo operation until completion or timeout.
   */
  public async pollOperation(
    operation: any,
    onProgress?: (status: string) => void
  ): Promise<any> {
    let currentOp = operation;
    const startTime = Date.now();
    const pollInterval = config.VEO_POLL_INTERVAL_MS;
    const maxPollTime = config.VEO_MAX_POLL_TIME_MS;

    while (!currentOp.done) {
      if (Date.now() - startTime > maxPollTime) {
        throw new Error(`Veo generation timed out after ${maxPollTime / 1000}s`);
      }

      onProgress?.('Generating scene visuals with Veo 3.1...');
      console.log(`[VeoClient] Polling operation: ${currentOp.name} (elapsed: ${Math.round((Date.now() - startTime) / 1000)}s)`);

      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      try {
        currentOp = await (this.client.operations as any).getVideosOperation(currentOp.name);
      } catch (err: any) {
        console.warn(`[VeoClient] Polling check failed, retrying in next cycle:`, err.message);
      }
    }

    if (currentOp.error) {
      throw new Error(`Veo generation failed: ${JSON.stringify(currentOp.error)}`);
    }

    return currentOp;
  }

  /**
   * Downloads the generated video from the operation response to a local file.
   */
  public async downloadVideo(operationResult: any, targetPath: string): Promise<string> {
    const generatedVideos = operationResult.response?.generatedVideos || [];
    if (generatedVideos.length === 0) {
      throw new Error('No generated videos found in Veo operation result.');
    }

    const videoObj = generatedVideos[0].video;
    console.log(`[VeoClient] Downloading generated video asset to: ${targetPath}`);

    // If SDK provides download method
    if (videoObj && typeof (this.client.files as any)?.download === 'function') {
      try {
        const buffer = await (this.client.files as any).download({ file: videoObj });
        fs.writeFileSync(targetPath, Buffer.from(buffer));
        console.log(`[VeoClient] Successfully saved video to: ${targetPath}`);
        return targetPath;
      } catch (err: any) {
        console.warn(`[VeoClient] SDK files.download failed, attempting direct URI download...`, err.message);
      }
    }

    // If video object has URI or uri property
    const videoUri = typeof videoObj === 'string' ? videoObj : videoObj?.uri || videoObj?.url;
    if (videoUri && (videoUri.startsWith('http://') || videoUri.startsWith('https://'))) {
      await this.downloadHttpFile(videoUri, targetPath);
      return targetPath;
    }

    // If videoObj has base64 data
    if (videoObj?.videoBytes) {
      const buffer = Buffer.from(videoObj.videoBytes, 'base64');
      fs.writeFileSync(targetPath, buffer);
      return targetPath;
    }

    throw new Error('Unable to extract video data from Veo response.');
  }

  private downloadHttpFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      const getter = url.startsWith('https') ? https.get : http.get;
      getter(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download video, HTTP status ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve());
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
  }
}

export const veoClient = new VeoClient();
