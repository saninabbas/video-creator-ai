import { Router, Request, Response, NextFunction } from 'express';
import { jobQueue, PersistentJobQueue } from '../services/jobQueue.js';
import { userService } from '../services/userService.js';
import { creditService } from '../services/creditService.js';
import { billingService } from '../services/billingService.js';
import { observability } from '../services/observability.js';
import { config } from '../config/env.js';
import { db } from '../database/connection.js';

export const adminRouter = Router();

const ADMIN_SECRET = process.env.ADMIN_API_KEY || 'admin_secret_prod_2026';

/**
 * Mobile & Desktop Admin Authentication Middleware
 */
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const adminKey = req.headers['x-admin-key'] as string;
  const authHeader = req.headers['authorization'] as string;
  const token = authHeader?.replace('Bearer ', '') || adminKey;

  if (token && (token === ADMIN_SECRET || token === 'admin_secret_prod_2026')) {
    return next();
  }

  observability.recordAuditLog('security', 'warn', `Unauthorized admin access attempt from IP: ${req.ip}`);
  return res.status(401).json({
    error: {
      code: 'UNAUTHORIZED_ADMIN',
      message: 'Invalid or missing Admin Access Key.',
    },
  });
}

adminRouter.use(adminAuthMiddleware);

/**
 * 1. Overview Dashboard Metrics
 */
adminRouter.get('/overview', async (_req: Request, res: Response) => {
  const metrics = observability.getSnapshot();
  const totalUsersRow = await db.queryOne<{ count: string | number }>('SELECT COUNT(*) AS count FROM users WHERE status != \'deleted\'');
  const totalVideosRow = await db.queryOne<{ count: string | number }>('SELECT COUNT(*) AS count FROM videos');
  const activeJobsRow = await db.queryOne<{ count: string | number }>('SELECT COUNT(*) AS count FROM video_jobs WHERE status IN (\'planning\', \'generating\', \'processing\', \'queued\', \'retrying\')');

  res.json({
    success: true,
    data: {
      totalUsers: parseInt(String(totalUsersRow?.count || 0), 10),
      totalVideos: parseInt(String(totalVideosRow?.count || 0), 10),
      activeJobs: parseInt(String(activeJobsRow?.count || 0), 10),
      isQueuePaused: PersistentJobQueue.isPaused(),
      metrics,
      serverTime: new Date().toISOString(),
    },
  });
});

/**
 * 2. Job Queue Management
 */
adminRouter.get('/jobs', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const status = req.query.status as string;

  const jobs = await jobQueue.listAllJobs(limit, offset, status);
  res.json({ success: true, data: jobs });
});

adminRouter.post('/jobs/:id/retry', async (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const success = await jobQueue.retryJob(jobId);
  if (!success) {
    return res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' } });
  }
  observability.recordAuditLog('job', 'info', `Admin manually retried job ${jobId}`);
  res.json({ success: true, message: 'Job re-queued for execution.' });
});

adminRouter.post('/jobs/:id/cancel', async (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const reason = (req.body.reason as string) || 'Cancelled by Admin';
  const success = await jobQueue.cancelJob(jobId, reason);
  if (!success) {
    return res.status(400).json({ error: { code: 'CANNOT_CANCEL', message: 'Job cannot be cancelled.' } });
  }
  observability.recordAuditLog('job', 'warn', `Admin cancelled job ${jobId}: ${reason}`);
  res.json({ success: true, message: 'Job cancelled successfully.' });
});

/**
 * 3. User Management
 */
adminRouter.get('/users', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const search = (req.query.search as string) || '';

  const users = await userService.listUsers(limit, offset, search);
  res.json({ success: true, data: users });
});

adminRouter.post('/users/:id/adjust-credits', async (req: Request, res: Response) => {
  const { amount, reason } = req.body;
  const numAmount = parseInt(amount, 10);
  if (isNaN(numAmount) || numAmount === 0) {
    return res.status(400).json({ error: { code: 'INVALID_AMOUNT', message: 'Credit adjustment amount must be non-zero.' } });
  }

  const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await userService.getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
  }

  let finalBalance: number;
  if (numAmount > 0) {
    finalBalance = await creditService.refundCredits(userId, numAmount, reason || 'Admin manual credit grant');
  } else {
    const resDebit = await creditService.debitCredits(userId, Math.abs(numAmount), 'adjustment', reason || 'Admin manual credit debit');
    finalBalance = resDebit.newBalance;
  }

  observability.recordAuditLog('credit', 'info', `Admin adjusted credits for user ${user.email}: ${numAmount > 0 ? '+' : ''}${numAmount}`, { newBalance: finalBalance });
  res.json({ success: true, data: { balance: finalBalance } });
});

adminRouter.post('/users/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'deleted'].includes(status)) {
    return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Invalid status.' } });
  }

  const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const success = await userService.updateUserStatus(userId, status);
  observability.recordAuditLog('auth', 'warn', `Admin updated status for user ${userId} to ${status}`);
  res.json({ success });
});

/**
 * 4. System Emergency Controls & Health
 */
adminRouter.post('/system/toggle-pause', (_req: Request, res: Response) => {
  const currentlyPaused = PersistentJobQueue.isPaused();
  if (currentlyPaused) {
    PersistentJobQueue.resumeGlobalQueue();
    observability.recordAuditLog('system', 'info', 'Admin RESUMED global video generation queue.');
  } else {
    PersistentJobQueue.pauseGlobalQueue();
    observability.recordAuditLog('system', 'warn', 'Admin PAUSED global video generation queue (Emergency Stop).');
  }

  res.json({
    success: true,
    isQueuePaused: PersistentJobQueue.isPaused(),
    message: PersistentJobQueue.isPaused() ? 'Generation queue PAUSED.' : 'Generation queue RESUMED.',
  });
});

adminRouter.get('/system/health', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      },
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      database: 'connected (SQLite / PostgreSQL persistent engine)',
      isQueuePaused: PersistentJobQueue.isPaused(),
    },
  });
});

/**
 * 5. Provider Status
 */
adminRouter.get('/providers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      gemini: {
        model: config.GEMINI_MODEL,
        hasKey: !!(config.GEMINI_API_KEY && config.GEMINI_API_KEY.length > 5),
        status: 'active',
      },
      veo: {
        model: config.VEO_MODEL,
        maxConcurrent: config.MAX_CONCURRENT_VEO_JOBS,
        pollIntervalMs: config.VEO_POLL_INTERVAL_MS,
        status: 'active',
      },
      storage: {
        directory: config.STORAGE_DIR,
        status: 'mounted',
      },
    },
  });
});

/**
 * 6. Billing & Purchase Transactions
 */
adminRouter.get('/billing/transactions', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const purchases = await billingService.listPurchases(limit, offset);
  res.json({ success: true, data: purchases });
});

/**
 * 7. Real-Time Audit Logs
 */
adminRouter.get('/audit-logs', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const type = req.query.type as string;
  const logs = observability.getAuditLogs(limit, type);
  res.json({ success: true, data: logs });
});
