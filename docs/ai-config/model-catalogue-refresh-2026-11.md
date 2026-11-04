# AI catalogue refresh — v1.8.2

**Prepared locally, then deployed November 4, 2026.** Local checks below are
separate from the [production verification record](../deployment/v1.8.2-validation.md).
This implements the approved curated catalogue and targeted adapter approach.
Version 1.9.0 remains reserved for Shopping List UX; none of that roadmap scope
is included here. Frontend/backend packages and their lockfile package metadata
are 1.8.2. The root tooling package is unchanged.

## Delivered scope

| Provider | Withdrawn presets | Replacement presets |
|---|---|---|
| OpenAI | GPT-5.6 Luna, Terra, Sol | GPT-6 Luna, GPT-6.1 Terra, GPT-6.1 Sol |
| Anthropic | Haiku 4.5, Sonnet 5, Opus 5 | Haiku 5.5, Sonnet 5.5, Opus 5.5 |
| Google | None in this round | Existing four selections retained |

Astra and Fable remain. There are twelve selections plus Custom. No Gemini 4
Argon preset was added. The existing nine-step Add/Edit workflow, organization
scope, key entry, save behavior, centralized notices and error handling remain.

The backend catalogue remains authoritative. Withdrawn entries retain real
capabilities, pricing, replacement and lifecycle metadata for saved/custom
configurations. Withdrawal is separate from provider retirement. The user
confirmed no current deployment uses GPT-5. No saved model is silently migrated.
Known retired models fail before generation; rename/deactivate/delete remain
possible. GPT-4.1 Nano and the May 2024 GPT-4o snapshot are retired; GPT-4.1,
GPT-4.1 Mini and GPT-4o Mini carry January 14, 2027 shutdown metadata. Sonnet 4.5
carries November 30, 2026 shutdown metadata and is withheld early.

Legacy Gemini 2.5 Flash/Pro entries warn about Google's December 1 automatic
redirect to 3.5 Flash-Lite/3.8 Flash and the resulting request/pricing change.
They remain withheld. This is a redirect warning, not a claim the endpoints
cease serving; administrators should select the replacement explicitly before
that date. No automatic migration of saved configurations is performed.

## Provider contracts

- OpenAI: Chat Completions, JSON-schema output, `max_completion_tokens`, omitted
  sampling. Luna/Terra default to `none`; Sol to `low`. Explicit effort is
  validated against each model. Newly selected models discard incompatible
  saved effort values. Provider maxima do not replace FEED operation caps.
  November 4 live requests rejected `max` for Luna/Terra/Sol; their selectable
  ceiling is `xhigh`, which passed for all three. This measured API contract
  takes precedence over the higher level listed on the provider pages.
- Claude: Messages, no assistant prefill or sampling. Haiku defaults to disabled
  thinking and low effort; Sonnet to `between_tools` and low effort; Opus to
  adaptive thinking and low effort. Haiku permits forced classification tools;
  Sonnet/Opus use automatic tools and validate returned blocks. SDK 0.129.0 is
  pinned for the new Messages types; the API version and transport stay intact.
- Google: selections, transport and request contracts remain unchanged.

Pricing uses a shared resolver across providers, usage, limits and estimates.
Preset rates support Haiku's above-100K input tier, the new OpenAI above-272K
input tiers, and the January 1, 2027 Gemini 3.6/3.8 rate change. Tier thresholds
are based on input tokens and apply to the whole request. Rates represent
ordinary input/output usage; forecasts remain estimates, not hard billing caps
or a complete provider invoice reconciliation.

`AIConfiguration.pricingSource` is nullable: `preset` opts into maintained
catalogue rates; `manual` or null preserves saved rates and legacy units.
Selecting a model sets preset provenance; editing either price or its unit
switches to manual without a new UI control. The server derives managed rates
instead of trusting client-supplied prices. Historical usage is unchanged.

## Migration and cleanup

