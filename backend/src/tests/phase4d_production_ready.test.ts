import { migrationRunner } from '../database/migrationRunner.js';
import { db } from '../database/connection.js';
import { authService } from '../services/authService.js';
import { projectService } from '../services/projectService.js';
import { videoService } from '../services/videoService.js';
import { creditService } from '../services/creditService.js';
import { jobQueue } from '../services/jobQueue.js';
import { billingService } from '../services/billingService.js';
import { observability } from '../services/observability.js';
import {
  getShortVideoCreditCost,
  getLongVideoCreditCost,
  validateAndSanitizeDuration,
} from '../config/credits.js';

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

async function runPhase4dProductionHardeningTests() {
  console.log('================================================================');
  console.log(' AI VIDEO STUDIO — PHASE 4D PRODUCTION HARDENING & GO-LIVE TEST ');
  console.log('================================================================\n');

  await migrationRunner.migrateUp();

  // -------------------------------------------------------------
  // TASK 1: DURATION-BASED SHORT VIDEO PRICING
  // -------------------------------------------------------------
  console.log('1. Auditing Duration-Based Short Video Pricing...');
  assert(getShortVideoCreditCost(15) === 10, '15s Short = 10 credits');
  assert(getShortVideoCreditCost(20) === 10, '20s Short = 10 credits');
  assert(getShortVideoCreditCost(21) === 20, '21s Short = 20 credits');
  assert(getShortVideoCreditCost(30) === 20, '30s Short = 20 credits');
  assert(getShortVideoCreditCost(40) === 20, '40s Short = 20 credits');
  assert(getShortVideoCreditCost(41) === 35, '41s Short = 35 credits');
  assert(getShortVideoCreditCost(60) === 35, '60s Short = 35 credits');

  // Test malicious client attempting to underpay for a 60s video
  const userShortTest = await authService.register({
    email: `short_pricing_${Date.now()}@example.com`,
    password: 'Password123!',
    name: 'Short Pricing User',
  });
  await creditService.refundCredits(userShortTest.user.id, 500, 'Provisioning');
  const balBefore60 = (await creditService.getWallet(userShortTest.user.id))!.balance;

  // Enqueue 60s short
  await jobQueue.enqueue({
    userId: userShortTest.user.id,
    topic: '60s Short Generation',
    videoType: 'short',
    durationSeconds: 60,
    style: 'cinematic',
  });
  const balAfter60 = (await creditService.getWallet(userShortTest.user.id))!.balance;
  assert(balBefore60 - balAfter60 === 35, 'Server strictly debits 35 credits for 60s short regardless of client');

  // -------------------------------------------------------------
  // TASK 2: LONG VIDEO CREDIT PRICING
  // -------------------------------------------------------------
  console.log('\n2. Auditing Long Video Credit Pricing...');
  assert(getLongVideoCreditCost(8, true) === 50, '8 min Long = 50 credits');
  assert(getLongVideoCreditCost(10, true) === 55, '10 min Long = 55 credits');
  assert(getLongVideoCreditCost(15, true) === 65, '15 min Long = 65 credits');
  assert(getLongVideoCreditCost(20, true) === 75, '20 min Long = 75 credits');
  assert(getLongVideoCreditCost(30, true) === 90, '30 min Long = 90 credits');

  // -------------------------------------------------------------
  // TASK 3: HARD GENERATION LIMITS & INPUT SANITIZATION
  // -------------------------------------------------------------
  console.log('\n3. Testing Hard Generation Limits & Input Validation...');
  assert(validateAndSanitizeDuration('short', 10).valid === false, 'Short < 15s rejected');
  assert(validateAndSanitizeDuration('short', 65).valid === false, 'Short > 60s rejected');
  assert(validateAndSanitizeDuration('short', -5).valid === false, 'Negative short rejected');
  assert(validateAndSanitizeDuration('short', NaN).valid === false, 'NaN short rejected');
  assert(validateAndSanitizeDuration('long', undefined, 5).valid === false, 'Long < 8 min rejected');
  assert(validateAndSanitizeDuration('long', undefined, 35).valid === false, 'Long > 30 min rejected');
  assert(validateAndSanitizeDuration('long', undefined, -2).valid === false, 'Negative long rejected');

  // -------------------------------------------------------------
  // TASK 6: GOOGLE PLAY BILLING & 100 DUPLICATE WEBHOOKS TEST
  // -------------------------------------------------------------
  console.log('\n4. Testing Google Play Billing Architecture & Duplicate Webhooks...');
  const billingUser = await authService.register({
    email: `billing_${Date.now()}@example.com`,
    password: 'Password123!',
    name: 'Billing Tester',
  });
  const billingToken = `GPA.3392-8821-4491-${Date.now()}`;
  const balBeforePurchase = (await creditService.getWallet(billingUser.user.id))!.balance;

  // Simulate 100 concurrent duplicate webhook / purchase verifications of the same token
  const purchaseResults = await Promise.all(
    Array.from({ length: 100 }).map(() =>
      billingService.verifyAndProcessPurchase({
        userId: billingUser.user.id,
        purchaseToken: billingToken,
        productId: 'ai_video_creator_250',
        orderId: `ORDER-${billingToken}`,
      })
    )
  );

  const balAfterPurchase = (await creditService.getWallet(billingUser.user.id))!.balance;
  const creditsGrantedTotal = purchaseResults.reduce((acc, r) => acc + r.creditsGranted, 0);
  const duplicatesCount = purchaseResults.filter((r) => r.isDuplicate).length;

  assert(creditsGrantedTotal === 250, '100 duplicate webhooks resulted in EXACTLY 250 credits granted');
  assert(duplicatesCount === 99, '99 duplicate submissions were safely detected and acknowledged with $0 credit allocation');
  assert(balAfterPurchase - balBeforePurchase === 250, 'User wallet balance incremented exactly by package amount (250 credits)');

  // -------------------------------------------------------------
  // TASK 7: CREDIT LEDGER RACE & CONCURRENT SAFETY
  // -------------------------------------------------------------
  console.log('\n5. Testing Credit Wallet Race Conditions & Zero Negative Balances...');
  const raceUser = await authService.register({
    email: `wallet_race_${Date.now()}@example.com`,
    password: 'Password123!',
    name: 'Wallet Race Tester',
  });
  // Balance is 50 signup credits. Let's fire 20 parallel 10-credit debits simultaneously.
  // Exactly 5 should succeed (5 x 10 = 50), and 15 must fail with INSUFFICIENT_CREDITS.
  let debitSuccesses = 0;
  let debitFailures = 0;

  await Promise.all(
    Array.from({ length: 20 }).map(async () => {
      try {
        await creditService.debitCredits(raceUser.user.id, 10, 'generation', 'Race debit attempt');
        debitSuccesses++;
      } catch (err) {
        debitFailures++;
      }
    })
  );

  const finalRaceWallet = await creditService.getWallet(raceUser.user.id);
  assert(debitSuccesses === 5, 'Exactly 5 debits succeeded on 50-credit wallet');
  assert(debitFailures === 15, '15 debits safely failed without throwing unhandled exceptions');
  assert(finalRaceWallet!.balance === 0, 'Wallet balance never dropped below zero (Final: 0)');

  // -------------------------------------------------------------
  // TASK 8 & 9: MEDIA OWNERSHIP SECURITY & IDOR PROTECTION
  // -------------------------------------------------------------
  console.log('\n6. Testing Authenticated Media Ownership & IDOR Protection...');
  const ownerUser = await authService.register({
    email: `owner_${Date.now()}@example.com`,
    password: 'Password123!',
    name: 'Owner User',
  });
  const eavesdropper = await authService.register({
    email: `eavesdropper_${Date.now()}@example.com`,
    password: 'Password123!',
    name: 'Eavesdropper User',
  });

  const ownerProj = await projectService.createProject({
    userId: ownerUser.user.id,
    title: 'Owner Secret Project',
    type: 'short',
  });
  const ownerVideo = await videoService.createVideo({
    userId: ownerUser.user.id,
    projectId: ownerProj.id,
    type: 'short',
    title: 'Private Video Asset',
    durationSeconds: 15,
  });

  // Eavesdropper tries to fetch owner video
  const idorVideo = await videoService.getVideoById(eavesdropper.user.id, ownerVideo.id);
  assert(idorVideo === null, 'IDOR Probe: Eavesdropper cannot fetch owner video (404/403 isolated)');

  // -------------------------------------------------------------
  // TASK 12: OBSERVABILITY & LOG REDACTION AUDIT
  // -------------------------------------------------------------
  console.log('\n7. Auditing Production Log Sanitizer & Zero-Secret Leaks...');
  const sensitiveLog =
    'User login with password:"SuperSecretPassword123!" and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and API key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q and DB postgres://user:secretpass@localhost:5432/db';
  const sanitized = observability.sanitizeLog(sensitiveLog);

  assert(!sanitized.includes('SuperSecretPassword123!'), 'Password redacted from logs');
  assert(!sanitized.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'Bearer token redacted from logs');
  assert(!sanitized.includes('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q'), 'API key redacted from logs');
  assert(!sanitized.includes('secretpass'), 'Database password redacted from logs');

  console.log('\n================================================================');
  console.log(`PHASE 4D PRODUCTION HARDENING RESULTS: ${passed}/${total} assertions PASSED!`);
  console.log('================================================================\n');
}

runPhase4dProductionHardeningTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Phase 4D Hardening test failed:', err);
    process.exit(1);
  });
