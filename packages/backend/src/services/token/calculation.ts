// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { encoding_for_model } from 'tiktoken';
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

  // Use configured model or fallback for tiktoken
  const modelForEncoding = config.model?.startsWith('gpt-') ? 'gpt-4o-mini' : 'gpt-4o-mini';
  
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

  // Use configured model or fallback for tiktoken
  const modelForEncoding = config.model?.startsWith('gpt-') ? 'gpt-4o-mini' : 'gpt-4o-mini';
  
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

  // Use configured model or fallback for tiktoken
  const modelForEncoding = config.model?.startsWith('gpt-') ? 'gpt-4o-mini' : 'gpt-4o-mini';
  
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