Migration `20261104173000_ai_pricing_source` adds one nullable column without
rewriting configurations or keys. Existing rows retain null/manual behavior.
It was first applied to the local development database; the separately authorized
production deployment applied it on November 4 (see the verification record).
Backup contract 13
carries provenance; older artifacts remain accepted with null defaults. Normal
backup secret exclusions and same-instance secret preservation remain intact.
Older readers intentionally reject contract 13 rather than silently drop fields.

Removed unused code: the legacy AIConfigurationForm, obsolete OpenAI wrapper,
unused single-call classification interface/implementations, and the token-limit
repair script whose heuristic treated valid 128K limits as corruption. Callable
legacy catalogue entries and their capability branches remain for compatibility.

For rollback, retain a pre-release database/storage backup and the previous
image tags. Prefer a forward correction for this additive migration. Do not
restore a contract-13 backup into an older application. A full rollback must
restore the matching pre-release database and storage together; it discards
subsequent writes. Never copy provider keys into release artifacts.

## Local validation evidence

Validation uses Node 24.22.1. Results are local, not deployed verification.

- Backend and frontend production builds pass. Vite retains its existing large
  bundle warning and runtime brand stylesheet notice.
- Backend full suite: 111 files / 1,334 tests passed; 2 tests skipped.
- Frontend full suite: 88 files / 584 tests passed.
- Final metadata/notice review: 6 backend catalogue/pricing files / 78 tests
  and 5 frontend modal/notice files / 37 tests passed; both builds pass again.
- Real frontend type checking uses `tsconfig.app.json`. A clean HEAD archive
  with the same installed dependencies reports 144 existing errors. This change
  reduces that count to 136; normalized diagnostic comparison adds no errors.
  The ratchet baseline is left unchanged; a clean type check is not claimed.
- Fresh SQLite fixtures now explicitly create an empty database before Prisma
  migration deployment. All 37 migrations and secret-preserving restore pass.
- Catalogue tests assert the exact twelve selections, retained withdrawn lookup,
  per-model defaults, sampling/prefill/tool contracts, pricing boundaries,
  effective dates, manual preservation and safe credential responses.

Commands, run from the respective package directories:

```bash
# packages/backend
npm run build
npx vitest run --maxWorkers=4
npx prisma migrate status

# packages/frontend
npm run build
npx vitest run
npm run typecheck:ratchet
```

### Authenticated browser pass — November 4, 2026

The user replaced the local Resend key. Restarting the backend loaded the new
environment, and the user completed normal sign-in. Authentication was not
bypassed. The in-app browser pass at localhost:5173 verified:

- All twelve offered ids, grouped correctly by provider, plus Custom. Google
  selections are unchanged; GPT-5.6 and the older Claude presets are absent.
- Add opens on Gemini 3.5 Flash-Lite; switching providers selects GPT-6 Luna or
  Haiku 5.5. GPT-6.1 Sol completed all nine steps to an enabled Create button,
  using a dummy key only in the unsaved draft. No key or configuration was saved.
- Sol's $2/$10 rates, 1,050,000/128,000 token limits, omitted sampling controls
  and low-through-max thinking range. Haiku's $0.1/$0.5 rates, 1M/128K limits,
  omitted sampling and low-through-max slider; keyboard End selects max and
  displays the existing higher-cost warning. Opus 5.5 prefills $4/$20 rates and
  displays the expensive-model notice.
- Saved Sonnet 5/Opus 5 stay readable with Superseded notices. Edit offers their
  5.5 replacements without reoffering the old ids. Switching Sonnet to 5.5
  prefills current rates and low default thinking and reaches Save Changes.
- Edit keeps the key empty with the existing leave-blank-to-preserve message.
  A draft manual price survives Back/Next. Canceling and reopening Sonnet shows
  the original saved model; existing rows remain unchanged (15 configurations).
- Custom reveals the free-text model field, disables Next when empty and enables
  it after entry. Light/dark dialogs render legibly, and the initial dark theme
  was restored. Dropdown → Edit → Close/Cancel and subsequent Add operations work.
  After animations finish there are no visible dialogs, menus or poppers, and
  `document.body.style.pointerEvents` is empty rather than stuck at `none`.
