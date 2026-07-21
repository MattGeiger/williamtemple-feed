# Procurement Unification Plan

**Started:** 2026-07-20
**Status:** Phases 1–5 complete (MVP). Phase 6 (Fresh Alliance confirmation status): FEED schema executed 2026-07-21, extension deferred to a future session.
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

### D13 — Fresh Alliance includes Pending; OFB Warehouse stays Completed-only
A live, read-only investigation of the Primarius portal on 2026-07-21
(recorded in full in
[fresh-alliance-pending-pickups.md](fresh-alliance-pending-pickups.md))
established that the coverage gap D12 describes is a real OFB review queue,
not a data-entry backlog alone: Agency Pickups has a Pending tab, and Pending
and Completed are **the same underlying records** — confirmed by a continuous,
non-overlapping `Id`/`ReferenceCode` sequence across both, and directly by
searching Completed for a known Pending reference (zero results). Moving from
Pending to Completed flips a flag on the existing row; it does not create a
new one.

This resolves the duplication concern that motivated the investigation:
FEED's existing revision model, keyed on `ReferenceCode`, already treats a
later re-import of the same reference as a new revision of the same event,
whether or not its confirmation status changed. No new deduplication logic
is required.

The two OFB channels are not treated the same way, and this is a permanent
distinction, not a temporary compromise:

- **Fresh Alliance Pending is included.** The agency is the authoritative
  observer — staff already collected and weighed the donation before OFB
  ever reviews the record. OFB's confirmation is a downstream paperwork step
  on an observation the agency already made in full. Historically, confirmed
  weight has equaled requested weight on all 3,933 corpus rows.
- **OFB Warehouse stays Completed-only.** Checked Order History directly:
  its equivalent "Active" tab held an order in `DataEntry` status, moving
  through a `Released / Picked / Confirmed` pipeline controlled by OFB, not
  the agency. An Active order is a request, not an observation — quantities
  legitimately change during fulfillment (an item may be unavailable, or
  substituted). Importing it would violate the same "never infer, never
  treat a request as a fact" principle that governs the rest of this
  project. This does not change without new evidence that OFB's fulfillment
  process works differently than observed here.

**A value must never be reshaped to resolve an ambiguity a status flag
already resolves.** An earlier draft of this decision proposed representing
a Pending pickup's `Received Weight` as blank rather than the `0` Primarius
actually reports, on the reasoning that `0` "reads as nothing was picked
up." That doesn't survive contact with the schema's own existing pattern:
`hasDonorValuation` already sits next to a real, possibly-`0` rate rather
than nulling it out. The fix here is the same — report the real value, add
`isConfirmed` to say what it means. Requested weight, including a genuine
`0` for a category that was not collected in a given pickup, was never in
question and is untouched by any of this.

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

### Phase 5 — Donor analytics ✅ complete (2026-07-20)
- [x] Grocery Partner Mix — received pounds by partner (Carbon palette)
- [x] Per-partner pickup cadence — visit count, share, and average load
- [x] Per-partner category breakdown carried in the payload
- [x] Donor contribution over time via `donorMonthlyWeight`
- [x] Recorded Donated Value stated with its coverage percentage (D6)
- [x] Observations only — a test asserts the section contains no "best",
      "worst", "underperform", "declin", "should", or "top partner"
- [x] Degrades to an empty state rather than crashing without donor data
- [x] 3 frontend tests; 190/190 frontend, 357/357 backend

The value card leads with coverage rather than footnoting it: the recorded
total is a partial sum, and unvalued pounds are shown beside it so the figure
can never be read as the value of all donated supply.

Partner cadence turned out to be the most operationally useful output. Over the
last 90 days Restaurant Depot made 18 pickups averaging 157 lb while Amazon made
19 averaging 993 lb — near-identical visit counts for six times the load, which
is a routing and staffing fact rather than a judgement about either partner.

**Partner Contribution Over Time and the partner filter landed 2026-07-20**,
retiring the dormant `donorMonthlyWeight` field rather than leaving it unused.
Partner selection filters client-side over data already fetched, so it never
interacts with the channel and acquisition filters, whose whole-event semantics
would make a combined result hard to reason about. Months without a delivery are
zero-filled so a line never bridges a gap and implies a delivery that did not
happen.

**Phases 1–5 constitute the production-ready MVP.**

### Phase 6 — Fresh Alliance confirmation status 🔄 FEED complete, extension deferred (2026-07-21)
Full findings in
[fresh-alliance-pending-pickups.md](fresh-alliance-pending-pickups.md); decision
recorded as D13.

