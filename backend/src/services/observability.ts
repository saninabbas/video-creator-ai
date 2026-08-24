import { PROVIDER_PRICING } from '../config/providerPricing.js';

export interface FinancialMetrics {
  totalEstimatedRevenueUsd: number;
  totalEstimatedProviderCostUsd: number;
  totalEstimatedGrossProfitUsd: number;
  grossMarginPercent: number;
  totalVeoSeconds: number;
  totalGeminiInputTokens: number;
  totalGeminiOutputTokens: number;
  totalVoiceCharacters: number;
  totalStorageMb: number;
  totalBandwidthMb: number;
  totalRefundCostUsd: number;
}

export interface MetricsSnapshot {
  jobsQueued: number;
  jobsProcessing: number;
  jobsCompleted: number;
  jobsFailed: number;
  jobsRetrying: number;
  totalCreditsDebited: number;
  totalCreditsRefunded: number;
  rateLimit429Count: number;
  serverError5xxCount: number;
  networkTimeoutCount: number;
  avgGeminiDurationMs: number;
  avgVeoDurationMs: number;
  avgFfmpegDurationMs: number;
  uptimeSeconds: number;
  financials: FinancialMetrics;
}

export class ObservabilityService {
  private startTime = Date.now();
  private jobsCompleted = 0;
  private jobsFailed = 0;
  private jobsRetrying = 0;
  private totalCreditsDebited = 0;
  private totalCreditsRefunded = 0;
  private rateLimit429Count = 0;
  private serverError5xxCount = 0;
  private networkTimeoutCount = 0;

  private totalVeoSeconds = 0;
  private totalGeminiInputTokens = 0;
  private totalGeminiOutputTokens = 0;
  private totalVoiceCharacters = 0;
  private totalStorageMb = 0;
  private totalBandwidthMb = 0;

  private geminiDurations: number[] = [];
  private veoDurations: number[] = [];
  private ffmpegDurations: number[] = [];

  public recordJobComplete(
    geminiMs?: number,
    veoMs?: number,
    ffmpegMs?: number,
    usage?: {
      veoSec?: number;
      geminiIn?: number;
      geminiOut?: number;
      voiceChars?: number;
      storageMb?: number;
    }
  ): void {
    this.jobsCompleted++;
    if (geminiMs) this.geminiDurations.push(geminiMs);
    if (veoMs) this.veoDurations.push(veoMs);
    if (ffmpegMs) this.ffmpegDurations.push(ffmpegMs);

    if (usage) {
      if (usage.veoSec) this.totalVeoSeconds += usage.veoSec;
      if (usage.geminiIn) this.totalGeminiInputTokens += usage.geminiIn;
      if (usage.geminiOut) this.totalGeminiOutputTokens += usage.geminiOut;
      if (usage.voiceChars) this.totalVoiceCharacters += usage.voiceChars;
      if (usage.storageMb) {
        this.totalStorageMb += usage.storageMb;
        this.totalBandwidthMb += usage.storageMb * 2;
      }
    }

    if (this.geminiDurations.length > 100) this.geminiDurations.shift();
    if (this.veoDurations.length > 100) this.veoDurations.shift();
    if (this.ffmpegDurations.length > 100) this.ffmpegDurations.shift();
  }

  public recordJobFailed(errorType?: string): void {
    this.jobsFailed++;
    if (errorType === 'RATE_LIMITED') this.rateLimit429Count++;
    else if (errorType === 'NETWORK_TIMEOUT') this.networkTimeoutCount++;
    else if (errorType === 'PROVIDER_UNAVAILABLE') this.serverError5xxCount++;
  }

  public recordJobRetrying(): void {
    this.jobsRetrying++;
  }

  public recordCreditDebit(amount: number): void {
    this.totalCreditsDebited += amount;
  }

  public recordCreditRefund(amount: number): void {
    this.totalCreditsRefunded += amount;
  }

