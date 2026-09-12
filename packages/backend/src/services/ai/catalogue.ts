// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * What FEED knows about each AI model, in one place.
 *
 * `model-specs.ts` holds price and limits and is duplicated byte-for-byte in
 * the frontend, with nothing enforcing the two agree (ISSUES.md #84). This
 * module is the server-authoritative replacement it names: the same facts
 * plus the two kinds of knowledge the duplicated file could not express.
 *
 * **Lifecycle**, because a model's availability changes under us. A provider
 * withdraws a model, or stops offering it to new accounts, and FEED finds out
 * when a translation fails. Recording a shutdown date and a replacement lets
 * the interface say so first.
 *
 * **Capabilities**, because what a model accepts is not derivable from its
 * name. Every one of these was measured against a live API on 2026-09-11
 * rather than read off a documentation page, and three of them contradicted
 * what the docs implied:
 *
 *   - `claude-sonnet-5` refuses `temperature` outright — its presence, not
 *     its value, so sending the default does not help.
 *   - `claude-sonnet-5` refuses an assistant-message prefill.
 *   - `gpt-5.6-luna` refuses `reasoning_effort: 'minimal'`, which is FEED's
 *     spec default for `gpt-5-nano`, and refuses `max_tokens` in favour of
 *     `max_completion_tokens`.
 *
 * String tests on model ids cannot carry that. `model.includes('-4-5-')` was
 * the previous answer and it silently excluded every dateless Claude 5 id.
 *
 * Nothing consumes this module yet. It is introduced alongside the existing
 * `model-specs.ts` so the change can be reviewed on its own; the providers,
 * the dialogs, and the catalogue contents follow in their own commits.
 */

/** Where a model is in its life, and what to say when it is ending. */
export type ModelLifecycleStatus =
  /** Generally available, and the current recommendation. */
  | 'active'
  /** Available and priced, but superseded; kept so saved rows still resolve. */
  | 'legacy'
  /** A provider preview: expect it to change or vanish within months. */
  | 'preview'
  /** The provider has announced its end. */
  | 'deprecated'
  /** Gone. Requests fail. */
  | 'retired';

/**
 * How much a model costs relative to the work FEED does with it. Drives the
 * warning on models that cost many times what translation needs.
 * `frontier` means an output price at or above $20 per 1M tokens.
 */
export type ModelCostTier = 'economy' | 'standard' | 'frontier';

/** Whether a model accepts `temperature` / `top_p`, and in what combination. */
export type SamplingSupport =
  /** Both may be sent. */
  | 'supported'
  /** One or the other, never both (Claude 4.5). */
  | 'temperature-or-top-p'
  /** Neither may be sent at all (Claude 4.6 and later). */
  | 'unsupported';

/** How a model is asked to think less, or more. */
export type ReasoningControl =
  /** No control, and nothing to send. */
  | { kind: 'none' }
  /** OpenAI's `reasoning_effort`. */
  | { kind: 'effort'; values: readonly string[]; leastCost: string }
  /** Gemini's `thinkingConfig.thinkingLevel`. */
  | { kind: 'thinking-level'; values: readonly string[]; leastCost: string }
  /** Claude's extended thinking: off unless asked. */
  | { kind: 'extended'; leastCost: 'off' }
  /** Claude 5's adaptive thinking: on unless disabled. */
  | { kind: 'adaptive'; values: readonly string[]; leastCost: string; canDisable: boolean };

/** Whether FEED may seed the reply to force a JSON opening brace. */
export type PrefillSupport = 'allowed' | 'rejected';

/** How a language is served by a model, for the coverage warning (D18). */
export type LanguageCoverage = 'evaluated' | 'supported' | 'unsupported';

export interface ModelPricing {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /**
   * The date these prices were last checked against the provider's own page.
   * A stale price does not error; it silently mis-projects the spend limits
   * it feeds, which is why the date is recorded rather than assumed.
   */
  verifiedAt: string;
  /** Set when a provider has announced a change, e.g. Gemini 3.x in 2027. */
  changesOn?: string;
}

export interface ModelLifecycle {
  status: ModelLifecycleStatus;
  /** ISO date the provider stops serving it, when one is announced. */
  shutdownDate?: string;
  /** The catalogue id to move to. Must resolve to another entry. */
  replacement?: string;
  /** Why it is in this state, in one line, for the interface to show. */
  note?: string;
}

export interface ModelCapabilities {
  sampling: SamplingSupport;
  maxTokensField: 'max_tokens' | 'max_completion_tokens';
  reasoning: ReasoningControl;
  prefill: PrefillSupport;
  /**
   * Ceiling FEED applies to a non-streaming request, below the model's own
   * output limit. The Anthropic SDK refuses a non-streaming call whose
   * expected duration passes ten minutes, and a 128K output limit sails past
   * it.
   */
  nonStreamingOutputCeiling?: number;
}

export interface CatalogueEntry {
  /** The exact id sent to the provider. */
  id: string;
  /** What an administrator sees. */
  displayName: string;
  provider: 'OpenAI' | 'Anthropic' | 'Google';
  pricing: ModelPricing;
  contextWindow: number;
  maxOutputTokens: number;
  lifecycle: ModelLifecycle;
  costTier: ModelCostTier;
  capabilities: ModelCapabilities;
  /**
   * Language coverage, by FEED's own language names. Absent means unknown
   * rather than unsupported: only a measured or provider-published claim
   * belongs here.
   */
  languages?: Record<string, LanguageCoverage>;
}

/** The service endpoints a provider is reached on. */
export const SERVICE_ENDPOINTS = {
  OpenAI: 'https://api.openai.com/v1',
  Anthropic: 'https://api.anthropic.com/v1',
  Google: 'https://generativelanguage.googleapis.com',
  Azure: '',
} as const;

/**
 * The catalogue as it stands today — the models `model-specs.ts` currently
 * offers, restated with lifecycle and capabilities. Retiring these and adding
 * the 2026 families is a separate commit, so that this one can be read as
 * "the same list, described properly".
 */
export const CATALOGUE: readonly CatalogueEntry[] = [
  // ---------------- OpenAI ----------------
  {
    id: 'gpt-5-nano-2025-08-07',
    displayName: 'gpt-5-nano',
    provider: 'OpenAI',
    pricing: { input: 0.05, output: 0.4, verifiedAt: '2026-09-11' },
    contextWindow: 128000,
    maxOutputTokens: 128000,
    lifecycle: {
      status: 'deprecated',
      shutdownDate: '2026-12-11',
      replacement: 'gpt-5.6-luna',
      note: 'Deprecated 2026-06-11; OpenAI shuts the 2025-08-07 snapshots down on 2026-12-11.',
    },
    costTier: 'economy',
    capabilities: {
      sampling: 'unsupported',
      maxTokensField: 'max_completion_tokens',
      // `minimal` is valid here and rejected on GPT-5.6 — the reason this is
      // per-model data rather than one shared union.
      reasoning: { kind: 'effort', values: ['minimal', 'low', 'medium', 'high'], leastCost: 'minimal' },
      prefill: 'allowed',
    },
  },
  {
    id: 'gpt-5-mini-2025-08-07',
    displayName: 'gpt-5-mini',
    provider: 'OpenAI',
    pricing: { input: 0.25, output: 2.0, verifiedAt: '2026-09-11' },
    contextWindow: 128000,
    maxOutputTokens: 128000,
    lifecycle: {
      status: 'deprecated',
      shutdownDate: '2026-12-11',
      replacement: 'gpt-5.6-terra',
      note: 'What production runs today. Shuts down 2026-12-11.',
    },
    costTier: 'economy',
    capabilities: {
      sampling: 'unsupported',
      maxTokensField: 'max_completion_tokens',
      reasoning: { kind: 'effort', values: ['minimal', 'low', 'medium', 'high'], leastCost: 'minimal' },
      prefill: 'allowed',
    },
  },
  {
    id: 'gpt-5-2025-08-07',
    displayName: 'gpt-5',
    provider: 'OpenAI',
    pricing: { input: 1.25, output: 10.0, verifiedAt: '2026-09-11' },
    contextWindow: 128000,
    maxOutputTokens: 128000,
    lifecycle: {
      status: 'deprecated',
      shutdownDate: '2026-12-11',
      replacement: 'gpt-5.6-sol',
    },
    costTier: 'standard',
    capabilities: {
      sampling: 'unsupported',
      maxTokensField: 'max_completion_tokens',
      reasoning: { kind: 'effort', values: ['minimal', 'low', 'medium', 'high'], leastCost: 'minimal' },
      prefill: 'allowed',
    },
  },

  // ---------------- Anthropic ----------------
  {
    id: 'claude-haiku-4-5-20251001',
    displayName: 'claude-haiku-4.5',
    provider: 'Anthropic',
    pricing: { input: 1.0, output: 5.0, verifiedAt: '2026-09-11' },
    contextWindow: 200000,
    maxOutputTokens: 64000,
    lifecycle: {
      status: 'active',
      shutdownDate: '2026-10-15',
      note: 'Retirement not sooner than 2026-10-15, and no Haiku successor exists yet.',
    },
    costTier: 'economy',
    capabilities: {
      // Measured: prefill and one sampling parameter still work here.
      sampling: 'temperature-or-top-p',
      maxTokensField: 'max_tokens',
      reasoning: { kind: 'extended', leastCost: 'off' },
      prefill: 'allowed',
      nonStreamingOutputCeiling: 20480,
    },
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    displayName: 'claude-sonnet-4.5',
    provider: 'Anthropic',
    pricing: { input: 3.0, output: 15.0, verifiedAt: '2026-09-11' },
    contextWindow: 200000,
    maxOutputTokens: 64000,
    lifecycle: {
      status: 'legacy',
      shutdownDate: '2026-09-29',
      replacement: 'claude-sonnet-5',
    },
    costTier: 'standard',
    capabilities: {
      sampling: 'temperature-or-top-p',
      maxTokensField: 'max_tokens',
      reasoning: { kind: 'extended', leastCost: 'off' },
      prefill: 'allowed',
      nonStreamingOutputCeiling: 20480,
    },
  },
  {
    id: 'claude-opus-4-5-20251101',
    displayName: 'claude-opus-4.5',
    provider: 'Anthropic',
    pricing: { input: 5.0, output: 25.0, verifiedAt: '2026-09-11' },
    contextWindow: 200000,
    maxOutputTokens: 64000,
    lifecycle: {
      status: 'legacy',
      shutdownDate: '2026-11-24',
      replacement: 'claude-opus-5',
    },
    costTier: 'frontier',
    capabilities: {
      sampling: 'temperature-or-top-p',
      maxTokensField: 'max_tokens',
      reasoning: { kind: 'extended', leastCost: 'off' },
      prefill: 'allowed',
      nonStreamingOutputCeiling: 20480,
    },
  },

  // ---------------- Google ----------------
  {
    id: 'gemini-2.5-flash-lite',
    displayName: 'gemini-2.5-flash-lite',
    provider: 'Google',
    pricing: { input: 0.1, output: 0.4, verifiedAt: '2026-09-11' },
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    lifecycle: {
      status: 'deprecated',
      replacement: 'gemini-3.5-flash-lite',
      // Measured on this instance's own key.
      note: 'Google refuses this model to newer projects: 404 "no longer available to new users".',
    },
    costTier: 'economy',
    capabilities: {
      sampling: 'supported',
      maxTokensField: 'max_tokens',
      reasoning: { kind: 'none' },
      prefill: 'allowed',
    },
  },
  {
    id: 'gemini-2.5-flash',
    displayName: 'gemini-2.5-flash',
    provider: 'Google',
    pricing: { input: 0.3, output: 2.5, verifiedAt: '2026-09-11' },
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    lifecycle: {
      status: 'deprecated',
      replacement: 'gemini-3.8-flash',
      note: 'Refused to newer projects, as 2.5 Flash-Lite is.',
    },
    costTier: 'economy',
    capabilities: {
      sampling: 'supported',
      maxTokensField: 'max_tokens',
      reasoning: { kind: 'none' },
      prefill: 'allowed',
    },
  },
  {
    id: 'gemini-2.5-pro',
    displayName: 'gemini-2.5-pro',
    provider: 'Google',
    pricing: { input: 1.25, output: 10.0, verifiedAt: '2026-09-11' },
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    lifecycle: {
      status: 'deprecated',
      replacement: 'gemini-3.1-pro-preview',
      note: 'Refused to newer projects.',
    },
    costTier: 'standard',
    capabilities: {
      sampling: 'supported',
      maxTokensField: 'max_tokens',
      reasoning: { kind: 'none' },
      prefill: 'allowed',
    },
  },
  {
    id: 'gemini-3-flash-preview',
    displayName: 'gemini-3-flash-preview',
    provider: 'Google',
    pricing: { input: 0.5, output: 3.0, verifiedAt: '2026-09-11' },
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    lifecycle: {
      status: 'deprecated',
      replacement: 'gemini-3.8-flash',
      note: 'Preview, superseded by the stable 3.x Flash line.',
    },
    costTier: 'economy',
    capabilities: {
      sampling: 'supported',
      maxTokensField: 'max_tokens',
      reasoning: {
        kind: 'thinking-level',
        values: ['minimal', 'low', 'medium', 'high'],
        leastCost: 'minimal',
      },
      prefill: 'allowed',
    },
  },
  {
    id: 'gemini-3-pro-preview',
    displayName: 'gemini-3-pro-preview',
    provider: 'Google',
    pricing: { input: 2.0, output: 12.0, verifiedAt: '2026-09-11' },
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    lifecycle: {
      status: 'retired',
      shutdownDate: '2026-03-09',
      replacement: 'gemini-3.1-pro-preview',
      note: 'Shut down 2026-03-09. Requests fail.',
    },
    costTier: 'standard',
    capabilities: {
      sampling: 'supported',
      maxTokensField: 'max_tokens',
      reasoning: { kind: 'thinking-level', values: ['low', 'high'], leastCost: 'low' },
      prefill: 'allowed',
    },
  },
] as const;

/** One entry by the id sent to the provider. */
export const findCatalogueEntry = (id: string | null | undefined): CatalogueEntry | undefined =>
  id ? CATALOGUE.find((entry) => entry.id === id) : undefined;

/** Everything a provider offers, in catalogue order. */
export const entriesForProvider = (provider: CatalogueEntry['provider']): CatalogueEntry[] =>
  CATALOGUE.filter((entry) => entry.provider === provider);

/** What an administrator should be able to pick: anything not already gone. */
export const selectableEntries = (): CatalogueEntry[] =>
  CATALOGUE.filter((entry) => entry.lifecycle.status !== 'retired');

/**
 * The cheapest reasoning setting a model allows, which is FEED's default:
 * translation and classification gain nothing from reasoning, and it is
 * billed as output. Returns null where a model offers no control.
 */
export const leastCostReasoning = (entry: CatalogueEntry): string | null => {
  const { reasoning } = entry.capabilities;
  return reasoning.kind === 'none' ? null : reasoning.leastCost;
};

/** Whether a value is one this model will accept, for validation and the UI. */
export const acceptsReasoningValue = (entry: CatalogueEntry, value: string): boolean => {
  const { reasoning } = entry.capabilities;
  if (reasoning.kind === 'none') return false;
  if (reasoning.kind === 'extended') return value === 'off';
  return reasoning.values.includes(value);
};
