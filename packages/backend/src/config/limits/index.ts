/**
 * Token usage and cost limits configuration
 */
export const TOKEN_LIMITS = {
  // Daily token limits per model
  MODEL_DAILY_LIMITS: {
    'gpt-4o-mini': 1_000_000,    // 1M tokens per day
    'gpt-4': 500_000,            // 500K tokens per day
    'gpt-3.5-turbo': 2_000_000   // 2M tokens per day
  },

  // Monthly token limits per model
  MODEL_MONTHLY_LIMITS: {
    'gpt-4o-mini': 20_000_000,   // 20M tokens per month
    'gpt-4': 10_000_000,         // 10M tokens per month
    'gpt-3.5-turbo': 40_000_000  // 40M tokens per month
  },

  // Cost limits
  COST_LIMITS: {
    DAILY: 100.00,    // $100 per day
    MONTHLY: 2000.00, // $2000 per month
    ANNUAL: 20000.00  // $20K per year
  },

  // Warning thresholds (percentage of limit)
  WARNING_THRESHOLDS: {
    FIRST_WARNING: 0.7,   // 70% of limit
    SECOND_WARNING: 0.85, // 85% of limit
    FINAL_WARNING: 0.95   // 95% of limit
  },

  // Rate limiting (requests per minute)
  RATE_LIMITS: {
    DEFAULT: 60,    // 60 requests per minute
    BURST: 100,     // 100 requests per minute burst limit
    WINDOW: 60_000, // 1 minute window
    TPM: 200_000    // 200K tokens per minute (OpenAI limit)
  }
} as const;

/**
 * Default model name for token usage tracking
 */
export const MODEL_NAME = 'gpt-4o-mini' as const;

/**
 * Optimization thresholds for triggering recommendations
 */
export const OPTIMIZATION_THRESHOLDS = {
  // Growth rates that trigger alerts
  GROWTH_RATES: {
    HIGH: 0.20,    // 20% growth rate
    EXTREME: 0.50  // 50% growth rate
  },

  // Usage pattern thresholds
  PATTERNS: {
    PEAK_AVERAGE_RATIO: 2.0,  // Peak vs average usage ratio
    HIGH_COST_PER_TOKEN: 0.00002 // $0.02 per 1K tokens
  },

  // Model selection thresholds
  MODEL_SELECTION: {
    SIMPLE_TASK_TOKEN_LIMIT: 100,  // Use simpler model for short prompts
    COMPLEXITY_THRESHOLD: 0.8      // Complexity score for model selection
  }
} as const;

/**
 * Model-specific token cost rates
 */
export const TOKEN_RATES = {
  'gpt-4o-mini': {
    prompt: 0.00000015,   // $0.150 per 1M tokens
    completion: 0.0000006  // $0.600 per 1M tokens
  }
} as const;

/**
 * Determines if a number is within warning threshold
 */
export function isWithinWarningThreshold(
  current: number,
  limit: number,
  threshold: number
): boolean {
  return (current / limit) >= threshold;
}

/**
 * Gets appropriate warning level based on current usage
 */
export function getWarningLevel(current: number, limit: number): keyof typeof TOKEN_LIMITS.WARNING_THRESHOLDS | null {
  const ratio = current / limit;

  if (ratio >= TOKEN_LIMITS.WARNING_THRESHOLDS.FINAL_WARNING) {
    return 'FINAL_WARNING';
  } else if (ratio >= TOKEN_LIMITS.WARNING_THRESHOLDS.SECOND_WARNING) {
    return 'SECOND_WARNING';
  } else if (ratio >= TOKEN_LIMITS.WARNING_THRESHOLDS.FIRST_WARNING) {
    return 'FIRST_WARNING';
  }

  return null;
}

/**
 * Calculates remaining tokens before hitting limit
 */
export function calculateRemainingTokens(
  current: number,
  limit: number
): number {
  return Math.max(0, limit - current);
}

/**
 * Determines if an operation would exceed token limits
 */
export function wouldExceedLimit(
  current: number,
  additional: number,
  limit: number
): boolean {
  return (current + additional) > limit;
}