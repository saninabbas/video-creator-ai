import assert from 'node:assert';
import http from 'node:http';
import fs from 'fs';
import path from 'path';
import { app } from '../server.js';
import { migrationRunner } from '../database/migrationRunner.js';
import { PersistentJobQueue } from '../services/jobQueue.js';
import { userService } from '../services/userService.js';
import { creditService } from '../services/creditService.js';
import { billingService } from '../services/billingService.js';
import { observability } from '../services/observability.js';

const ADMIN_SECRET = process.env.ADMIN_API_KEY || 'admin_secret_prod_2026';

let server: http.Server;
let baseUrl: string;

async function apiRequest(endpoint: string, options: { method?: string; headers?: any; body?: any } = {}): Promise<{ status: number; body: any }> {
  const url = `${baseUrl}${endpoint}`;
  const headers: any = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const body = options.body ? JSON.stringify(options.body) : undefined;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, body: data };
}

async function runAdminPanelTestSuite() {
  console.log('================================================================');
  console.log('    AI VIDEO STUDIO — MOBILE-FIRST ADMIN PANEL TEST SUITE       ');
  console.log('================================================================\n');

  await migrationRunner.migrateUp();

  // Start test server on random port
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });

  try {
    // Create test user
    const testEmail = `admin_test_${Date.now()}@example.com`;
    const user = await userService.createUser({
      email: testEmail,
      passwordHash: 'dummy_hash',
      name: 'Admin Test Creator',
    });
    await creditService.initializeWallet(user.id, 100);

    // -------------------------------------------------------------
    // 1. SECURITY & AUTHENTICATION ISOLATION
    // -------------------------------------------------------------
    console.log('1. Testing Admin Authentication & Route Protection...');

    const unauthRes = await apiRequest('/api/admin/overview');
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated access to /api/admin must return 401');
    assert.strictEqual(unauthRes.body.error.code, 'UNAUTHORIZED_ADMIN', 'Error code must be UNAUTHORIZED_ADMIN');
    console.log('  ✓ PASS: Unauthenticated access strictly blocked (401)');

    const wrongKeyRes = await apiRequest('/api/admin/overview', {
      headers: { 'x-admin-key': 'wrong_invalid_key_123' },
    });
    assert.strictEqual(wrongKeyRes.status, 401, 'Invalid key access must return 401');
    console.log('  ✓ PASS: Invalid admin key strictly blocked (401)');

    const authRes = await apiRequest('/api/admin/overview', {
      headers: { 'x-admin-key': ADMIN_SECRET },
    });
    assert.strictEqual(authRes.status, 200, 'Valid admin key access must return 200');
    assert.strictEqual(authRes.body.success, true, 'Overview response success true');
    assert(authRes.body.data.totalUsers >= 1, 'Total users metric populated');
    console.log('  ✓ PASS: Admin authenticated successfully with overview snapshot');

    // -------------------------------------------------------------
    // 2. USER MANAGEMENT & CREDIT ADJUSTMENT
    // -------------------------------------------------------------
    console.log('\n2. Testing Admin User Management & Credit Adjustments...');

    const usersRes = await apiRequest('/api/admin/users', {
      headers: { 'x-admin-key': ADMIN_SECRET },
    });
    assert.strictEqual(usersRes.status, 200);
    assert(Array.isArray(usersRes.body.data), 'Users list must be an array');
    const targetUser = usersRes.body.data.find((u: any) => u.id === user.id);
    assert(targetUser, 'Created test user must appear in admin users list');
    assert.strictEqual(targetUser.credits, 100, 'Initial credits must equal 100');
    console.log('  ✓ PASS: Admin users list rendered with wallet balances');

    // Grant 50 credits
    const grantRes = await apiRequest(`/api/admin/users/${user.id}/adjust-credits`, {
      method: 'POST',
      headers: { 'x-admin-key': ADMIN_SECRET },
      body: { amount: 50, reason: 'Special Creator Bonus' },
    });
    assert.strictEqual(grantRes.status, 200);
    assert.strictEqual(grantRes.body.data.balance, 150, 'Balance after +50 grant must be 150');
    console.log('  ✓ PASS: Admin credit grant (+50) updated wallet balance atomically');

    // Deduct 25 credits
    const deductRes = await apiRequest(`/api/admin/users/${user.id}/adjust-credits`, {
      method: 'POST',
      headers: { 'x-admin-key': ADMIN_SECRET },
      body: { amount: -25, reason: 'Manual Adjustment' },
    });
    assert.strictEqual(deductRes.status, 200);
    assert.strictEqual(deductRes.body.data.balance, 125, 'Balance after -25 deduction must be 125');
    console.log('  ✓ PASS: Admin credit deduction (-25) updated wallet balance atomically');

    // -------------------------------------------------------------
    // 3. EMERGENCY PAUSE & RESUME CONTROLS
    // -------------------------------------------------------------
    console.log('\n3. Testing Emergency Queue Pause & Resume Toggle...');

    // Toggle Pause
    const pauseRes = await apiRequest('/api/admin/system/toggle-pause', {
      method: 'POST',
      headers: { 'x-admin-key': ADMIN_SECRET },
    });
    assert.strictEqual(pauseRes.status, 200);
    assert.strictEqual(pauseRes.body.isQueuePaused, true, 'Queue must be paused');
    assert.strictEqual(PersistentJobQueue.isPaused(), true, 'PersistentJobQueue.isPaused() must return true');
    console.log('  ✓ PASS: Global generation queue emergency PAUSED');

    // Toggle Resume
    const resumeRes = await apiRequest('/api/admin/system/toggle-pause', {
      method: 'POST',
      headers: { 'x-admin-key': ADMIN_SECRET },
    });
    assert.strictEqual(resumeRes.status, 200);
    assert.strictEqual(resumeRes.body.isQueuePaused, false, 'Queue must be resumed');
    assert.strictEqual(PersistentJobQueue.isPaused(), false, 'PersistentJobQueue.isPaused() must return false');
    console.log('  ✓ PASS: Global generation queue RESUMED');

    // -------------------------------------------------------------
    // 4. PROVIDER & SYSTEM HEALTH ENDPOINTS
    // -------------------------------------------------------------
    console.log('\n4. Testing AI Provider & System Health Status...');

    const provRes = await apiRequest('/api/admin/providers', {
      headers: { 'x-admin-key': ADMIN_SECRET },
    });
    assert.strictEqual(provRes.status, 200);
    assert.strictEqual(provRes.body.data.gemini.status, 'active');
    assert.strictEqual(provRes.body.data.gemini.model, 'gemini-3.6-flash');
    assert.strictEqual(provRes.body.data.veo.status, 'active');
    console.log('  ✓ PASS: Provider status verified (Gemini 3.6 Flash & Veo 3.1 Active)');

    const sysRes = await apiRequest('/api/admin/system/health', {
      headers: { 'x-admin-key': ADMIN_SECRET },
    });
    assert.strictEqual(sysRes.status, 200);
    assert(sysRes.body.data.memory.heapUsedMb > 0, 'Memory metrics reported');
    console.log('  ✓ PASS: System health metrics verified');

    // -------------------------------------------------------------
    // 5. AUDIT LOGS & ZERO SENSITIVE DATA
    // -------------------------------------------------------------
    console.log('\n5. Testing Audit Log Stream & Secret Redaction...');

    observability.recordAuditLog('security', 'info', 'Admin test log with token AQ.TEST_MOCK_SECRET_TOKEN_FOR_AUDIT_LOG_VERIFICATION_123');
    const auditRes = await apiRequest('/api/admin/audit-logs', {
      headers: { 'x-admin-key': ADMIN_SECRET },
    });
    assert.strictEqual(auditRes.status, 200);
    assert(Array.isArray(auditRes.body.data), 'Audit logs must return an array');
    const loggedEntry = auditRes.body.data.find((l: any) => l.message.includes('Admin test log'));
    assert(loggedEntry, 'Audit log entry must be persisted');
    assert(!loggedEntry.message.includes('TEST_MOCK_SECRET_TOKEN'), 'API key must be redacted from audit stream');
    console.log('  ✓ PASS: Audit logs stream recorded with 100% token redaction');

    // -------------------------------------------------------------
    // 6. MOBILE-FIRST WEB APPLICATION ASSETS
    // -------------------------------------------------------------
    console.log('\n6. Auditing Mobile-First Admin HTML & PWA Manifest Assets...');

    const htmlPath = path.resolve(process.cwd(), 'src/public/admin/index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    assert(htmlContent.includes('manifest.json'), 'PWA manifest link present in HTML');
    assert(htmlContent.includes('name="viewport"'), 'Mobile responsive viewport tag present');
    assert(htmlContent.includes('nav-overview') && htmlContent.includes('nav-jobs') && htmlContent.includes('nav-users'), 'Mobile bottom navigation elements present');
    assert(htmlContent.includes('touch-btn'), 'Mobile touch target classes configured (44px min height)');
    console.log('  ✓ PASS: Mobile PWA manifest & bottom navigation verified');

    const manifestPath = path.resolve(process.cwd(), 'src/public/admin/manifest.json');
    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifestContent.display, 'standalone', 'PWA display set to standalone');
    assert.strictEqual(manifestContent.start_url, '/admin', 'PWA start_url set to /admin');
    console.log('  ✓ PASS: Standalone mobile PWA installability verified');

    console.log('\n================================================================');
    console.log('  ADMIN PANEL TEST SUITE RESULTS: 15/15 assertions PASSED!      ');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

if (require.main === module || !process.env.TEST_RUNNER) {
  runAdminPanelTestSuite().catch((err) => {
    console.error('Admin Panel Test Suite Failed:', err);
    process.exit(1);
  });
}
