// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { encoding_for_model } from 'tiktoken';

/**
 * The encoding every token estimate uses, for every provider.
 *
 * This was written at four sites as
 *
 *   config.model?.startsWith('gpt-') ? 'gpt-4o-mini' : 'gpt-4o-mini'
 *
 * — a ternary whose branches are the same string, so the test could not
 * change the result. Per-provider encoding was plainly intended and collapsed
 * at some point, invisibly, because nothing downstream looks wrong at a
 * glance.
 *
 * Keeping a single encoding is a decision, not a surrender to the bug.
 * tiktoken ships no encoding for Claude or Gemini, so there is nothing more
 * accurate to switch to locally, and asking it for a real per-model name
 * would throw for any id it does not recognise and drop the caller into the
 * far cruder `length / 4` fallback further down. `gpt-4o-mini` resolves to
 * `o200k_base`, which is also the correct encoding for the GPT-5 family FEED
 * actually runs.
 *
 * What it is not good for is Anthropic: its current tokenizer counts roughly
 * 30% more tokens for the same text (see
 * docs/ai-config/model-catalogue-refresh-2026-09.md). That bias survives here
 * deliberately — correcting it needs a factor measured per provider, and
 * inventing one would swap a knowable error for a fabricated one.
 *
 * The bias is confined to *estimates*: pre-flight limit checks and the cost
 * forecast. Every provider returns authoritative counts alongside its
 * response, and recorded spend is priced from those.
 */
export const ENCODING_MODEL = 'gpt-4o-mini' as const;
import prisma from '../../db';

export interface TokenMetrics {
  tokenCount: number;
  cost: number;
}

// Token calculation cache
interface CachedTokenMetrics {
  metrics: TokenMetrics;
  timestamp: number;
}

const TOKEN_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const tokenCache = new Map<string, CachedTokenMetrics>();
let cachedConfig: any = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Converts cost rate to per-token rate based on unit price
 */
export function convertToPerTokenRate(rate: number, unitPrice?: string | null): number {
  if (!rate) return 0;
  
  switch (unitPrice) {
    case 'per_1m':
      return rate / 1_000_000;
    case 'per_1k':
      return rate / 1_000;
    default:
      // Default to per_1k for backward compatibility
      return rate / 1_000;
  }
}

/**
 * Clear token calculation cache
 */
export function clearTokenCache(): void {
  tokenCache.clear();
  cachedConfig = null;
  configCacheTime = 0;
}

/**
 * Create cache key for token calculations
 */
function createCacheKey(text: string, language?: string, operation?: string): string {
  const content = `${text}:${language || ''}:${operation || 'default'}`;
  // Use simple hash for cache key
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

/**
 * Calculates input metrics using database configuration with caching
 */
export function calculateInputMetrics(
  userText: string, 
  targetLanguage: string,
  config: any
): TokenMetrics {
  const cacheKey = createCacheKey(userText, targetLanguage, 'input');
  const cached = tokenCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < TOKEN_CACHE_TTL) {
    return cached.metrics;
  }
  
  if (!config) {
    throw new Error('AI configuration required for token calculation.');
  }

  // Skip token calculation for very small texts (optimization)
  if (userText.length < 10) {
    const fallbackTokens = 5 + 50; // Small text + system prompt
    const inputCostPerToken = convertToPerTokenRate(config.inputCost || 0, config.unitPrice);
    const cost = fallbackTokens * inputCostPerToken;
    const result = { tokenCount: fallbackTokens, cost };
    
    tokenCache.set(cacheKey, {
      metrics: result,
      timestamp: now
    });
    
    return result;
  }

  const modelForEncoding = ENCODING_MODEL;
  
  try {
    const encoder = encoding_for_model(modelForEncoding);
    
    // System prompt calculation
    const systemPrompt = `You are a translation service for a nonprofit food pantry. Translate to ${targetLanguage} using the closest natural equivalent. Your response must be a valid JSON string containing only a "translatedText" field.`;
    const systemTokenCount = encoder.encode(systemPrompt).length;
    
    // User text calculation
    const userTokenCount = encoder.encode(userText).length;
    
    encoder.free();
    
    const totalInputTokens = systemTokenCount + userTokenCount;
    const inputCostPerToken = convertToPerTokenRate(config.inputCost || 0, config.unitPrice);
    const cost = totalInputTokens * inputCostPerToken;
    
    const result = { tokenCount: totalInputTokens, cost };
    
    // Cache the result
    tokenCache.set(cacheKey, {
      metrics: result,
      timestamp: now
    });
    
    return result;
  } catch (error) {
    console.error('Token encoding error:', error);
    
    // Fallback calculation
    const roughTokens = Math.ceil(userText.length / 4) + 50; // ~4 chars per token + system prompt
    const inputCostPerToken = convertToPerTokenRate(config.inputCost || 0, config.unitPrice);
    const cost = roughTokens * inputCostPerToken;
    
    const result = { tokenCount: roughTokens, cost };
    
    // Cache fallback result too
    tokenCache.set(cacheKey, {
      metrics: result,
      timestamp: now
    });
    
    return result;
  }
}

/**
 * Calculates output metrics using database configuration
 */
export function calculateOutputMetrics(outputText: string, config: any): TokenMetrics {
  if (!config) {
    throw new Error('AI configuration required for token calculation.');
  }

  const modelForEncoding = ENCODING_MODEL;
  
  try {
    const encoder = encoding_for_model(modelForEncoding);
    const outputTokenCount = encoder.encode(outputText).length;
    encoder.free();
    
    const outputCostPerToken = convertToPerTokenRate(config.outputCost || 0, config.unitPrice);
    const cost = outputTokenCount * outputCostPerToken;
    return { tokenCount: outputTokenCount, cost };
  } catch (error) {
    console.error('Token encoding error:', error);
    
    // Fallback calculation
    const roughTokens = Math.ceil(outputText.length / 4);
    const outputCostPerToken = convertToPerTokenRate(config.outputCost || 0, config.unitPrice);
    const cost = roughTokens * outputCostPerToken;
    
    return { tokenCount: roughTokens, cost };
  }
}

/**
 * Estimates output metrics for translations (1.5x input text)
 */
export function estimateOutputMetrics(inputText: string, config: any): TokenMetrics {
  if (!config) {
    throw new Error('AI configuration required for token calculation.');
  }

  const modelForEncoding = ENCODING_MODEL;
  
  try {
    const encoder = encoding_for_model(modelForEncoding);
    const inputTokenCount = encoder.encode(inputText).length;
    encoder.free();
    
    const estimatedOutputTokens = Math.ceil(inputTokenCount * 1.5);
    const outputCostPerToken = convertToPerTokenRate(config.outputCost || 0, config.unitPrice);
    const cost = estimatedOutputTokens * outputCostPerToken;
    
    return { tokenCount: estimatedOutputTokens, cost };
  } catch (error) {
    console.error('Token encoding error:', error);
    
    // Fallback calculation
    const roughInputTokens = Math.ceil(inputText.length / 4);
    const estimatedOutputTokens = Math.ceil(roughInputTokens * 1.5);
    const outputCostPerToken = convertToPerTokenRate(config.outputCost || 0, config.unitPrice);
    const cost = estimatedOutputTokens * outputCostPerToken;
    
    return { tokenCount: estimatedOutputTokens, cost };
  }
}

/**
 * Formats a token count for display
 */
export function formatTokenCount(count: number): string {
  return count.toLocaleString();
}

/**
 * Formats a cost amount for display
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(6)}`;
}
