import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection.js';

export type NotificationType = 'video_completed' | 'video_failed' | 'credits_low' | 'credits_purchased' | 'system';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export class NotificationService {
  public async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<NotificationRecord> {
    const id = uuidv4();
    const dataJson = data ? JSON.stringify(data) : null;

    await db.execute(
      `INSERT INTO notifications (id, user_id, type, title, message, data_json, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, CURRENT_TIMESTAMP)`,
      [id, userId, type, title, message, dataJson]
    );

    console.log(`[NotificationService] Notification created for user ${userId}: "${title}"`);

    return {
      id,
      userId,
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
  }

  public async getUserNotifications(userId: string, limit = 50): Promise<NotificationRecord[]> {
    const rows = await db.query<any>(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      type: r.type as NotificationType,
      title: r.title,
      message: r.message,
      data: r.data_json ? JSON.parse(r.data_json) : undefined,
      isRead: Boolean(r.is_read),
      createdAt: r.created_at,
    }));
  }

  public async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const res = await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
    return res.rowCount > 0;
  }
}

export const notificationService = new NotificationService();
