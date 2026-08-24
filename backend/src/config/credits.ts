/**
 * Authoritative Credit & Duration Pricing Configuration (Phases 1-4D).
 * Enforced strictly SERVER-SIDE to protect unit economics.
 */

export const CREDIT_CONFIG = {
  // Signup bonus credits granted to new accounts (50 credits)
  SIGNUP_BONUS: parseInt(process.env.CREDIT_SIGNUP_BONUS || '50', 10),

  // Default / Baseline Costs
  COSTS: {
    SHORT_VIDEO: 10,
    LONG_VIDEO: 50,
    SHORT_VIDEO_BASE: 10,
    LONG_VIDEO_BASE: 50,
    SCENE_REGENERATION: 5,
    AI_IMPROVEMENT: 2,
    CREATE_SHORTS_FROM_LONG: 15,
  },

  // Limits
  MAX_DAILY_GENERATIONS: parseInt(process.env.MAX_DAILY_GENERATIONS || '100', 10),
};

/**
 * Single Authoritative Pricing Function for Short Videos (Task 1).
 * 15–20 seconds = 10 credits
 * 21–40 seconds = 20 credits
 * 41–60 seconds = 35 credits
 */
export function getShortVideoCreditCost(durationSeconds: number): number {
  if (typeof durationSeconds !== 'number' || isNaN(durationSeconds) || !isFinite(durationSeconds)) {
    throw new Error('INVALID_DURATION: Duration must be a valid finite number.');
  }

  const rounded = Math.round(durationSeconds);

  if (rounded < 15 || rounded > 60) {
    throw new Error(`INVALID_DURATION: Short video duration must be between 15 and 60 seconds (requested: ${durationSeconds}s).`);
  }

  if (rounded <= 20) {
    return 10;
  } else if (rounded <= 40) {
    return 20;
  } else {
    return 35;
  }
}

/**
 * Single Authoritative Pricing Function for Long Videos (Task 2).
 * 8 min (480s)  = 50 credits
 * 10 min (600s) = 55 credits
 * 15 min (900s) = 65 credits
 * 20 min (1200s) = 75 credits
 * 30 min (1800s) = 90 credits
 */
export function getLongVideoCreditCost(durationSecondsOrMinutes: number, isMinutes = false): number {
  if (typeof durationSecondsOrMinutes !== 'number' || isNaN(durationSecondsOrMinutes) || !isFinite(durationSecondsOrMinutes)) {
    throw new Error('INVALID_DURATION: Duration must be a valid finite number.');
  }

  const minutes = isMinutes ? durationSecondsOrMinutes : Math.round(durationSecondsOrMinutes / 60);

  if (minutes < 8 || minutes > 30) {
    throw new Error(`INVALID_DURATION: Long video duration must be between 8 and 30 minutes (requested: ${minutes}m).`);
  }

  if (minutes <= 8) return 50;
  if (minutes <= 10) return 55;
  if (minutes <= 15) return 65;
  if (minutes <= 20) return 75;
  return 90;
}

/**
 * Validates requested duration and returns sanitized duration in seconds (Task 3).
 */
export function validateAndSanitizeDuration(
  videoType: 'short' | 'long',
  durationSeconds?: number,
  durationMinutes?: number
): { valid: boolean; durationSeconds: number; creditCost: number; error?: string } {
  if (videoType === 'short') {
    const sec = durationSeconds ?? 30;
    if (typeof sec !== 'number' || isNaN(sec) || !isFinite(sec) || sec < 15 || sec > 60) {
      return {
        valid: false,
        durationSeconds: 0,
        creditCost: 0,
        error: `Short video duration must be between 15 and 60 seconds (got: ${sec}).`,
      };
    }
    const cost = getShortVideoCreditCost(sec);
    return { valid: true, durationSeconds: Math.round(sec), creditCost: cost };
  } else if (videoType === 'long') {
    let min = durationMinutes;
    if (!min && durationSeconds) {
      min = Math.round(durationSeconds / 60);
    }
    const finalMin = min ?? 8;
    if (typeof finalMin !== 'number' || isNaN(finalMin) || !isFinite(finalMin) || finalMin < 8 || finalMin > 30) {
      return {
        valid: false,
        durationSeconds: 0,
        creditCost: 0,
        error: `Long video duration must be between 8 and 30 minutes (got: ${finalMin}).`,
      };
    }
    const cost = getLongVideoCreditCost(finalMin, true);
    return { valid: true, durationSeconds: Math.round(finalMin * 60), creditCost: cost };
  } else {
    return {
      valid: false,
      durationSeconds: 0,
      creditCost: 0,
      error: 'Invalid videoType. Must be "short" or "long".',
    };
  }
}
