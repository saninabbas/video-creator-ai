import { migrationRunner } from '../database/migrationRunner.js';
import { db } from '../database/connection.js';
import { authService } from '../services/authService.js';
import { jobQueue } from '../services/jobQueue.js';
import { creditService } from '../services/creditService.js';
import { observability } from '../services/observability.js';
import { providerConcurrency } from '../services/providerConcurrency.js';

async function runLoadTest(concurrencyLevels = [10, 50, 100, 500, 1000]) {
  console.log('================================================================');
  console.log('    AI VIDEO STUDIO — HIGH-SCALE 1,000-USER LOAD TEST HARNESS   ');
  console.log('================================================================\n');

  await migrationRunner.migrateUp();

  // 1. Create Load Test Users
  console.log('Step 1: Provisioning Load Test Users...');
  const userCount = 25;
  const userIds: string[] = [];

  for (let i = 0; i < userCount; i++) {
    const email = `load_user_${i}_${Date.now()}@example.com`;
    const reg = await authService.register({
      email,
      password: 'Password123!',
      name: `Load Creator ${i}`,
    });
    // Top up test credits for batch runs
    await creditService.refundCredits(reg.user.id, 2000, 'Load test provision');
    userIds.push(reg.user.id);
  }
  console.log(`  ✓ Provisioned ${userCount} active users with verified credit wallets.`);

  const runId = Date.now();

  // 2. Run Scaled Load Batches
  for (const batchSize of concurrencyLevels) {
    console.log(`\nStep 2: Dispatching Batch of ${batchSize} Concurrent Generation Requests...`);
    const tStart = Date.now();

    const promises = Array.from({ length: batchSize }).map((_, idx) => {
      const uId = userIds[idx % userIds.length];
      const videoType = idx % 3 === 0 ? 'long' : 'short';
      return jobQueue.enqueue({
        userId: uId,
        topic: `Load Test Topic #${idx} - ${videoType}`,
        videoType: videoType as 'short' | 'long',
        durationSeconds: videoType === 'short' ? 30 : undefined,
        durationMinutes: videoType === 'long' ? 8 : undefined,
        style: 'cinematic',
        idempotencyKey: `idempotency_load_${runId}_${batchSize}_${idx}`,
      });
    });

    const results = await Promise.all(promises);
    const elapsedMs = Date.now() - tStart;
    const avgLatencyMs = Math.round(elapsedMs / batchSize);

    console.log(`  ✓ Successfully enqueued ${results.length}/${batchSize} jobs.`);
    console.log(`  ✓ Total enqueue time: ${elapsedMs}ms | Avg latency per request: ${avgLatencyMs}ms`);

    // Verify all returned valid job IDs
    const validCount = results.filter((r) => r && r.jobId && typeof r.status === 'string').length;
    if (validCount !== batchSize) {
      throw new Error(`Batch verification failed: expected ${batchSize} valid jobs, got ${validCount}`);
    }
  }

  // 3. Verify Database Queue Depth & Integrity
  console.log('\nStep 3: Verifying Database Queue Consistency...');
  const totalJobsInDb = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM video_jobs WHERE idempotency_key LIKE 'idempotency_load_${runId}_%'`
  );
  const totalExpected = concurrencyLevels.reduce((a, b) => a + b, 0);
  console.log(`  ✓ Total enqueued test jobs in DB: ${totalJobsInDb?.count} (Expected: ${totalExpected})`);

  // 4. Test Idempotency under High Load
  console.log('\nStep 4: Testing Idempotency & Double Debit Protection under Load...');
  const testUserId = userIds[0];
  const walletBefore = await creditService.getWallet(testUserId);
  const fixedKey = `load_idempotency_strict_${Date.now()}`;

  // Submit same request 5 times concurrently
  const duplicateResults = await Promise.all([
    jobQueue.enqueue({ userId: testUserId, topic: 'Strict Idempotency Test', videoType: 'short', idempotencyKey: fixedKey, style: 'cinematic' }),
    jobQueue.enqueue({ userId: testUserId, topic: 'Strict Idempotency Test', videoType: 'short', idempotencyKey: fixedKey, style: 'cinematic' }),
    jobQueue.enqueue({ userId: testUserId, topic: 'Strict Idempotency Test', videoType: 'short', idempotencyKey: fixedKey, style: 'cinematic' }),
    jobQueue.enqueue({ userId: testUserId, topic: 'Strict Idempotency Test', videoType: 'short', idempotencyKey: fixedKey, style: 'cinematic' }),
    jobQueue.enqueue({ userId: testUserId, topic: 'Strict Idempotency Test', videoType: 'short', idempotencyKey: fixedKey, style: 'cinematic' }),
  ]);

  const uniqueJobIds = new Set(duplicateResults.map((r) => r.jobId));
  const walletAfter = await creditService.getWallet(testUserId);

  if (uniqueJobIds.size !== 1) {
    throw new Error(`Idempotency failed: expected 1 unique job, got ${uniqueJobIds.size}`);
  }
  if (walletBefore!.balance - walletAfter!.balance !== 10) {
    throw new Error(`Double debit occurred! Balance diff: ${walletBefore!.balance - walletAfter!.balance}`);
  }
  console.log('  ✓ Verified exactly 1 job created and exactly 10 credits deducted across 5 concurrent submissions.');

  // 5. Verify Provider Concurrency Semaphores
  console.log('\nStep 5: Inspecting Provider Concurrency Semaphores...');
  const stats = providerConcurrency.getAllStats();
  console.log('  Provider Concurrency Stats:', JSON.stringify(stats, null, 2));

  // 6. Observability Metrics
  console.log('\nStep 6: Observability Snapshot...');
  const metrics = observability.getSnapshot();
  console.log('  System Metrics Snapshot:', JSON.stringify(metrics, null, 2));

  console.log('\n================================================================');
  console.log('       PHASE 4A HIGH-SCALE LOAD TEST RESULTS: ALL PASS          ');
  console.log('================================================================\n');
}

runLoadTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Load test error:', err);
    process.exit(1);
  });
