// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * What FEED may send to a Claude 4.6-or-later model.
 *
 * Both facts below were measured against the API on 2026-09-11, not inferred
 * from documentation:
 *
 *   claude-sonnet-5 + assistant "{" prefill
 *     -> 400 "This model does not support assistant message prefill.
 *             The conversation must end with a user message."
 *   claude-sonnet-5 + temperature: 0.7
 *     -> 400 "`temperature` is deprecated for this model."
 *
 * The second one matters more than it looks: the parameter's *presence* is
 * refused, so sending the default value instead of 0.7 does not help. It has
 * to be omitted.
 *
 * Nothing covered prefill or sampling before, which is how both shipped.
 */

import { describe, expect, test, vi } from 'vitest';
import type { AIConfiguration } from '@prisma/client';

vi.mock('../../../../db', () => ({ default: {} }));

import { AnthropicTranslationService } from '../AnthropicTranslationService';
import { PromptBuilder } from '../../prompts/PromptBuilder';

const buildConfig = (overrides: Partial<AIConfiguration> = {}): AIConfiguration =>
  ({
    id: 1,
    name: 'Anthropic',
    type: 'apikey',
    value: '',
    description: null,
    serviceType: 'Anthropic',
    model: 'claude-haiku-4-5-20251001',
    modelName: 'claude-haiku-4.5',
    endpointUrl: '',
    encryptedApiKey: 'encrypted',
    inputCost: 1.0,
    outputCost: 5.0,
    unitPrice: 'per_1m',
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 10000,
    inputTokenLimit: 200000,
    outputTokenLimit: 64000,
    dailyCostLimit: null,
    monthlyCostLimit: null,
    tokensPerMinute: 50000,
    requestsPerMinute: 50,
    requestsPerDay: null,
    thinkingLevel: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    salt: 'salt',
    ...overrides
  }) as AIConfiguration;

describe('which Claude models accept sampling parameters', () => {
  test('a dated id still takes temperature', () => {
    const service = new AnthropicTranslationService(buildConfig()) as any;
    const result = service.checkAndOverrideParameters('claude-haiku-4-5-20251001', 0.7, 1.0);

    expect(result.temperature).toBe(0.7);
    // Claude 4.5 takes one of temperature/top_p, not both.
    expect(result.topP).toBeUndefined();
  });

  test('a dateless id takes neither temperature nor top_p', () => {
    const service = new AnthropicTranslationService(buildConfig({ model: 'claude-sonnet-5' })) as any;
    const result = service.checkAndOverrideParameters('claude-sonnet-5', 0.7, 1.0);

    expect(result.temperature).toBeUndefined();
    expect(result.topP).toBeUndefined();
  });

  test('the default value is refused too, so it is the presence that matters', () => {
    const service = new AnthropicTranslationService(buildConfig({ model: 'claude-opus-5' })) as any;
    const result = service.checkAndOverrideParameters('claude-opus-5', 1.0, undefined);

    expect(result.temperature).toBeUndefined();
  });
});

describe('assistant prefill', () => {
  const translate = async (model: string) => {
    const create = vi.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"translatedText": "Hola"}' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const service = new AnthropicTranslationService(buildConfig({ model })) as any;
    vi.spyOn(service, 'getAnthropicClient').mockResolvedValue({ messages: { create } });
    const result = await service.translateText({ text: 'Hello', targetLanguage: 'Spanish' });
    return { request: create.mock.calls[0][0], result };
  };

  test('a dateless model is sent no prefill and no temperature', async () => {
    const { request, result } = await translate('claude-sonnet-5');

    expect(request.messages).toHaveLength(1);
    expect(request.messages[0].role).toBe('user');
    expect(request).not.toHaveProperty('temperature');
    expect(request).not.toHaveProperty('top_p');
    // The reply is a whole JSON object, and parses without a prepended brace.
    expect(result.translatedText).toBe('Hola');
  });

  test('a dated model keeps the prefill it still accepts', async () => {
    const create = vi.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '"translatedText": "Hola"}' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const service = new AnthropicTranslationService(
      buildConfig({ model: 'claude-haiku-4-5-20251001' })
    ) as any;
    vi.spyOn(service, 'getAnthropicClient').mockResolvedValue({ messages: { create } });

    const result = await service.translateText({ text: 'Hello', targetLanguage: 'Spanish' });
    const request = create.mock.calls[0][0];

    expect(request.messages).toHaveLength(2);
    expect(request.messages[1]).toEqual({ role: 'assistant', content: '{' });
    expect(request.temperature).toBe(0.7);
    expect(result.translatedText).toBe('Hola');
  });
});

describe('parsing a reply either way', () => {
  const parse = (text: string, prefilled: boolean) => {
    const service = new AnthropicTranslationService(buildConfig()) as any;
    return service.parseJsonReply(text, prefilled);
  };

  test('prefilled: the opening brace is restored', () => {
    expect(parse('"translatedText": "Hola"}', true)).toEqual({ translatedText: 'Hola' });
  });

  test('not prefilled: a whole object parses as-is', () => {
    expect(parse('{"translatedText": "Hola"}', false)).toEqual({ translatedText: 'Hola' });
  });

  test('a fenced code block is unwrapped', () => {
    expect(parse('```json\n{"translatedText": "Hola"}\n```', false)).toEqual({
      translatedText: 'Hola',
    });
  });

  test('a fenced array retains its enclosing brackets', () => {
    expect(parse('```json\n[{"translatedText":"Arroz"},{"translatedText":"Frijoles"}]\n```', false))
      .toEqual([{ translatedText: 'Arroz' }, { translatedText: 'Frijoles' }]);
  });

  test('prose around the object does not defeat it', () => {
    expect(parse('Here you go:\n{"translatedText": "Hola"}\nHope that helps.', false)).toEqual({
      translatedText: 'Hola',
    });
  });
});

