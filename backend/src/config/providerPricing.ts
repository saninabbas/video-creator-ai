/**
 * Centralized Google AI, Cloud & Infrastructure Provider Pricing Configuration.
 * Audited and verified against official Google Cloud Vertex AI & Google AI Studio documentation (August 2026).
 */

export interface ModelPricingTier {
  provider: 'google' | 'internal';
  modelId: string;
  unit: string;
  unitPriceUsd: number;
  source: string;
  dateVerified: string;
  confidence: 'HIGH' | 'MEDIUM' | 'PRICE_NOT_VERIFIED';
  notes?: string;
}

export const PROVIDER_PRICING = {
  // Gemini AI Director / Reasoning / Scripting
  gemini: {
    'gemini-2.5-flash': {
      provider: 'google',
      modelId: 'gemini-2.5-flash',
      inputPerMillionTokensUsd: 0.30,
      outputPerMillionTokensUsd: 2.50,
      source: 'Google AI Studio / Vertex AI Generative AI Pricing',
      dateVerified: '2026-08',
      confidence: 'HIGH',
      notes: 'Scheduled for deprecation Oct 2026; recommend upgrading to gemini-3.7-flash or gemini-3.5-flash-lite.',
    },
    'gemini-3.7-flash': {
      provider: 'google',
      modelId: 'gemini-3.7-flash',
      inputPerMillionTokensUsd: 0.75,
      outputPerMillionTokensUsd: 3.75,
      source: 'Google AI Studio Pricing (Introductory rate through Dec 2026)',
      dateVerified: '2026-08',
      confidence: 'HIGH',
    },
    'gemini-3.5-flash-lite': {
      provider: 'google',
      modelId: 'gemini-3.5-flash-lite',
      inputPerMillionTokensUsd: 0.30,
      outputPerMillionTokensUsd: 2.50,
      source: 'Google AI Studio Pricing',
      dateVerified: '2026-08',
      confidence: 'HIGH',
    },
  },

  // Veo Video Generation Models
  veo: {
    'veo-3.1-generate-preview': {
      provider: 'google',
      modelId: 'veo-3.1-generate-preview',
      pricePerSecondUsd: 0.05, // Lite / preview tier
      resolution: '720p',
      source: 'Google Vertex AI Video Generation Model Pricing (Lite Tier)',
      dateVerified: '2026-08',
      confidence: 'HIGH',
      notes: 'Pay-per-second duration billing, video-only.',
    },
    'veo-3.1-fast': {
      provider: 'google',
      modelId: 'veo-3.1-fast',
      pricePerSecondUsd: 0.15,
      resolution: '720p / 1080p',
      source: 'Google Vertex AI Video Generation Fast Tier',
      dateVerified: '2026-08',
      confidence: 'HIGH',
    },
    'veo-3.0-standard': {
      provider: 'google',
      modelId: 'veo-3.0-generate-001',
      pricePerSecondUsd: 0.45,
      resolution: '1080p',
      source: 'Google Cloud Vertex AI Production Video Models',
      dateVerified: '2026-08',
      confidence: 'HIGH',
    },
    'veo-3.0-with-audio': {
      provider: 'google',
      modelId: 'veo-3.0-audio',
      pricePerSecondUsd: 0.75,
      source: 'Google Cloud Vertex AI Video with Audio Generation',
      dateVerified: '2026-08',
      confidence: 'HIGH',
    },
  },

  // Voice Narration (Google Cloud Text-to-Speech)
  voice: {
    standard: {
      provider: 'google',
      modelId: 'google-tts-standard',
      pricePerMillionCharactersUsd: 4.00,
      source: 'Google Cloud Text-to-Speech Pricing (Standard / WaveNet)',
      dateVerified: '2026-08',
      confidence: 'HIGH',
    },
    neural2: {
      provider: 'google',
      modelId: 'google-tts-neural2',
      pricePerMillionCharactersUsd: 16.00,
      source: 'Google Cloud Text-to-Speech Pricing (Neural2)',
      dateVerified: '2026-08',
      confidence: 'HIGH',
      notes: '1M characters free per month per Google Cloud billing account.',
    },
  },

  // Storage & CDN Egress
  storage: {
    gcsStandardStoragePerGbMonthUsd: 0.026, // $0.000026 / MB / month
    egressBandwidthPerGbUsd: 0.12,          // $0.00012 / MB
    source: 'Google Cloud Storage Standard Pricing',
    dateVerified: '2026-08',
    confidence: 'HIGH',
  },

  // Internal Compute & Safety Allowance
  compute: {
    ffmpegTranscodePerMinuteUsd: 0.002, // VM CPU transcode cost
    retrySafetyAllowanceRatio: 0.05,    // 5% allowance for network/transient retries
  },
} as const;