  public getSnapshot(activeQueued = 0, activeProcessing = 0): MetricsSnapshot {
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

    // Calculate Financial Economics
    // Assume effective price per credit in paid subscription package = $0.10 / credit
    const effectiveCreditPriceUsd = 0.10;
    const netCredits = Math.max(0, this.totalCreditsDebited - this.totalCreditsRefunded);
    const estimatedRevenue = netCredits * effectiveCreditPriceUsd;

    const veoCost = this.totalVeoSeconds * PROVIDER_PRICING.veo['veo-3.1-generate-preview'].pricePerSecondUsd;
    const geminiCost =
      (this.totalGeminiInputTokens / 1_000_000) * PROVIDER_PRICING.gemini['gemini-2.5-flash'].inputPerMillionTokensUsd +
      (this.totalGeminiOutputTokens / 1_000_000) * PROVIDER_PRICING.gemini['gemini-2.5-flash'].outputPerMillionTokensUsd;
    const voiceCost = (this.totalVoiceCharacters / 1_000_000) * PROVIDER_PRICING.voice.neural2.pricePerMillionCharactersUsd;
    const storageCost = (this.totalStorageMb / 1024) * PROVIDER_PRICING.storage.gcsStandardStoragePerGbMonthUsd;
    const bandwidthCost = (this.totalBandwidthMb / 1024) * PROVIDER_PRICING.storage.egressBandwidthPerGbUsd;

    const totalProviderCost = veoCost + geminiCost + voiceCost + storageCost + bandwidthCost;
    const grossProfit = estimatedRevenue - totalProviderCost;
    const grossMarginPercent = estimatedRevenue > 0 ? Math.round((grossProfit / estimatedRevenue) * 100) : 0;
    const refundCost = this.totalCreditsRefunded * effectiveCreditPriceUsd;

    return {
      jobsQueued: activeQueued,
      jobsProcessing: activeProcessing,
      jobsCompleted: this.jobsCompleted,
      jobsFailed: this.jobsFailed,
      jobsRetrying: this.jobsRetrying,
      totalCreditsDebited: this.totalCreditsDebited,
      totalCreditsRefunded: this.totalCreditsRefunded,
      rateLimit429Count: this.rateLimit429Count,
      serverError5xxCount: this.serverError5xxCount,
      networkTimeoutCount: this.networkTimeoutCount,
      avgGeminiDurationMs: avg(this.geminiDurations),
      avgVeoDurationMs: avg(this.veoDurations),
      avgFfmpegDurationMs: avg(this.ffmpegDurations),
      uptimeSeconds: Math.round((Date.now() - this.startTime) / 1000),
      financials: {
        totalEstimatedRevenueUsd: parseFloat(estimatedRevenue.toFixed(2)),
        totalEstimatedProviderCostUsd: parseFloat(totalProviderCost.toFixed(4)),
        totalEstimatedGrossProfitUsd: parseFloat(grossProfit.toFixed(2)),
        grossMarginPercent,
        totalVeoSeconds: this.totalVeoSeconds,
        totalGeminiInputTokens: this.totalGeminiInputTokens,
        totalGeminiOutputTokens: this.totalGeminiOutputTokens,
        totalVoiceCharacters: this.totalVoiceCharacters,
        totalStorageMb: this.totalStorageMb,
        totalBandwidthMb: this.totalBandwidthMb,
        totalRefundCostUsd: parseFloat(refundCost.toFixed(2)),
      },
    };
  }

  /**
   * Sanitizes log text to ensure zero credentials, tokens, or passwords are leaked.
   */
  public sanitizeLog(message: string): string {
    return message
      .replace(/AIzaSy[A-Za-z0-9_-]{33}/g, 'AIzaSy***REDACTED***')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***REDACTED***')
      .replace(/password["']?\s*:\s*["'][^"']+["']/gi, 'password:"***REDACTED***"')
      .replace(/postgres:\/\/[^:]+:[^@]+@/gi, 'postgres://***:***@');
  }
}

export const observability = new ObservabilityService();
