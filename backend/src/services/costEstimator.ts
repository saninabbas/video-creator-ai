import { GENERATION_POLICY } from '../config/generationPolicy.js';
import { PROVIDER_PRICING } from '../config/providerPricing.js';

export interface ItemizedCostBreakdown {
  geminiCostUsd: number;
  veoCostUsd: number;
  voiceCostUsd: number;
  storageCostUsd: number;
  bandwidthCostUsd: number;
  computeCostUsd: number;
  retryAllowanceUsd: number;
  totalEstimatedCostUsd: number;
}

export interface PreFlightCostEstimate {
  videoType: 'short' | 'long';
  targetDurationSeconds: number;
  estimatedVeoSeconds: number;
  estimatedSupportingSeconds: number;
  estimatedGeminiInputTokens: number;
  estimatedGeminiOutputTokens: number;
  estimatedVoiceCharacters: number;
  estimatedStorageMb: number;
  estimatedBandwidthMb: number;
  estimatedCredits: number;
  breakdown: ItemizedCostBreakdown;
  estimatedProviderCostUsd: number;
}

export class CostEstimatorService {
  /**
   * Calculates comprehensive pre-flight resource consumption and verified provider costs.
   */
  public estimateCost(
    videoType: 'short' | 'long',
    durationSeconds?: number,
    durationMinutes?: number,
    veoModelKey: keyof typeof PROVIDER_PRICING.veo = 'veo-3.1-generate-preview'
  ): PreFlightCostEstimate {
    const totalDurationSeconds =
      videoType === 'long'
        ? (durationMinutes || 8) * 60
        : durationSeconds || 30;

    let estimatedVeoSeconds: number;
    let estimatedSupportingSeconds: number;
    let estimatedCredits: number;
    let estimatedStorageMb: number;

    if (videoType === 'short') {
      // Shorts: 100% video footage
      estimatedVeoSeconds = Math.min(totalDurationSeconds, GENERATION_POLICY.SHORT.maxVeoSeconds);
      estimatedSupportingSeconds = 0;
      estimatedCredits = GENERATION_POLICY.SHORT.creditCost;
      estimatedStorageMb = Math.round((totalDurationSeconds / 60) * 15); // ~15MB/min (720p 9:16)
    } else {
      // Long: Hybrid strategy (capped at 60s premium Veo footage, supporting B-roll & motion visuals)
      estimatedVeoSeconds = Math.min(60, GENERATION_POLICY.LONG.maxVeoSeconds);
      estimatedSupportingSeconds = Math.max(0, totalDurationSeconds - estimatedVeoSeconds);
      estimatedCredits = GENERATION_POLICY.LONG.creditCost;
      estimatedStorageMb = Math.round((totalDurationSeconds / 60) * 20); // ~20MB/min (720p 16:9)
    }

    // Gemini Tokens (Input prompt + Schema instructions / Output JSON plan)
    const geminiInputTokens = videoType === 'short' ? 1200 : 3500;
    const geminiOutputTokens = videoType === 'short' ? 800 : 2500;

    // Voice Narration: ~15 characters spoken per second
    const voiceCharacters = totalDurationSeconds * 15;

    // Bandwidth: User video stream downloads (assuming 2 views per created video)
    const bandwidthMb = estimatedStorageMb * 2;

    // Verified Pricing Calculation
    const geminiPricing = PROVIDER_PRICING.gemini['gemini-2.5-flash'];
    const geminiCostUsd =
      (geminiInputTokens / 1_000_000) * geminiPricing.inputPerMillionTokensUsd +
      (geminiOutputTokens / 1_000_000) * geminiPricing.outputPerMillionTokensUsd;

    const veoPricing = PROVIDER_PRICING.veo[veoModelKey] || PROVIDER_PRICING.veo['veo-3.1-generate-preview'];
    const veoCostUsd = estimatedVeoSeconds * veoPricing.pricePerSecondUsd;

    const voicePricing = PROVIDER_PRICING.voice.neural2;
    const voiceCostUsd = (voiceCharacters / 1_000_000) * voicePricing.pricePerMillionCharactersUsd;

    const storageCostUsd = (estimatedStorageMb / 1024) * PROVIDER_PRICING.storage.gcsStandardStoragePerGbMonthUsd;
    const bandwidthCostUsd = (bandwidthMb / 1024) * PROVIDER_PRICING.storage.egressBandwidthPerGbUsd;
    const computeCostUsd = (totalDurationSeconds / 60) * PROVIDER_PRICING.compute.ffmpegTranscodePerMinuteUsd;

    const subtotal = geminiCostUsd + veoCostUsd + voiceCostUsd + storageCostUsd + bandwidthCostUsd + computeCostUsd;
    const retryAllowanceUsd = subtotal * PROVIDER_PRICING.compute.retrySafetyAllowanceRatio;
    const totalEstimatedCostUsd = parseFloat((subtotal + retryAllowanceUsd).toFixed(5));

    return {
      videoType,
      targetDurationSeconds: totalDurationSeconds,
      estimatedVeoSeconds,
      estimatedSupportingSeconds,
      estimatedGeminiInputTokens: geminiInputTokens,
      estimatedGeminiOutputTokens: geminiOutputTokens,
      estimatedVoiceCharacters: voiceCharacters,
      estimatedStorageMb: Math.max(5, estimatedStorageMb),
      estimatedBandwidthMb: Math.max(10, bandwidthMb),
      estimatedCredits,
      breakdown: {
        geminiCostUsd: parseFloat(geminiCostUsd.toFixed(6)),
        veoCostUsd: parseFloat(veoCostUsd.toFixed(4)),
        voiceCostUsd: parseFloat(voiceCostUsd.toFixed(6)),
        storageCostUsd: parseFloat(storageCostUsd.toFixed(6)),
        bandwidthCostUsd: parseFloat(bandwidthCostUsd.toFixed(6)),
        computeCostUsd: parseFloat(computeCostUsd.toFixed(6)),
        retryAllowanceUsd: parseFloat(retryAllowanceUsd.toFixed(6)),
        totalEstimatedCostUsd,
      },
      estimatedProviderCostUsd: totalEstimatedCostUsd,
    };
  }
}

export const costEstimator = new CostEstimatorService();
