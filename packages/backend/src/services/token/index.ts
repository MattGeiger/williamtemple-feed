import { calculateInputMetrics, calculateOutputMetrics, TokenMetrics } from './calculation';
import { AIConfiguration } from '@prisma/client';

/**
 * Calculates input token metrics for gpt-4o-mini.
 * Input tokens = system prompt tokens (including target language) + user prompt tokens.
 */
export function estimateInputTokensAndCost(text: string, targetLanguage: string, config: AIConfiguration): TokenMetrics {
  return calculateInputMetrics(text, targetLanguage, config);
}

/**
 * Calculates output (completion) token metrics for gpt-4o-mini.
 */
export function estimateOutputTokensAndCost(text: string, config: AIConfiguration): TokenMetrics {
  return calculateOutputMetrics(text, config);
}

// Re-export formatting utilities
export { formatTokenCount, formatCost } from './calculation';
