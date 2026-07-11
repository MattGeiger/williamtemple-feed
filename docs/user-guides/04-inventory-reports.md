# Operational Reports

Reports turns the inventory updates staff already make into availability and
service-pressure history. It does not require a separate counting workflow.

## What Reports Can Safely Show

FEED remembers effective changes to:

- In Stock and Out of Stock availability.
- Limited Supply and Clearance status.
- Food Item and Category limits, including returning to No Limit.

These are operational observations, not explanations. Out of Stock means an
item was unavailable to clients; it does not prove that its physical count was
zero. Limited Supply indicates staff recorded supply pressure, but FEED does
not guess whether low supply, high demand, or another cause produced it.

## Choose A Date Range

Open **Reports** under **Inventory** in the sidebar. Reports starts with the
last 90 days. Use **Date Range** to switch to 30 days, 6 months, 12 months, or
the year to date.

History begins when operational tracking was introduced. Earlier dates are
untracked and are not displayed as zero availability.

## Read The Report

- **Availability Summary** shows the current available, unavailable, Limited
  Supply, Clearance, item-limit, and category-limit counts. It also summarizes
  the share of tracked item-days that were available.
- **Availability Over Time** shows the percentage of the tracked catalog that
  was available to clients.
- **Operational Pressure** shows Limited Supply, Clearance, and explicit item
  rationing as separate lines. FEED does not combine them into an invented
  score.
- **Unavailable Episodes** lists recorded unavailable periods and their
  duration.
- **Rationing History** lists changes to Food Item and Category limits.

Rapid edits made within five minutes are treated as one correction session in
the charts and summaries. FEED keeps every original event in the raw history.

## Export Report Data

Select **Export CSV** beside any summary, chart, or table to download the data
behind that block. Select **Export Raw History** to download every atomic Food
Item and Category event in the chosen range.

Raw history identifies whether an event contributed to the five-minute
sampled analysis. This makes it possible to audit a result without losing the
record of a quick staff correction.

CSV exports are spreadsheet-ready. Unknown values remain blank instead of
being silently changed to zero.

## Dashboard Shortcuts

Dashboard shows two literal operational counts:

- **Unavailable Items**
- **Limited Supply**

Each card links to Reports for the full history. FEED does not currently show
burn rate, projected depletion, replenishment cost, or quantity-completeness
cards because ordinary service-catalog updates cannot support those claims
reliably.

## What To Read Next

- To update the information used by reports, read [Inventory](03-inventory.md).
- To turn current inventory into client-facing lists, read [Shopping Lists](07-shopping-lists.md).
