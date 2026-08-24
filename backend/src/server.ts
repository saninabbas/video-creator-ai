import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config/env.js';
import { migrationRunner } from './database/migrationRunner.js';
import { jobQueue } from './services/jobQueue.js';
import { standardLimiter } from './security/rateLimiter.js';
import { authRouter } from './routes/authRoutes.js';
import { projectRouter } from './routes/projectRoutes.js';
import { videoRouter } from './routes/videoRoutes.js';
import { creditRouter } from './routes/creditRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { billingRouter } from './routes/billingRoutes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Global standard rate limiter
app.use(standardLimiter.middleware(120, 60 * 1000));

// Serve generated media assets
app.use('/media', express.static(path.resolve(config.STORAGE_DIR)));

// Serve Creator Web Dashboard for instant browser testing
app.use(express.static(path.resolve(__dirname, 'public')));
app.use(express.static(path.resolve(__dirname, '../src/public')));
app.use(express.static(path.resolve(process.cwd(), 'src/public')));
app.use(express.static(path.resolve(process.cwd(), 'backend/src/public')));

/**
 * Health check & configuration status endpoint (Section 31 & 36)
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    engine: 'AI Video Studio Production Engine v2.0',
    geminiModel: config.GEMINI_MODEL,
    veoModel: config.VEO_MODEL,
    hasApiKey: !!(config.GEMINI_API_KEY && config.GEMINI_API_KEY.trim().length > 5),
    timestamp: new Date().toISOString(),
  });
});

// Mount Phase 2 SaaS REST Routes
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/videos', videoRouter);
app.use('/api/credits', creditRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/billing', billingRouter);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ServerError]', err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred.',
    },
  });
});

/**
 * Server initialization: applies DB migrations and starts queue worker before listening.
 */
export async function startServer() {
  try {
    console.log('[Server] Initializing database migrations...');
    await migrationRunner.migrateUp();

    console.log('[Server] Starting background job queue worker...');
    jobQueue.startWorker();

    const PORT = config.PORT;
    const server = app.listen(PORT, () => {
      console.log(`[AI Video Studio Server] Production SaaS backend running on http://localhost:${PORT}`);
      console.log(`[AI Video Studio Server] Gemini Model: ${config.GEMINI_MODEL}`);
      console.log(`[AI Video Studio Server] Veo Model: ${config.VEO_MODEL}`);
    });

    return server;
  } catch (err: any) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

if (require.main === module || !process.env.TEST_MODE) {
  startServer();
}

export { app };
