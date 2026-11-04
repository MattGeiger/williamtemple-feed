# AI catalogue refresh — v1.8.2

**Prepared locally: November 4, 2026. Production deployment is a separate step.**
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
It was applied to the local development database only. Backup contract 13
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
persists. However, successful probe responses are discarded: `verifyEntitlement`
accepts any successful HTTP response without checking text, returned model,
finish reason or usage. Its 16-token output cap can also be insufficient for a
reasoning model to produce visible text. This is a validation gap; whether any
of the user's accepted saves had empty/truncated output is currently unknown.

Next diagnostic round should use a fixed saved key/model/prompt and record both
successes and failures: UTC timestamp, local attempt id, provider request id,
status/code, requested/returned model, finish reason, output presence and token
usage. Use an opaque credential correlation tag, never keys, authorization
headers, cookies or full SDK error dumps. Disable hidden SDK retries for the
comparison. Compare the save path with a direct SDK generation using identical
parameters, repeat a small spaced sample under an agreed spend limit, then
repeat after a delay. Require usable output and a subsequent real translation
before marking generation verified. If identical direct calls alternate between
403 and usable output, provide the paired request ids privately to OpenAI
support. Do not mask 403s with automatic retries or bypass save validation.

The earlier unbilled checks with the original local credentials returned 401.
The agent did not initiate billable generation in that sweep ($0 recorded).
The user's subsequent saves perform minimal paid generation; their spend was
not measured here. Google and reliable usable OpenAI generation remain
unverified. Request fixtures alone do not prove entitlement or output quality.

Before release, complete this remaining feature checklist:

1. Save a current model with a valid key, then reopen it and verify persistence.
   The browser pass reached the save controls but deliberately did not submit
   a dummy credential or modify existing configurations.
2. Save an upgrade with the key blank to verify preservation against a working
   provider account. Save/reopen a manual price override and verify rates, units
   and provenance persist. Automated route/restore tests already cover storage;
   successful provider-backed browser saves are still pending.
3. Run each new model's small translation and batch classification, including
   highest effort, malformed/truncated replies and retry/usage accounting where
   fixtures cover injected failures. Review output with a qualified language user.
4. Exercise food/category translation, DOCX classification/translation and builder
   translated PDF with Arabic and CJK text. Render the exported PDF and compare
   against the canvas. Confirm cache reuse avoids unnecessary generation.
5. Verify an unavailable model is refused with replacement advice and can still
   be deactivated/deleted. Confirm no key appears in responses or browser storage.

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
