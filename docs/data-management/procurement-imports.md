# Procurement Imports

## Purpose

FEED imports external procurement observations as a dataset separate from the
Food Item service catalog and its operational event history. The first source
is the standardized Oregon Food Bank (OFB) CSV exporter.

The staff workflow is intentionally short:

1. Open **Information → Data Management**.
2. Drop or select an OFB CSV.
3. Review the import result and any calm data-quality warnings.
4. Leave. The uploaded file is no longer retained.

No mapping, row-by-row confirmation, or correction queue is required.

## Data boundary

The upload is held in memory for the request, parsed, normalized, written in one
database transaction, and discarded. FEED stores neither the original filename
nor the CSV bytes. Real exports are excluded from Git; regression coverage uses
synthetic fixtures.

Normalized procurement data must never:

- change a Food Item's availability, status, limit, or estimated quantity;
- claim procurement caused a later operational transition;
- convert inbound weight into Food Item counts;
- treat shopping-list generation as consumption or demand;
- merge procurement channels merely because they arrived through one portal.

## Accepted OFB contract

The importer requires the exact standardized header sequence:

`Date, Period, Order #, Product #, Product Description, Category, Qty, Weight,
Unit Price, Price Total, Service Fee, Grants Applied`

Structural failures block the import: malformed CSV, missing or reordered
headers, invalid dates, product identifiers outside the observed four-to-six
digit contract, missing or unsafe order references, acquisition classes that
conflict with OFB's product-number families, or unsafe numeric values. OFB
order references are preserved as bounded strings because real references may
contain an alphabetic suffix. Source-quality anomalies import with warnings
when FEED can preserve both the source observation and a deterministic
reconciliation.

Examples include:

- `Price Total` differing from `Qty × Unit Price`;
- a Period label disagreeing with the delivery date;
- a source order appearing on more than one receiving date in the same export.

Multiple source orders on one receiving date are normal and do not produce a
warning. A source order on multiple dates in one export is a structural
conflict because FEED cannot choose which snapshot is authoritative without
inventing a rule.

For price disagreements, FEED preserves the source-reported total and a
canonical calculated total. Analytics use the calculated total. This is
reconciliation, not an assertion that FEED knows why the source differs.

## Procurement channels

OFB exports contain two procurement channels that must remain distinguishable:

- **OFB Warehouse** covers ordinary four-to-six digit product identifiers.
- **Fresh Alliance** covers the five-digit `4xxxx` product family. These lines
  are Donated supply received through participating grocery partners.

Both channels contribute to combined procurement totals when the user selects
All Channels. They remain filterable because their sourcing patterns and
cadence are materially different. This channel classification is deterministic
source metadata; it is not semantic mapping to FEED Food Items.

## Revision and rollback model

The source order reference is the stable observation boundary established by
the direct exporter corpus. Each normalized order snapshot receives a
deterministic hash; source row order is excluded from that hash.

- An identical active snapshot is a no-op.
- A changed snapshot for the same source order appends a new revision.
- A revised snapshot may correct its receiving date without manufacturing a
  second order identity.
- Only the newest revision belonging to an active import contributes to
  Analytics.
- Rolling back an import preserves its data and audit history, then restores
  the preceding active revision for each affected source order.
- Restoring an import makes its revisions eligible again; the newest active
  revision still wins.

Import warning details—including delivery date and source row references—are
retained as normalized provenance. This does not retain the source file.

Imports and normalized observations are organization-wide. User identity is
retained only as optional audit attribution, never as a visibility filter.

## Staleness

Procurement data is flagged as potentially stale when the newest active
delivery date is more than 30 calendar days before today in FEED's configured
organization timezone. Both Analytics and Data Management surface the flag.

Staleness is a refresh prompt. It is not an accusation of incomplete work, and
it must not be presented as a data-quality score.

## Analytics vocabulary

The Procurement lens safely reports:

- total OFB inbound weight;
- source-order count and distinct receiving-date count as separate metrics;
- median order weight, interquartile range, and median source lines per order;
- OFB acquisition mix by inbound weight;
- OFB Warehouse and Fresh Alliance channel mix by inbound weight;
- calculated gross product charges, service fees, grants, and net recorded
  charges;
- monthly inbound weight by acquisition class;
- year-over-year seasonal weight with shared date-range, channel, and
  acquisition filters;
- supplier-product recurrence by distinct receiving date;
- product continuity and a recurrence-versus-coverage pattern matrix.

Supplier products are identified by OFB product code. Descriptions remain
source observations and may change. Price trends must stay within one supplier
product code. Product continuity is procurement continuity, not proof that a
Food Item was available to clients.

The Analytics date control is shared with Operations: 7 days, 30 days, 90 days
(default), year to date, all active procurement history, or an inclusive custom
date range. Channel and acquisition class remain independent Procurement
filters. All Procurement cards—including recurrence, the pattern matrix, and
Product Continuity—use the same resolved range. Staleness remains based on the
latest active delivery in the complete corpus rather than the selected range.

Seasonal Inbound Weight compares selectable calendar-year series only when the
resolved range spans more than one calendar year. A single-year range shows the
monthly trend inside that range and disables the year overlay control; it never
quietly reaches outside the shared date filter.

Completed source lines with zero quantity or zero weight remain in provenance
and the Import Quality count, but are not evidence that supply was received.
They do not contribute to recurrence or Product Continuity.

OFB places order-level service fees and grants on individual source rows.
Whole-order and year-only totals may include those adjustments. When a channel
or acquisition-class filter divides an order, FEED reports the filtered gross
product charges but marks fees, grants, and net cost as **Not attributable**.
It never assigns an order-level adjustment to the product row on which the
exporter happened to place it.

## Authoritative corpus validation

The direct exporter corpus was validated on July 14, 2026. The approved union
uses five broad exports covering January 3, 2011 through July 13, 2026. Narrower
overlapping exports are accepted as no-ops. The file named
`OFB_Completed_Orders_2026-06-01_to_2026-06-02.csv` was explicitly excluded
because it is a synthetic conflict fixture rather than source history.

The production-shaped import produced:

- 36,679 normalized source rows;
- 2,050 source orders across 1,566 receiving dates;
- 1,584 stored supplier product codes, of which 1,583 have positive inbound
  observations;
- 3,625,094.50 pounds of inbound supply;
- $342,857.70 calculated gross product charges;
- $255.40 in service fees and $22,953.87 in grants;
- $320,159.23 in net recorded charges.

The overlapping May–July 2026 export skipped all 69 source orders as exact
duplicates. Rollback restored the preceding active order revisions, restore
reinstated the latest snapshot, and an intentionally modified order appended
revision 2 without altering the source identity. These checks were repeated on
a production-shaped database copy after applying every migration.

This validation does not authorize semantic mapping, category synthesis, or
AI-assisted links to FEED Food Items. Exact supplier-product price history and
direct analytics export remain later, separately reviewed increments.
