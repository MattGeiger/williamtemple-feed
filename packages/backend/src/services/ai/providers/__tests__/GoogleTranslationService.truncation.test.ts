// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * What staff read when Gemini's answer runs out of room.
 *
 * `AnthropicTranslationService` has tested `stop_reason === 'max_tokens'` at
 * three sites all along and throws "Translation response was truncated due to
 * length". `GoogleTranslationService` tested `finishReason` nowhere: it handed
 * the half-written body straight to `JSON.parse`, so the message reaching
 * staff was `Unterminated string in JSON at position 22` — which names neither
 * the cause nor anything anyone can do about it (ISSUES.md #84).
 *
 * Found by the live smoke sweep on 2026-09-13. Two Gemini models at `high`
 * spent essentially their whole 512-token budget thinking — 490 and 492
 * tokens — and returned 5 and 8 tokens of answer, with
 * `finishReason: MAX_TOKENS`. The sweep's cap is what surfaced it, but the
 * missing check is real at any cap: the same thing happens to a long document
 * at the production ceiling of 65,536.
 *
 * The fixtures below therefore carry `candidates[0].finishReason` *and*
 * Gemini-shaped `usageMetadata`. That shape is load-bearing twice over. The
 * sibling `failed-spend` test's header explains the second half: FEED's
 * `extractUsageMetrics` reads `promptTokenCount` and sums
 * `candidatesTokenCount + thoughtsTokenCount`, falling back to its own
 * estimate only when both are absent — so an OpenAI-shaped fixture would let
 * every assertion here pass while proving nothing about the provider's counts.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AIConfiguration } from '@prisma/client';

vi.mock('../../../../db', () => ({ default: {} }));

vi.mock('../../../limits', () => ({
  limitEnforcement: {
    checkTokenUsage: vi.fn().mockResolvedValue({
      canProceed: true,
      remainingTokens: 0,
      warningLevel: null
    })
  }
}));

vi.mock('../../../usage-record', () => ({
  UsageRecordService: {
    createUsageRecord: vi.fn().mockResolvedValue(undefined)
  }
}));

import { GoogleTranslationService } from '../GoogleTranslationService';
import { UsageRecordService } from '../../../usage-record';

const buildConfig = (overrides: Partial<AIConfiguration> = {}): AIConfiguration =>
  ({
    id: 1,
    name: 'Google',
    type: 'apikey',
    value: '',
    description: null,
    serviceType: 'Google',
    model: 'gemini-3.8-flash',
    modelName: 'gemini-3.8-flash',
    endpointUrl: '',
    encryptedApiKey: 'encrypted',
    salt: 'salt',
    inputCost: 0.75,
    outputCost: 3.75,
    unitPrice: 'per_1m',
    temperature: 1.0,
    topP: 1.0,
    thinkingLevel: null,
    maxTokens: 4096,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    dailyCostLimit: null,
    monthlyCostLimit: null,
    tokensPerMinute: null,
    requestsPerMinute: null,
    requestsPerDay: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }) as AIConfiguration;

/**
 * The counts are the sweep's own, from `gemini-3.8-flash` on 2026-09-13:
 * 152 prompt, 492 thinking, 5 of answer, cut off at 512.
 */
const truncated = (text: string) => ({
  text,
  candidates: [{ finishReason: 'MAX_TOKENS', index: 0 }],
  usageMetadata: {
    promptTokenCount: 152,
    candidatesTokenCount: 5,
    thoughtsTokenCount: 492
  }
});

/** The same reply, finished rather than cut off. */
const complete = (text: string) => ({
  text,
  candidates: [{ finishReason: 'STOP', index: 0 }],
  usageMetadata: {
    promptTokenCount: 152,
    candidatesTokenCount: 21,
    thoughtsTokenCount: 0
  }
});

const serviceReturning = (reply: unknown) => {
  const generateContent = vi.fn().mockResolvedValue(reply);
  const service = new GoogleTranslationService(buildConfig()) as any;
  vi.spyOn(service, 'getGoogleClient').mockResolvedValue({ models: { generateContent } });
  return service;
};

beforeEach(() => {
  vi.mocked(UsageRecordService.createUsageRecord).mockClear();
});

describe('a Gemini reply cut off at the token cap', () => {
  test('says the answer was truncated, not that the JSON is broken', async () => {
    const service = serviceReturning(truncated('{"translatedText": "Arroz'));

    await expect(
      service.translateText({ text: 'Rice', targetLanguage: 'Spanish' })
    ).rejects.toThrow(/truncated due to length/);
  });

  test('never surfaces the parser message', async () => {
    // The assertion that matters to whoever is reading the screen. Before the
    // guard this rejected with `Unterminated string in JSON at position 22`.
    const service = serviceReturning(truncated('{"translatedText": "Arroz'));

    await expect(
      service.translateText({ text: 'Rice', targetLanguage: 'Spanish' })
    ).rejects.not.toThrow(/JSON|Unterminated/);
  });

  test('is still recorded as spend the provider billed for', async () => {
    // The placement guard, and the reason the check sits *inside* the `try`
    // rather than above it. The reply was paid for; `catch (unusable)` is what
    // records that, and a guard thrown earlier would have made the error
    // clearer and the spend invisible — undoing `181d917`.
    const service = serviceReturning(truncated('{"translatedText": "Arroz'));

    await expect(
      service.translateText({ text: 'Rice', targetLanguage: 'Spanish' })
    ).rejects.toThrow(/truncated/);

    expect(UsageRecordService.createUsageRecord).toHaveBeenCalledTimes(1);
    const metrics = vi.mocked(UsageRecordService.createUsageRecord).mock.calls[0][3];
    expect(metrics.success).toBe(false);
    expect(metrics.promptTokens).toBe(152);
    // 5 + 492: the thinking is the bill here, and dropping it would understate
    // this reply by 99% of what it cost.
    expect(metrics.completionTokens).toBe(497);
  });

  test('a finished reply is untouched by the guard', async () => {
    // `MAX_TOKENS` is the only finish reason that means "ran out of room".
    // STOP, SAFETY and RECITATION are different conditions and must not be
    // reported as truncation.
    const service = serviceReturning(complete('{"translatedText": "Arroz"}'));

    const result = await service.translateText({ text: 'Rice', targetLanguage: 'Spanish' });

    expect(result.translatedText).toBe('Arroz');
    expect(UsageRecordService.createUsageRecord).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ success: false }),
      expect.anything(),
      expect.anything()
    );
  });

  test('the batch translation path says so too', async () => {
    const service = serviceReturning(
      truncated('{"translations": [{"translatedText": "Arroz')
    );

    await expect(
      service.translateTextBatch({
        texts: [{ id: 'a', text: 'Rice' }],
        targetLanguage: 'Spanish'
      })
    ).rejects.toThrow(/truncated due to length/);
  });

  test('classification says classification, as Anthropic does', async () => {
    const service = serviceReturning(
      truncated('{"classifications": [{"id": "s1", "a": 0.1')
    );

    await expect(
      service.classifySegments({ segments: [{ id: 's1', text: 'Food Pantry Hours' }] })
    ).rejects.toThrow(/Classification response was truncated/);
  });

  test('batch classification says so as well', async () => {
    const service = serviceReturning(
      truncated('{"classifications": [{"id": "s1", "a": 0.1')
    );

    await expect(
      service.classifySegmentsBatch({ segments: [{ id: 's1', text: 'Food Pantry Hours' }] })
    ).rejects.toThrow(/Classification response was truncated/);
  });
});
