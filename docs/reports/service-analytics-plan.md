# Service Analytics Plan

**Status:** Documentation and source-contract discovery only. No Service tab,
database schema, importer, or analytics calculations have been implemented.

## Purpose

Service is the planned third lens in FEED Analytics, positioned to the right of
**Operations** and **Procurement**:

1. **Operations** describes recorded inventory availability, change, and
   service pressure.
2. **Procurement** describes inbound supply and recorded acquisition activity.
3. **Service** will describe pantry service delivered to households and
   individuals.

Together, the lenses describe a defensible flow from inbound supply, through
operational availability, to service delivery. They remain separate evidence
domains. FEED must not claim that a particular procurement event or inventory
transition caused a particular household visit, and service counts must never
be converted into inventory quantities or inferred consumption.

The initial product goal is to answer basic questions such as:

- How many pantry visits were recorded?
- How many household service encounters were recorded?
- How many people were represented by those encounters?
- How did service volume change over time?
- Which source systems cover which periods?

Exact metric names depend on what the source exports can actually prove. FEED
must not label encounter counts as distinct households or distinct individuals
unless stable source identifiers make that calculation possible.

## Source landscape

The dates below are planning estimates supplied before example exports were
available. Source-contract discovery must replace them with verified coverage
before implementation.

| Source | Expected coverage | Expected grain | Product role |
|---|---|---|---|
| Link2Feed | Approximately early 2020 through May 2026 | To be verified; likely visit or report rows | Standard white-label source |
| SIMC (Service Insights Meal Connect) | Approximately the first week of June 2026 onward | To be verified; likely visit or report rows | Standard white-label source |
| WTH supplemental Google Sheet | Coverage to be verified | Period-level counts | William Temple House-only sidecar |

### Link2Feed

Link2Feed is the historical intake source. FEED should treat its export as an
authoritative observation from that source, not as an extension of SIMC. The
importer must preserve source identity, coverage, and any source-specific
record keys needed for revision handling.

### SIMC

SIMC is the current intake source. It starts after the Link2Feed era according
to the current estimate, but FEED must verify the exact boundary and whether
there is a gap or overlap. A source transition is a provenance seam, not
evidence of a real increase or decrease in service.

### WTH supplemental log

William Temple House maintains a proprietary Google Sheet with basic counts:

- households that shopped in the pantry;
- households that received a long shopping list;
- households that received a premade food bag;
- households that received an emergency food bag.

This source is a permanent single-agency sidecar. It must be hidden or absent
in a generic white-label deployment and must not shape the standard
Link2Feed/SIMC data model around WTH-specific workflow categories.

The four counts must not be assumed to be mutually exclusive, exhaustive, or
additive until staff confirm their definitions. In particular, FEED must not
sum the three distribution-method counts into a total-household figure unless
the sheet contract proves that each served household appears in exactly one
category.

## White-label and agency-specific scope

The standard FEED service-data foundation consists of:

- a Link2Feed source adapter;
- a SIMC source adapter;
- shared canonical service facts;
- shared Service Analytics calculations and presentation.

The WTH deployment adds:

- a separately identified supplemental-log adapter;
- WTH-only metric definitions for long lists and premade/emergency bags;
- configuration that enables the sidecar without changing standard behavior.

This follows the precedent of Procurement's agency-specific legacy sidecar:
bespoke history may enrich one deployment, but it must not become general
system logic.

All normalized Service data remains organization-wide under FEED's shared-data
architecture. Authentication gates access; user identity may provide import
audit attribution but never partitions the dataset.

## Architecture approaches considered

### Option A — Query source-native tables directly

Store Link2Feed, SIMC, and supplemental-sheet rows in separate source-shaped
tables, then teach each Service card how to query every table.

**Advantages**

- Fastest initial importer for one source.
- Preserves every source field without an early normalization decision.

**Costs**

- Every metric duplicates source-merging and seam logic.
- Source vocabulary leaks into UI calculations.
- Adding another intake system requires changes throughout Analytics.
- Cross-source definitions can silently drift.

**Assessment:** useful for short-lived exploration, not an appropriate
production architecture.

### Option B — Force every source into one visit-level fact

Normalize every row into one canonical household visit with optional household
size and distribution method.

**Advantages**

- Simple time-series and visit-count queries.
- Strong foundation if every source truly exports one row per visit.

**Costs**

- Aggregate-only supplemental counts cannot honestly become synthetic visits.
- Missing identifiers may tempt FEED to fabricate household or person identity.
- Source report totals and visit facts have different mathematical behavior.

**Assessment:** too rigid before the source contracts are known and dishonest
for aggregate-only sources.

### Option C — Dual-grain canonical service observations

Normalize detailed sources into canonical visit observations when the source
supports them, while retaining period-level aggregate observations for sources
that report only counts. A centralized metric registry declares which facts
can be combined and how.

**Advantages**

- Preserves the real granularity of every source.
- Supports Link2Feed/SIMC as reusable white-label adapters.
- Supports the WTH sheet without manufacturing visits.
- Centralizes metric definitions, combinability, provenance, and seam rules.
- Leaves room for future intake systems.

