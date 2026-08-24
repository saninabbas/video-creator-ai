import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { providerConcurrency } from './providerConcurrency.js';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface AssembleInput {
  clipPaths: string[];
  outputPath: string;
  thumbnailPath?: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
}

export interface AssemblyResult {
  outputPath: string;
  thumbnailPath?: string;
  durationSeconds: number;
  sizeBytes: number;
}

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  audioCodec?: string;
  sizeBytes: number;
}

export class VideoAssemblerService {
  /**
   * Combines individual generated scene video clips into a single finished MP4 with FFmpeg concurrency control.
   */
  public async assembleClips(input: AssembleInput): Promise<AssemblyResult> {
    return providerConcurrency.ffmpeg.run(async () => {
      console.log(`[VideoAssembler] Assembly started for ${input.clipPaths.length} clips -> ${input.outputPath}`);

    if (input.clipPaths.length === 0) {
      throw new Error('Cannot assemble: No video clips provided.');
    }

    const outDir = path.dirname(input.outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Write demuxer list
    const listFilePath = path.join(outDir, `concat_manifest_${Date.now()}.txt`);
    const manifestContent = input.clipPaths
      .map((p) => `file '${p.replace(/\\/g, '/')}'`)
      .join('\n');
    fs.writeFileSync(listFilePath, manifestContent, 'utf-8');

    const width = input.aspectRatio === '9:16' ? 720 : 1280;
    const height = input.aspectRatio === '9:16' ? 1280 : 720;

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-pix_fmt yuv420p',
          `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
          '-preset fast',
          '-crf 22',
        ])
        .output(input.outputPath)
        .on('end', () => {
          try {
            if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
          } catch (_) {}
          resolve();
        })
        .on('error', (err) => {
          console.error(`[VideoAssembler] FFmpeg error:`, err.message);
          reject(err);
        })
        .run();
    });

    if (input.thumbnailPath) {
      await this.generateThumbnail(input.outputPath, input.thumbnailPath);
    }

    const stats = fs.statSync(input.outputPath);
    console.log(`[VideoAssembler] Assembly completed: ${input.outputPath} (${stats.size} bytes)`);

      return {
        outputPath: input.outputPath,
        thumbnailPath: input.thumbnailPath,
        durationSeconds: 0,
        sizeBytes: stats.size,
      };
    });
  }

  public generateThumbnail(videoPath: string, thumbnailPath: string): Promise<string> {
    return new Promise((resolve) => {
      const dir = path.dirname(thumbnailPath);
      const filename = path.basename(thumbnailPath);

      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:01.000'],
          filename,
          folder: dir,
          size: '640x?',
        })
        .on('end', () => resolve(thumbnailPath))
        .on('error', (err) => {
          console.warn(`[VideoAssembler] Thumbnail extraction warning:`, err.message);
          resolve(thumbnailPath);
        });
    });
  }

  /**
   * Inspects video metadata directly via FFmpeg binary.
   */
  public probeVideo(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(videoPath)) {
        return reject(new Error(`Video file not found at: ${videoPath}`));
      }

      const sizeBytes = fs.statSync(videoPath).size;
      const ffmpegBin = ffmpegStatic || 'ffmpeg';

      execFile(ffmpegBin, ['-i', videoPath], (_err, _stdout, stderr) => {
        const output = (stderr || '').toString();

        let durationSeconds = 0;
        let width = 720;
        let height = 1280;
        let fps = 30;
        let codec = 'h264';
        let audioCodec: string | undefined = 'aac';

        // Parse Duration: 00:00:10.00
        const durMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
        if (durMatch) {
          const hours = parseFloat(durMatch[1]);
          const mins = parseFloat(durMatch[2]);
          const secs = parseFloat(durMatch[3]);
          durationSeconds = hours * 3600 + mins * 60 + secs;
        }

        // Parse Resolution: 720x1280 or 1280x720
        const resMatch = output.match(/(\d{3,4})x(\d{3,4})/);
        if (resMatch) {
          width = parseInt(resMatch[1], 10);
          height = parseInt(resMatch[2], 10);
        }

        // Parse FPS: 30 fps or 29.97 fps
        const fpsMatch = output.match(/(\d+(?:\.\d+)?)\s*fps/);
        if (fpsMatch) {
          fps = Math.round(parseFloat(fpsMatch[1]));
        }

        // Parse Video Codec: Video: h264
        const codecMatch = output.match(/Video:\s*(\w+)/);
        if (codecMatch) {
          codec = codecMatch[1];
        }

        // Parse Audio Codec: Audio: aac
        const audioMatch = output.match(/Audio:\s*(\w+)/);
        if (audioMatch) {
          audioCodec = audioMatch[1];
        }

        resolve({
          durationSeconds,
          width,
          height,
          fps,
          codec,
          audioCodec,
          sizeBytes,
        });
      });
    });
  }
}

export const videoAssemblerService = new VideoAssemblerService();
