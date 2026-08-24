import fs from 'fs';
import { VideoScript, Scene } from '../../types/script.js';

export class SubtitleGenerator {
  /**
   * Generates a standard SRT format subtitle file from a VideoScript.
   */
  public generateSrt(script: VideoScript, outputPath: string): string {
    let srtIndex = 1;
    let srtContent = '';

    const allScenes: Scene[] = [];
    for (const chapter of script.chapters) {
      for (const scene of chapter.scenes) {
        allScenes.push(scene);
      }
    }

    for (const scene of allScenes) {
      if (!scene.narration || scene.narration.trim().length === 0) continue;

      const startTime = this.formatSrtTimestamp(scene.timestampStartSeconds);
      const endTime = this.formatSrtTimestamp(scene.timestampEndSeconds);

      // Split narration into short 5-8 word chunks for social retention
      const words = scene.narration.trim().split(/\s+/);
      const chunkSize = 6;
      const chunks: string[] = [];
      for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
      }

      const totalDuration = scene.timestampEndSeconds - scene.timestampStartSeconds;
      const chunkDuration = totalDuration / Math.max(1, chunks.length);

      for (let c = 0; c < chunks.length; c++) {
        const cStart = scene.timestampStartSeconds + c * chunkDuration;
        const cEnd = scene.timestampStartSeconds + (c + 1) * chunkDuration;

        srtContent += `${srtIndex}\n`;
        srtContent += `${this.formatSrtTimestamp(cStart)} --> ${this.formatSrtTimestamp(cEnd)}\n`;
        srtContent += `${chunks[c]}\n\n`;
        srtIndex++;
      }
    }

    fs.writeFileSync(outputPath, srtContent, 'utf-8');
    console.log(`[SubtitleGenerator] Generated SRT subtitles at: ${outputPath}`);
    return outputPath;
  }

  private formatSrtTimestamp(seconds: number): string {
    const totalMs = Math.round(seconds * 1000);
    const hrs = Math.floor(totalMs / 3600000);
    const mins = Math.floor((totalMs % 3600000) / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }
}

export const subtitleGenerator = new SubtitleGenerator();
