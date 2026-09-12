// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

export interface AIConfiguration {
  id: number
  name: string
  type: 'prompt' | 'model' | 'apikey'
  value: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  // API Key specific fields
  modelName?: string
  model?: string
  serviceType?: 'OpenAI' | 'Anthropic' | 'Google' | 'Azure'
  endpointUrl?: string
  apiKey?: string
  inputCost?: number | null
  outputCost?: number | null
  unitPrice?: string
  temperature?: number
  topP?: number
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' | null
  maxTokens?: number
  inputTokenLimit?: number | null
  outputTokenLimit?: number | null
  dailyCostLimit?: number | null
  monthlyCostLimit?: number | null
  tokensPerMinute?: number | null
  requestsPerMinute?: number | null
  requestsPerDay?: number | null
}

export interface BulkOperationResult {
  success: number
  failed: number
  errors: string[]
  changed?: number
  skipped?: number
}

export type AIConfigurationType = 'prompt' | 'apikey'

export interface StatusMessage {
  type: 'success' | 'error' | 'info'
  message: string
}

/**
 * The one-time initialization wizard's four screens, in order.
 *
 * `useSetupState` and `InitialSetupWizard` have always imported `SetupStep`
 * and `SetupState` from this module, and this module has never exported them
 * — the hook typechecked as `any` and the wizard's four `setupStep === '…'`
 * comparisons were unchecked string equality. Declared here from the values
 * both files actually use, so a fifth step or a renamed one is now a type
 * error rather than a screen that silently never renders.
 */
export type SetupStep = 'welcome' | 'keygen' | 'validation' | 'complete'

export interface SetupState {
  setupStep: SetupStep
  /** Base64 AES-GCM key, present only between generation and initialization. */
  generatedKey: string | null
  isInitializing: boolean
  initializationError: string | null
}

/**
 * The model catalogue served by `GET /api/ai-config/models`.
 *
 * A hand-written mirror of `CatalogueEntry` in
 * `packages/backend/src/services/ai/catalogue.ts`, following the same
 * convention as `AIConfiguration` above and `types/translation.ts`: the two
 * packages share no code, so a backend response shape is restated here with a
 * pointer to its source.
 *
 * Only the fields the configuration dialogs actually read are mirrored. A
 * field the backend adds and this omits is ignored at runtime rather than
 * breaking — but a field that changes *shape* would not be caught by the
 * compiler, so treat the backend file as authoritative when they disagree.
 */
export interface CatalogueModel {
  id: string
  displayName: string
  provider: 'OpenAI' | 'Anthropic' | 'Google'
  pricing: {
    input: number
    output: number
    verifiedAt: string
    changesOn?: string
  }
  contextWindow: number
  maxOutputTokens: number
  lifecycle: {
    status: 'active' | 'legacy' | 'preview' | 'deprecated' | 'retired'
    shutdownDate?: string
    replacement?: string
    note?: string
  }
  costTier: 'economy' | 'standard' | 'frontier'
  capabilities: {
    sampling: 'supported' | 'temperature-or-top-p' | 'unsupported'
    maxTokensField: 'max_tokens' | 'max_completion_tokens'
    reasoning:
      | { kind: 'none' }
      | { kind: 'effort'; values: string[]; leastCost: string }
      | { kind: 'thinking-level'; values: string[]; leastCost: string }
      | { kind: 'extended'; leastCost: 'off' }
      | { kind: 'adaptive'; values: string[]; leastCost: string; canDisable: boolean }
    prefill: 'allowed' | 'rejected'
    fixedTemperature?: number
    nonStreamingOutputCeiling?: number
  }
  rateLimits?: {
    tokensPerMinute: number
    requestsPerMinute: number
    requestsPerDay?: number
  }
}

export interface ModelCatalogueResponse {
  models: CatalogueModel[]
  endpoints: Record<string, string>
}
