# Procurement Unification Plan

**Started:** 2026-07-20
**Status:** Phases 1–4 complete; Phase 5 (donor analytics) next
**Owner doc:** this file is the North Star for procurement data ingestion. Update
it as each phase lands. Do not rely on session memory for any decision recorded
here.

## North Star

FEED reports Oregon Food Bank supply — warehouse and Fresh Food Alliance —
**correctly, completely, and with donor attribution**, using data staff can get
into the system without careful manual assembly.

Correctness first, then attribution, then convenience. In that order, always.

## Why this work exists

FEED's procurement foundation shipped against one export format. OFB's portal
actually exposes the same Fresh Alliance donation events through **two**
exports with **different identifiers**:

- **Completed Orders** — the established 12-column ledger. Fresh Alliance
  events appear as `Order #` values ending `AGPCKUP`, with all money columns
  `$0.00`.
- **Agency Pickups** — a 19-column export added in extension v1.2.0. The same
  events, keyed by `Pickup Reference`, **with donor identity**.

Importing both today would double-count Fresh Alliance weight. FEED also cannot
parse the second format at all. That is the defect blocking a production-ready
MVP; automation of any kind would only deliver wrong numbers faster.

Full evidence: [fresh-alliance-coverage-verification.md](fresh-alliance-coverage-verification.md).

## Settled decisions

Each is load-bearing. Revisit only with a new explicit decision recorded here.

### D1 — Supersede rather than join
The `AGPCKUP` subset of Completed Orders is verified to carry no information the
Agency Pickups export lacks (3,933 rows, 2023–2026, all money columns `$0.00`).
Where a Fresh Alliance import covers a date window, `AGPCKUP`-derived
observations in that window are marked superseded — not deleted.

Superseding is window-bounded even though this agency's corpus needs no
bounding, so a partial Fresh Alliance import can never suppress an uncovered
period.

### D2 — No derived cross-reference between identifier spaces
No rank-based, offset-based, or content-fingerprint join between `Pickup
Reference` and `Order #`. The source system does not publish the mapping;
deriving one manufactures identity. Empirically refuted as well — 304 rank
inversions across 824 events.

### D3 — Fresh Alliance imports use their own `source`
Persisted under `source = 'ofb_pickup'`, separate from `source = 'ofb'`. This
gives an independent revision lineage and independent rollback, and removes any
possibility of reference collision between the two identifier spaces.

### D4 — Donor identity is received, never inferred
FEED records the donor OFB reports. FEED never infers a partner from dates,
reference numbers, category mixes, or operational history. The prohibition in
`AGENTS.md` stands; what changed is that OFB now *reports* donor identity, so
the claim that it cannot is obsolete.

### D5 — The donor dimension is open
Derived from observed data. No fixed enum, no seeded partner list. Partners
start and stop; absence from a range is not evidence of withdrawal.

### D6 — In-kind value is partial and must say so
29% of Fresh Alliance poundage carries no recorded donor valuation. Persist the
per-row rate; never multiply weight by a single rate. Every value figure states
its coverage.

### D7 — Temperature is parsed and discarded
Validated when present so malformed exports still fail, but not persisted. The
agency keeps separate, more detailed food-safety temperature logs; these
readings are not operationally actionable in FEED.

### D8 — `12:00 AM` pickup time means unknown
A missing-time default, not an observed midnight collection. Surface as a
data-quality warning; never render as an observed hour.

### D9 — Legacy XLSX history is a separate domain, not a backfill
`In-Kind Donations FY20xx` and `Social Services Tracking FY20xx` are
agency-authored records of direct community donations and client services — not
OFB supply. The OFB corpus already reaches 2009 for warehouse orders and 2023
for Fresh Alliance, which is the complete OFB picture.

These files get their own source contract, validation, revision, and rollback
rules when the time comes. They are **not** to be coerced into the procurement
schema. Post-MVP; valuable, but separate.

