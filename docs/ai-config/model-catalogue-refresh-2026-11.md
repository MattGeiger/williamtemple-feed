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

### Checks blocked by local configuration

The real browser reached login at localhost:5173. The user attempted sign-in;
Resend rejected the local key's associated sending domain as unverified.
Authentication was not bypassed. No authenticated modal/feature smoke is claimed.

Unbilled model-access checks with the available local OpenAI, Anthropic and
Google credentials returned 401. No billable model generation was attempted;
recorded spend for this refresh is $0. Request fixtures establish local request
shape, not live account entitlement or translation quality. The six new models
still require successful live generation with working credentials.

After local credentials are restored, complete this short feature checklist:

1. Sign in normally. Open Add AI Model, verify all provider selections and Custom,
   then complete the existing steps and save a current model with a valid key.
   Close/reopen dialogs and confirm the page remains clickable in light/dark mode.
2. Edit a saved withdrawn model: its label and notice remain visible, it is absent
   from the choices, and switching to a current model resets incompatible effort.
   Save with the key blank to preserve it. Reopen after a manual price change and
   confirm prices, units and provenance survive.
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
