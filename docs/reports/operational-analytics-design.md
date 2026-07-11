# Operational Analytics, Supply Annotations, and Data Export

**Status:** Milestones 1–4 implemented as a RITE-tested vertical slice. Visual
PDF/ZIP packages and shared report templates remain dormant pending a validated
operational-report consumer.

This document is the source of truth for FEED's post-prototype analytics
direction. It supersedes the product semantics in `docs/reports/logistics.md`
and `docs/reports/analytics.md` wherever they conflict. Those files document
the July 2026 logistics/reporting prototype and remain useful implementation
history until the reframe is complete.

## Product principle

FEED should extract insight from work staff already perform. It must not turn
analytics into a parallel inventory-counting job.

Operational decisions and imported source records are the primary evidence:

1. **Service-catalog decisions** — available, unavailable, Limited Supply,
   Clearance, and request limits.
2. **External source records** — future OFB orders, donation weights, and other
   structurally imported datasets.
3. **Optional measurements** — a staff-entered estimated quantity when keeping
   that approximation is useful for a particular item.

FEED may ask for data during a workflow only when it is necessary to complete
the user's immediate task. Optional enrichment must not obstruct that task.
When evidence is incomplete, FEED reduces the specificity of its conclusion
instead of transferring the analytical burden to staff.

## Observable meanings

Reports describe recorded operational states without assigning an unobserved
cause:

| Recorded state | Safe analytical meaning |
|---|---|
| In Stock | Available to clients |
| Out of Stock | Unavailable to clients |
| Limited Supply | Staff perceived operational supply pressure |
| Clearance | Staff prioritized accelerated distribution |
| Item/category limit | Recorded rationing policy |
| No Limit | No explicit item/category rationing policy |

"No Limit" does not prove demand was met. Out of Stock does not prove the
physical quantity reached zero. Clearance does not prove waste or imminent
expiration. Shopping-list generation does not prove client demand,
distribution, or consumption.

The org-wide Global Limit is a printable-list safety fallback. It is not an
item/category rationing decision and is excluded from service-pressure
analytics.

## Food Item Supply tab

The fourth Add/Edit Food Item tab is **Supply**, not Logistics. Both fields are
optional:

- `estimatedQuantity Int?` — blank is Unknown; otherwise a nonnegative whole
  number. The unit is intentionally unspecified.
- `supplySource String?` — `null` is Unknown; accepted values are `donated`,
  `purchased`, and `mixed_other` (displayed as Mixed/Other).

New and migrated items default both fields to Unknown. Existing prototype
quantity, price, and package values are development-only test data and are not
preserved.

There is no price, unit/package divisor, derived unit cost, unit-of-measure
question, completion warning, or coupling between Supply fields and stock
status. Marking an item Out of Stock is a one-action availability transition
and never changes quantity.

Estimated quantity may be displayed for that item and included in raw history.
FEED does not sum unlike quantities, compare quantity magnitudes between
items, convert them to weight, infer consumption, calculate burn rate or days
of cover, or project depletion.

## Append-only operational history

Atomic history remains the foundation. Effective changes write the current row
and its event in one transaction. No-op saves create no event. Lifecycle
baselines identify the start of tracked history; no earlier state is invented.

### Food Item events

Each snapshot retains identity plus:

- availability (`isInStock`);
- Limited Supply and Clearance flags;
- item limit, limit type, and whether the item limit is operationally active;
- optional estimated quantity and supply source;
- event kind, dimension flags, and server timestamp.

Limit changes become first-class observations. Supply annotation changes are
retained but do not alter availability.

### Category events

Category creation, effective updates, and deletion write append-only snapshots
of category identity, limit, limit type, icon, and lifecycle state. This is
required because a category limit is independent of its Food Items and appears
as a section-level shopping-list rule.

Food Item limits, Category limits, and the Global Limit remain separate. The
persisted `100` No Limit sentinel must be interpreted consistently, but the raw
value is retained for compatibility.

## Correction-window sampling

Atomic history and analytical sampling solve different problems. The ledger
preserves what happened; analytics should not treat a rapid correction as a
real operational episode.

The initial correction window is **five minutes** and is applied at query time,
never during writes:

1. Partition events by entity and tracked analytical dimension.
2. Baseline, creation, and deletion events are hard boundaries and are never
   discarded.
3. Consecutive effective updates within five minutes form one correction
   session.