### D10 — CSV import stays, permanently
Whatever transport is added later, file import remains a documented, supported
path. When a network path fails during a distribution day, staff need a route
that does not depend on it.

### D11 — Transport is not on the MVP path
Server-side credentialed fetch and extension-to-FEED push are both viable and
both deferred. See "Transport, deferred" below. The MVP blocker is correctness,
not convenience.

### D12 — Coverage is descriptive, never a score
Channels report on different lags. Confirmed 2026-07-20: Fresh Alliance pickups
happen and are entered into Primarius later, because the agency is short-staffed
and data entry competes with direct service.

Coverage UI states what FEED can currently see and what would extend that view.
It never implies lateness, fault, or a target — no "overdue", no "incomplete",
no progress bars toward a coverage goal, no red. A gap measures available
data-entry time, not performance. The food arrived and was distributed whether
or not anyone had time to type it in.

## Phases

Each phase is independently shippable. Check items off in place.

### Phase 1 — Verify historical coverage ✅ complete (2026-07-20)
- [x] Full-history Fresh Alliance export obtained (3,933 rows, 826 events, from 2023-06-01)
- [x] Year-by-year parity against the `AGPCKUP` subset — exact, zero delta
- [x] Confirmed no `AGPCKUP` event lacks a Fresh counterpart, and vice versa
- [x] Confirmed all money columns `$0.00` across the full corpus
- [x] Findings recorded in [fresh-alliance-coverage-verification.md](fresh-alliance-coverage-verification.md)

**Gate result: passed.** Superseding is lossless over the full 826-event history.

### Phase 2 — Fresh Alliance parser ✅ complete (2026-07-20)
Pure normalization, no schema change, no persistence. Reviewable in isolation
and validated against the real 3,933-row corpus.

- [x] `parseFreshAllianceCsv` against the exact 19-column contract
      — `packages/backend/src/services/procurement/fresh-alliance.ts`
- [x] Donor code/name, pickup ID/reference/line ID, pickup time, submitted timestamp
- [x] Received qty/weight, Fresh Alliance category, donor value per pound
- [x] Temperature validated then discarded (D7)
- [x] Unknown-time warning for `12:00 AM` (D8)
- [x] Missing-valuation warning where rate is `0.00`, weight retained (D6)
- [x] Event grouping by `Pickup Reference` with deterministic snapshot hash
      (row-order independent; changes when donor changes)
- [x] Structural failures reject; reconcilable anomalies warn
- [x] 14 tests including a corpus test over the full real export
      — `packages/backend/__tests__/features/procurement/fresh-alliance-import.test.ts`

Also landed: parsing primitives extracted to
`packages/backend/src/services/procurement/parsing.ts` and shared by both
parsers, so the date, numeric, reference, and product-family contracts cannot
drift between them. `index.ts` re-exports `ProcurementImportError`,
`ACQUISITION_CLASSES`, and `AcquisitionClass` so its public API is unchanged.

**Channel classification is file-level here.** Every event in the Agency Pickups
export is a Fresh Alliance receipt because of the export it came from; reference
suffixes and product-code prefixes are not consulted. This is stricter and more
honest than the suffix inference the 12-column path must use.

The corpus test is gated on `existsSync` because the real export is gitignored
agency data. It runs locally for anyone holding the file and skips in CI.

### Phase 3 — Persistence and supersede ✅ complete (2026-07-20)
- [x] Schema: donor and pickup fields on revision; received/valuation/FA-category on line
- [x] Schema: `supersededByImportId` on `ProcurementOrderRevision`, reversible
- [x] `importFreshAllianceCsv` under `source = 'ofb_pickup'` (D3) with its own
      revision lineage; products stay under `ofb` so one code means one catalog entry
