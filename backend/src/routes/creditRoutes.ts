import { Router, Request, Response } from 'express';
import { creditService } from '../services/creditService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const creditRouter = Router();
creditRouter.use(requireAuth);

/**
 * GET /api/credits
 * Returns user's current wallet balance and transaction ledger.
 */
creditRouter.get('/', async (req: Request, res: Response) => {
  try {
    const wallet = await creditService.getWallet(req.user!.id);
    const transactions = await creditService.getTransactions(req.user!.id, 30);

    res.json({
      balance: wallet?.balance || 0,
      transactions,
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'CREDIT_FETCH_ERROR',
        message: 'Failed to retrieve credit information.',
      },
    });
  }
});
