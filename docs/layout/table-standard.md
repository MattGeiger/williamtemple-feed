# Table Standard

## Status

Adopted 2026-08-05, applied to all sixteen tables in one pass. Enforced by
`src/test/table-standard.test.tsx`.

## The rules

1. **Tables render through `EnhancedDataTable`.** Directly or via `DataList`.
2. **Width is declared once, as `size`.** The table resolves it for every
   viewport. Nothing else sets a width.
3. **Sorting uses `<SortableHeader column={column}>`.** Never an inline button.
4. **Alignment is declared once, as `meta.align`.** The table applies it to the
   header and the cells together. Never align a cell directly.
5. **Dates come from `@/lib/formatting/date`.** `formatDate`, `formatDateTime`,
   `formatDateRange`. Never a local options object.

That is the whole standard. Everything below is why.

## What went wrong

Three independent defects, each of which read as "the tables are just
inconsistent":

**Widths.** `EnhancedDataTable` sized columns from `meta.style`, and `size` —
TanStack's own field, accepted and typed — was inert. Seven tables ran a
ten-line pipeline by hand to convert one into the other; nine never did, and
got `table-layout: fixed`'s even split. The Data Management imports table had
eight columns at exactly 262px each, so a 72px action trigger sat in a 262px
column with ~190px of dead space beside it.

**Header alignment.** Every sortable header was written inline as
`<Button variant="ghost">` with no `size`, so it inherited `px-4`. Cell content
sits at the `td`'s `p-2`. The label therefore began **16px to the right of the
data it labelled**, in 37 places across 8 files.

**Half-aligned columns.** Food Items right-aligned its Actions cells and left
its header string alone. Data Management did the same in reverse. Alignment was
decided per half rather than per column.

## Why it drifted

Every mechanism was **opt-in convention**. Skipping the width pipeline failed
silently and looked plausible. The sortable header was copy-pasted rather than
imported, so there was no single place to fix. And two people had already
noticed the alignment problem independently and solved it two different ways —
Analytics patched its buttons with `-ml-3` (12px, cancelling 16px), and
operational-reports factored a private `sortableHeader()` helper. Neither
change could reach the other fifteen tables.

A convention that is cheaper to ignore than to follow will be ignored. The fix
was to move each rule out of the call sites and into the component, then assert
the absence of the old pattern.

## Notes on the rules

**`size` is relative, not pixels.** Flexible columns get a percentage of the
remaining width in proportion to their `size`. Selection (32px) and actions
(72px) are pinned from `FIXED_COLUMN_WIDTHS` regardless of what they declare.

**`meta.style` still exists** as a per-column escape hatch, but it opts that
column out of the responsive recalculation. Prefer `size`.

**Alignment defaults to left, including numbers.** Right-aligning numerics is a
common convention and a reasonable future change, but it is a design decision,
not a refactor — the reference table left-aligns its counts, and this pass
deliberately did not change how anything looks except where it was misaligned.

**A residual offset is normal.** An icon button's centre sits about 16px from a
text label's centre, and a badge about 11px, because their boxes differ. That
is shape, not misalignment. What matters is that *text* columns read 0.

## Dates

**`m/d/yyyy`** — month first, no leading zero on either part. July 11th 2026 is
`7/11/2026`. With a time: `7/11/2026 3:04 PM`. As a range:
`6/2/2026 – 7/31/2026`.

Five formats were in use across two libraries:

| Written as | Produced |
| --- | --- |
| `toLocaleDateString()` | `7/11/2026` — correct, by accident |
| `toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })` | `07/11/2026` |
| `toLocaleDateString(undefined, …)` | whatever the viewer's browser says |
| `toLocaleDateString('en-US', { month: 'short' })` | `Jul 11, 2026` |
| date-fns `format(d, 'MMM d, yyyy h:mm a')` | `Jul 11, 2026 3:04 PM` |

The bare call was the correct one, which is the trap: writing the options out
explicitly — the careful-looking thing — is what produced the padded variant.

**The locale is pinned to `en-US`.** `toLocaleDateString(undefined, …)` formats
in the viewer's locale, so on an en-GB browser the same delivery window renders
day-first. That is a misread, not a preference.

**Charts are out of scope.** Axis ticks keep `MMM d`, and prose keeps
`MMM d, yyyy`. An axis is a scale and a sentence is a sentence; only data read
as a record is standardised.

### How this one drifted

Differently from the others, and more instructively. Someone *did* try to
standardise it. `analytics/index.tsx` carried this comment above a local helper:

> Tables across FEED render dates as zero-padded MM/DD/YYYY (see the
> shopping-list and AI-configuration tables). Analytics tables follow that one
> standard.

They surveyed real tables, drew a conclusion, wrote it down, and applied it —
and were wrong, because AI Configuration used a bare `toLocaleDateString()` that
drops the zeros. The evidence was inconsistent, so a careful reading of it
produced a confident, incorrect rule that then looked authoritative to everyone
after them.

A comment asserting a standard is not a standard. The format now lives in one
importable function with its own tests, so the question has an answer that can
be executed rather than surveyed.

## Enforcement

`src/test/table-standard.test.tsx` scans every component file and fails on:

- any file calling `calculateColumnWidths` (computing widths by hand);
- any file containing `toggleSorting` (an inline sortable header);
- any column definition whose `cell` carries `justify-end` or `text-right`;
- any column definition formatting a date itself — `toLocaleDateString`, or a
  date-fns pattern with a numeric `MM/dd`. Month-name patterns pass, because
  the Analytics and operational-reports files hold tables and charts side by
  side and the charts legitimately use them.

It strips comments before scanning, because the first version of it failed on
a comment explaining why a file no longer used `justify-end`.

## Measured result

Header-to-cell drift on text columns, before and after:

| Table | Before | After |
| --- | --- | --- |
| Translation Management | +16px × 5 | 0 |
| Food Items | +16px × 4 | 0 |
| Category Management | +16px × 2 | 0 |
| AI Configuration, Document Translator, Shopping Lists | +16px | 0 |
| Data Management | 0 (no sortable columns) | 0 |

Reports, which never had widths, went from three columns at 398px each to
34.15% / 43.9% / 21.95% — with no change to its own column file. Food Items'
Actions offset went from −34px to −16px, matching every other table.
