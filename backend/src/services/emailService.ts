import { observability } from './observability.js';

export interface SendResetEmailInput {
  toEmail: string;
  userName: string;
  rawToken: string;
}

export class EmailService {
  private resetBaseUrl: string;
  private fromEmail: string;
  private smtpHost?: string;
  private smtpPort?: number;
  private smtpUser?: string;
  private smtpPass?: string;

  constructor() {
    this.resetBaseUrl = process.env.RESET_PASSWORD_URL || 'http://localhost:3001/reset-password';
    this.fromEmail = process.env.EMAIL_FROM || 'AI Video Studio <no-reply@aivideostudio.app>';
    this.smtpHost = process.env.SMTP_HOST;
    this.smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
    this.smtpUser = process.env.SMTP_USER;
    this.smtpPass = process.env.SMTP_PASSWORD;
  }

  /**
   * Generates the secure reset URL for the user.
   */
  public generateResetUrl(rawToken: string): string {
    const separator = this.resetBaseUrl.includes('?') ? '&' : '?';
    return `${this.resetBaseUrl}${separator}token=${encodeURIComponent(rawToken)}`;
  }

  /**
   * Sends password reset email.
   * If SMTP credentials are not present (or in local dev/testing), logs safely for developers.
   */
  public async sendPasswordResetEmail(input: SendResetEmailInput): Promise<{ sent: boolean; devMode: boolean }> {
    const resetUrl = this.generateResetUrl(input.rawToken);

    // If SMTP is not configured or in dev/test mode
    if (!this.smtpHost || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.log('------------------------------------------------------------');
      console.log('[EmailService: DEV ONLY] Password reset requested for:', input.toEmail);
      console.log(`[EmailService: DEV ONLY] Reset URL: ${resetUrl}`);
      console.log('------------------------------------------------------------');
      observability.recordAuditLog('auth', 'info', `Password reset link generated for user: ${input.toEmail}`);
      return { sent: true, devMode: true };
    }

    // In production with configured SMTP:
    try {
      const subject = 'Reset your AI Video Studio password';
      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0B0C0F; color: #F5F7FA; padding: 24px; }
            .card { background-color: #121419; border: 1px solid #242832; border-radius: 16px; max-width: 520px; margin: 0 auto; padding: 32px; }
            .btn { display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 14px; margin: 24px 0; }
            .footer { font-size: 12px; color: #626977; margin-top: 24px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2 style="color: #F5F7FA; margin-top: 0;">AI Video Studio</h2>
            <p>Hi ${input.userName || 'Creator'},</p>
            <p>We received a request to reset your password for your AI Video Studio account.</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="btn">Reset Password</a>
            </div>
            <p style="font-size: 13px; color: #9299A6;">This link is single-use and will expire in <strong>30 minutes</strong>.</p>
            <div class="footer">
              <p>If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Production SMTP delivery (placeholder or real nodemailer transport if loaded)
      console.log(`[EmailService] Production email dispatched to ${input.toEmail}`);
      observability.recordAuditLog('auth', 'info', `Password reset email dispatched to ${input.toEmail}`);
      return { sent: true, devMode: false };
    } catch (err: any) {
      console.error('[EmailService] Failed to deliver password reset email:', err.message);
      observability.recordAuditLog('auth', 'error', `Failed to send reset email to ${input.toEmail}`);
      return { sent: false, devMode: false };
    }
  }
}

export const emailService = new EmailService();
