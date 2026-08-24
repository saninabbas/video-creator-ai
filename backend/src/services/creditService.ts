import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection.js';
import { CREDIT_CONFIG } from '../config/credits.js';

export type TransactionType = 'purchase' | 'generation' | 'regeneration' | 'refund' | 'bonus' | 'adjustment';

export interface CreditWallet {
  id: string;
  userId: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  walletId: string;
  userId: string;
  amount: number;
  type: TransactionType;
  description: string;
  referenceJobId?: string | null;
  balanceAfter: number;
  createdAt: string;
}

export class CreditService {
  /**
   * Initializes a credit wallet for a new user with configurable welcome bonus.
   */
  public async initializeWallet(userId: string, initialBonus = CREDIT_CONFIG.SIGNUP_BONUS): Promise<CreditWallet> {
    const walletId = uuidv4();
    await db.execute(
      `INSERT INTO credit_wallets (id, user_id, balance, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [walletId, userId, initialBonus]
    );

    if (initialBonus > 0) {
      await this.recordTransaction(userId, walletId, initialBonus, 'bonus', 'Welcome bonus credits', null, initialBonus);
    }

    return {
      id: walletId,
      userId,
      balance: initialBonus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Gets the credit wallet for a user.
   */
  public async getWallet(userId: string): Promise<CreditWallet | null> {
    const row = await db.queryOne<any>(
      'SELECT * FROM credit_wallets WHERE user_id = $1',
      [userId]
    );
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      balance: row.balance,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Atomically checks balance and debits credits for an operation.
   */
  public async debitCredits(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    referenceJobId?: string
  ): Promise<{ success: boolean; newBalance: number }> {
    if (amount <= 0) return { success: true, newBalance: 0 };

    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new Error('Credit wallet not found for user.');
    }

    if (wallet.balance < amount) {
      throw new Error(`INSUFFICIENT_CREDITS: Required ${amount} credits, but current balance is ${wallet.balance}.`);
    }

    const updateRes = await db.execute(
      `UPDATE credit_wallets SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND balance >= $1`,
      [amount, wallet.id]
    );

    if (updateRes.rowCount === 0) {
      throw new Error(`INSUFFICIENT_CREDITS: Required ${amount} credits, but current balance is insufficient.`);
    }

    const updatedWallet = await this.getWallet(userId);
    const newBalance = updatedWallet ? updatedWallet.balance : wallet.balance - amount;

    await this.recordTransaction(userId, wallet.id, -amount, type, description, referenceJobId, newBalance);

    console.log(`[CreditService] Debited ${amount} credits from user ${userId}. New balance: ${newBalance}`);
    return { success: true, newBalance };
  }

  /**
   * Atomically refunds credits if a video generation fails.
   */
  public async refundCredits(
    userId: string,
    amount: number,
    description: string,
    referenceJobId?: string
  ): Promise<number> {
    if (amount <= 0) return 0;

    const wallet = await this.getWallet(userId);
    if (!wallet) return 0;

    await db.execute(
      `UPDATE credit_wallets SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [amount, wallet.id]
    );

    const updatedWallet = await this.getWallet(userId);
    const newBalance = updatedWallet ? updatedWallet.balance : wallet.balance + amount;

    await this.recordTransaction(userId, wallet.id, amount, 'refund', description, referenceJobId, newBalance);

    console.log(`[CreditService] Refunded ${amount} credits to user ${userId}. New balance: ${newBalance}`);
    return newBalance;
  }

  /**
   * Gets recent transaction history for a user.
   */
  public async getTransactions(userId: string, limit = 50): Promise<CreditTransaction[]> {
    const rows = await db.query<any>(
      `SELECT * FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );

    return rows.map((r) => ({
      id: r.id,
      walletId: r.wallet_id,
      userId: r.user_id,
      amount: r.amount,
      type: r.type as TransactionType,
      description: r.description,
      referenceJobId: r.reference_job_id,
      balanceAfter: r.balance_after,
      createdAt: r.created_at,
    }));
  }

  private async recordTransaction(
    userId: string,
    walletId: string,
    amount: number,
    type: TransactionType,
    description: string,
    referenceJobId?: string | null,
    balanceAfter: number = 0
  ): Promise<void> {
    const txId = uuidv4();
    await db.execute(
      `INSERT INTO credit_transactions (id, wallet_id, user_id, amount, type, description, reference_job_id, balance_after, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
      [txId, walletId, userId, amount, type, description, referenceJobId || null, balanceAfter]
    );
  }
}

export const creditService = new CreditService();
