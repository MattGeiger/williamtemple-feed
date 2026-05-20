// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { Request, Response, NextFunction } from 'express';
import { MODEL_NAME, TOKEN_LIMITS, TOKEN_RATES } from '../config/limits';
import { calculateInputMetrics, calculateOutputMetrics } from '../services/token/calculation';

interface RequestStore {
  [key: string]: {
    requestCount: number;
    tokenCount: number;
    resetTime: number;
  };
}

const requests: RequestStore = {};

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  const now = Date.now();
  const fallbackConfig = {
    model: MODEL_NAME,
    inputCost: TOKEN_RATES[MODEL_NAME].prompt,
    outputCost: TOKEN_RATES[MODEL_NAME].completion,
    unitPrice: 'per_1m'
  };

  // Initialize or reset if window expired
  if (!requests[ip] || now > requests[ip].resetTime) {
    requests[ip] = {
      requestCount: 0,
      tokenCount: 0,
      resetTime: now + TOKEN_LIMITS.RATE_LIMITS.WINDOW_MS
    };
  }

  const requestData = requests[ip];
  requestData.requestCount++;

  // Estimate tokens for this request
  let estimatedTokens = 0;
  if (req.body?.text && req.body?.targetLanguage) {
    const inputMetrics = calculateInputMetrics(req.body.text, req.body.targetLanguage, fallbackConfig);
    // Estimate output tokens (typically similar to input for translations)
    const outputMetrics = calculateOutputMetrics(req.body.text, fallbackConfig);
    estimatedTokens = inputMetrics.tokenCount + outputMetrics.tokenCount;
  }

  // Update token count
  requestData.tokenCount += estimatedTokens;

  // Check request rate limit
  if (requestData.requestCount > TOKEN_LIMITS.RATE_LIMITS.RPM) {
    const error = new Error('You\'ve made too many requests in a short time. Please wait a minute and try again.') as Error & { statusCode?: number };
    error.statusCode = 429;
    return next(error);
  }

  // Check token rate limit
  if (requestData.tokenCount > TOKEN_LIMITS.RATE_LIMITS.TPM) {
    const error = new Error('You\'ve reached the maximum amount of text we can process right now. Please wait a minute and try again.') as Error & { statusCode?: number };
    error.statusCode = 429;
    return next(error);
  }

  // Add OpenAI-style rate limit headers
  const resetSeconds = Math.ceil((requestData.resetTime - now) / 1000);
  res.setHeader('x-ratelimit-limit-requests', TOKEN_LIMITS.RATE_LIMITS.RPM.toString());
  res.setHeader('x-ratelimit-limit-tokens', TOKEN_LIMITS.RATE_LIMITS.TPM.toString());
  res.setHeader('x-ratelimit-remaining-requests', (TOKEN_LIMITS.RATE_LIMITS.RPM - requestData.requestCount).toString());
  res.setHeader('x-ratelimit-remaining-tokens', (TOKEN_LIMITS.RATE_LIMITS.TPM - requestData.tokenCount).toString());
  res.setHeader('x-ratelimit-reset-requests', resetSeconds.toString());
  res.setHeader('x-ratelimit-reset-tokens', resetSeconds.toString());

  next();
};
