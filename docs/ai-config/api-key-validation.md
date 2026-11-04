# API Key Validation (Provider-aware, Warning-first)

Date: 2025-08-30

## Summary

The AI Configuration flow validates API keys using provider-aware, soft checks. If a key format appears unusual for the selected provider, a non-blocking `warning` toast prompts the user to double-check their value.

## Behavior

- Empty API keys are treated as errors in the multi-step dialog and block progression.
- Non-empty but unusual formats trigger a warning toast and do not block the user.
- Applies to OpenAI, Anthropic, and Google keys.

## Implementation

- Validation: `packages/frontend/src/components/ai-configuration/shared/validation.ts`
  - `validateApiKeyForService(key, serviceType)` uses permissive regex patterns per provider.
- UI Hook: `packages/frontend/src/components/ai-configuration/steps/ApiKeyStep.tsx`
  - On blur, calls `validateApiKeyForService`; if `warning`, shows a centralized toast via `useMessage().showMessage(text, 'warning')`.
- The unused legacy `AIConfigurationForm` was removed in v1.8.2; Add/Edit use the shared dialog exclusively.
- Format warnings do not replace save/activation entitlement checks. Rejected keys, unavailable models and exhausted provider credit retain distinct error handling.

## Rationale

- Follows the ASK principle and centralized toast architecture.
- Prevents false negatives due to evolving provider formats while guiding users.

