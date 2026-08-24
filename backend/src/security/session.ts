import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection.js';

export interface UserSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date | null;
}

export class SessionService {
  private readonly SESSION_EXPIRATION_DAYS = 30;

  /**
   * Generates a cryptographically random session token, hashes it with SHA-256,
   * stores the hash in the database, and returns the raw token to send to the client.
   */
  public async createSession(userId: string): Promise<{ rawToken: string; session: UserSession }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const sessionId = uuidv4();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.SESSION_EXPIRATION_DAYS);

    await db.execute(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [sessionId, userId, tokenHash, expiresAt.toISOString()]
    );

    const session: UserSession = {
      id: sessionId,
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    };

    return { rawToken, session };
  }

  /**
   * Validates a raw session token against the stored SHA-256 token hash in the database.
   */
  public async validateSession(rawToken: string): Promise<{ userId: string; sessionId: string } | null> {
    if (!rawToken || typeof rawToken !== 'string') return null;

    const tokenHash = this.hashToken(rawToken);
    const row = await db.queryOne<{
      id: string;
      user_id: string;
      expires_at: string;
      revoked_at: string | null;
    }>(
      `SELECT id, user_id, expires_at, revoked_at FROM sessions WHERE token_hash = $1`,
      [tokenHash]
    );

    if (!row) return null;

    // Check revocation
    if (row.revoked_at) return null;

    // Check expiration
    const expiresAt = new Date(row.expires_at);
    if (expiresAt.getTime() < Date.now()) return null;

    return {
      sessionId: row.id,
      userId: row.user_id,
    };
  }

  /**
   * Revokes a session immediately.
   */
  public async revokeSession(rawToken: string): Promise<boolean> {
    const tokenHash = this.hashToken(rawToken);
    const res = await db.execute(
      `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1`,
      [tokenHash]
    );
    return res.rowCount > 0;
  }

  /**
   * Revokes all active sessions for a user (e.g. on password change).
   */
  public async revokeAllUserSessions(userId: string): Promise<void> {
    await db.execute(
      `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}

export const sessionService = new SessionService();