**Costs**

- More deliberate schema and calculation design.
- Cards must handle metrics that are unavailable at one grain.
- Requires source-contract discovery before migrations are written.

**Recommendation:** Option C. It fits FEED's existing rule that missing detail
must reduce analytical specificity rather than be invented.

## Proposed canonical boundary

The exact Prisma schema is intentionally deferred until representative exports
are reviewed. The implementation should nevertheless preserve these concepts.

### Import record

One organization-wide import record per accepted source export:

- source (`link2feed`, `simc`, or an enabled agency sidecar);
- source schema/export version when available;
- verified coverage start and end;
- import timestamp and optional authenticated-user attribution;
- deterministic file or snapshot hash;
- active, rolled-back, or restored state;
- warnings and normalized provenance;
- source row count and accepted observation count.

As with Procurement, an uploaded file should be parsed in memory and discarded.
FEED should retain normalized observations, not the original file bytes or
filename.

### Visit observation

Used only when a source actually provides visit-grain evidence:

- source-scoped stable visit key;
- local service date and, if meaningful, recorded timestamp;
- source-scoped household key only when necessary for an approved distinct
  count;
- household member count when explicitly reported;
- source-reported service/program type where its meaning is documented;
- revision identity and import provenance.

No cross-source household identity is assumed. Link2Feed and SIMC identifiers
must remain source-scoped unless a separately reviewed matching contract exists.

### Aggregate observation

Used when a source reports a count for a day, week, month, or other stated
period:

- source and source-scoped observation key;
- inclusive period start and end;
- metric kind;
- numeric count;
- stated grain;
- revision identity and import provenance.

An aggregate observation is never expanded into synthetic visit rows.

### Metric registry

A centralized registry should define:

- stable metric ID and user-facing label;
- unit and grain;
- whether the metric counts encounters or distinct entities;
- accepted source fact types;
- whether values may be summed across periods;
- whether sources may be combined;
- required disclosures and unavailable states.

Metric definitions belong in shared backend calculation code and mirrored
frontend types, not in individual chart components.

## Metric vocabulary

The first release should prefer literal, supportable measures:

| Metric | Safe meaning | Required evidence |
|---|---|---|
| Pantry visits | Recorded pantry service encounters | Stable visit rows or an explicit visit total |
| Household service encounters | Household-level services recorded in the period | One household encounter per source-defined service event |
| People represented in service encounters | Sum of explicitly reported household/person counts attached to encounters | Reported member count or explicit aggregate |
| Distinct households | Unique households in the selected range | Stable source household identifiers and an approved deduplication rule |
| Distinct individuals | Unique people in the selected range | Stable person identifiers and an approved privacy/deduplication rule |
| Long-list households | WTH supplemental count under its authored definition | WTH sidecar only |
| Premade-bag households | WTH supplemental count under its authored definition | WTH sidecar only |
| Emergency-bag households | WTH supplemental count under its authored definition | WTH sidecar only |

Until identifiers and definitions are verified, the initial Service UI should
use encounter language. “Individuals served” is acceptable only if the source
contract defines it; otherwise use “people represented in recorded visits” or
the source's own reviewed term.

Repeat visits create a fundamental distinction:

- summing daily household visits answers how many service encounters occurred;
- deduplicating household IDs answers how many distinct households appeared.

Both may be useful, but they are not interchangeable and must never share one
label.

## Source seams and coverage

Service Analytics must display source coverage prominently enough that a user
does not mistake a system transition for a service trend.

Requirements:

- show verified first and last observation dates per source;
- show gaps and overlaps explicitly;
- retain source as a filter or chart series where it changes interpretation;
- mark the Link2Feed → SIMC seam on long-range time series;
- never zero-fill a period merely because a source has no coverage;
- never combine overlapping source totals until duplicate coverage is ruled
  out or reconciled deterministically;
- keep staleness source-specific.

The “All” date preset should begin at the earliest active Service observation
when Service is selected. Switching tabs should retain the same explicit date
range. The URL state should support `tab=service` alongside the shared `range`,
`from`, and `to` parameters.

## Privacy and data minimization

Intake exports may contain highly sensitive personal information. Service
Analytics should ingest the minimum data needed for approved aggregate metrics.

Unless a reviewed metric requires them, FEED must not retain:

- names;
- dates of birth;
- addresses;
- phone numbers or email addresses;
- free-text case notes;
- government or benefits identifiers;
- demographic fields not explicitly approved for an analytical purpose.

If distinct counting requires a stable household or person key, prefer a
source-scoped one-way keyed digest created during import. Do not retain the raw
identifier merely for convenience, and do not use a plain unsalted hash of a
guessable identifier. Key rotation, backup/restore behavior, and the effect on
historical deduplication must be designed before implementation.

Real service exports and supplemental logs are private operational records.
They must remain outside the repository. Automated tests use synthetic
fixtures; authorized corpus checks read private files from external storage.

## Import and correction semantics

Service ingestion should reuse the proven Procurement pattern where the source
contract permits:

- exact source detection rather than asking staff to guess a format;
- strict structural validation and calm, specific warnings;
- deterministic normalized hashes;
- identical re-imports as no-ops;
- changed source records as revisions rather than destructive overwrites;
- rollback and restore with complete audit history;
- normalized provenance retained while uploaded bytes are discarded;
- organization-wide coverage and import history in Data Management.

Source corrections must not double-count earlier revisions. The newest active
revision for one source-scoped observation contributes to Analytics.

The WTH supplemental sidecar should initially use a reviewed export/import
contract rather than requiring live Google authorization. Direct Google Sheets
sync is a separate dependency, permissions, reliability, and deployment
decision and should be considered only after the metric contract is stable.

## Planned Analytics experience

The Analytics tab order will be:

1. Operations
2. Procurement
3. Service

Service uses the same sticky tab/range control and organization-timezone date
semantics. Service-only filters should appear below the shared controls and
must not leak into Operations or Procurement URL state.

The first vertical slice should progress from summary to explanation:

1. **Service summary** — household encounters, pantry visits, and people
   represented, limited to metrics the active sources can support.
2. **Service over time** — weekly or monthly counts with source seam and
   coverage disclosure.
3. **Source coverage** — Link2Feed and SIMC windows, observation counts,
   last-updated dates, gaps, overlaps, and staleness.
4. **WTH distribution method** — agency-only long-list, premade-bag, and
   emergency-bag observations, with the sheet's definitions visible.
5. **Underlying observations export** — privacy-minimized, normalized records
   or aggregates supporting the visible cards.

Unavailable metrics should be absent or explicitly “Not available from this
source,” never shown as zero.

## Implementation phases

### Phase 0 — Source-contract discovery

- Obtain representative, safely handled exports from Link2Feed and SIMC.
- Verify exact coverage boundaries, timezone/date meaning, row grain, stable
  keys, revision behavior, and whether exports are snapshots or deltas.
- Inventory personal fields and define the minimum retained field set.
- Confirm whether household/person counts describe encounters or unique people.
- Review the WTH sheet's period grain and whether its categories overlap.
- Produce synthetic fixtures matching the approved structural contracts.

**Gate:** no schema or importer implementation until both standard source
contracts are documented.

### Phase 1 — Canonical service foundation

- Add import, revision, rollback, and coverage persistence.
- Add visit and aggregate observation shapes based on Phase 0 findings.
- Add the versioned metric registry.
- Add source adapters and pure normalization tests.
- Keep source bytes and personal fields outside persistent storage unless
  explicitly approved.

### Phase 2 — Data Management

- Add one service-import workflow that identifies Link2Feed or SIMC.
- Show per-source coverage, warnings, revision state, rollback, and restore.
- Add the separately enabled WTH supplemental sidecar.
- Centralize ASK-aligned messages in the existing service layer.

### Phase 3 — Service Analytics vertical slice

- Add the Service tab to the right of Procurement.
- Extend shared URL/date-range state with `tab=service`.
- Add summary, time-series, coverage, and normalized CSV export.
- Display seams, gaps, unavailable metrics, and source provenance.
- Validate light/dark, desktop/mobile, empty state, and single-source state.

### Phase 4 — Agency enrichment

- Add the WTH distribution-method card only after category definitions are
  confirmed.
- Evaluate direct Google Sheets synchronization as an optional follow-up.
- Keep all agency-specific vocabulary behind deployment configuration.

### Phase 5 — Advanced metrics

Only after the foundational counts are trusted:

- distinct-household and distinct-individual metrics;
- repeat-visit cohorts;
- household-size distributions;
- service cadence and seasonal comparison;
- approved program or demographic breakdowns.

Each requires a separate privacy, definition, and data-quality review.

## Validation requirements

Before release:

- reconcile FEED totals to source-system reports over known windows;
- prove identical re-imports are no-ops;
- prove revisions, rollback, and restore never double-count;
- test Link2Feed-only, SIMC-only, gap, overlap, and seam-spanning ranges;
- test aggregate-only WTH observations without synthetic visit expansion;
- confirm every empty/unavailable state differs from numeric zero;
- inspect raw normalized exports for accidental personal information;
- validate the complete private corpus outside the repository;
- verify shared range behavior across Operations, Procurement, and Service.

## Open questions

These cannot be answered responsibly without representative exports:

1. What is the exact row grain of each standard source?
2. Which stable visit, household, or person identifiers are exported?
3. Does “individuals served” mean unique people, household members attached to
   visits, or person-service encounters?
4. Are Link2Feed and SIMC coverage windows separated, overlapping, or gapped?
5. What local date/timezone semantics does each export use?
6. Do exports restate corrected history or emit incremental changes?
7. Are the WTH long-list, premade-bag, and emergency-bag counts mutually
   exclusive and exhaustive?
8. What period grain and coverage does the WTH sheet provide?
9. Which source fields are required for reconciliation but prohibited from
   persistence?
10. Which Service metrics are required for the first usable release versus
    later analysis?

Until these questions are resolved, this document defines direction and
guardrails—not a final database or API contract.