- The sidebar reports Version 1.8.2; Release Notes opens the matching entry and
  describes local preparation separately from production deployment.

No blocking workflow defect was observed. The console emitted a React 19
`element.ref` compatibility diagnostic from a dependency; this pass does not
establish whether it predates the refresh. It did not prevent the checked
interactions. No runtime code was changed during this browser pass.

Screenshots captured in this chat show the Claude dropdown, Opus 5.5 in light
mode and the retained Sonnet 5 upgrade notice in dark mode. These are local
browser observations, not provider generation or deployed verification.

### User save checks — November 4, 2026

The user entered fresh Anthropic keys and reported successful model updates.
A read-only local database check confirms Haiku/Sonnet/Opus 5.5 were persisted;
Haiku is active, and Sonnet/Opus are inactive. Saves run the existing minimal
generation entitlement check. This validates saved model/key setup, not the
full translation/classification feature matrix or output quality.

OpenAI updates with a fresh key fail during the generation entitlement check.
The provider returned HTTP 403, `model_not_found`, explicitly stating the key's
project does not have access to `gpt-6-astra` and `gpt-6.1-sol`. These were real
provider responses, not FEED parameter validation or an invalid-key 401. The
exact account restriction has not been established; project model permissions
and organization availability need review. Creating another key in the same
project does not by itself resolve project-level model restrictions. See
[OpenAI project model permissions](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/projects/subresources/model_permissions/methods/retrieve).
The agent changed no account permissions, and failed OpenAI updates did not persist.

#### Intermittent acceptance after permission updates

The user updated OpenAI permissions and reported saves succeeding after repeated
clicks. Read-only investigation confirms all four current OpenAI models are now
saved. The log contains twelve distinct 403 `model_not_found` entitlement
failures across the four models; the latest failures precede their database
update times by a few seconds. A failed request therefore proves denial at that
moment, not permanent lack of access. Permission propagation or inconsistent
provider routing is a hypothesis, not an established cause.

At approximately 11:46 AM Pacific on November 4, the agent ran two unbilled
`models.retrieve` calls per saved OpenAI model, with SDK retries disabled. All
eight returned 200 and the expected model id. The four configurations use the
same decrypted credential (compared in memory, never printed). No shell/file
OpenAI endpoint/project/organization overrides were found. No additional paid
generation, configuration writes or permission changes were performed.

Source inspection rules out the translation failure cache for ordinary saves:
each save creates an uncached service, verifies entitlement and only then
persists. At discovery, successful probe responses were discarded:
`verifyEntitlement` accepted any successful HTTP response without checking text,
returned model, finish reason or usage. Its 16-token output cap could also be
insufficient for a reasoning model to produce visible text. Whether any
of the user's accepted saves had empty/truncated output is currently unknown.

#### Controlled follow-up — implemented and executed

The user approved up to **$1.00** for this investigation. The existing provider
pattern was extended without new dependencies, UI steps or configuration writes:

- `services/ai/openai-entitlement.ts` provides the fixed save request and strict
  response check. The output cap is 512 tokens, including reasoning. Success
  requires the requested model (or its dated snapshot), normal `stop`, nonempty
  text, no refusal and valid usage counts. Empty, truncated or mismatched replies
  return `AI_MODEL_VERIFICATION_FAILED`, not a successful save or generic outage.
- Every probe emits an allowlisted trace: UTC time, client/provider request ids,
  lane, config id, process-scoped HMAC credential tag, requested/returned model,
  HTTP status/code, finish reason, output presence, usage and estimated cost.
  Neither output text nor keys, headers, cookies or full SDK exceptions are logged.
- Save checks disable SDK retries and retain their single-check behavior. The
  configuration-specific refusal message says no changes were saved and allows
  for recent permission changes; it no longer claims a configuration was being
  translated or that retry could never succeed. Translation error copy is unchanged.
