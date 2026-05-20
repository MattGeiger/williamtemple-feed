// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Token usage and cost limits configuration
 */
export type ModelName = string;

export const MODEL_NAME: ModelName = 'gpt-4o-mini';

export const TOKEN_RATES: Record<ModelName, { prompt: number; completion: number }> = {
  'gpt-4o-mini': {
    prompt: 0.00000015,   // $0.150 per 1M tokens
    completion: 0.0000006 // $0.600 per 1M tokens
  },
  'gpt-4': {
    prompt: 0.00003,      // placeholder rate
    completion: 0.00006
  },
  'gpt-3.5-turbo': {
    prompt: 0.0000005,
    completion: 0.0000015
  }
} as const;

export const TOKEN_LIMITS = {
  // Daily token limits per model
  MODEL_DAILY_LIMITS: {
    'gpt-4o-mini': 1_000_000,
    'gpt-4': 500_000,
    'gpt-3.5-turbo': 2_000_000
  },

  // Rate Limits
  RATE_LIMITS: {
    RPM: 500,              // 500 requests per minute
    RPD: 10_000,           // 10,000 requests per day
    TPM: 200_000,          // 200,000 tokens per minute
    WINDOW_MS: 60_000      // 1 minute window
  },

  // Cost limits
  COST_LIMITS: {
    DAILY: 100.00,   // $100 per day
    MONTHLY: 100.00  // $100 per month (placeholder)
  },

  // Warning thresholds (percentage of limit)
  WARNING_THRESHOLDS: {
    WARNING: 0.7,           // 70% of limit
    ELEVATED_WARNING: 0.85, // 85% of limit
    FINAL_WARNING: 0.95     // 95% of limit
  }
} as const;

export const OPTIMIZATION_THRESHOLDS = {
  GROWTH_RATES: {
    HIGH: 0.20,
    EXTREME: 0.50
  },
  PATTERNS: {
    PEAK_AVERAGE_RATIO: 2.0,
    HIGH_COST_PER_TOKEN: 0.00002
  },
  MODEL_SELECTION: {
    SIMPLE_TASK_TOKEN_LIMIT: 100,
    COMPLEXITY_THRESHOLD: 0.8
  }
} as const;

/**
 * Gets appropriate warning level based on current usage
 */
export function getWarningLevel(
  current: number,
  limit: number
): keyof typeof TOKEN_LIMITS.WARNING_THRESHOLDS | null {
  const ratio = current / limit;

  if (ratio >= TOKEN_LIMITS.WARNING_THRESHOLDS.FINAL_WARNING) {
    return 'FINAL_WARNING';
  }
  if (ratio >= TOKEN_LIMITS.WARNING_THRESHOLDS.ELEVATED_WARNING) {
    return 'ELEVATED_WARNING';
  }
  if (ratio >= TOKEN_LIMITS.WARNING_THRESHOLDS.WARNING) {
    return 'WARNING';
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
