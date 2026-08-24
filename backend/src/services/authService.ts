import { userService, UserRecord } from './userService.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { sessionService } from '../security/session.js';
import { creditService } from './creditService.js';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    credits: number;
    createdAt: string;
  };
  token: string;
}

export class AuthService {
  /**
   * Registers a new user, hashes password, grants 50 welcome credits, and generates a session.
   */
  public async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await userService.getUserByEmail(input.email);
    if (existing) {
      throw new Error('EMAIL_EXISTS: An account with this email address already exists.');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await userService.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    // Initialize 50 free credits
    const wallet = await creditService.initializeWallet(user.id, 50);

    // Create session
    const { rawToken } = await sessionService.createSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: wallet.balance,
        createdAt: user.created_at,
      },
      token: rawToken,
    };
  }

  /**
   * Authenticates user via email and password, returning a new session token.
   */
  public async login(input: LoginInput): Promise<AuthResult> {
    const user = await userService.getUserByEmail(input.email);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS: Incorrect email or password.');
    }

    const passwordValid = await verifyPassword(input.password, user.password_hash);
    if (!passwordValid) {
      throw new Error('INVALID_CREDENTIALS: Incorrect email or password.');
    }

    if (user.status !== 'active') {
      throw new Error('ACCOUNT_DISABLED: Your account is suspended or disabled.');
    }

    const wallet = await creditService.getWallet(user.id);
    const { rawToken } = await sessionService.createSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: wallet?.balance || 0,
        createdAt: user.created_at,
      },
      token: rawToken,
    };
  }

  /**
   * Logs out the user by revoking the current session token.
   */
  public async logout(rawToken: string): Promise<boolean> {
    return sessionService.revokeSession(rawToken);
  }

  /**
   * Retrieves profile and live credit balance for current authenticated user.
   */
  public async getProfile(userId: string) {
    const user = await userService.getUserById(userId);
    if (!user) throw new Error('User not found.');

    const wallet = await creditService.getWallet(userId);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      credits: wallet?.balance || 0,
      createdAt: user.created_at,
    };
  }
}

export const authService = new AuthService();
