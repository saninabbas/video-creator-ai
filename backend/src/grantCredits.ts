import { db } from './database/connection.js';
import { v4 as uuidv4 } from 'uuid';

async function grant() {
  const emails = ['saninabbas@gmail.com', 'saninabbas3381@gmail.com'];
  
  for (const email of emails) {
    let user = await db.queryOne<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    let userId = user ? user.id : uuidv4();

    if (!user) {
      // Create user if not existing
      await db.execute(
        `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'creator', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, email.toLowerCase(), '$2b$12$eX.dummy.hash.for.testing.account.only', 'Sanin Creator']
      );
      const walletId = uuidv4();
      await db.execute(
        `INSERT INTO credit_wallets (id, user_id, balance, created_at, updated_at)
         VALUES ($1, $2, 1000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [walletId, userId]
      );
      await db.execute(
        `INSERT INTO credit_transactions (id, wallet_id, user_id, amount, balance_after, description, type, created_at)
         VALUES ($1, $2, $3, 1000, 1000, 'ADMIN_TEST_GRANT', 'grant', CURRENT_TIMESTAMP)`,
        [uuidv4(), walletId, userId]
      );
      console.log(`Created account for ${email} and credited 1000 credits.`);
    } else {
      // Ensure wallet exists and update balance to 1000
      let wallet = await db.queryOne<{ id: string }>(
        'SELECT id FROM credit_wallets WHERE user_id = $1',
        [user.id]
      );
      let walletId = wallet ? wallet.id : uuidv4();
      if (wallet) {
        await db.execute(
          'UPDATE credit_wallets SET balance = 1000, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
          [user.id]
        );
      } else {
        await db.execute(
          `INSERT INTO credit_wallets (id, user_id, balance, created_at, updated_at)
           VALUES ($1, $2, 1000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [walletId, user.id]
        );
      }
      await db.execute(
        `INSERT INTO credit_transactions (id, wallet_id, user_id, amount, balance_after, description, type, created_at)
         VALUES ($1, $2, $3, 1000, 1000, 'ADMIN_TEST_GRANT', 'grant', CURRENT_TIMESTAMP)`,
        [uuidv4(), walletId, user.id]
      );
      console.log(`Updated wallet balance to 1000 credits for ${email} (User ID: ${user.id}).`);
    }
  }

  const allWallets = await db.query(
    `SELECT u.email, w.balance 
     FROM users u 
     JOIN credit_wallets w ON w.user_id = u.id 
     WHERE u.email LIKE '%sanin%'`
  );
  console.log('Current balances:', allWallets);
}

grant().catch(console.error);