4. The session contributes its final state at the final event timestamp.
5. If that final state equals the state before the session, the session
   contributes no analytical transition.
6. Events separated by more than five minutes remain distinct observations.

This rule prevents an accidental Out of Stock → In Stock reversal performed a
minute later from becoming a stockout episode. It does not mutate the ledger or
hide evidence from raw export.

Every report/export using sampled observations records the correction-window
duration and calculation version. Raw operational-history CSV exports contain
all atomic events and identify which events contributed to sampled analysis.
The window is a centralized versioned constant and must be tuned from real use,
not duplicated in individual reports.

## Initial analytics vertical slice

The first supported analytics domain is **Availability & Service Pressure**.
It uses only operational history and exposes underlying observations rather
than an arbitrary composite score.

Initial blocks:

1. Availability summary — current available/unavailable counts and tracked
   availability percentage.
2. Availability over time — percentage of the active catalog available during
   each period.
3. Operational pressure over time — Limited Supply, Clearance, and explicit
   rationing states.
4. Unavailable episodes — item/category, start, end, duration, and restoration
   status.
5. Rationing history — item and category limit changes, including No Limit.

Valid measures include counts, percentages, durations, transition frequency,
and episode medians. The denominator for a historical percentage includes only
entities that existed at that time and only time at or after their tracking
baseline. Deleted entities stop contributing at deletion.

Seasonal views may be displayed descriptively, but FEED must not label a
pattern seasonal until sufficient recurring history exists (normally more than
one annual cycle).

## Export contract

The first validated report blocks expose:

- direct CSV for one block;
- server-side canonical calculations shared with the interactive view;
- raw event export where explicitly offered.

Ordered card selection and ZIP packages containing landscape PDF
visualizations, per-card CSV files, and a manifest remain the intended visual
export direction. They are intentionally dormant at this milestone rather
than being re-enabled against the abandoned logistics calculations.

CSV/PDF output must distinguish raw atomic history from sampled analytical
observations. Unknown values remain blank/Unknown rather than zero. Exported
metadata includes the resolved date range, timezone, data-as-of timestamp,
calculation/schema version, and correction-window policy.

## Prototype rollback and dormant infrastructure

The July 2026 prototype's visible Reports routes, sidebar entry, report
selection UI, logistics Dashboard cards, and price/burn/replenishment content
are removed before selective reintroduction. Domain endpoints and card
registrations that make abandoned claims are disabled rather than merely
hidden.

The following generic infrastructure is intentionally retained dormant:

- report card registry and source binding;
- cross-card selection provider;
- shared report templates;
- authenticated binary downloads;
- CSV, ZIP, manifest, PDF, and server-authored SVG rendering;
- Chromium lifecycle/network isolation;
- date-range and IANA-timezone helpers.

Dormant code is technical debt, not a permanent entitlement. Audit it at every
analytics milestone and release boundary. Each retained module must either
gain a validated consumer, remain clearly isolated with passing focused tests,
or be pruned. Do not extend dormant domain-specific calculations merely to
avoid deleting prototype work.

## External data roadmap

OFB and donation ingestion are later, source-specific vertical slices. Obtain
representative raw source files before fixing schemas. Initial ingestion must
be computation rather than data entry: upload, validate, normalize, report the
result, and finish without a mapping/configuration queue.

OFB v1 preserves structural columns and provenance, relies primarily on
weight, cost, source classification, and order cadence, and does not perform
semantic package parsing or map supplier records into Food Item quantities.
Strict extraction of an unambiguous leading supplier code is identity parsing,
not package interpretation.

AI-assisted cross-source mapping, donation-source synthesis, and SIMC/
Link2Feed enrichment are v2. SIMC contains PII; prefer aggregate or
de-identified exports, minimize retained fields, establish encryption and
retention first, and never send PII to an external LLM.

## Delivery sequence

1. Prototype rollback and Supply reframe.
2. Food Item and Category operational-history foundation.
3. Availability & Service Pressure vertical slice.
4. Selective Reports/Dashboard reintroduction with raw and structured CSV
   exports. **Implemented.**
5. Reconnect ordered PDF/ZIP visual exports to validated operational blocks.
6. OFB source ingestion after representative raw-data review.
7. Donation-weight ingestion after receiving a sample workbook.
8. V2 AI-assisted mapping and privacy-bounded service-demand enrichment.
