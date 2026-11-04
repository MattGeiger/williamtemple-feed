# AI models — FEED v1.8.2

The sole model authority is `packages/backend/src/services/ai/catalogue.ts`.
The Add/Edit dialogs read `GET /api/ai-config/models`; providers read the same
capabilities directly. No frontend model-spec list exists.

## Selectable presets

| Provider | Presets in dropdown order |
|---|---|
| OpenAI | GPT-6 Luna (provider default), GPT-6.1 Terra, GPT-6.1 Sol, GPT-6 Astra |
| Anthropic | Claude Haiku 5.5 (provider default), Claude Sonnet 5.5, Claude Opus 5.5, Claude Fable 5.1 |
| Google | Gemini 3.5 Flash-Lite (overall default), Gemini 3.6 Flash, Gemini 3.8 Flash, Gemini 3.1 Pro Preview |

There are 12 selectable presets. Gemini 4 Argon is deliberately excluded.
The catalogue order establishes provider defaults. New model facts are verified
against official documentation; live verification is recorded separately.

## Selection and compatibility

`lifecycle.offered: false` withdraws a choice without claiming the provider has
retired it. Withheld entries remain in the endpoint's `withdrawn` array, so a
saved configuration keeps its settings, lifecycle notice and replacement advice.
Provider-retired models cannot be activated or used for generation. Deactivation,
delete and housekeeping remain available. Custom model entry remains supported;
an unknown id uses conservative capabilities and manual prices.

## Requests

OpenAI uses Chat Completions with JSON-schema responses and
`max_completion_tokens`. New GPT-6 presets omit sampling parameters. Luna and
Terra default to reasoning `none`; Sol defaults to `low`.

Claude uses Messages. Haiku 5.5 defaults to disabled thinking, Sonnet 5.5 to
`between_tools` and low effort, and Opus 5.5 to adaptive thinking at low effort.
All omit sampling and assistant prefill. Haiku permits forced classification
tools; Sonnet/Opus/Fable use automatic tools with validated results. Responses
are read by block type. Operation ceilings remain below advertised maxima.

## Pricing and languages

`AIConfiguration.pricingSource` is `preset`, `manual`, or null. Null is legacy
manual pricing. Selecting a preset establishes managed rates; changing a rate or
its unit switches to manual, without an extra UI step. Managed rates use current
catalogue rates at request time, including supported input-length tiers and
scheduled changes. Manual per-1K/per-1M rates are preserved. Historical usage costs
are never recomputed. Recorded usage includes billed thinking and failed replies.
Token forecasts remain estimates, not provider token counts or hard spend caps.

Every model states coverage for FEED's 59 language names. `supported` is a
provider claim; `evaluated` requires FEED evidence. Existing language warnings
and Simplified Chinese handling remain unchanged.

## Maintenance and evidence

Audit at release boundaries and monthly. Recheck ids, token limits, official
prices, access restrictions and deprecation notices on the day of a change.
Use tiny provider probes and request/response fixtures; keep paid tests out of CI.

- [November refresh and validation](model-catalogue-refresh-2026-11.md)
- [Configuration overview](ai-configuration-overview.md)
- [Pre-refresh model reference (historical)](ai-models-before-1.8.2.md)
- [Official OpenAI migration guide](https://developers.openai.com/api/docs/guides/latest-model)
- [Official Claude model overview](https://platform.claude.com/docs/en/models/overview)
- [Official Gemini model catalogue](https://aistudio.google.com/docs/models)
