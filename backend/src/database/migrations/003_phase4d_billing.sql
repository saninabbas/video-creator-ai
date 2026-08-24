-- AI Video Studio - Phase 4D Google Play Billing & Purchase Ledger Migration
-- Idempotent In-App Purchases Table

CREATE TABLE IF NOT EXISTS in_app_purchases (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purchase_token VARCHAR(255) NOT NULL UNIQUE,
    product_id VARCHAR(100) NOT NULL,
    order_id VARCHAR(100),
    purchase_state VARCHAR(50) NOT NULL DEFAULT 'PURCHASED',
    credits_granted INTEGER NOT NULL,
    raw_payload TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON in_app_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_token ON in_app_purchases(purchase_token);
