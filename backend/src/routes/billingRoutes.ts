import { Router, Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billingService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const billingRouter = Router();

/**
 * GET /api/billing/packages
 * Returns catalog of in-app purchase packages.
 */
billingRouter.get('/packages', (_req: Request, res: Response) => {
  res.json({
    packages: billingService.getCatalog(),
  });
});

/**
 * POST /api/billing/verify-purchase
 * Authenticated Android in-app purchase verification.
 */
billingRouter.post(
  '/verify-purchase',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { purchaseToken, productId, orderId, rawPayload } = req.body;
      const result = await billingService.verifyAndProcessPurchase({
        userId: req.user!.id,
        purchaseToken,
        productId,
        orderId,
        rawPayload,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/billing/google-play-webhook
 * Google Play RTDN Webhook Endpoint.
 */
billingRouter.post('/google-play-webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    if (message && message.data) {
      // Decode base64 Google Pub/Sub payload if present
      const decodedJson = Buffer.from(message.data, 'base64').toString('utf-8');
      const rtdnPayload = JSON.parse(decodedJson);
      console.log('[BillingWebhook] Received Google Play RTDN notification:', rtdnPayload);
    }
    res.status(200).json({ status: 'received' });
  } catch (err) {
    next(err);
  }
});
