// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { createHmac, randomBytes, randomUUID } from 'crypto';
import type OpenAI from 'openai';
import { capabilitiesFor, resolveReasoning } from './catalogue';
import { providerVerificationError } from './provider-failure';
import type { PricingConfiguration } from './pricing';
import { priceUsage } from './pricing';

export const ENTITLEMENT_OUTPUT_CAP = 512;
const correlationSecret = randomBytes(32);

/** Stable only within this process; neither a key prefix nor a reusable key hash. */
export const credentialTag = (key: string): string =>
  createHmac('sha256', correlationSecret).update(key).digest('hex').slice(0, 16);

export function entitlementRequest(model: string): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  const capabilities = capabilitiesFor('OpenAI', model);
  const reasoning = resolveReasoning(capabilities, null).value;
  return {
    model,
    messages: [{ role: 'user', content: 'Reply with OK.' }],
    ...(reasoning ? { reasoning_effort: reasoning as OpenAI.ReasoningEffort } : {}),
    [capabilities.maxTokensField]: ENTITLEMENT_OUTPUT_CAP,
  };
}

export interface EntitlementTrace {
  at: string;
  attemptId: string;
  lane: 'save' | 'direct';
  configId?: number;
  credentialTag: string;
  requestedModel: string;
  returnedModel?: string;
  status?: number;
  code?: string;
  requestId?: string;
  finishReason?: string;
  hasOutput?: boolean;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  costUsd?: number;
  durationMs: number;
  ok: boolean;
}

export function unusableCompletion(response: OpenAI.Chat.Completions.ChatCompletion, model: string): string | null {
  // Stable aliases may resolve to a dated snapshot. Do not accept another family.
  if (response.model !== model && !(
    response.model?.startsWith(`${model}-`)
    && /^\d{4}-\d{2}-\d{2}$/.test(response.model.slice(model.length + 1))
  )) return 'different-model';
  const choice = response.choices?.[0];
  if (choice?.finish_reason !== 'stop') return 'incomplete';
  if (choice.message?.refusal) return 'refusal';
  if (typeof choice.message?.content !== 'string' || !choice.message.content.trim()) return 'empty-output';
  if (!response.usage || !Number.isFinite(response.usage.prompt_tokens)
    || !Number.isFinite(response.usage.completion_tokens)
    || response.usage.prompt_tokens < 0 || response.usage.completion_tokens < 0) return 'missing-usage';
  return null;
}

/** One request, no automatic retries. Log an allowlist of metadata on BOTH outcomes. */
export async function probeOpenAIEntitlement(
  client: OpenAI,
  config: PricingConfiguration & { id?: number },
  options: { credentialTag: string; lane?: 'save' | 'direct'; onTrace?: (trace: EntitlementTrace) => void },
): Promise<{ ok: boolean; error?: unknown; trace: EntitlementTrace }> {
  const started = Date.now();
  const model = config.model!;
  const trace: EntitlementTrace = {
    at: new Date().toISOString(), attemptId: randomUUID(), lane: options.lane ?? 'save',
    configId: config.id, credentialTag: options.credentialTag, requestedModel: model,
    durationMs: 0, ok: false,
  };
  let error: unknown;
  try {
    const result = await client.chat.completions.create(entitlementRequest(model), {
      maxRetries: 0, timeout: 30_000, headers: { 'X-Client-Request-Id': trace.attemptId },
    }).withResponse();
    const response = result.data;
    Object.assign(trace, {
      status: result.response.status, requestId: result.request_id ?? undefined,
      returnedModel: response.model, finishReason: response.choices?.[0]?.finish_reason,
      hasOutput: Boolean(response.choices?.[0]?.message?.content?.trim()),
      promptTokens: response.usage?.prompt_tokens, completionTokens: response.usage?.completion_tokens,
      reasoningTokens: response.usage?.completion_tokens_details?.reasoning_tokens,
    });
    if (response.usage) trace.costUsd = priceUsage(config, response.usage.prompt_tokens, response.usage.completion_tokens);
    const reason = unusableCompletion(response, model);
    if (reason) {
      trace.code = reason;
      error = providerVerificationError(model);
    } else trace.ok = true;
  } catch (failure) {
    error = failure;
    const provider = failure as { status?: number; code?: string; request_id?: string; requestID?: string };
    trace.status = provider?.status;
    trace.code = provider?.code;
    trace.requestId = provider?.request_id ?? provider?.requestID;
  }
  trace.durationMs = Date.now() - started;
  // Never log the SDK exception, request/response body, key, headers or cookies.
  (options.onTrace ?? (value => console.info('[OpenAI entitlement]', JSON.stringify(value))))(trace);
  return { ok: trace.ok, ...(error ? { error } : {}), trace };
}