- [x] Investigated Primarius Pending/Completed live, read-only, production —
      confirmed same-record identity, confirmed the Warehouse/Fresh-Alliance
      asymmetry with direct evidence, resolved the duplication question
- [x] FEED schema: `isConfirmed` on `ProcurementOrderRevision` — nullable,
      Fresh Alliance only, `true` for everything the current 19-column
      contract can produce (that contract structurally cannot carry
      unconfirmed rows today)
- [x] FEED parser and persistence updated and tested; migration verified
      against a production-shaped copy
- [ ] **Deferred to a future session, deliberately.** Extension v2.0.0: one
      action pulling Completed Orders (Warehouse, unchanged), Agency Pickups
      Completed (unchanged), and Agency Pickups **Pending** (new) into one
      file; a new `Confirmed` column on Fresh Alliance rows only; a same-run
      race guard (fetch Completed first, exclude any reference already seen
      when pulling Pending) since a pickup can transition mid-export; refuse-
      partial extended to all three fetches equally. Full technical spec
      lives in the extension's own repository so a session starting cold
      there — a different model, no FEED context — has everything it needs:
      `OFB Data Fetch Plugin/docs/fresh-alliance-pending-pickups-v2-design.md`.
- [ ] **Deferred, not yet decided.** How Analytics treats pending weight once
      the extension can produce it (include-and-flag vs. exclude-and-surface-
      separately vs. show both) — an agency decision, not a schema one.

### Phase 7+ — Further polish, post-MVP
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

## Analytics UI polish landed after the MVP

Unrelated to Phase 6 above (naming coincidence only — this predates the
confirmation-status work). Two of the analytics-page requests from review
landed as polish, ahead of the extension work:

- **Seasonal channel breakdown.** `seasonalChannelWeight` (added earlier as a
  computed-but-unwired field — see the Phase 5 note above) now backs a channel
  `Select` on the Seasonal Inbound Weight card. Same "one source of truth" rule
  as the donor filter: the card's own control is offered only when the
  page-level channel filter is "All Channels"; when the page filter narrows,
  the card follows it and the card-level control disappears rather than risking
  disagreement with a filter visible elsewhere on the page. Pinned by two
  frontend tests.
- **Paid-product family colors and Other breakdown.** Bars in Where Paid
  Procurement Dollars Went are colored by product family (parsed from the OFB
  description prefix, e.g. "Meals, Beef Stew" → Meals) instead of one flat
  color, and the aggregate "Other paid products" row's tooltip breaks itself
  down by family — grouping is the only way the tail is legible; individually
  the 144 remaining codes average 0.19% of paid spend each. Rendered with one
  `Bar` + a `Cell` per row rather than a series-per-family stack, because a
  14-series stacked `Bar` set produced empty rectangle groups with no painted
  geometry in this Recharts version — that failure mode is worth knowing before
  reaching for a per-series stack again on a chart with this many categories.
- **Sticky top filters.** The tab switcher (Operations/Procurement) and date
  range control are `position: sticky` beneath the app header on the Analytics
  page, so they stay reachable across a long scroll of Procurement cards.
  `position: sticky`, not a `ScrollArea`-wrapped card region — AGENTS.md
  requires `ScrollArea` to have a definite height, which on a page this long
  would mean a nested scroll region that traps wheel events and behaves badly
  on mobile; sticky keeps native page scroll. Verified in the browser at
  desktop and mobile width, light and dark theme, and with the Custom Range
  popover open while scrolled (no z-index conflict).