- [x] Window-bounded supersede of `source = 'ofb'` + `fresh_alliance_receipt` (D1)
- [x] Rollback clears exactly what an import claimed; restore reclaims its window
- [x] Analytics and data status read both sources and exclude superseded revisions
- [x] `POST /api/procurement/imports/fresh-alliance`
- [x] Migration verified: full chain applied to a copy of
      `docs/backup_20260709_103507.db`, all columns and indexes present,
      168 food items and 9 categories preserved
- [x] 21 Fresh Alliance tests (30 procurement total); full suite 352/352

**Two correctness details worth remembering:**

*Supersede claims are per-import and unclaimed-only.* `applySupersede` matches
`supersededByImportId: null`, so the first covering import keeps the claim,
overlapping imports stay deterministic, and each import releases exactly what it
took. Restore recomputes the claim from the import's recorded window rather than
remembering a row list.

*Re-importing Completed Orders re-triggers supersede.* Fresh AGPCKUP revisions
land unclaimed, so `importOfbCsv` reasserts every active Fresh Alliance import's
window after writing. Without this, re-importing an orders export after a Fresh
Alliance import would silently restore double counting. Covered by
"re-importing Completed Orders cannot reintroduce double counting".

*Excluding and including are one change.* Analytics previously hard-coded
`source: 'ofb'`. Superseding without also reading `ofb_pickup` would have
dropped ~570,000 lb from reports, so `corpusWhere` gained both the source list
and the superseded filter together.

### Phase 4 — Coverage visibility ✅ complete (2026-07-20)
- [x] `getProcurementDataStatus` returns a per-channel window — event count,
      earliest and latest receiving date — excluding superseded and inactive rows
- [x] Coverage strip in Data Management showing both windows side by side
      — `packages/frontend/src/components/data-management/coverage-strip.tsx`
- [x] Descriptive framing only, enforced by test (D12): no "overdue", "behind",
      "incomplete", "missing data", or "failed to" anywhere on the page
- [x] Staleness follows the newest observation FEED holds, so a lagging channel
      never makes the corpus read as stale
- [x] Stale prompt reworded from a judgement to an offer
- [x] Resilient to a status payload without `coverage` — an older cached
      response should not take the page down
- [x] 4 backend coverage tests, 1 frontend coverage test

**Validated end to end against the real corpus (2026-07-20), not mocks:**

| Check | Result |
| --- | --- |
| Fresh Alliance weight before import (from `AGPCKUP`) | 826 events, 569,969 lb |
| Fresh Alliance weight after import (donor-attributed) | 826 events, 569,969 lb |
| Double counting | none — identical to the pound |
| `AGPCKUP` events superseded | 826, marked not deleted |
| Warehouse totals | unchanged, 1,321 events / 3,152,249 lb |
| Rollback | supersede marks cleared, prior observations returned in full |
| Restore | window reclaimed, 826 marks reapplied |
| Donor roster | matches the verification record exactly, all seven partners |
| Valuation coverage | 1,108 lines / 164,298 lb unvalued (D6) |
| Unknown pickup times | 62 (D8) |

**Two defects found during that walkthrough and fixed:**

*Import History showed the raw `ofb_pickup` string.* `sourceLabel` only knew
`ofb`. Both sources now read as "OFB Completed Orders" and "OFB Agency Pickups"
— same portal, different export.

*A full-history import returned 1,170 individual notes in a 350 KB response*,
which the details dialog would have rendered as 1,170 rows. Repeated per-row
observations are now summarized once per kind with a count, retaining every
affected row number. The same import now returns two notes in 5.4 KB — a 65×
smaller payload — and anything genuinely actionable is no longer buried.

**Import became one action instead of two.** Rather than adding a second button
and asking staff to declare which OFB export they were holding — a choice they
could get wrong, on two files that look alike, mid-task — FEED reads the header
row and routes the file itself (`services/procurement/detect.ts`). Detection is
exact-match only and never guesses at a near-miss; an unrecognized file names
both accepted exports. `POST /imports/ofb` and `POST /imports/fresh-alliance`
were replaced by a single `POST /imports`.

