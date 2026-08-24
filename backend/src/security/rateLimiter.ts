import { Request, Response, NextFunction } from 'express';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTimeMs: number;
  retryAfterSec?: number;
}

/**
 * Rate Limiter Interface (Architectural Correction #3)
 * Allows pluggable rate limiting implementations:
 * - InMemoryRateLimiter: For single-instance development and MVP
 * - RedisRateLimiter / CloudflareKVLimiter: For distributed multi-node production deployment
 */
export interface IRateLimiter {
  checkLimit(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult>;
}

interface RateLimitRecord {
  count: number;
  resetTimeMs: number;
}

/**
 * In-Memory Rate Limiter
 * NOTE: This is designed for single-node development and MVP deployment only.
 * For horizontally scaled, multi-instance production environments, replace with a distributed
 * Redis/Upstash adapter implementing IRateLimiter.
 */
export class InMemoryRateLimiter implements IRateLimiter {
  private requests = new Map<string, RateLimitRecord>();

  constructor(
    private defaultWindowMs: number = 60 * 1000,
    private defaultMaxRequests: number = 60
  ) {}

  public async checkLimit(
    key: string,
    maxRequests?: number,
    windowMs?: number
  ): Promise<RateLimitResult> {
    const max = maxRequests || this.defaultMaxRequests;
    const window = windowMs || this.defaultWindowMs;
    const now = Date.now();

    const record = this.requests.get(key);

    if (!record || now > record.resetTimeMs) {
      this.requests.set(key, {
        count: 1,
        resetTimeMs: now + window,
      });
      return {
        allowed: true,
        remaining: max - 1,
        resetTimeMs: now + window,
      };
    }

    if (record.count >= max) {
      const retryAfterSec = Math.ceil((record.resetTimeMs - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetTimeMs: record.resetTimeMs,
        retryAfterSec,
      };
    }

    record.count++;
    return {
      allowed: true,
      remaining: max - record.count,
      resetTimeMs: record.resetTimeMs,
    };
  }

  public middleware(customMax?: number, customWindowMs?: number) {
    const max = customMax || this.defaultMaxRequests;
    const window = customWindowMs || this.defaultWindowMs;

    return async (req: Request, res: Response, next: NextFunction) => {
      const clientIp =
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        'anonymous_client';

      const key = `${clientIp}:${req.path}`;
      const result = await this.checkLimit(key, max, window);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', result.remaining);

      if (!result.allowed) {
        if (result.retryAfterSec) {
          res.setHeader('Retry-After', result.retryAfterSec);
        }
        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Please slow down and try again in ${result.retryAfterSec || 60} seconds.`,
          },
        });
      }

      next();
    };
  }

  public emailMiddleware(maxRequests = 3, windowMs = 15 * 60 * 1000) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const email = (req.body?.email || req.ip || 'anonymous').toLowerCase().trim();
      const key = `pwd_reset:${email}`;
      const result = await this.checkLimit(key, maxRequests, windowMs);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);

      if (!result.allowed) {
        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many password reset requests for this email. Please try again later.`,
          },
        });
      }

      next();
    };
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTimeMs) {
        this.requests.delete(key);
      }
    }
  }
}

export const standardLimiter = new InMemoryRateLimiter(60 * 1000, 100);
export const authLimiter = new InMemoryRateLimiter(60 * 1000, 15);
export const generationLimiter = new InMemoryRateLimiter(60 * 1000, 10);
export const passwordResetLimiter = new InMemoryRateLimiter(15 * 60 * 1000, 3);
