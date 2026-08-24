import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';

export interface StorageResult {
  key: string;
  url: string;
  localPath: string;
  sizeBytes: number;
  mimeType: string;
}

export interface IVideoStorageService {
  uploadVideo(jobId: string, filename: string, sourcePathOrBuffer: string | Buffer): Promise<StorageResult>;
  getVideo(key: string): Promise<Buffer | null>;
  deleteVideo(key: string): Promise<boolean>;
  getVideoUrl(key: string): string;
  getLocalPath(key: string): string;
}

/**
 * Storage service abstraction.
 * Implements local disk storage for development, fully decoupled and ready for S3 / Cloudflare R2 object storage.
 */
export class LocalVideoStorageService implements IVideoStorageService {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = path.resolve(customBaseDir || config.STORAGE_DIR);
    this.ensureDir(this.baseDir);
  }

  public async uploadVideo(
    jobId: string,
    filename: string,
    sourcePathOrBuffer: string | Buffer
  ): Promise<StorageResult> {
    const jobDir = path.join(this.baseDir, jobId);
    this.ensureDir(jobDir);

    const destPath = path.join(jobDir, filename);
    const key = `${jobId}/${filename}`;

    if (typeof sourcePathOrBuffer === 'string') {
      if (fs.existsSync(sourcePathOrBuffer) && sourcePathOrBuffer !== destPath) {
        fs.copyFileSync(sourcePathOrBuffer, destPath);
      }
    } else {
      fs.writeFileSync(destPath, sourcePathOrBuffer);
    }

    const stats = fs.existsSync(destPath) ? fs.statSync(destPath) : { size: 0 };
    const mimeType = filename.endsWith('.mp4') ? 'video/mp4' : filename.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream';

    console.log(`[StorageService] Stored file key="${key}" size=${stats.size} bytes`);

    return {
      key,
      url: `/media/${key}`,
      localPath: destPath,
      sizeBytes: stats.size,
      mimeType,
    };
  }

  public async getVideo(key: string): Promise<Buffer | null> {
    const filePath = path.join(this.baseDir, key);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  public async deleteVideo(key: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[StorageService] Deleted file key="${key}"`);
      return true;
    }
    return false;
  }

  public getVideoUrl(key: string): string {
    return `/media/${key}`;
  }

  public getLocalPath(key: string): string {
    return path.join(this.baseDir, key);
  }

  public getJobDir(jobId: string): string {
    const dir = path.join(this.baseDir, jobId);
    this.ensureDir(dir);
    return dir;
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export const storageService = new LocalVideoStorageService();
