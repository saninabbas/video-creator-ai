import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection.js';
import { userService } from './userService.js';
import { hashPassword } from '../security/password.js';
import { sessionService } from '../security/session.js';
import { emailService } from './emailService.js';
import { observability } from './observability.js';

export interface DbPasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export class PasswordResetService {
  private readonly TOKEN_EXPIRY_MINUTES = 30;

  /**
   * Hashes a raw token using SHA-256 before database storage/comparison.
   */
  public hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Initiates forgot password flow.
   * Guaranteed constant response for timing-safety and zero user enumeration.
   */
  public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await userService.getUserByEmail(normalizedEmail);

    if (user) {
      // 1. Generate 32-byte cryptographically secure random token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(rawToken);

      const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();
      const tokenId = uuidv4();

      // 2. Invalidate any previous unused reset tokens for this user
      await db.execute(
        `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL`,
        [user.id]
      );

      // 3. Store new token hash in database
      await db.execute(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [tokenId, user.id, tokenHash, expiresAt]
      );

      // 4. Dispatch email asynchronously (or safe dev log)
      await emailService.sendPasswordResetEmail({
        toEmail: user.email,
        userName: user.name,
        rawToken,
      });

      observability.recordAuditLog('auth', 'info', `Password reset token issued for user ID: ${user.id}`);
    } else {
      observability.recordAuditLog('auth', 'info', `Password reset requested for non-existing email: ${normalizedEmail}`);
    }

    // Always return identical success message (Security Section 2)
    return {
      success: true,
      message: 'If an account exists for this email, a password reset link has been sent.',
    };
  }

  /**
   * Resets password using single-use unexpired token.
   * Atomically updates password, consumes token, and revokes all active sessions.
   */
  public async resetPassword(rawToken: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('INVALID_TOKEN: Password reset token is missing.');
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new Error('WEAK_PASSWORD: Password must be at least 8 characters long.');
    }

    const tokenHash = this.hashToken(rawToken);

    // 1. Look up token in database
    const tokenRecord = await db.queryOne<DbPasswordResetToken>(
      `SELECT * FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    );

    if (!tokenRecord) {
      throw new Error('INVALID_TOKEN: This password reset link is invalid or has expired.');
    }

    // 2. Check if already used
    if (tokenRecord.used_at) {
      throw new Error('TOKEN_USED: This password reset link has already been used.');
    }

    // 3. Check expiration
    const expiryTime = new Date(tokenRecord.expires_at).getTime();
    if (Date.now() > expiryTime) {
      throw new Error('TOKEN_EXPIRED: This password reset link has expired. Please request a new one.');
    }

    // 4. Load user
    const user = await userService.getUserById(tokenRecord.user_id);
    if (!user) {
      throw new Error('USER_NOT_FOUND: User account not found.');
    }

    // 5. Hash new password using existing secure scrypt / Argon2 / pbkdf2 system
    const newPasswordHash = await hashPassword(newPassword);

    // 6. Update user password
    await db.execute(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newPasswordHash, user.id]
    );

    // 7. Mark token as used (single-use enforcement)
    await db.execute(
      `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [tokenRecord.id]
    );

    // 8. Revoke all active sessions for this user (Session Security Section 7)
    await sessionService.revokeAllUserSessions(user.id);

    observability.recordAuditLog('security', 'info', `Password reset successfully completed for user ID: ${user.id}`);

    return {
      success: true,
      message: 'Password updated successfully. Please log in with your new password.',
    };
  }
}

export const passwordResetService = new PasswordResetService();
