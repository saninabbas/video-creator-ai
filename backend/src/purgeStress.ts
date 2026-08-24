import { db } from './database/connection.js';

async function purgeStressJobs() {
  console.log('Purging test/stress jobs from database...');
  await db.execute(`
    DELETE FROM video_jobs
    WHERE user_id IN (
      SELECT id FROM users
      WHERE email LIKE 'stress_%'
         OR email LIKE 'test_user_%'
         OR email LIKE '%@example.com'
         OR email LIKE 'worker_test_%'
         OR email LIKE 'real_veo_%'
         OR email LIKE 'producer_%'
         OR email LIKE 'e2e_%'
         OR email LIKE 'http_test_%'
    )
  `);

  await db.execute(`
    DELETE FROM videos
    WHERE user_id IN (
      SELECT id FROM users
      WHERE email LIKE 'stress_%'
         OR email LIKE 'test_user_%'
         OR email LIKE '%@example.com'
         OR email LIKE 'worker_test_%'
         OR email LIKE 'real_veo_%'
         OR email LIKE 'producer_%'
         OR email LIKE 'e2e_%'
         OR email LIKE 'http_test_%'
    )
  `);

  const remaining = await db.query(`
    SELECT j.id, j.status, j.created_at, v.title, u.email
    FROM video_jobs j
    JOIN videos v ON j.video_id = v.id
    JOIN users u ON j.user_id = u.id
    WHERE j.status IN ('queued', 'planning', 'generating', 'processing')
    ORDER BY j.created_at ASC
  `);

  console.log('Active user queue count:', remaining.length);
  console.log('Active jobs:', remaining);
}

purgeStressJobs().catch(console.error);
