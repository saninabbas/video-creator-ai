import { Router, Request, Response } from 'express';
import { notificationService } from '../services/notificationService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

/**
 * GET /api/notifications
 */
notificationRouter.get('/', async (req: Request, res: Response) => {
  try {
    const notifications = await notificationService.getUserNotifications(req.user!.id);
    res.json({ notifications });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'NOTIFICATION_FETCH_ERROR',
        message: 'Failed to retrieve notifications.',
      },
    });
  }
});

/**
 * PATCH /api/notifications/:id/read
 */
notificationRouter.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const success = await notificationService.markAsRead(notificationId, req.user!.id);

    if (!success) {
      return res.status(404).json({
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found.',
        },
      });
    }

    res.json({ message: 'Notification marked as read.' });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'NOTIFICATION_UPDATE_ERROR',
        message: 'Failed to update notification.',
      },
    });
  }
});
