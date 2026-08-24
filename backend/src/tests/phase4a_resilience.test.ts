import { AsyncSemaphore, providerConcurrency } from '../services/providerConcurrency.js';
import { retryEngine } from '../services/retryEngine.js';
import { costEstimator } from '../services/costEstimator.js';
import { observability } from '../services/observability.js';
import { migrationRunner } from '../database/migrationRunner.js';
import { db } from '../database/connection.js';
import { authService } from '../services/authService.js';
import { jobQueue } from '../services/jobQueue.js';
import { creditService } from '../services/creditService.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    throw new Error(`Assertion failed for: ${testName}`);
  }
}

async function runResilienceTests() {
  console.log('================================================================');
  console.log('       AI VIDEO STUDIO — PHASE 4A RESILIENCE TEST SUITE         ');
  console.log('================================================================\n');

  await migrationRunner.migrateUp();

  // 1. Concurrency Semaphore Test
  console.log('1. Testing Async Semaphore Concurrency Limits...');
  const sem = new AsyncSemaphore(2, 'TestSem');
  let activeCount = 0;
  let maxObserved = 0;

  const tasks = Array.from({ length: 6 }).map(async (_, idx) => {
    return sem.run(async () => {
      activeCount++;
      if (activeCount > maxObserved) maxObserved = activeCount;
      await new Promise((r) => setTimeout(r, 50));
      activeCount--;
      return idx;
    });
  });

  await Promise.all(tasks);
  assert(maxObserved <= 2, 'Semaphore strictly enforces max concurrency of 2');
  assert(activeCount === 0, 'All semaphore leases released back to 0');

  // 2. Retry Engine Evaluation & Backoff Test
  console.log('\n2. Testing Retry Engine Error Classification & Backoff...');
  const rateLimitEval = retryEngine.evaluate({ status: 429, message: 'Resource exhausted' }, 1);
  assert(rateLimitEval.isRetryable === true, 'HTTP 429 classified as retryable');
  assert(rateLimitEval.delayMs >= 1000, 'Backoff delay calculated with positive jitter');

  const timeoutEval = retryEngine.evaluate(new Error('ETIMEDOUT: connect timeout'), 2);
  assert(timeoutEval.isRetryable === true, 'Network timeout classified as retryable');

  const fatalEval = retryEngine.evaluate(new Error('MISSING_CREDENTIALS: API key not set'), 1);
  assert(fatalEval.isRetryable === false, 'Missing credentials classified as unrecoverable fatal error');

  const maxAttemptsEval = retryEngine.evaluate({ status: 503 }, 4);
  assert(maxAttemptsEval.isRetryable === false, 'Exceeded max attempts correctly marked non-retryable');

  // 3. Pre-Flight Cost Estimator Test
  console.log('\n3. Testing Cost Estimator Service...');
  const shortCost = costEstimator.estimateCost('short', 30);
  assert(shortCost.estimatedVeoSeconds === 30, 'Short video estimates 30s Veo');
  assert(shortCost.estimatedCredits === 10, 'Short video credit cost = 10');

  const longCost = costEstimator.estimateCost('long', undefined, 10);
  assert(longCost.estimatedVeoSeconds <= 60, 'Long video hybrid strategy caps Veo at <=60s');
  assert(longCost.estimatedCredits === 50, 'Long video credit cost = 50');
  assert(longCost.estimatedProviderCostUsd > 0, 'Provider cost calculation positive');

  // 4. Observability & Log Sanitization Test
  console.log('\n4. Testing Observability & Log Sanitization...');
  observability.recordCreditDebit(10);
  observability.recordCreditRefund(10);
  const snapshot = observability.getSnapshot(2, 1);
  assert(snapshot.totalCreditsDebited >= 10, 'Credit debit tracked in metrics');
  assert(snapshot.totalCreditsRefunded >= 10, 'Credit refund tracked in metrics');

  const rawLog = 'Connected with AIzaSyTestKey1234567890123456789012345678 and Authorization: Bearer token_secret_123';
  const sanitized = observability.sanitizeLog(rawLog);
  assert(!sanitized.includes('AIzaSyTestKey'), 'API key securely redacted from log');
  assert(!sanitized.includes('token_secret_123'), 'Bearer token securely redacted from log');

  // 5. Worker Atomic Lease Claiming & Recovery Test
  console.log('\n5. Testing Worker Lease Claiming & Crash Recovery...');
  const testUser = await authService.register({
    email: `worker_test_${Date.now()}@example.com`,
    password: 'Password123!',
    name: 'Worker Tester',
  });

  const enqueued = await jobQueue.enqueue({
    userId: testUser.user.id,
    topic: 'Lease Claiming Resilience Test',
    videoType: 'short',
    durationSeconds: 15,
    style: 'cinematic',
  });

  // Claim job
  const claimedJob = await jobQueue.claimNextJob();
  assert(claimedJob !== null, 'Job claimed atomically by worker');
  assert(claimedJob?.status === 'planning', 'Claimed job transitioned to planning');
  assert(typeof claimedJob?.worker_id === 'string', 'Worker ID stamped on job record');

  // Simulate stale lease by setting status to planning and lease_expires_at in the past
  const pastIso = new Date(Date.now() - 30000).toISOString();
  await db.execute(
    `UPDATE video_jobs SET status = 'planning', lease_expires_at = $1 WHERE id = $2`,
    [pastIso, enqueued.jobId]
  );

  const recovered = await jobQueue.recoverStaleJobs();
  assert(recovered >= 1, 'Stale lease identified and recovered to queued');

  const afterRecovery = await jobQueue.getJob(testUser.user.id, enqueued.jobId);
  assert(afterRecovery?.status === 'queued', 'Recovered job status is queued for pickup');

  console.log('\n================================================================');
  console.log(`PHASE 4A RESILIENCE TEST RESULTS: ${passed}/${total} assertions PASSED!`);
  console.log('================================================================\n');
}

runResilienceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Resilience test failed:', err);
    process.exit(1);
  });
