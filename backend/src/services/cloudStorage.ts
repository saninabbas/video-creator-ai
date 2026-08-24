import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';

export interface StorageUploadResult {
  key: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export interface ICloudStorage {
  uploadFile(key: string, sourceFilePathOrBuffer: string | Buffer, mimeType?: string): Promise<StorageUploadResult>;
  getFile(key: string): Promise<Buffer | null>;
  deleteFile(key: string): Promise<boolean>;
  fileExists(key: string): Promise<boolean>;
  getPublicUrl(key: string): string;
}

export class CloudStorageService implements ICloudStorage {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = path.resolve(customBaseDir || config.STORAGE_DIR);
    this.ensureDirectory(this.baseDir);
  }

  /**
   * Sanitizes key to strictly prevent path traversal vulnerabilities.
   */
  public sanitizeKey(key: string): string {
    const clean = key
      .replace(/\\/g, '/')
      .replace(/\.\./g, '')
      .replace(/^\/+/, '');
    return clean;
  }

  public generateVideoKey(userId: string, videoId: string, filename: string): string {
    const cleanFilename = path.basename(filename);
    return `users/${userId}/videos/${videoId}/${cleanFilename}`;
  }

  public generateSceneKey(userId: string, videoId: string, sceneNumber: number): string {
    return `users/${userId}/videos/${videoId}/scenes/scene_${sceneNumber}.mp4`;
  }

  public async uploadFile(
    rawKey: string,
    sourceFilePathOrBuffer: string | Buffer,
    mimeType?: string
  ): Promise<StorageUploadResult> {
    const key = this.sanitizeKey(rawKey);
    const destPath = path.join(this.baseDir, key);
    const dir = path.dirname(destPath);
    this.ensureDirectory(dir);

    if (typeof sourceFilePathOrBuffer === 'string') {
      if (fs.existsSync(sourceFilePathOrBuffer) && sourceFilePathOrBuffer !== destPath) {
        fs.copyFileSync(sourceFilePathOrBuffer, destPath);
      }
    } else {
      fs.writeFileSync(destPath, sourceFilePathOrBuffer);
    }

    const stats = fs.existsSync(destPath) ? fs.statSync(destPath) : { size: 0 };
    const detectedMime =
      mimeType ||
      (key.endsWith('.mp4')
        ? 'video/mp4'
        : key.endsWith('.jpg')
        ? 'image/jpeg'
        : key.endsWith('.srt')
        ? 'text/plain'
        : 'application/octet-stream');

    console.log(`[CloudStorage] Uploaded key="${key}" (${stats.size} bytes)`);

    return {
      key,
      url: this.getPublicUrl(key),
      sizeBytes: stats.size,
      mimeType: detectedMime,
    };
  }

  public async getFile(rawKey: string): Promise<Buffer | null> {
    const key = this.sanitizeKey(rawKey);
    const filePath = path.join(this.baseDir, key);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  public async deleteFile(rawKey: string): Promise<boolean> {
    const key = this.sanitizeKey(rawKey);
    const filePath = path.join(this.baseDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[CloudStorage] Deleted file key="${key}"`);
      return true;
    }
    return false;
  }

  public async fileExists(rawKey: string): Promise<boolean> {
    const key = this.sanitizeKey(rawKey);
    const filePath = path.join(this.baseDir, key);
    return fs.existsSync(filePath);
  }

  public getPublicUrl(rawKey: string): string {
    const key = this.sanitizeKey(rawKey);
    return `/media/${key}`;
  }

  public getLocalDiskPath(rawKey: string): string {
    const key = this.sanitizeKey(rawKey);
    return path.join(this.baseDir, key);
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export const cloudStorage = new CloudStorageService();
