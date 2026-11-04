# AI Configuration architecture — v1.8.2

## Shared workspace and UI

AI configuration is organization-wide. Administrators manage provider keys,
models and prompts through the existing shared table and multi-step dialogs.
The current component map, nine-step model flow and defaults are documented in
[the overview](ai-configuration-overview.md).

`ServiceStep` offers only the server catalogue's selectable entries. Both Model
Name and Model selectors update the same model identity and prefill its costs,
token limits and optional account allowances. Withheld saved models stay visible
as the current value without becoming a selectable preset again. Custom entry
remains available. `ParametersStep` and `ThinkingLevelStep` resolve both offered
and withheld models. `BaseAIConfigDialog` retains navigation, failed-save state,
and its fixed-height Shadcn ScrollArea.

## Backend and data

- `AIConfiguration`: encrypted credentials, model, request settings, manual-rate
  snapshots, pricing provenance, spending limits and provider allowances.
- `SystemPrompt`: editable translation/classification instructions and thresholds.
- `FormattingChoice`: organization-shared classification cache, including manual
  decisions. This refresh does not invalidate it or translation caches.
- `UsageRecord`: provider-reported token usage, model identity and recorded cost,
  including billed replies FEED cannot use.

`services/ai/catalogue.ts` is authoritative for model ids, lifecycle, prices,
limits, capabilities and language coverage. `/api/ai-config/models` exposes it;
no secondary frontend model table exists. `pricing.ts` resolves effective rates
for presets and preserves manual/legacy units. Backup contract 13 includes the
nullable provenance field but still redacts encrypted keys and salts. Older
artifacts restore manual pricing; restored keyless configurations stay inactive.

## Provider contracts

The factory selects the most recently updated active configuration. All adapters
consume catalogue capabilities after prompt settings have been merged. Unsupported
sampling never reaches GPT-6 or Claude 5.5 requests. Model-specific thinking modes,
assistant-prefill rules and forced-tool support are explicit capabilities.

OpenAI keeps Chat Completions and JSON schemas. Claude keeps Messages, selecting
text/tool blocks by type and using automatic classification tools where forcing
is unsupported. Google selections and request behavior are retained. These are
synchronous provider operations; the refresh adds no job system or local provider.

All active classification consumers use `classifySegmentsBatch`; the unused
single-segment interface, old OpenAI wrapper and unused legacy form were removed.

## Errors and validation

Provider access checks preserve the actual failure classification. Entitlement
checks run on save/activation. Centralized frontend messaging presents structured
API errors, lifecycle and cost warnings. Cache invalidation after a save prevents
stale instances and remembered provider failures from surviving an edit.

See [model contracts](ai-models.md) and [validation evidence](model-catalogue-refresh-2026-11.md).
Performance and quality depend on the model and prompt; historical timing figures
are not guarantees for the refreshed catalogue.