describe('complete batch replies and billed failures', () => {
  test('records a truncated single translation without retrying it', async () => {
    const service = new AnthropicTranslationService(buildConfig({ model: 'claude-haiku-5-5' })) as any;
    const create = vi.fn().mockResolvedValue({ stop_reason: 'max_tokens',
      content: [{ type: 'text', text: '{' }], usage: { input_tokens: 20, output_tokens: 512 } });
    vi.spyOn(service, 'getAnthropicClient').mockResolvedValue({ messages: { create } });
    const failed = vi.spyOn(service, 'trackFailedUsage').mockResolvedValue(undefined);
    await expect(service.translateText({ text: 'Rice', targetLanguage: 'Spanish' })).rejects.toThrow('truncated');
    expect(create).toHaveBeenCalledOnce();
    expect(failed).toHaveBeenCalledWith('translation', expect.objectContaining({ promptTokens: 20, completionTokens: 512 }),
      'claude-haiku-5-5', { language: 'Spanish' });
  });

  const run = async (text: string, stopReason = 'end_turn') => {
    const service = new AnthropicTranslationService(buildConfig({ model: 'claude-haiku-5-5' })) as any;
    vi.spyOn(PromptBuilder, 'getPromptConfiguration').mockResolvedValue({
      systemPrompt: 'Translate to {targetLanguage}', maxTokens: 512, isCustom: false
    });
    const create = vi.fn().mockResolvedValue({ stop_reason: stopReason,
      content: [{ type: 'text', text }], usage: { input_tokens: 20, output_tokens: 10 } });
    vi.spyOn(service, 'getAnthropicClient').mockResolvedValue({ messages: { create } });
    const failed = vi.spyOn(service, 'trackFailedUsage').mockResolvedValue(undefined);
    const succeeded = vi.spyOn(service, 'trackSuccessfulUsage').mockResolvedValue(undefined);
    const result = service.translateTextBatch({ targetLanguage: 'Spanish', texts: [
      { id: 'a', text: 'Rice' }, { id: 'b', text: 'Beans' }, { id: 'c', text: 'Rice' }
    ] });
    return { result, failed, succeeded, create };
  };

  test('accepts a fenced array and restores duplicate input ids', async () => {
    const { result, failed, succeeded, create } = await run('```json\n[{"translatedText":"Arroz"},{"translatedText":"Frijoles"}]\n```');
    expect((await result).translations.map((entry: any) => entry.id)).toEqual(['a', 'c', 'b']);
    expect(create.mock.calls[0][0].messages[0].content).toContain('exactly 2 entries');
    expect(failed).not.toHaveBeenCalled();
    expect(succeeded).toHaveBeenCalledOnce();
  });

  test.each([
    ['malformed JSON', '{bad', 'end_turn'],
    ['missing entry', '{"translations":[{"translatedText":"Arroz"}]}', 'end_turn'],
    ['blank entry', '{"translations":[{"translatedText":"Arroz"},{"translatedText":" "}]}', 'end_turn'],
    ['truncated response', '{}', 'max_tokens']
  ])('rejects %s and records actual billed usage', async (_name, text, stopReason) => {
    const { result, failed, succeeded } = await run(text, stopReason);
    await expect(result).rejects.toThrow();
    expect(failed).toHaveBeenCalledWith('batch', expect.objectContaining({ promptTokens: 20, completionTokens: 10 }),
      'claude-haiku-5-5', { language: 'Spanish' });
    expect(succeeded).not.toHaveBeenCalled();
  });
});

describe('the non-streaming output ceiling', () => {
  test('applies to Claude 5, which has the largest output limit', () => {
    // It was keyed to `-4-5-`, so it skipped exactly the models whose 128K
    // output ceiling makes an unclamped non-streaming request most dangerous.
    const service = new AnthropicTranslationService(
      buildConfig({ model: 'claude-sonnet-5', outputTokenLimit: 128000, maxTokens: 128000 })
    ) as any;

    expect(service.resolveMaxTokens('claude-sonnet-5', 128000, 2048, 'translation')).toBe(20480);
  });

  test('still applies to Claude 4.5', () => {
    // `maxTokens` has to exceed the ceiling for the ceiling to be what binds:
    // resolveMaxTokens takes the minimum of every candidate, so the default
    // fixture's 10,000 would win on its own and prove nothing.
    const service = new AnthropicTranslationService(
      buildConfig({ maxTokens: 64000 })
    ) as any;

    expect(
      service.resolveMaxTokens('claude-haiku-4-5-20251001', 64000, 2048, 'translation')
    ).toBe(20480);
  });

  test('a lower configured limit still wins over the ceiling', () => {
    const service = new AnthropicTranslationService(buildConfig({ maxTokens: 10000 })) as any;

    expect(
      service.resolveMaxTokens('claude-sonnet-5', 64000, 2048, 'translation')
    ).toBe(10000);
  });
});
