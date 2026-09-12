// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { calculateInputMetrics, calculateOutputMetrics, TokenMetrics } from './calculation';
import { AIConfiguration } from '@prisma/client';

/**
 * Estimates input token metrics, for any provider.
 * Input tokens = system prompt tokens (including target language) + user prompt tokens.
 *
 * The count comes from one OpenAI encoding whatever the provider — see
 * `ENCODING_MODEL` for why that is deliberate and where it is wrong. This is
 * an estimate, used before a call is made; it is not what recorded spend is
 * priced from.
 */
export function estimateInputTokensAndCost(text: string, targetLanguage: string, config: AIConfiguration): TokenMetrics {
  return calculateInputMetrics(text, targetLanguage, config);
}

/**
 * Estimates output (completion) token metrics, for any provider.
 * Same single-encoding caveat as `estimateInputTokensAndCost`.
 */
export function estimateOutputTokensAndCost(text: string, config: AIConfiguration): TokenMetrics {
  return calculateOutputMetrics(text, config);
}

// Re-export formatting utilities
export { formatTokenCount, formatCost } from './calculation';