- `scripts/diagnose-openai-entitlement.ts` defaults to plan-only. `--bill` enables
  up to three spaced rounds, alternating service/direct order, with the same
  saved key/model/prompt and no SDK retries. Requests reserve the higher of
  saved/current rates for 1,000 assumed input and 512 capped output tokens. The
  input allowance is an estimate, not a hard token cap. Missing/uncertain billed
  usage or an exhausted reservation stops further requests. No keys or settings
  are rewritten and no configuration is activated.

Executed from `packages/backend`:

```bash
npx ts-node scripts/diagnose-openai-entitlement.ts --ceiling 1 --rounds 3
npx ts-node scripts/diagnose-openai-entitlement.ts --bill --ceiling 1 --rounds 3
```

At approximately 11:57–11:59 AM Pacific on November 4:

| Model | FEED service checks | Direct SDK checks | FEED Spanish translation |
|---|---|---|---|
| GPT-6 Luna | 3/3 usable | 3/3 usable | Rice → Arroz |
| GPT-6.1 Terra | 3/3 usable | 3/3 usable | Rice → Arroz |
| GPT-6.1 Sol | 3/3 usable | 3/3 usable | Rice → Arroz |
| GPT-6 Astra | 3/3 usable | 3/3 usable | Rice → Arroz |

All 24 probes returned HTTP 200, the expected model, normal `stop`, nonempty
output and usage; none used more than five completion tokens. The same credential
tag appeared in both lanes for all models. Estimated probe cost: **$0.002384**.
The direct lane uses an independently constructed SDK client; the service lane
exercises FEED's real save-check method, not an HTTP PUT or a configuration write.

Four additional `translateText` calls used FEED's real translation prompt,
JSON-response parsing and usage tracking with synthetic text `Rice`, Spanish,
in-memory 512-token limits and SDK retries disabled. All returned `Arroz`, with
94 input and 14 output tokens each; one outbound call per model. Read-only
inspection confirms four successful UsageRecord rows with matching models/costs.
No translation-cache, inventory or configuration rows were written by this check.

The 28 paid requests total **$0.0045324 estimated ordinary-token cost**, with
**$0.444352 reserved** across both phases, below the approved $1.00. Estimates
use the catalogue rates and are not provider invoice reconciliation. Raw safe
request traces remain local at `/tmp/feed-openai-diagnostic-results.jsonl` and
`/tmp/feed-openai-translation-check.jsonl`; credentials are absent. Request ids
can be supplied privately to OpenAI if denial recurs.

Backend build passes; the full suite passes **113 files / 1,354 tests**, with
2 skipped. New regression coverage rejects unusable HTTP 200 replies, ensures
403s are not retried even with an `x-should-retry` hint, checks trace redaction,
preserves the verification error through route handling, and enforces the CLI's
opt-in and reservation guards.

The earlier intermittent 403 was **not reproduced**. Its cause is still unproven;
permission propagation/provider routing remains a hypothesis. This short sample
establishes current usable generation for these models, not long-term reliability
or complete language/document/classification coverage. If failures recur, compare
safe traces with identical parameters and paired provider request ids. Do not
mask access refusals with automatic retries or bypass save validation.

#### Description-only UI saves — November 4, 2026

At the user's request, the authenticated browser edited the description of each
OpenAI configuration (Terra, Sol, Astra and Luna), saved once, reopened it and
restored the original description with one further save. No key, model, status,
price or other setting was intentionally changed. All **8/8 actual UI saves**
succeeded on the first attempt; no 403 or other error appeared. Each save emitted
one trace with HTTP 200, the expected model, normal `stop` and usable output.

A before/after comparison of configuration settings plus encrypted-key/salt
digests confirms every description and all captured settings/keys match the
baseline. Only `updatedAt` changed. The original descriptions are visible again
in the table. This exercises the full UI/HTTP-save path, beyond the previous
service/direct comparison. Credential values were neither printed nor re-entered.

