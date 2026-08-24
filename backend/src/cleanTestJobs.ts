import { db } from './database/connection.js';

async function cleanup() {
  console.log('Cleaning up stress test jobs...');
  // Find creator user
  const user = await db.queryOne<{ id: string }>(`SELECT id FROM users WHERE email = 'saninabbas3381@gmail.com'`);
  if (user) {
    // Delete all jobs not belonging to creator
    await db.execute(`DELETE FROM video_jobs WHERE user_id != $1`, [user.id]);
    await db.execute(`DELETE FROM videos WHERE user_id != $1`, [user.id]);
    
    // Reset creator's jobs to queued so worker executes them fresh
    await db.execute(`UPDATE video_jobs SET status = 'queued', progress = 0, current_step = 'Queued for processing', worker_id = NULL, lease_expires_at = NULL WHERE user_id = $1`, [user.id]);
    await db.execute(`UPDATE videos SET status = 'generating' WHERE user_id = $1`, [user.id]);

    // Give creator 100 free credits
    await db.execute(`UPDATE credit_wallets SET balance = 100 WHERE user_id = $1`, [user.id]);
    console.log('Successfully cleaned up test jobs and prioritized creator jobs with 100 credits!');
  }

  const jobs = await db.query(`SELECT j.id, j.status, j.progress, v.title FROM video_jobs j JOIN videos v ON v.id = j.video_id`);
  console.log('Remaining creator jobs in queue:', jobs);
}

cleanup().catch(console.error);
