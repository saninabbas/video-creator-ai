import { migrationRunner } from '../database/migrationRunner.js';
import { authService } from '../services/authService.js';
import { projectService } from '../services/projectService.js';
import { videoService } from '../services/videoService.js';
import { creditService } from '../services/creditService.js';
import { notificationService } from '../services/notificationService.js';
import { jobQueue } from '../services/jobQueue.js';
import { cloudStorage } from '../services/cloudStorage.js';

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

async function runAndroidApiContractTests() {
  console.log('================================================================');
  console.log('    AI VIDEO STUDIO — ANDROID CLIENT API CONTRACT TEST SUITE    ');
  console.log('================================================================\n');

  // 1. Migrations
  await migrationRunner.migrateUp();

  // 2. Auth Flow Contract (Register & Login)
  console.log('1. Testing Android Auth API Contract...');
  const testEmail = `android_user_${Date.now()}@example.com`;
  const registerResult = await authService.register({
    email: testEmail,
    password: 'MobileAppSecret123!',
    name: 'Android Creator',
  });

  assert(typeof registerResult.token === 'string', 'Auth token string present');
  assert(typeof registerResult.user.id === 'string', 'UserDto.id present');
  assert(registerResult.user.credits === 50, 'UserDto.credits = 50');
  assert(registerResult.user.name === 'Android Creator', 'UserDto.name matches');

  const loginResult = await authService.login({
    email: testEmail,
    password: 'MobileAppSecret123!',
  });
  assert(typeof loginResult.token === 'string', 'Login returns valid session token');

  const meProfile = await authService.getProfile(loginResult.user.id);
  assert(meProfile.id === loginResult.user.id, 'GET /api/auth/me profile matches');

  // 3. Project Creation Contract
  console.log('\n2. Testing Android Project Contract...');
  const project = await projectService.createProject({
    userId: loginResult.user.id,
    title: 'Mobile Project Series',
    type: 'short',
  });
  assert(typeof project.id === 'string', 'ProjectDto.id present');
  assert(project.title === 'Mobile Project Series', 'ProjectDto.title matches');

  // 4. Short Video Creation (9:16) Contract
  console.log('\n3. Testing Android Short Creation (9:16) Contract...');
  const shortEnqueued = await jobQueue.enqueue({
    userId: loginResult.user.id,
    projectId: project.id,
    topic: '10 facts about volcanic islands',
    videoType: 'short',
    durationSeconds: 30,
    style: 'cinematic',
  });

  assert(typeof shortEnqueued.jobId === 'string', 'CreateVideoResponse.jobId present');
  assert(typeof shortEnqueued.videoId === 'string', 'CreateVideoResponse.videoId present');
  assert(shortEnqueued.status === 'queued', 'CreateVideoResponse.status = queued');

  // 5. Long Video Creation (16:9) Contract
  console.log('\n4. Testing Android Long Creation (16:9) Contract...');
  // Grant 50 bonus credits for the long video test
  await creditService.refundCredits(loginResult.user.id, 50, 'Test credit top-up');

  const longEnqueued = await jobQueue.enqueue({
    userId: loginResult.user.id,
    topic: 'Documentary: Secrets of the Solar System',
    videoType: 'long',
    durationMinutes: 8,
    style: 'documentary',
  });

  assert(typeof longEnqueued.jobId === 'string', 'Long video jobId present');
  assert(typeof longEnqueued.videoId === 'string', 'Long video videoId present');

  // 6. Video Job Status & Polling Contract
  console.log('\n5. Testing Video Job Status & Polling Contract...');
  const videoRecord = await videoService.getVideoById(loginResult.user.id, shortEnqueued.videoId);
  assert(videoRecord !== null, 'VideoDto retrievable');
  assert(videoRecord!.width === 720 && videoRecord!.height === 1280, 'Short video dimensions 720x1280 (9:16)');

  const longVideoRecord = await videoService.getVideoById(loginResult.user.id, longEnqueued.videoId);
  assert(longVideoRecord !== null, 'Long VideoDto retrievable');
  assert(longVideoRecord!.width === 1280 && longVideoRecord!.height === 720, 'Long video dimensions 1280x720 (16:9)');

  // 7. Video List Contract (My Videos tabs)
  console.log('\n6. Testing Video List Contract...');
  const userVideos = await videoService.getUserVideos(loginResult.user.id, 50);
  assert(userVideos.length >= 2, 'VideoListResponse contains all created videos');
  const shortVideos = userVideos.filter((v) => v.type === 'short');
  const longVideos = userVideos.filter((v) => v.type === 'long');
  assert(shortVideos.length >= 1, 'Shorts filter tab supported');
  assert(longVideos.length >= 1, 'Long video filter tab supported');

  // 8. Credits & Ledger Contract
  console.log('\n7. Testing Credits Contract...');
  const wallet = await creditService.getWallet(loginResult.user.id);
  assert(wallet !== null, 'CreditsResponse.balance available');
  const txs = await creditService.getTransactions(loginResult.user.id);
  assert(txs.length >= 3, 'CreditsResponse.transactions available for ledger');

  // 9. Notifications Contract
  console.log('\n8. Testing Notifications Contract...');
  await notificationService.createNotification(
    loginResult.user.id,
    'video_completed',
    'Short video ready 🎉',
    'Your volcanic islands video is finished.',
    { videoId: shortEnqueued.videoId }
  );
  const notifs = await notificationService.getUserNotifications(loginResult.user.id);
  assert(notifs.length >= 1, 'NotificationListResponse populated');
  assert(notifs[0].title === 'Short video ready 🎉', 'Notification title matches');

  // 10. Logout Contract
  console.log('\n9. Testing Logout Contract...');
  const logoutSuccess = await authService.logout(loginResult.token);
  assert(logoutSuccess === true, 'Logout revokes token');

  console.log('\n================================================================');
  console.log(`ANDROID API CONTRACT RESULTS: ${passed}/${total} assertions PASSED!`);
  console.log('================================================================\n');
}

runAndroidApiContractTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Contract test error:', err);
    process.exit(1);
  });
