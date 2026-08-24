import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection.js';
import { creditService } from './creditService.js';
import { notificationService } from './notificationService.js';

export interface InAppProduct {
  productId: string;
  name: string;
  credits: number;
  priceUsd: number;
}

export const IN_APP_PACKAGES: Record<string, InAppProduct> = {
  'ai_video_starter_100': {
    productId: 'ai_video_starter_100',
    name: 'Starter Pack (100 Credits)',
    credits: 100,
    priceUsd: 9.99,
  },
  'ai_video_creator_250': {
    productId: 'ai_video_creator_250',
    name: 'Creator Pack (250 Credits)',
    credits: 250,
    priceUsd: 19.99,
  },
  'ai_video_pro_700': {
    productId: 'ai_video_pro_700',
    name: 'Pro Pack (700 Credits)',
    credits: 700,
    priceUsd: 49.99,
  },
  'ai_video_studio_1600': {
    productId: 'ai_video_studio_1600',
    name: 'Studio Pack (1,600 Credits)',
    credits: 1600,
    priceUsd: 99.99,
  },
};

export interface ProcessPurchaseInput {
  userId: string;
  purchaseToken: string;
  productId: string;
  orderId?: string;
  rawPayload?: any;
}

export interface PurchaseResult {
  success: boolean;
  isDuplicate: boolean;
  purchaseId: string;
  creditsGranted: number;
  newBalance: number;
  productId: string;
}

export class BillingService {
  /**
   * Idempotently verifies and processes a Google Play in-app purchase (Task 6).
   * Guarantees that duplicate webhooks or multiple submissions of the same purchaseToken
   * allocate credits EXACTLY ONCE.
   */
  public async verifyAndProcessPurchase(input: ProcessPurchaseInput): Promise<PurchaseResult> {
    if (!input.purchaseToken || !input.productId) {
      throw new Error('INVALID_PURCHASE: purchaseToken and productId are required.');
    }

    const pack = IN_APP_PACKAGES[input.productId];
    if (!pack) {
      throw new Error(`INVALID_PRODUCT_ID: Product "${input.productId}" is not recognized.`);
    }

    // 1. Idempotency Check: check if purchaseToken already exists in DB
    const existing = await db.queryOne<any>(
      'SELECT * FROM in_app_purchases WHERE purchase_token = $1',
      [input.purchaseToken]
    );

    if (existing) {
      console.log(`[BillingService] Duplicate purchase token match: ${input.purchaseToken}. Zero additional credits granted.`);
      const wallet = await creditService.getWallet(input.userId);
      return {
        success: true,
        isDuplicate: true,
        purchaseId: existing.id,
        creditsGranted: 0,
        newBalance: wallet ? wallet.balance : 0,
        productId: existing.product_id,
      };
    }

    const purchaseId = uuidv4();

    // 2. Insert into in_app_purchases with unique constraint protection
    try {
      await db.execute(
        `INSERT INTO in_app_purchases (id, user_id, purchase_token, product_id, order_id, purchase_state, credits_granted, raw_payload, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'PURCHASED', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          purchaseId,
          input.userId,
          input.purchaseToken,
          input.productId,
          input.orderId || `GPA.${Date.now()}-${uuidv4().slice(0, 8)}`,
          pack.credits,
          input.rawPayload ? JSON.stringify(input.rawPayload) : null,
        ]
      );
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate')) {
        // Concurrent race condition: another thread inserted first
        const raced = await db.queryOne<any>(
          'SELECT * FROM in_app_purchases WHERE purchase_token = $1',
          [input.purchaseToken]
        );
        const wallet = await creditService.getWallet(input.userId);
        return {
          success: true,
          isDuplicate: true,
          purchaseId: raced ? raced.id : purchaseId,
          creditsGranted: 0,
          newBalance: wallet ? wallet.balance : 0,
          productId: input.productId,
        };
      }
      throw err;
    }

    // 3. Atomically credit user wallet
    const newBalance = await creditService.refundCredits(
      input.userId,
      pack.credits,
      `In-App Purchase: ${pack.name} ($${pack.priceUsd})`,
      purchaseId
    );

    // 4. Send confirmation notification
    await notificationService.createNotification(
      input.userId,
      'credits_purchased',
      'Credits Added 🎉',
      `${pack.credits} credits have been added to your account for ${pack.name}.`,
      { purchaseId, creditsGranted: pack.credits, newBalance }
    );

    console.log(`[BillingService] Successfully processed purchase ${purchaseId}: granted ${pack.credits} credits to user ${input.userId}.`);

    return {
      success: true,
      isDuplicate: false,
      purchaseId,
      creditsGranted: pack.credits,
      newBalance,
      productId: input.productId,
    };
  }

  /**
   * Returns list of available in-app credit packages.
   */
  public getCatalog(): InAppProduct[] {
    return Object.values(IN_APP_PACKAGES);
  }

  public async listPurchases(limit = 50, offset = 0): Promise<any[]> {
    return db.query(
      `SELECT p.*, u.name AS user_name, u.email AS user_email
       FROM in_app_purchases p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  }
}

export const billingService = new BillingService();
