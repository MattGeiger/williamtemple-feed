# AI Configuration overview — v1.8.2

AI Configuration manages one organization-wide set of provider credentials,
model configurations and system prompts. Authentication gates access;
administrator authority gates mutations. Configurations are never partitioned
by user.

## Current implementation

- `components/ai-configuration/index.tsx` orchestrates the list and dialogs.
- `AddAIModelDialog.tsx` and `EditAIModelDialog.tsx` use `BaseAIConfigDialog`.
- `shared/stepDefinitions.ts` defines the nine model-configuration steps:
  Service Configuration, API Credentials, Cost Tracking, Token Limits, Cost
  Limits, Usage Limits, AI Parameters, Thinking Level, Configuration Details.
- System-prompt dialogs retain their existing separate flow.
- `services/ai-config` owns API calls. `services/unified-config` combines model
  configurations and system prompts for the shared list.
- `useModelCatalogue` reads `GET /api/ai-config/models`, including `models`,
  `withdrawn` and provider endpoints. No frontend `model-specs.ts` exists.

## Defaults and editing

The Add dialog defaults to Google / Gemini 3.5 Flash-Lite. Switching provider
selects GPT-6 Luna for OpenAI or Claude Haiku 5.5 for Anthropic. Costs and token
limits prefill from the catalogue when it arrives. Merely opening Edit never
replaces saved rates or thinking choices. A model change preserves supported
effort and clears incompatible effort to the model's least-cost default.

API keys are write-only. Edit shows a blank field; leaving it blank keeps the
existing key. Nonempty unusual key formats receive a soft warning, not rejection.
A real provider entitlement check occurs on save/activation, with provider-specific
errors. Known retired models are rejected before generation. Withheld but still
available models remain editable and retain replacement guidance.

Preset prices are managed through `pricingSource: preset`; explicit price/unit
edits select manual pricing. Older rows and backups use null/manual semantics.
The backend computes effective tiered/date-dependent preset rates. Costs already
recorded against UsageRecord are never recalculated.

## Backend

`routes/ai-config.ts` owns CRUD, catalogue reads, validation and entitlement.
`AIServiceFactory` selects the most recently updated active API configuration,
reuses instances while unchanged and clears caches after configuration writes.
`AIConfiguration` stores model settings; `SystemPrompt` stores editable prompts.
Output token limits remain mirrored to `maxTokens` for provider compatibility.

See [models](ai-models.md), [thinking](ai-thinking-parameters.md),
[cost control](ai-cost-control.md), and [November validation](model-catalogue-refresh-2026-11.md).