**"Other paid products" became a real stacked bar — landed 2026-07-21.** The
Cell-based single-color workaround from the prior pass was a deliberate,
disclosed compromise: the family breakdown existed only in the tooltip, not
as a visible segmented bar, because a 14-series `stackId` stack rendered zero
geometry. Investigated further rather than left as the final answer: this
is a documented Recharts limitation (recharts/recharts#3883, "Stacked Bar
Chart disappears when stackId is added for complex datasets"), reproduced
here even after eliminating undefined per-series values, not something
specific to this data or a bug in the aggregation.

Fix: stop using Recharts' native per-series stacking entirely. `Bar` now
takes a custom `shape` (`PaidProductBarShape`) that draws each row's
`segments` as adjacent `<rect>`s sized directly from the real dollar values,
clipped to a shared rounded rect so the bar's outer corners stay rounded
while interior segment boundaries stay square — the same visual result a
native stack would give, without touching the mechanism that doesn't render.
`buildPaidProductChartSeries` was reshaped to match: every row (ordinary or
aggregate) now carries a unified `segments: Array<{family, spendDollars}>`
instead of the previous sparse per-family-key record plus a separate
`familyBreakdown` field, which removes the `familyKeyOf` helper the Cell
approach needed.

Verified this time by measuring actual rendered geometry in the browser, not
just checking the code compiles: 47 painted rects across 16 rows (15 ordinary
+ 1 aggregate, each contributing one clip-path rect, plus 30 colored segment
rects — 15 ordinary rows × 1 segment, 15 segments on the aggregate row
alone), and the aggregate row's measured segment widths converted back to
percentages (30.9%, 11.9%, 11.2%, …) match the known family shares to within
pixel-rounding error. Confirmed in both light and dark theme.

**Fresh Food Alliance Receipt Categories gained donor identity, sortable
headers, and a donor filter — landed 2026-07-20.** The table's stale
description ("Partner identity is unavailable in this source and is never
inferred") predated the Agency Pickups import and was never corrected when it
started shipping donor identity — the same mistake `procurement-imports.md`
had, caught the same way: a user re-reading the actual page.

Backend: a new `freshAllianceDonorCategories` aggregation splits the existing
category-only observations by donor, computed in the same per-line loop as
`freshAllianceCategories` (donor code and name are already available there
from the donor-summary work) and kept as a separate field rather than
replacing the category-only one — the Fresh Food Alliance Category Mix chart
is legitimately still a donor-agnostic view, and reconciling two derived maps
against the same source lines is safer than reshaping one map's meaning
mid-stream. A receipt with no donor on file is bucketed under an explicit
`donorCode: null` / `"Not Reported"` row rather than guessed or silently
dropped — the per-donor total must always reconcile to the category-only
total, and a backend test asserts exactly that. In the current corpus this
bucket is empty, because the Fresh Alliance import supersedes every AGPCKUP
event it covers, but a partially superseded window is a real possibility this
must not misrepresent.

Frontend: the donor filter follows the same multi-select pattern already
established for seasonal years and the donor-trend chart (`DropdownMenu` +
`DropdownMenuCheckboxItem`, select-all/clear-all, defaults to every donor
present). Column sorting was extended to match the level other procurement
tables provide on their equivalent columns — Donor, Category, Receipt Events,
and Receiving Dates all gained sort arrows; Source Code and Last Received stay
plain, consistent with every sibling table's identical columns.

**Fixed family colors, plus a legend, landed 2026-07-20.** Bar colors were
previously assigned by rank (`carbonCategoricalTheme(index)` over
`paidProductSeries.families`, sorted by spend in the current view) — a color
meant whichever family happened to be Nth by spend in *that* render, so the
same color could mean "Meat" on one date range and "Rice" on another. A fixed
`FAMILY_COLOR_ASSIGNMENTS` table now keys color by family label instead: 9
Carbon hues (hue-hopped for adjacent contrast) at `primary` grade cover the
9 most distinct known families, the remaining 5 repeat those hues at
`secondary` grade, and `Unclassified` is pinned to `warmGray` — reserved,
never assigned to a real family, so a muted color visually marks "not a real
category." A description prefix outside the profiled 14 still gets a
deterministic hash-based color rather than colliding with an existing family
or the reserved gray.

A companion legend renders beneath the chart, one swatch per family present
in the current view, resolved directly via `useTheme()` + a hex lookup rather
than the CSS custom properties `ChartContainer` injects — Recharts constrains
`ChartContainer`'s only child to the chart itself, so there's no way to mount
a legend as a descendant of the `[data-chart=id]` scope those variables are
declared on. Same pattern already used in `dashboard/category-chart.tsx` for
the identical reason.

A real frontend typecheck regression was found and fixed during this pass —
see the AGENTS.md "Lessons From Recent Work" entry on `tsc --noEmit` silently
checking nothing when invoked without `--project tsconfig.app.json`. The
concrete bugs it had been hiding: an incomplete `emptyAnalytics` test fixture
missing `coverage`/`donors`/`donorMonthlyWeight`/`donorValue`/
`seasonalChannelWeight`, a duplicate import, and a real runtime-adjacent bug
where `selectedChannel`'s inferred type widened to plain `string`, which would
have made a `Record<ProcurementChannel, string>` lookup silently return
`undefined` for the seasonal card's channel label. Confirmed via an isolated
`git worktree` checkout of the session-start commit that this session's
frontend work introduced zero net new distinct TypeScript errors once those
were fixed; the ~10 errors remaining in touched files are the pre-existing
`ColumnDef`/icon debt category documented in `docs/TSC-DEBT.md`.

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
- [fresh-alliance-pending-pickups.md](fresh-alliance-pending-pickups.md) — Phase 6 evidence: the live Primarius investigation, D13's basis
- `docs/reports/operational-analytics-design.md` — analytics source of truth
- `AGENTS.md` § Operational Analytics Direction — standing constraints
