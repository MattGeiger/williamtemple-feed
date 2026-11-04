// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import OpenAI from 'openai';
import { describe, expect, test, vi } from 'vitest';
import { credentialTag, probeOpenAIEntitlement, unusableCompletion } from '../../../src/services/ai/openai-entitlement';
import { providerFailureError } from '../../../src/services/ai/provider-failure';

const config = { id: 10, serviceType: 'OpenAI', model: 'gpt-6.1-terra', pricingSource: 'preset' };
const response = (overrides: Record<string, unknown> = {}) => ({
  id: 'chatcmpl-test', object: 'chat.completion', created: 1, model: config.model,
  choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'OK' } }],
  usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 }, ...overrides,
}) as OpenAI.Chat.Completions.ChatCompletion;

describe('OpenAI save verification', () => {
  test('one actual SDK request includes correlation and no hidden retry; success is traced', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(response()), {
      status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'req-success' },
    }));
    const client = new OpenAI({ apiKey: 'test-secret-key', fetch });
    const onTrace = vi.fn();
    const result = await probeOpenAIEntitlement(client, config, { credentialTag: credentialTag('test-secret-key'), onTrace });
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const init = fetch.mock.calls[0][1];
    expect(JSON.parse(init.body)).toMatchObject({ model: config.model, reasoning_effort: 'none', max_completion_tokens: 512 });
    expect(new Headers(init.headers).get('x-client-request-id')).toBe(result.trace.attemptId);
    expect(result.trace).toMatchObject({ status: 200, requestId: 'req-success', finishReason: 'stop', hasOutput: true, promptTokens: 10 });
    expect(onTrace).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result.trace)).not.toContain('test-secret-key');
    expect(JSON.stringify(result.trace)).not.toContain('content');
  });

  test('403s are returned once with safe metadata and never converted into success', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      error: { message: 'Project private-id does not have access to model', code: 'model_not_found', type: 'invalid_request_error' },
    }), { status: 403, headers: { 'content-type': 'application/json', 'x-request-id': 'req-denied', 'x-should-retry': 'true', 'set-cookie': 'private-cookie' } }));
    const onTrace = vi.fn();
    const result = await probeOpenAIEntitlement(new OpenAI({ apiKey: 'private-key', fetch }), config,
      { credentialTag: credentialTag('private-key'), onTrace });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, trace: { status: 403, code: 'model_not_found', requestId: 'req-denied' } });
    expect(JSON.stringify(onTrace.mock.calls)).not.toMatch(/private-key|private-cookie|private-id|authorization/i);
  });

  test.each([
    ['no choices', { choices: [] }],
    ['blank text', { choices: [{ finish_reason: 'stop', message: { content: '  ' } }] }],
    ['truncation', { choices: [{ finish_reason: 'length', message: { content: 'OK' } }] }],
    ['refusal', { choices: [{ finish_reason: 'stop', message: { content: 'OK', refusal: 'No' } }] }],
    ['wrong model', { model: 'gpt-6-astra' }],
    ['no usage', { usage: undefined }],
  ])('rejects HTTP 200 with %s', async (_name, overrides) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(response(overrides)), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    const result = await probeOpenAIEntitlement(new OpenAI({ apiKey: 'test-key', fetch }), config,
      { credentialTag: credentialTag('test-key'), onTrace: vi.fn() });
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: 'AI_MODEL_VERIFICATION_FAILED', statusCode: 503 });
  });

  test('a dated snapshot of the requested alias is accepted', () => {
    expect(unusableCompletion(response({ model: `${config.model}-2026-10-01` }), config.model)).toBeNull();
    expect(unusableCompletion(response({ model: `${config.model}-different` }), config.model)).toBe('different-model');
  });

  test('credential correlation is stable within the process and never contains the key', () => {
    expect(credentialTag('one')).toBe(credentialTag('one'));
    expect(credentialTag('one')).not.toBe(credentialTag('two'));
    expect(credentialTag('one')).toMatch(/^[0-9a-f]{16}$/);
  });

  test('save refusals do not claim translation occurred or retry can never help', () => {
    const error = providerFailureError({ status: 403 }, { model: config.model, subject: 'this configuration' });
    expect(error.message).toContain('No changes were saved');
    expect(error.message).not.toMatch(/was not translated|Retrying will not help/);
  });
});