Estimated cost of these eight checks: **$0.000796**; cumulative agent-run paid
diagnostics: **$0.0053284**, still below the approved $1.00. Safe traces are local
at `/tmp/feed-description-test-traces.json`; the restored UI screenshot is
`/tmp/feed-openai-description-saves-restored.png` and is attached in the chat.

Description-only updates currently still invoke provider generation. Thus an
external access refusal can block a harmless metadata edit even when the key
and model did not change. This behavior was preserved for this test; no runtime
code was changed. Decoupling metadata edits from entitlement verification would
be a separate behavior change. The earlier intermittent refusal remains
unreproduced, not conclusively resolved.

The earlier unbilled checks with the original local credentials returned 401.
The agent did not initiate billable generation in that sweep ($0 recorded).
The user's subsequent saves perform minimal paid generation; their spend was
not measured here. Google remains unverified; the later OpenAI follow-up above
provides current live evidence. Request fixtures alone do not prove entitlement
or output quality.

The earlier feature checklist is superseded by the local validation below.
Provider-backed saves and blank-key preservation have now been exercised;
manual price/provenance persistence and unavailable-model lifecycle controls
are covered by automated route/modal/restore tests. A separate browser save of
a manual price override was not performed. Qualified language review remains
a human responsibility; synthetic smoke output is not a translation-quality
certification. Google live testing is explicitly excluded by the user because
its selections were unchanged. Production verification is now recorded separately
in [the deployment record](../deployment/v1.8.2-validation.md).

### Completed feature validation — November 4 follow-up

The user authorized synthetic local fixtures and a cumulative $1.00 provider
test allowance. No Google requests were made in this follow-up. Provider-service
checks use saved credentials without changing the saved model; browser checks
use the authenticated application at port 5173 and the real backend at 3001.

| Models | Spanish single translation | Arabic batch, including duplicate ids | Three-segment classification | Highest selectable effort |
|---|---|---|---|---|
| GPT-6 Luna, GPT-6.1 Terra, GPT-6.1 Sol | Pass | Pass | Pass | `xhigh`: pass after removing rejected `max` |
| GPT-6 Astra | Pass | Pass | Pass | `xhigh`: pass |
| Claude Haiku 5.5 | Pass | Pass after batch parsing fix | Pass | `max`: pass with 1,024-token cap |
| Claude Sonnet 5.5, Opus 5.5, Fable 5.1 | Pass | Pass | Pass | `max`: pass |

The initial OpenAI sweep was 25/28: only the three `max` requests failed with
HTTP 400. All three complete model sweeps then passed 7/7 at the accepted
`xhigh` ceiling. The initial Claude sweep was 27/28: Haiku returned a batch
shape that failed JSON parsing. The old parser reproduces that failure for a
fenced array of objects because it extracts the inner braces and drops the
array brackets. FEED now parses complete fenced JSON first, accepts either a
valid array or the established `translations` envelope, explicitly requests the
envelope, and requires exactly one non-empty result per unique input. Duplicate
input ids are restored. Incomplete batches fail instead of silently succeeding.
Billed malformed/truncated batch replies, and truncated/empty single replies,
now retain failed usage records with provider-reported token counts.

Haiku's repeat highest-effort request exhausted the intentionally tiny 512-token
test cap. It was rejected rather than accepted as a translation; a separately
bounded 1,024-token check completed (`Rice` → `Arroz`, 244 input/193 output).
This is an output-budget limitation, not evidence of lost model access. Other
production configuration limits were not reduced by the refresh.

Authenticated browser and feature checks:

- Uploaded a valid, four-paragraph synthetic DOCX; Auto-Format classified all
  four segments through GPT-6 Luna, then Spanish translation replaced all four.
  Downloaded the DOCX, rendered it with LibreOffice/Poppler and visually inspected
  all text. A first minimal fixture lacked the required DOCX relationships and
  failed extraction; replacing the test fixture resolved it without app changes.
- Selected exactly 40 synthetic failed Custom translations and used **Actions →
  Retry Selected**. All 40 completed through Luna on the first run. Its temporary
  512-token cap bounded this concurrent test; the original limit was restored.
