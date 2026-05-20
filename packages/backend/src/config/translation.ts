// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Translation usage warning thresholds
 */
export const TRANSLATION_THRESHOLDS = {
  // Daily token limits
  DAILY_TOKEN_LIMIT: 1000000,  // 1M tokens per day
  DAILY_TOKEN_WARNING: 800000, // 80% of limit

  // Cost thresholds
  DAILY_COST_LIMIT: 100.00,    // $100 per day
  DAILY_COST_WARNING: 80.00,   // $80 per day

  // Rate limiting
  RATE_LIMIT_WINDOW: 60000,    // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 60, // 60 requests per minute

  // Performance thresholds
  MAX_RESPONSE_TIME: 10000,    // 10 seconds
  SLOW_RESPONSE_TIME: 5000,    // 5 seconds
} as const;

/**
 * Translation service settings
 */
export const TRANSLATION_SETTINGS = {
  // Model settings
  DEFAULT_MODEL: 'gpt-4o-mini',

  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second

  // Batch settings
  MAX_BATCH_SIZE: 10,
  MAX_CONCURRENT: 5,
} as const;

/**
 * Alert levels for usage monitoring
 */
export const ALERT_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

/**
 * Message templates for alerts
 */
export const ALERT_MESSAGES = {
  TOKEN_LIMIT_APPROACHING: (used: number, limit: number) => 
    `Token usage approaching daily limit: ${used.toLocaleString()} / ${limit.toLocaleString()}`,
    
  COST_LIMIT_APPROACHING: (cost: number, limit: number) =>
    `Cost approaching daily limit: $${cost.toFixed(2)} / $${limit.toFixed(2)}`,
    
  RATE_LIMIT_EXCEEDED: (requests: number, limit: number) =>
    `Rate limit exceeded: ${requests} requests (limit: ${limit} per minute)`,
    
  SLOW_RESPONSE: (time: number) =>
    `Slow translation response time: ${(time / 1000).toFixed(1)}s`,
} as const;