The import confirmation now states what was recognized and, for Agency Pickups,
says plainly how many Completed Orders receipts it replaced so weight is counted
once — the one part of this design staff would otherwise have to reason about.

### Phase 5 — Donor analytics
- [ ] Donor mix
- [ ] Donor × category matrix
- [ ] Donor contribution over time
- [ ] Per-donor pickup cadence (visit count vs. average load)
- [ ] Donor filter, scoped to the Fresh Alliance channel
- [ ] In-kind value with explicit coverage caveat (D6)
- [ ] Observations only — no editorializing about why a partner's volume moved

**Phases 1–5 constitute the production-ready MVP.**

### Phase 6+ — Polish, post-MVP
- Extension v2.0.0 unified export: one workflow, one date range, one file,
  refuse-partial across both channels. Makes coverage mismatch structurally
  impossible rather than merely visible, and retires the supersede rule for new
  data.
- Legacy XLSX ingestion as its own domain (D9).

## Transport, deferred

Explored in depth on 2026-07-20 and deliberately deferred behind correctness
(D11). Recorded so the reasoning is not relitigated from scratch.

**Established:** OFB does not grant agencies API access — a walled garden.
Primarius exposes Orders and Agency Pickups as unrelated entities; neither
carries the other's identifier, so the join genuinely does not exist upstream.

**Option A — Extension pushes to FEED.** Extension already holds a legitimate
authenticated session. Costs a host permission and a FEED-issued token. No
credential custody, no autonomous login, no backend scraping. Cheaper than
previously assessed: the extension is distributed unpacked in Chrome Developer
Mode, so no Web Store review gates it.

**Option B — Server-side fetch.** FEED stores Primarius credentials using the
existing AES-256-GCM infrastructure and drives Puppeteer, which is already in
the backend for PDF rendering. Closest to the desired UX.

Conditions agreed before Option B is built:
- **Read-only tenant** from OFB rather than an individual's login. Highest-
  leverage risk reduction available; worth requesting regardless of transport.
- **No scheduler.** User-initiated, one click only.
- **Rate and range constraints** so FEED cannot burden OFB's servers.
- Extract the extension's normalization logic into a package shared by the
  extension and the backend. `export-core.js` and `fresh-alliance-core.js` are
  already isomorphic (UMD, `module.exports`/`require`). Product-code edge cases
  took extension releases v1.1.1–v1.1.3 to get right; a second implementation
  would drift, and the failure mode is silently wrong normalization. This is a
  prerequisite for Option B, not a nice-to-have.
- The PDF Chromium path is a sealed offline renderer — request interception with
  an allowlist that aborts everything else. An authenticated session must be a
  separate, separately-configured browser context, not an extension of it.

**Note on scope:** FEED's revision-hash model already makes incremental append
mostly free — an identical snapshot is a no-op. Incremental fetching is
politeness toward OFB's servers, not a correctness requirement.

## Tracking progress empirically

Claims about this feature should be checkable, not remembered:

- **Coverage parity** — the year-by-year table in the verification record.
  Re-run if the export contract changes.
- **Supersede correctness** — total Fresh Alliance weight must be unchanged
  after a Fresh Alliance import supersedes the `AGPCKUP` population. 569,969 lb
  through 2026-07-14 is the reference figure.
- **No double counting** — combined inbound weight must not increase when the
  same period is imported through both formats.
- **Donor totals** — the roster table in the verification record is the expected
  output of Phase 5's donor mix once the full corpus is loaded.

## Related documents

- [procurement-imports.md](procurement-imports.md) — the import contract
- [fresh-alliance-coverage-verification.md](fresh-alliance-coverage-verification.md) — Phase 1 evidence
- `docs/reports/operational-analytics-design.md` — analytics source of truth
- `AGENTS.md` § Operational Analytics Direction — standing constraints
