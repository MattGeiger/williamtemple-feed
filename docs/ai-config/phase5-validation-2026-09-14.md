# Phase 5 validation and release handoff

The Fable classification and spending-accounting findings are fixed in
**1.8.0-beta.3**. Local feature validation is complete. **Phase 5 remains open
for the Cloudflare checks and production rollout.** Raspberry Pi Connect
requires sign-in; no production configuration, data, or container was changed.
The public production health endpoint reports `1.7.5-rc.1` on September 14.

## What changed

- `forcedToolUse` is an Anthropic catalogue capability. Fable uses `auto`,
  with explicit instructions to call the classification tool. Known compatible
  models retain forced tools; unknown Claude models conservatively use `auto`.
  This follows [Anthropic's Fable documentation](https://platform.claude.com/docs/en/models/fable-5-1/overview)
  and [tool-choice contract](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools).
- Both classification paths validate the named tool, result count, and finite
  scores between zero and one. Unusable billed replies write failed usage.
  Parallel classification waits for every in-flight batch and records each
  separately, preserving a successful sibling's cost when another fails.
- Google batch translation and both classification methods record unusable
  billed replies, including thinking tokens. A refusal before a reply does not
  manufacture a usage row.
- The smoke script measures its own persisted rows using an async-local
  collection. It includes failed replies and excludes unrelated requests.
  Failed persistence stops the run. Unknown models, provider mismatches,
  missing/nonpositive saved prices, and invalid ceilings cannot spend. Each
  call reserves three projected attempts at the higher of saved and catalogue
  prices, converting legacy per-thousand units. The input estimate is still
  not a hard dollar guarantee.

No schema, dependencies, authentication, provider-selection policy, or
production settings changed. Application daily/monthly cost enforcement still
filters `success: true`; deciding whether those limits include billed failures
remains the separate decision already recorded in ISSUES.md #84. Historical
unrecorded failures were not reconstructed from guessed counts.

## Evidence

Tests ran in the package directories on Node 24. The backend suite passed
**108 files, 1,299 tests, 2 skipped**; the frontend passed **87 files, 578 tests**.
Backend build and typecheck passed. A separate typecheck included the smoke
script and new tests, which the runtime build excludes. Frontend build passed;
the actual frontend typecheck ratchet reports **144 existing errors**, below
the saved baseline of 148. It is not a claim of a clean frontend typecheck.

An initial run's three fresh-database suites failed in Prisma's schema engine
before tests ran. Reproducing migration creation with engine diagnostics
succeeded; the subsequent complete run passed with `RUST_LOG=info`. No
application or migration change was made to mask that environment failure.

| Live check | Result | Recorded cost |
| --- | --- | ---: |
| Fable `classifySegments`, two synthetic segments | Passed, 5.5 seconds | $0.012610 |
| Fable `classifySegmentsBatch`, same two segments | Passed, 3.7 seconds | $0.012820 |
| Gemini 3.5 Flash Lite DOCX classification, Spanish translation, Arabic builder translation | Passed; real upload, extraction, classification, asynchronous translation, download, preflight, fill, and PDF routes | $0.00122240 |
| Opus 5 long DOCX classification | 121 decisions: 117 uncached segments across three batches and four cache hits; HTTP 200 in 8.6 seconds | $0.104505 |
| Opus 5 bulk retry | All 40 synthetic rows completed; HTTP 200 in 8.0 seconds | $0.108925 |
| Gemini 3.8 Flash regular live sweep | All seven checks passed, including highest reasoning | $0.00264375 |
| Gemini 3.8 Flash, deliberately truncated batch translation and both classification methods | All three failed clearly and recorded billed tokens, including empty output | $0.000504 |
| **Total for this continuation** | Within the previously approved $5 validation budget | **$0.24323015** |

The three deliberate failures reported respectively 131/13, 178/12, and
178/12 input/output tokens. They produced three `success = false` usage rows.
Provider-shaped overload and rate-limit fixtures also traversed the real
translation route and error handler: HTTP 503, `AI_TRANSLATION_BUSY`, retryable
copy, and no administrator alert. No attempt was made to overload a live
provider merely to obtain a transient busy response.

The Spanish DOCX was rendered with LibreOffice and visually inspected. The
Arabic PDF was rendered with Poppler; letters joined correctly, table columns
mirrored, physical dividers remained on the correct edges, and English tags
were legible. The saved synthetic template was applied in the local browser,
Arabic preview selected, and Download PDF completed. Synthetic fixtures were
kept separate from existing inventory and documents. Local configurations 5
and 14 were restored to their original activation, token, thinking, and update
values after the checks. Usage rows remain as real spending history.
The 40 synthetic bulk rows were removed after verification; the two synthetic
source documents, Spanish output and named builder template remain locally
available for review.

## Built release candidate

Both **linux/arm64** images were built locally from commit `aeab799`, with
same-origin frontend API routing. They are loaded into Docker on this Mac;
they have **not** been pushed to a registry or deployed.

| Local image | Image ID |
| --- | --- |
| `et2geiger/feed-backend:1.8.0-beta.3` | `sha256:efa3e912417caa935cf0731e8407130cc7602f78cc6e8ffea36958cf036ede17` |
| `et2geiger/feed-frontend:1.8.0-beta.3` | `sha256:06c840b6e7c088f863bfd85b15c2d221e3e630b6c152c191ac2114cb30fcb65a` |

The isolated backend container reports Node **24.21.0**, application version
**1.8.0-beta.3**, and Chromium **152.0.7977.82**. All 36 migrations applied to a
fresh disposable database with external networking disabled. The frontend's
Nginx configuration validates and its compiled bundle contains the new version.
These are Pi-architecture builds, not an AMD64 validation claim. The staged
older releases described below still need their own immutable images.

Local reproducibility material is under `/tmp/feed-phase5/`: input/output
documents, PDF renders, request summaries, configuration restoration values,
and the scripts used. `/tmp/feed-fable-canary.json` records the Fable results.
These are local QA artifacts, not production data or distributable examples.
The database backup there contains local operational data and is deliberately
outside Git. Temporary files may be removed by the OS.

## Remaining release steps

Preserve the agreed D23 order. The existing commits make the stages separable:

1. Release honest provider errors and alerts from `f9ca7f4` (`1.7.5`). Verify
   authentication, basic inventory access, and the existing translation path.
2. Release the Node 24-only delta at `7c7b350`. This commit still reports
   application version `1.7.5`, so give its images a distinct immutable tag
   such as `1.7.5-node24`, and verify `node --version` inside the running backend.
   Do not combine this rollout with the catalogue/SDK change.
3. Release `1.8.0-beta.3`, then select and verify the approved replacement for
   production's `gpt-5-mini` in AI Configuration. The new-configuration default
   does not automatically migrate a saved production row.
4. Through the production Cloudflare URL, repeat a synthetic DOCX translation,
   Arabic builder export, long-document classification, and large bulk retry.
   Local eight-second timings do not prove the Pi or Cloudflare path. If a
   synchronous route returns 524, follow D20/D28 and implement the approved
   translation-specific background-job design before closing Phase 5.

For each stage, inspect the live Pi state and take a verified database/storage
backup before applying it. Follow `docs/deployment/DOCKER_DEPLOYMENT.md`:
persist the selected `VERSION` in the Pi's `.env`, confirm `docker compose
config` resolves the intended images, pull and start, then inspect running
image IDs, health, and frontend version/assets. Retain the previous image tags
and backups for rollback. Do not run seeding against production.

Pi access is the concrete remaining dependency: sign in to Raspberry Pi
Connect and open the FEED device session. The deployment guide records direct
SSH as unreliable; it was not substituted for the missing Connect session.
