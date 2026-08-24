import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection.js';

export interface VideoRecord {
  id: string;
  userId: string;
  projectId?: string | null;
  type: 'short' | 'long';
  title: string;
  durationSeconds: number;
  width: number;
  height: number;
  status: 'queued' | 'planning' | 'generating' | 'processing' | 'completed' | 'failed' | 'cancelled';
  storageKey?: string | null;
  thumbnailKey?: string | null;
  subtitlesKey?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoSceneRecord {
  id: string;
  videoId: string;
  sceneNumber: number;
  durationSeconds: number;
  narration?: string | null;
  visualPrompt: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  storageKey?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export class VideoService {
  public async createVideo(data: {
    id?: string;
    userId: string;
    projectId?: string | null;
    type: 'short' | 'long';
    title: string;
    durationSeconds: number;
    width?: number;
    height?: number;
  }): Promise<VideoRecord> {
    const id = data.id || uuidv4();
    const width = data.width || (data.type === 'short' ? 720 : 1280);
    const height = data.height || (data.type === 'short' ? 1280 : 720);

    await db.execute(
      `INSERT INTO videos (id, user_id, project_id, type, title, duration_seconds, width, height, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, data.userId, data.projectId || null, data.type, data.title, data.durationSeconds, width, height]
    );

    const video = await this.getVideoById(data.userId, id);
    if (!video) throw new Error('Failed to create video record.');
    return video;
  }

  public async getUserVideos(userId: string, limit = 50): Promise<VideoRecord[]> {
    const rows = await db.query<any>(
      'SELECT * FROM videos WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );

    return rows.map((r) => this.mapVideoRow(r));
  }

  public async getVideoById(userId: string, videoId: string): Promise<VideoRecord | null> {
    const row = await db.queryOne<any>(
      'SELECT * FROM videos WHERE id = $1 AND user_id = $2',
      [videoId, userId]
    );
    if (!row) return null;
    return this.mapVideoRow(row);
  }

  public async updateVideoStatus(
    videoId: string,
    status: string,
    storageKey?: string,
    thumbnailKey?: string,
    subtitlesKey?: string
  ): Promise<void> {
    await db.execute(
      `UPDATE videos
       SET status = $1,
           storage_key = COALESCE($2, storage_key),
           thumbnail_key = COALESCE($3, thumbnail_key),
           subtitles_key = COALESCE($4, subtitles_key),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [status, storageKey || null, thumbnailKey || null, subtitlesKey || null, videoId]
    );
  }

  public async deleteVideo(userId: string, videoId: string): Promise<boolean> {
    const video = await this.getVideoById(userId, videoId);
    if (!video) return false;

    const res = await db.execute(
      'DELETE FROM videos WHERE id = $1 AND user_id = $2',
      [videoId, userId]
    );
    return res.rowCount > 0;
  }

  // Scene management
  public async createScene(data: {
    videoId: string;
    sceneNumber: number;
    durationSeconds: number;
    narration?: string;
    visualPrompt: string;
  }): Promise<VideoSceneRecord> {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO video_scenes (id, video_id, scene_number, duration_seconds, narration, visual_prompt, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, data.videoId, data.sceneNumber, data.durationSeconds, data.narration || null, data.visualPrompt]
    );

    return {
      id,
      videoId: data.videoId,
      sceneNumber: data.sceneNumber,
      durationSeconds: data.durationSeconds,
      narration: data.narration,
      visualPrompt: data.visualPrompt,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  public async getVideoScenes(videoId: string): Promise<VideoSceneRecord[]> {
    const rows = await db.query<any>(
      'SELECT * FROM video_scenes WHERE video_id = $1 ORDER BY scene_number ASC',
      [videoId]
    );

    return rows.map((r) => ({
      id: r.id,
      videoId: r.video_id,
      sceneNumber: r.scene_number,
      durationSeconds: r.duration_seconds,
      narration: r.narration,
      visualPrompt: r.visual_prompt,
      status: r.status,
      storageKey: r.storage_key,
      errorMessage: r.error_message,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public async updateSceneStatus(sceneId: string, status: string, storageKey?: string, errorMessage?: string): Promise<void> {
    await db.execute(
      `UPDATE video_scenes
       SET status = $1,
           storage_key = COALESCE($2, storage_key),
           error_message = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [status, storageKey || null, errorMessage || null, sceneId]
    );
  }

  private mapVideoRow(r: any): VideoRecord {
    return {
      id: r.id,
      userId: r.user_id,
      projectId: r.project_id,
      type: r.type,
      title: r.title,
      durationSeconds: r.duration_seconds,
      width: r.width,
      height: r.height,
      status: r.status,
      storageKey: r.storage_key,
      thumbnailKey: r.thumbnail_key,
      subtitlesKey: r.subtitles_key,
      videoUrl: r.storage_key ? `/media/${r.storage_key}` : null,
      thumbnailUrl: r.thumbnail_key ? `/media/${r.thumbnail_key}` : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

export const videoService = new VideoService();
