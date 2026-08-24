import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';

export class LocalStorageManager {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = path.resolve(customBaseDir || config.STORAGE_DIR);
    this.ensureDirectoryExists(this.baseDir);
  }

  public getJobDir(jobId: string): string {
    const jobDir = path.join(this.baseDir, jobId);
    this.ensureDirectoryExists(jobDir);
    return jobDir;
  }

  public getScenesDir(jobId: string): string {
    const scenesDir = path.join(this.getJobDir(jobId), 'scenes');
    this.ensureDirectoryExists(scenesDir);
    return scenesDir;
  }

  public getAudioDir(jobId: string): string {
    const audioDir = path.join(this.getJobDir(jobId), 'audio');
    this.ensureDirectoryExists(audioDir);
    return audioDir;
  }

  public getSceneVideoPath(jobId: string, sceneNumber: number): string {
    return path.join(this.getScenesDir(jobId), `scene_${sceneNumber}.mp4`);
  }

  public getSceneAudioPath(jobId: string, sceneNumber: number): string {
    return path.join(this.getAudioDir(jobId), `scene_${sceneNumber}.mp3`);
  }

  public getFullAudioPath(jobId: string): string {
    return path.join(this.getAudioDir(jobId), `full_narration.mp3`);
  }

  public getSubtitlesPath(jobId: string): string {
    return path.join(this.getJobDir(jobId), `subtitles.srt`);
  }

  public getFinalVideoPath(jobId: string): string {
    return path.join(this.getJobDir(jobId), `final_video.mp4`);
  }

  public getThumbnailPath(jobId: string): string {
    return path.join(this.getJobDir(jobId), `thumbnail.jpg`);
  }

  public getScriptJsonPath(jobId: string): string {
    return path.join(this.getJobDir(jobId), `script.json`);
  }

  public writeScriptJson(jobId: string, script: unknown): void {
    const filePath = this.getScriptJsonPath(jobId);
    fs.writeFileSync(filePath, JSON.stringify(script, null, 2), 'utf-8');
  }

  public readScriptJson<T>(jobId: string): T | null {
    const filePath = this.getScriptJsonPath(jobId);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export const storageManager = new LocalStorageManager();
