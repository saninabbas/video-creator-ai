/**
 * Centralized Credit & Pricing Configuration (Section 14, 15 & Architectural Correction #4)
 * All values are configurable via environment variables, ready for future billing/tier adjustments.
 */
export const CREDIT_CONFIG = {
  // Signup bonus credits granted to new accounts (Development value: 50)
  SIGNUP_BONUS: parseInt(process.env.CREDIT_SIGNUP_BONUS || '50', 10),

  // Credit costs for generation actions (Development values)
  COSTS: {
    SHORT_VIDEO: parseInt(process.env.CREDIT_COST_SHORT || '10', 10),
    LONG_VIDEO: parseInt(process.env.CREDIT_COST_LONG || '50', 10),
    SCENE_REGENERATION: parseInt(process.env.CREDIT_COST_REGENERATION || '5', 10),
    AI_IMPROVEMENT: parseInt(process.env.CREDIT_COST_IMPROVEMENT || '2', 10),
    CREATE_SHORTS_FROM_LONG: parseInt(process.env.CREDIT_COST_CREATE_SHORTS || '15', 10),
  },

  // Limits
  MAX_DAILY_GENERATIONS: parseInt(process.env.MAX_DAILY_GENERATIONS || '100', 10),
};
