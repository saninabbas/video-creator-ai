import { db } from './database/connection.js';

async function resetAndClean() {
  console.log('[DB Clean] Purging old stress/test jobs...');
  // Delete all jobs not belonging to real creator
  await db.execute(`DELETE FROM video_jobs WHERE user_id NOT IN (SELECT id FROM users WHERE email LIKE '%sanin%')`);
  await db.execute(`DELETE FROM videos WHERE user_id NOT IN (SELECT id FROM users WHERE email LIKE '%sanin%')`);

  // Reset any queued or interrupted user jobs
  const res = await db.execute(`
    UPDATE video_jobs 
    SET status = 'queued', progress = 0, current_step = 'Queued for immediate processing', 
        worker_id = NULL, lease_expires_at = NULL, next_retry_at = NULL, error_message = NULL
    WHERE status != 'completed'
  `);
  console.log(`[DB Clean] Reset ${res.rowCount} creator jobs to queued.`);

  const activeJobs = await db.query(`SELECT id, status, progress, current_step FROM video_jobs`);
  console.log('[DB Clean] Active creator jobs:', activeJobs);
}

resetAndClean().catch(console.error);
