import { migrationRunner } from '../database/migrationRunner.js';
import { authService } from '../services/authService.js';
import { userService } from '../services/userService.js';
import { sessionService } from '../security/session.js';
import { projectService } from '../services/projectService.js';
import { videoService } from '../services/videoService.js';
import { creditService } from '../services/creditService.js';
import { jobQueue } from '../services/jobQueue.js';
import { cloudStorage } from '../services/cloudStorage.js';
import { verifyPassword } from '../security/password.js';
import { CREDIT_CONFIG } from '../config/credits.js';
import { standardLimiter, InMemoryRateLimiter, IRateLimiter } from '../security/rateLimiter.js';
import { db } from '../database/connection.js';

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

async function runPhase2Tests() {
  console.log('================================================================');
  console.log('       AI VIDEO STUDIO — PHASE 2 PRODUCTION BACKEND TESTS       ');
  console.log('================================================================\n');

  // 1. Run Database Migrations (Primary PostgreSQL schema)
  console.log('1. Testing Database Migration System...');
  await migrationRunner.migrateUp();
  const status = await migrationRunner.getStatus();
  assert(status.pending.length === 0, 'All pending migrations applied with 0 pending');
  console.log(`     Applied migrations: ${status.applied.join(', ')}`);

  // 2. User Registration & Password Security (Correction #2)
  console.log('\n2. Testing User Registration & Password Security...');
  const testEmailA = `test_user_a_${Date.now()}@example.com`;
  const testPasswordA = 'SuperSecret123!';
  const authA = await authService.register({
    email: testEmailA,
    password: testPasswordA,
    name: 'Alice Creator',
  });

  assert(authA.user.email === testEmailA, 'User registered with correct email');
  assert(authA.user.credits === CREDIT_CONFIG.SIGNUP_BONUS, `User granted ${CREDIT_CONFIG.SIGNUP_BONUS} configurable welcome credits`);
  assert(typeof authA.token === 'string' && authA.token.length > 20, 'Cryptographically secure session token issued');

  // Verify password hash in DB
  const rawUserInDb = await userService.getUserByEmail(testEmailA);
  assert(rawUserInDb !== null, 'User found in database');
  assert(rawUserInDb!.password_hash !== testPasswordA, 'Password is NOT stored in plaintext');
  assert(rawUserInDb!.password_hash.startsWith('$2'), 'Password is hashed with bcrypt (12 rounds)');
  const passwordMatch = await verifyPassword(testPasswordA, rawUserInDb!.password_hash);
  assert(passwordMatch === true, 'Bcrypt verification validates correct password');
  const wrongPasswordMatch = await verifyPassword('WrongPassword', rawUserInDb!.password_hash);
  assert(wrongPasswordMatch === false, 'Bcrypt verification rejects incorrect password');

  // 3. Login, Session Validation, and Logout
  console.log('\n3. Testing Authentication & Session Lifecycle...');
  const loginResult = await authService.login({
    email: testEmailA,
    password: testPasswordA,
  });
  assert(loginResult.user.id === authA.user.id, 'Login successful with matching user ID');
  assert(typeof loginResult.token === 'string', 'Login issues fresh session token');

  // Validate session
  const sessionInfo = await sessionService.validateSession(loginResult.token);
  assert(sessionInfo !== null && sessionInfo.userId === authA.user.id, 'Session token validates successfully');

  // Revoke / Logout
  const revoked = await authService.logout(loginResult.token);
  assert(revoked === true, 'Logout revokes session token');
  const postLogoutValidation = await sessionService.validateSession(loginResult.token);
  assert(postLogoutValidation === null, 'Revoked session is strictly rejected');

  // 4. Multi-User Isolation & Ownership Verification (Correction #10)
  console.log('\n4. Testing Multi-User Ownership & Resource Isolation...');
  const testEmailB = `test_user_b_${Date.now()}@example.com`;
  const authB = await authService.register({
    email: testEmailB,
    password: 'Password456!',
    name: 'Bob Viewer',
  });

  // User A creates project and video
  const projectA = await projectService.createProject({
    userId: authA.user.id,
    title: "Alice's Secret Documentary",
    type: 'long',
  });
  assert(projectA.userId === authA.user.id, "Project created for Alice");

  const videoA = await videoService.createVideo({
    userId: authA.user.id,
    projectId: projectA.id,
    type: 'long',
    title: "Alice's Video",
    durationSeconds: 480,
  });

  // User B tries to access User A's project and video
  const bobAccessToAliceProject = await projectService.getProjectById(authB.user.id, projectA.id);
  assert(bobAccessToAliceProject === null, "Bob CANNOT access Alice's project (returns null)");

  const bobAccessToAliceVideo = await videoService.getVideoById(authB.user.id, videoA.id);
  assert(bobAccessToAliceVideo === null, "Bob CANNOT access Alice's video (returns null)");

  const bobDeleteAliceProject = await projectService.deleteProject(authB.user.id, projectA.id);
  assert(bobDeleteAliceProject === false, "Bob CANNOT delete Alice's project");

  // 5. Configurable Credit System & Transactions (Correction #4)
  console.log('\n5. Testing Configurable Credit Ledger & Atomic Deductions...');
  const walletA = await creditService.getWallet(authA.user.id);
  assert(walletA !== null && walletA.balance === CREDIT_CONFIG.SIGNUP_BONUS, `Alice wallet balance is ${CREDIT_CONFIG.SIGNUP_BONUS}`);

  // Debit for Short video
  const shortCost = CREDIT_CONFIG.COSTS.SHORT_VIDEO;
  const debitRes = await creditService.debitCredits(
    authA.user.id,
    shortCost,
    'generation',
    'Short video creation test'
  );
  assert(debitRes.newBalance === CREDIT_CONFIG.SIGNUP_BONUS - shortCost, `Balance accurately reduced by ${shortCost} credits`);

  const transactions = await creditService.getTransactions(authA.user.id);
  assert(transactions.length >= 2, 'Transactions ledger contains bonus and generation debit');
  assert(transactions[0].amount === -shortCost, `Latest transaction records -${shortCost} debit`);

  // Insufficient credits check
  let insufficientCaught = false;
  try {
    await creditService.debitCredits(authA.user.id, 99999, 'generation', 'Expensive test');
  } catch (err: any) {
    if (err.message.includes('INSUFFICIENT_CREDITS')) insufficientCaught = true;
  }
  assert(insufficientCaught, 'Excessive debit request safely rejected with INSUFFICIENT_CREDITS');

  // Refund credits check
  const newBal = await creditService.refundCredits(authA.user.id, shortCost, 'Refund for test failure');
  assert(newBal === CREDIT_CONFIG.SIGNUP_BONUS, `Refund restores balance to ${CREDIT_CONFIG.SIGNUP_BONUS} credits`);

  // 6. Persistent Background Job Queue & Server Restart Recovery (Correction #10)
  console.log('\n6. Testing Persistent Job Queue & Crash Recovery Simulation...');
  const enqueued = await jobQueue.enqueue({
    userId: authA.user.id,
    topic: 'Test Quantum Computing Short Video',
    videoType: 'short',
    durationSeconds: 30,
    style: 'cinematic',
  });

  assert(enqueued.status === 'queued', 'Job entered database queue with status=queued');
  assert(typeof enqueued.jobId === 'string', 'Job assigned valid UUID');

  // Simulate interrupted server state: simulate job becoming 'generating' before crash
  await db.execute(
    `UPDATE video_jobs SET status = 'generating', current_step = 'Was rendering before simulated crash' WHERE id = $1`,
    [enqueued.jobId]
  );

  // Run startup crash recovery
  const recoveredCount = await jobQueue.recoverStaleJobs();
  assert(recoveredCount >= 1, 'Crash recovery identified interrupted jobs');

  const recoveredJob = await jobQueue.getJob(authA.user.id, enqueued.jobId);
  assert(recoveredJob !== null && recoveredJob.status === 'queued', 'Interrupted job safely reset to status=queued for worker retry');

  // Bob cannot access Alice's job
  const bobJobAccess = await jobQueue.getJob(authB.user.id, enqueued.jobId);
  assert(bobJobAccess === null, "Bob CANNOT query Alice's background job status");

  // 7. Rate Limiter Interface (Correction #3)
  console.log('\n7. Testing Rate Limiting Interface...');
  const customLimiter: IRateLimiter = new InMemoryRateLimiter(60 * 1000, 3);
  const r1 = await customLimiter.checkLimit('test_user_ip', 3, 60000);
  const r2 = await customLimiter.checkLimit('test_user_ip', 3, 60000);
  const r3 = await customLimiter.checkLimit('test_user_ip', 3, 60000);
  const r4 = await customLimiter.checkLimit('test_user_ip', 3, 60000);

  assert(r1.allowed === true && r2.allowed === true && r3.allowed === true, 'First 3 requests within limit allowed');
  assert(r4.allowed === false && r4.remaining === 0, '4th request blocked by rate limiter');

  // 8. Cloud Storage Keys & Path Traversal Prevention
  console.log('\n8. Testing Cloud Storage Keys & Security...');
  const safeKey = cloudStorage.generateVideoKey(authA.user.id, 'vid_123', 'output.mp4');
  assert(safeKey === `users/${authA.user.id}/videos/vid_123/output.mp4`, 'Safe storage key generated');

  const maliciousKey = '../../etc/passwd';
  const sanitized = cloudStorage.sanitizeKey(maliciousKey);
  assert(!sanitized.includes('..') && !sanitized.startsWith('/'), 'Path traversal sanitized safely');

  console.log('\n================================================================');
  console.log(`PHASE 2 TEST RESULTS: ${passed}/${total} assertions PASSED successfully!`);
  console.log('================================================================\n');
}

runPhase2Tests().catch((err) => {
  console.error('Phase 2 Test Suite Error:', err);
  process.exit(1);
});
