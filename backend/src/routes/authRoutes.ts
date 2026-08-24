import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authLimiter } from '../security/rateLimiter.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
  name: z.string().min(2, 'Name must be at least 2 characters long.'),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

/**
 * POST /api/auth/register
 */
authRouter.post('/register', authLimiter.middleware(10), async (req: Request, res: Response) => {
  try {
    const validated = registerSchema.parse(req.body);
    const result = await authService.register(validated);

    res.status(201).json({
      message: 'Account created successfully.',
      user: result.user,
      token: result.token,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.errors[0]?.message || 'Invalid input.',
        },
      });
    }
    if (err.message?.includes('EMAIL_EXISTS')) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
    }
    console.error('[AuthRoutes] Registration error:', err);
    res.status(500).json({
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Could not complete registration. Please try again.',
      },
    });
  }
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', authLimiter.middleware(10), async (req: Request, res: Response) => {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await authService.login(validated);

    res.json({
      message: 'Login successful.',
      user: result.user,
      token: result.token,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.errors[0]?.message || 'Invalid input.',
        },
      });
    }
    if (err.message?.includes('INVALID_CREDENTIALS')) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Incorrect email or password.',
        },
      });
    }
    console.error('[AuthRoutes] Login error:', err);
    res.status(500).json({
      error: {
        code: 'LOGIN_FAILED',
        message: 'Could not log in. Please try again.',
      },
    });
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.token) {
      await authService.logout(req.token);
    }
    res.json({ message: 'Logged out successfully.' });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'LOGOUT_ERROR',
        message: 'Failed to log out.',
      },
    });
  }
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const profile = await authService.getProfile(req.user!.id);
    res.json({ user: profile });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'PROFILE_ERROR',
        message: 'Could not retrieve profile.',
      },
    });
  }
});
