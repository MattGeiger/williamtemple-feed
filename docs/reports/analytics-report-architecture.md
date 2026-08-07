# Analytics Report Architecture

## Status

Built 2026-08-06/07 for 1.5.0-beta.8. Fifteen cards, both lenses, generating a
ZIP of PDF + per-card CSV + manifest. Templates save; the Reports Management
surface that re-runs them is not built yet.

## What a report is

**An export of what Analytics is already showing.** Not a second analytical
engine.

That sentence is the whole architecture. Every card in a report is a card on the
Analytics page, rendering the same numbers under the same filters. A report
therefore makes no claim the screen does not, which is what makes it safe to
build on: the claims were reviewed once, on the screen, and the report inherits
them.

The previous attempt was the opposite. `routes/reports.ts` had its own 31-card
registry computing its own answers, which is exactly how it drifted into the
price, burn, projected-stockout, replenishment, and quantity-coverage claims
that RITE rejected (ISSUES #46). That code still exists, unmounted. This is
mounted at `/api/analytics-reports` specifically so it cannot inherit any of it.

## The card contract

One accessor, two outputs.

```
card.data(payload, options) ──┬──► card.print(data)   → SVG / HTML
                              └──► cardCsv(data)      → CSV
```

`data()` returns display-ready categories and series: already labelled, already
in display units, already condensed if the range is too long to print. The chart
and the CSV both consume *that*, so their numbers cannot disagree. Only the
drawing differs — which is the point, because a print chart should be designed
for paper rather than imitating a screen.

### Why this exists

The first spike skipped it and re-derived rows inside each renderer. It drifted
on its very first output, in two ways:

- printed the raw enum `PURCH-DON` where the screen shows `Purch-Don`;
- omitted the legacy partner history the screen stacks onto Fresh Alliance,
  **understating that channel by 933,689 lb of 1,513,436 — 62%**.

Neither was visible without comparing outputs side by side. Both looked
completely plausible. That is the failure mode this contract is built against.

### Card shape

| Field | Meaning |
| --- | --- |
| `id` | Stable. Selection, templates, and options are all keyed by it. |
| `lens` | `operations` or `procurement` — decides which payload it is handed. |
| `kind` | `chart`, `kpi`, or `table`. Declared, not inferred. |
| `data(payload, options?)` | The single accessor. |
| `print(data)` | Markup for the page. |

## Approach A: server-authored charts

Three approaches were built and compared against the same data before choosing
(see the commit history for the spikes):

| | Size | Rasters | Needs a browser | Deterministic |
| --- | --- | --- | --- | --- |
| **A — server-authored SVG** | 586 KB / 7pp | 0 | no | **yes** |
| B — serialized from the DOM | 145 KB / 4pp | 0 | yes | no |
| C — Chromium prints the page | 5.8 MB / 11pp | **139** | yes | no |

C prints an *application*: 139 raster images of icons, sidebar, and chrome. B
loses legends — Recharts renders them as HTML outside the `<svg>` — and needs
computed styles inlined, 1,053 attributes for one chart.

A won on the property that matters most: **no browser is required to draw a
chart**, so a saved template can regenerate on a schedule, and the same inputs
always produce the same bytes. It also costs the least per card: roughly 4–9
lines of adapter against shared primitives.

The tradeoff, stated plainly: **the PDF does not look pixel-identical to the
screen.** It shows the same numbers in a chart drawn for print. That was an
explicit decision, not an oversight.

### Primitives

Charts are drawn with no CSS at all — colours and type are attributes on the
elements — so output is identical wherever it renders. `analytics-cards.test.ts`
asserts no `var(--` and no `class=` appears in any card's output.

| Primitive | For |
| --- | --- |
| `hBarSvg` | A labelled breakdown. |
| `stackedBarSvg` | One timeline split by source. |
| `stackedHBarSvg` | Parts of one whole, per row. |
| `groupedHBarSvg` | **Independent** measures per row. |
| `lineChartSvg` | Comparisons; optional fill under the first series. |
| `kpiGrid` | Text tiles, as HTML. |
| `tableHtml` | A table, as HTML. |

**Stacked versus grouped is a correctness decision, not a style one.** Seasonal
Inbound Weight compares calendar years — stacking would sum unrelated years into
a total nobody asked for, so it draws lines. Category Pressure carries four
independent signals where Beans reads 98% / 0% / 100% / 0%; stacked, that is a
198%-long bar meaning nothing. FFA Category Mix *is* parts of a whole, so it
stacks. What the bars **are** decides the primitive.

## Filters and card options

Two layers, and both must survive into the report.

**Page filters** — range, channel, acquisition class — are read off the payload
the API returned, so the screen and the report cannot disagree about what was
asked for. A card's title and series set may depend on them: Inbound Weight Over
Time is called "Warehouse Weight by Acquisition Class" under one filter and
shows an entirely different series set under another.

**Card-level controls** — a search box, a donor filter, a year selection, a
table's sort — live in React and are not in the payload. They travel as
`cardOptions`, keyed by card id.

They are **frozen when selection begins**, not read at generate time. The modal
offers no filter controls, so a run must mean what the page showed when the user
chose to make a report; changing a card's filter afterwards would silently
rewrite a selection already made.

Options are published during *render*, not in an effect: `startSelecting` can
fire before an effect has flushed, and a stale snapshot is precisely the failure
this prevents.

## Readability-driven grain

A bar needs about **1.6 mm** on paper to read as a bar, which allows ~103
categories across the usable 244 mm. Past that, a time series is coarsened
month → quarter → year until it fits, and the card says so:

> Condensed to quarters: 201 months would print at under 1.6mm per bar. Narrow
> the date range to see months.

The threshold is in millimetres, not pixels, because the output is vector — user
units map to a fixed printed width, so millimetres are the units the rule is
about and the only ones checkable against a printed page.

**Condensing happens in `data()`, before both outputs.** Had it run in the
renderer, the chart would show quarters while the CSV still held months, and two
files in one archive would disagree. The CSV offers both grains as a user
choice; `condensed` is the default so an unqualified export never contradicts
the picture beside it.

## Tables

Every control a user set travels: filter, sort, visible columns, page size. The
state lives inside `EnhancedDataTable`, so it publishes it via
`onViewStateChange` — there is no other route to it.

It is **re-derived server-side rather than sent as resolved rows**, because a
saved template regenerates months later with no client to resolve anything.
Applied in the order the table applies it: filter, then sort, then page.

Sorting uses the underlying value, never the formatted text. `"$9"` sorts after
`"$10"` as a string, and every currency column would be silently wrong.

Printed as HTML, not SVG: a table is text in a grid and Chromium already lays
that out with real typography and page breaks. The header repeats on every page
and rows never split across a boundary — the two things that make a long table
usable on paper, and that screenshotting a web table never gives you. A
hundred-row export is a legitimate request and is tested as one.

## Cross-lens loading

Operations and Procurement come from different services with different range
semantics — Operations resolves its range against the pantry's operating-hours
timezone and applied schedule revisions, which Procurement knows nothing about.
The route inspects the selection, loads only the lenses it needs, and hands each
card the payload for its own lens. A card whose lens was not loaded is reported
like a stale id rather than producing a plausible-looking empty chart.

## What the archive contains

```
01-<card>.csv          numbered in selection order
02-<card>.csv
<title>.pdf
manifest.json          range, filters, cardOptions, grain, per-card notes,
                       generatedAt, dataAsOf, unknown card ids
```

Selection order is report order. The manifest exists because a CSV separated
from its range and filters is exactly the misread the whole contract is built to
prevent.

## Templates

A template stores the **shape** — which cards, in which order, under which
filters and card options — and deliberately **not the date range**.

"Last 90 days" saved in March either freezes a stale window or quietly means
something different in April. The range is chosen when the template is run.
Saved with `source: 'analytics'` so these never collide with the dormant
workspace's templates, which describe cards this route cannot render.

## Drift guards

The two packages share no module, so anything duplicated across them is checked
by reading both sides from source. This is the same technique the audit-action
labels use, for the same reason: every previous drift in this project came from
unchecked duplication.

| Test | Guards |
| --- | --- |
| `analytics-card-parity.test.ts` | Display labels and unit conversion. |
| `table-column-parity.test.ts` | Column **ids** and headers. Ids matter most — sorting travels by id, so a renamed `accessorKey` silently reorders the exported table while everything still renders. |
| `analytics-cards.test.ts` | Chart and CSV read the same rows; no `var()`; empty payloads do not throw. |

Each guard was verified by breaking it deliberately and watching it fail.

### Known gap

**Formatters are not covered.** The guards compare ids, headers, and labels —
not behaviour. A real instance: `dateTimeLabel` used a single `toLocaleString`
call, producing `5/7/2026, 9:30 AM` with a comma the screen never shows. The
shared formatter composes date and time with a space. It reached a rendered CSV
before being caught by eye. Closing this means comparing behaviour rather than
source text, which is a different mechanism than the one built here.

## What is not built

- **Reports Management** — templates save, but nothing lists or re-runs them.
- **Formatter parity** — the gap above.
- **Operations card options** — no Operations card yet has card-level controls
  that need freezing; the mechanism is there when one does.
