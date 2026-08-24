import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { providerConcurrency } from './providerConcurrency.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

export interface GenerateSceneOptions {
  prompt: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution?: '720p' | '1080p';
  durationSeconds?: number;
  outputFilePath: string;
  onProgress?: (status: string, elapsedSec: number) => void;
}

export interface VeoSceneResult {
  operationName: string;
  videoFilePath: string;
  fileSizeBytes: number;
  durationSeconds?: number;
}

export class VeoService {
  private clientInstance: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error(
        'MISSING_CREDENTIALS: GEMINI_API_KEY is not set. Please add a valid Google Gemini API Key to your .env file or environment.'
      );
    }
    if (!this.clientInstance) {
      this.clientInstance = new GoogleGenAI({ apiKey });
    }
    return this.clientInstance;
  }

  /**
   * Generates a single video scene using Google Veo 3.1 API with concurrency control.
   */
  public async generateScene(options: GenerateSceneOptions): Promise<VeoSceneResult> {
    return providerConcurrency.veo.run(async () => {
      console.log(`[VeoService] Scene generation started. Model="${config.VEO_MODEL}", AspectRatio="${options.aspectRatio}"`);
      console.log(`[VeoService] Visual Prompt: "${options.prompt}"`);

      const client = this.getClient();

    // 1. Submit asynchronous generation request
    let operation: any;
    try {
      operation = await (client.models as any).generateVideos({
        model: config.VEO_MODEL,
        prompt: options.prompt,
        config: {
          aspectRatio: options.aspectRatio,
          resolution: options.resolution || '720p',
        },
      });
      console.log(`[VeoService] Veo operation created: ${operation.name}`);
    } catch (err: any) {
      console.error(`[VeoService] Failed to initiate Veo video generation:`, err.message || err);
      throw new Error(`Veo request failed: ${err.message || String(err)}`);
    }

    // 2. Poll operation until complete
    const pollInterval = config.VEO_POLL_INTERVAL_MS;
    const maxPollTime = config.VEO_MAX_POLL_TIME_MS;
    const startTime = Date.now();

    let currentOp = operation;

    while (!currentOp.done) {
      const elapsedMs = Date.now() - startTime;
      const elapsedSec = Math.round(elapsedMs / 1000);

      if (elapsedMs > maxPollTime) {
        throw new Error(`Veo generation timed out after ${elapsedSec} seconds.`);
      }

      console.log(`[VeoService] Polling operation: ${currentOp.name} (${elapsedSec}s elapsed)...`);
      options.onProgress?.(`Rendering scene visuals with Veo 3.1 (${elapsedSec}s)...`, elapsedSec);

      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      try {
        currentOp = await (client.operations as any).getVideosOperation(currentOp.name);
      } catch (pollErr: any) {
        console.warn(`[VeoService] Polling cycle warning, will retry next interval:`, pollErr.message);
      }
    }

    // 3. Handle failure
    if (currentOp.error) {
      console.error(`[VeoService] Veo operation failed:`, currentOp.error);
      throw new Error(`Veo generation operation reported error: ${JSON.stringify(currentOp.error)}`);
    }

    console.log(`[VeoService] Veo operation completed successfully: ${currentOp.name}`);

    // 4. Download and store video
    const generatedVideos = currentOp.response?.generatedVideos || [];
    if (generatedVideos.length === 0) {
      throw new Error('Veo completed but returned no generated video assets.');
    }

    const videoObj = generatedVideos[0].video;
    await this.saveVideoToFile(client, videoObj, options.outputFilePath);

    const stats = fs.statSync(options.outputFilePath);
    console.log(`[VeoService] Video downloaded and stored at: ${options.outputFilePath} (${stats.size} bytes)`);

      return {
        operationName: currentOp.name,
        videoFilePath: options.outputFilePath,
        fileSizeBytes: stats.size,
      };
    });
  }

  private async saveVideoToFile(client: GoogleGenAI, videoObj: any, destPath: string): Promise<void> {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // SDK file download method
    if (videoObj && typeof (client.files as any)?.download === 'function') {
      try {
        const buffer = await (client.files as any).download({ file: videoObj });
        fs.writeFileSync(destPath, Buffer.from(buffer));
        return;
      } catch (err: any) {
        console.warn(`[VeoService] SDK files.download failed, falling back to direct URI download:`, err.message);
      }
    }

    // URL download
    const url = typeof videoObj === 'string' ? videoObj : videoObj?.uri || videoObj?.url;
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await this.downloadHttpFile(url, destPath);
      return;
    }

    // Base64 bytes
    if (videoObj?.videoBytes) {
      const buffer = Buffer.from(videoObj.videoBytes, 'base64');
      fs.writeFileSync(destPath, buffer);
      return;
    }

    throw new Error('Unable to extract video binary from Veo response object.');
  }

  private downloadHttpFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      const getter = url.startsWith('https') ? https.get : http.get;
      getter(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download video, HTTP ${res.statusCode}`));
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

export const veoService = new VeoService();
