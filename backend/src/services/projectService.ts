import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection.js';

export interface ProjectRecord {
  id: string;
  userId: string;
  title: string;
  type: 'short' | 'long';
  status: string;
  script?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export class ProjectService {
  public async createProject(data: {
    userId: string;
    title: string;
    type: 'short' | 'long';
    scriptJson?: any;
    metadataJson?: any;
  }): Promise<ProjectRecord> {
    const id = uuidv4();
    const script = data.scriptJson ? JSON.stringify(data.scriptJson) : null;
    const metadata = data.metadataJson ? JSON.stringify(data.metadataJson) : null;

    await db.execute(
      `INSERT INTO projects (id, user_id, title, type, status, script_json, metadata_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, data.userId, data.title.trim(), data.type, script, metadata]
    );

    const project = await this.getProjectById(data.userId, id);
    if (!project) throw new Error('Failed to create project.');
    return project;
  }

  public async getUserProjects(userId: string): Promise<ProjectRecord[]> {
    const rows = await db.query<any>(
      'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      type: r.type as 'short' | 'long',
      status: r.status,
      script: r.script_json ? JSON.parse(r.script_json) : undefined,
      metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public async getProjectById(userId: string, projectId: string): Promise<ProjectRecord | null> {
    const row = await db.queryOne<any>(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      type: row.type as 'short' | 'long',
      status: row.status,
      script: row.script_json ? JSON.parse(row.script_json) : undefined,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public async deleteProject(userId: string, projectId: string): Promise<boolean> {
    // Assert ownership
    const project = await this.getProjectById(userId, projectId);
    if (!project) return false;

    const res = await db.execute(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );
    return res.rowCount > 0;
  }
}

export const projectService = new ProjectService();
