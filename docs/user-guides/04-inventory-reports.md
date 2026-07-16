# Inventory Analytics

Analytics keeps two kinds of evidence separate:

- **Operations** turns the inventory updates staff already make into
  availability and service-pressure history. It does not require a separate
  counting workflow.
- **Procurement** summarizes external Oregon Food Bank supply records imported
  through Data Management. It describes inbound supply, not remaining stock or
  client demand.

## What Analytics Can Safely Show

FEED remembers effective changes to:

- In Stock and Out of Stock availability.
- Limited Supply and Clearance status.
- Food Item and Category limits, including returning to No Limit.

These are operational observations, not explanations. Out of Stock means an
item was unavailable to clients; it does not prove that its physical count was
zero. Limited Supply indicates staff recorded supply pressure, but FEED does
not guess whether low supply, high demand, or another cause produced it.

## Choose A Date Range

Open **Analytics** under **Inventory** in the sidebar. Choose **Operations** or
**Procurement** at the top of the page.

Operations starts with the last 90 days. Use **Date Range** to switch to 30
days, 6 months, 12 months, or the year to date.

History begins when operational tracking was introduced. Earlier dates are
untracked and are not displayed as zero availability.

## Read The Analytics

- **Availability Summary** shows the current available, unavailable, Limited
  Supply, item-limit, and category-limit counts. **Repeat Unavailability** is
  the number of items that moved from Available to Unavailable at least twice
  in the chosen range. The summary also shows median restoration time.
- **Available Assortment Over Time** shows the average number of distinct Food
  Item records available during each scheduled service window. The card keeps
  the combined trend, adds range/latest averages, and shows how each Category
  contributed over time with a separate line. Use the Category selector to
  show all Categories or isolate one. The combined averages remain visible,
  and the CSV follows the selected Category. Category values add up to the
  combined line. It describes recorded breadth, not physical quantity.
- **Recurring Availability** focuses on items that repeatedly cycle out and
  back into availability. It shows recurring-item and episode totals, the
  typical restoration time for that cohort, and the items cycling most often.
  Category Pressure groups the same cohort by Category. An item needs at least
  two observed
  Available → Unavailable transitions; initial, migration, and one-time
  unavailable states remain outside this lens.
- **Operational Pressure** shows Limited Supply, Clearance, explicit Food Item
  rationing, and categories with limits as separate lines. A category limit
  counts as one category policy; FEED never converts it into an assumed number
  of affected Food Items or combines these signals into an invented score.
- **Category Pressure** compares how often each pressure signal was active
  during that Category's recorded service time. A separate panel shows
  recurring items and unavailable entries as event counts. These values are
  intentionally not combined into a single score.
- **Unavailable Episodes** lists recorded unavailable periods and their
  duration.
- **Rationing History** lists changes to Food Item and Category limits.

Rapid edits made within five minutes are treated as one correction session in
the charts and summaries. FEED keeps every original event in the raw history.

Analytics uses the organization schedule in **Information → Settings**. Closed
days and hours when the pantry is not serving clients do not affect the
assortment timeline. Status transitions still count when staff record them,
including morning updates before service. Current “Available Now” and
“Unavailable Now” values remain literal current counts outside service hours.

## Read Procurement Analytics

The Procurement tab uses completed Oregon Food Bank orders imported under
**Information → Data Management**.

- **Inbound Supply Summary** keeps source orders, distinct receiving dates,
  inbound weight, and supplier-product recurrence separate.
- **Recorded Cost Summary** shows product charges, service fees, grants, and
  the resulting net recorded charge. If a channel or acquisition filter splits
  an order, fees, grants, and net cost display as **Not attributable** rather
  than being assigned to an unrelated product row.
- **Acquisition Mix** compares Donated, Purch-Don, Government, and Purchased
  inbound pounds.
- **Procurement Channels** keeps OFB Warehouse and Fresh Alliance grocery
  partnership supply distinct.
- **Product Recurrence Distribution** shows how much of the supplier catalog
  appears once, occasionally, or repeatedly. It describes dependable versus
  opportunistic inbound supply; it is not a staff-performance score.
- **Procurement Pattern Matrix** compares observed-month coverage and receipt
  frequency. Larger points represent more total inbound weight.
- **Inbound Weight Over Time** shows monthly acquisition-class trends.
- **Seasonal Inbound Weight** overlays calendar years month by month. Use the
  year selector to keep the comparison readable.
- **Product Continuity** provides the sortable supplier-product detail behind
  the recurrence views.

Use the year, procurement-channel, and acquisition-class filters independently.
Select **Manage Procurement Data** to import a fresh export or review import
history. FEED shows a refresh warning when the latest receiving date is more
than 30 calendar days old.

## Export Analytics Data

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

Each card links to Analytics for the full history. FEED does not currently show
burn rate, projected depletion, replenishment cost, or quantity-completeness
cards because ordinary service-catalog updates cannot support those claims
reliably.

## What To Read Next

- To update the information used by analytics, read [Inventory](03-inventory.md).
- To update the pantry schedule used by analytics, read [Operating Hours](11-settings.md).
- To import or reverse Oregon Food Bank data, read [Data Management](12-data-management.md).
- To turn current inventory into client-facing lists, read [Shopping Lists](07-shopping-lists.md).
