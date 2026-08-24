import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../security/session.js';
import { db } from '../database/connection.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionId?: string;
      token?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let rawToken: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.substring(7).trim();
    } else if (req.headers['x-session-token']) {
      rawToken = String(req.headers['x-session-token']).trim();
    }

    if (!rawToken) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please provide a valid session token.',
        },
      });
    }

    const sessionInfo = await sessionService.validateSession(rawToken);
    if (!sessionInfo) {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Your session has expired or is invalid. Please log in again.',
        },
      });
    }

    const user = await db.queryOne<AuthenticatedUser>(
      'SELECT id, email, name, status FROM users WHERE id = $1',
      [sessionInfo.userId]
    );

    if (!user || user.status !== 'active') {
      return res.status(403).json({
        error: {
          code: 'USER_INACTIVE',
          message: 'Your account is currently disabled.',
        },
      });
    }

    req.user = user;
    req.sessionId = sessionInfo.sessionId;
    req.token = rawToken;
    next();
  } catch (err: any) {
    console.error('[AuthMiddleware] Error validating authentication:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_AUTH_ERROR',
        message: 'Failed to verify authentication.',
      },
    });
  }
}
