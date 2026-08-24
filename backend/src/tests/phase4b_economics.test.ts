import { PROVIDER_PRICING } from '../config/providerPricing.js';
import { costEstimator } from '../services/costEstimator.js';
import { observability } from '../services/observability.js';

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

async function runEconomicsAuditTests() {
  console.log('================================================================');
  console.log('   AI VIDEO STUDIO — PHASE 4B UNIT ECONOMICS AUDIT TEST SUITE   ');
  console.log('================================================================\n');

  // 1. Verify Official Provider Pricing Constants
  console.log('1. Auditing Centralized Provider Pricing Constants...');
  assert(PROVIDER_PRICING.veo['veo-3.1-generate-preview'].pricePerSecondUsd === 0.05, 'Veo Lite/Preview = $0.05/sec verified');
  assert(PROVIDER_PRICING.veo['veo-3.1-fast'].pricePerSecondUsd === 0.15, 'Veo Fast = $0.15/sec verified');
  assert(PROVIDER_PRICING.veo['veo-3.0-standard'].pricePerSecondUsd === 0.45, 'Veo Standard = $0.45/sec verified');
  assert(PROVIDER_PRICING.gemini['gemini-2.5-flash'].inputPerMillionTokensUsd === 0.30, 'Gemini 2.5 Flash input = $0.30/1M verified');
  assert(PROVIDER_PRICING.gemini['gemini-2.5-flash'].outputPerMillionTokensUsd === 2.50, 'Gemini 2.5 Flash output = $2.50/1M verified');
  assert(PROVIDER_PRICING.voice.neural2.pricePerMillionCharactersUsd === 16.00, 'TTS Neural2 = $16/1M chars verified');
  assert(PROVIDER_PRICING.storage.gcsStandardStoragePerGbMonthUsd === 0.026, 'GCS Storage = $0.026/GB/mo verified');
  assert(PROVIDER_PRICING.storage.egressBandwidthPerGbUsd === 0.12, 'GCS Egress Bandwidth = $0.12/GB verified');

  // 2. Short Video Economics (15s, 30s, 60s, 90s)
  console.log('\n2. Testing Short Video Economics...');
  const short15 = costEstimator.estimateCost('short', 15);
  const short30 = costEstimator.estimateCost('short', 30);
  const short60 = costEstimator.estimateCost('short', 60);

  assert(short15.estimatedVeoSeconds === 15, '15s Short uses exactly 15s Veo');
  assert(short15.estimatedProviderCostUsd >= 0.75 && short15.estimatedProviderCostUsd <= 0.85, '15s Short provider cost ~$0.79');

  assert(short30.estimatedVeoSeconds === 30, '30s Short uses exactly 30s Veo');
  assert(short30.estimatedProviderCostUsd >= 1.50 && short30.estimatedProviderCostUsd <= 1.65, '30s Short provider cost ~$1.58');

  assert(short60.estimatedVeoSeconds === 60, '60s Short uses 60s Veo');
  assert(short60.estimatedProviderCostUsd >= 3.00 && short60.estimatedProviderCostUsd <= 3.30, '60s Short provider cost ~$3.15');

  // 3. Long Video Hybrid Economics (8m, 10m, 15m, 20m, 30m)
  console.log('\n3. Testing Long Video Hybrid Economics (Veo Capped at <=60s)...');
  const long8 = costEstimator.estimateCost('long', undefined, 8);
  const long10 = costEstimator.estimateCost('long', undefined, 10);
  const long15 = costEstimator.estimateCost('long', undefined, 15);
  const long30 = costEstimator.estimateCost('long', undefined, 30);

  assert(long8.estimatedVeoSeconds === 60, '8 min Long video caps Veo at 60s');
  assert(long8.estimatedSupportingSeconds === 420, '8 min Long video generates 420s supporting visuals');
  assert(long8.estimatedProviderCostUsd >= 3.10 && long8.estimatedProviderCostUsd <= 3.45, '8 min Long provider cost ~$3.22 (vs $24 if 100% Veo!)');

  assert(long10.estimatedVeoSeconds === 60, '10 min Long video caps Veo at 60s');
  assert(long15.estimatedVeoSeconds === 60, '15 min Long video caps Veo at 60s');
  assert(long30.estimatedVeoSeconds === 60, '30 min Long video caps Veo at 60s');
  assert(long30.estimatedProviderCostUsd <= 4.00, '30 min Long video stays under $4.00 provider cost');

  // 4. Multiple Veo Strategy Cost Comparison
  console.log('\n4. Auditing Multi-Strategy Veo Long Video Economics...');
  const durationSec = 8 * 60; // 480 seconds (8 min)
  const costStrategyA = durationSec * 0.05 + 0.20; // 100% Veo = 480 * $0.05 = $24.20
  const costStrategyB = (durationSec * 0.5) * 0.05 + 0.20; // 50% Veo = 240 * $0.05 = $12.20
  const costStrategyC = (durationSec * 0.25) * 0.05 + 0.20; // 25% Veo = 120 * $0.05 = $6.20
  const costStrategyD = long8.estimatedProviderCostUsd; // Hybrid (60s Veo + Motion) = ~$3.22

  assert(costStrategyA > 24.00, 'Strategy A (100% Veo) is unsustainable at $24.20/video');
  assert(costStrategyD < 3.50, 'Strategy D (Hybrid) achieves 86% cost reduction ($3.22 vs $24.20)');

  // 5. Observability & Margin Tracking
  console.log('\n5. Auditing Observability Financial Analytics Snapshot...');
  observability.recordCreditDebit(100);
  observability.recordCreditRefund(10);
  observability.recordJobComplete(500, 15000, 2000, {
    veoSec: 30,
    geminiIn: 1500,
    geminiOut: 800,
    voiceChars: 450,
    storageMb: 15,
  });

  const snapshot = observability.getSnapshot();
  assert(snapshot.financials.totalEstimatedRevenueUsd > 0, 'Estimated revenue calculated');
  assert(snapshot.financials.totalEstimatedProviderCostUsd > 0, 'Estimated provider cost calculated');
  assert(snapshot.financials.grossMarginPercent > 0, 'Gross margin percentage positive');

  console.log('\n================================================================');
  console.log(`PHASE 4B ECONOMICS AUDIT TEST RESULTS: ${passed}/${total} assertions PASSED!`);
  console.log('================================================================\n');
}

runEconomicsAuditTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Economics audit test failed:', err);
    process.exit(1);
  });