- Generated Arabic shopping-list PDF through Luna and Chinese PDF through Haiku
  using a synthetic text/table template. Rendered both with Poppler and compared
  their canvas previews: Arabic shaping, mirrored table columns and dividers,
  Chinese glyphs, English tags, arrow, limits and row placement were legible and
  consistent. App dark mode did not tint the printed pages. This exercises the
  existing builder workflow; no Shopping List UX changes were included.
- Repeated Chinese PDF export: usage record count stayed **229 → 229**, with no
  extra provider generation. Both fresh and cached exports downloaded normally.
- Ran the actual inventory translation queue with synthetic Category and FoodItem
  records through Haiku for Arabic and Chinese. All four generic cache rows
  completed, with two denormalized translations per inventory record. This is a
  service-pipeline check, separate from the browser checks above.
- Removed the two fixture documents, translated DOCX, builder template, temporary
  inventory records and newly created translation/classification cache rows.
  Restored the original Luna/Haiku output limits, timestamps and default-provider
  ordering. Preserved real usage records; keys, model choices and other saved
  settings were not changed. Evidence downloads/screenshots remain outside Git.

Recorded OpenAI/Anthropic usage for November 4 totals **$0.0933044** (including
earlier diagnostics). Two failures before the accounting fixes were unrecorded:
the Haiku truncated single response reports 255 input/512 output tokens
($0.0002815); reserving an additional $0.001 for the failed tiny batch keeps the
combined accounted amount/allowance **below $0.10**, within the $1.00 approval.
These are FEED rate-based estimates, not a provider invoice reconciliation.

Final checks: backend **113 files, 1,364 passed, 2 skipped**; frontend **88 files,
584 passed**; both production builds pass. One first full backend run timed out
in a catalogue HTTP test under concurrent validation. The unchanged test passed
9/9 in isolation and the complete rerun passed; no timeout increase was made.
The frontend build retains its existing large-chunk warning. Earlier documented
frontend type debt remains separate from this change. Regression fixtures cover
fenced arrays, missing/blank translations, deduplication, malformed JSON,
truncation accounting and the measured OpenAI reasoning ceiling.

Evidence outside the repo: `/tmp/feed-182-final-backend-rerun.log`,
`/tmp/feed-182-final-frontend-tests.log`, `/tmp/feed-182-cleanup.log`,
`/tmp/feed-182-arabic-canvas.png`, `/tmp/feed-182-chinese-canvas.png`, and rendered
pages under `/tmp/feed-182-render/`. Earlier intermittent OpenAI 403s remain
unreproduced; the successful tests do not establish their original cause.

The existing smoke runner supports an explicit model without editing/activating
the saved configuration. It reuses the newest matching provider credential and
records usage against that configuration. Start with unbilled checks:

```bash
npm run smoke:live -- --model claude-haiku-5-5 --unbilled
```

Only after working credentials and an approved spending limit, use `--bill
--ceiling 0.10` for each model (add `--include-frontier` for Opus). The ceiling is
a reservation estimate with bounded output and assumed input, not a hard cap.

## Official sources

Provider documentation was reviewed November 4, 2026. These facts must be
rechecked at release boundaries and monthly; account access requires live proof.

- OpenAI: [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
  [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra),
  [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol),
  [migration](https://developers.openai.com/api/docs/guides/latest-model),
  [deprecations](https://developers.openai.com/api/docs/deprecations).
- Anthropic: [Haiku](https://platform.claude.com/docs/en/models/haiku-5-5/overview),
  [Sonnet migration](https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide),
  [Opus migration](https://platform.claude.com/docs/en/models/opus-5-5/migration-guide),
  [effort](https://platform.claude.com/docs/en/build-with-claude/effort),
  [deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations).
- Google: [pricing](https://aistudio.google.com/docs/pricing),
  [deprecations](https://aistudio.google.com/docs/deprecations).

Release tags, deployment gates and verification are in
[v1.8.2 release preparation](../deployment/v1.8.2-release-preparation.md).
