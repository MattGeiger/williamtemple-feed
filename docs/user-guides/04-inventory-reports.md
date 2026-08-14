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

The Procurement tab uses Oregon Food Bank portal exports imported under
**Information → Data**. The portal contains both requested OFB
Warehouse Orders and agency-reported Fresh Food Alliance grocery-partner receipts.

- **Inbound Supply Summary** keeps OFB Warehouse Orders, Fresh Food Alliance
  Receipts, receiving dates, and inbound weight separate.
- **Inbound Weight Over Time** shows monthly inbound pounds immediately after
  the summary, keeping Warehouse and Fresh Food Alliance channels separate.
- **Paid Procurement Summary** shows product charges, service fees, grants, and
  the resulting net recorded charge. If an acquisition-class filter splits an
  order, fees, grants, and net cost display as **Not attributable** rather than
  being assigned to an unrelated product row.
- **Where Paid Procurement Dollars Went** ranks exact OFB Warehouse product
  codes by calculated product charges. The chart shows the top 15 products and
  identifies how many remaining codes contribute to the **Other paid products**
  total. Search by product description or OFB product code to replace the
  summary with individually ranked matching products; no matching product is
  folded into **Other**. Broad searches show the top 25 results and report the
  complete match count. Tooltips show dollars, share of all paid charges, and
  product-code count.
  It reports where money was recorded; it does not infer why the organization
  purchased a product or whether donated supply was sufficient.
- **Acquisition Mix** compares Donated, Purch-Don, Government, and Purchased
  inbound pounds.
- **Procurement Channels** keeps OFB Warehouse and Fresh Food Alliance grocery
  partnership supply distinct.
- **Fresh Food Alliance Category Mix** shows broad OFB reporting categories. These
  are not individual products and do not identify the grocery partner.
- **Seasonal Inbound Weight** overlays every calendar year in the selected date
  range by default. Use the year selector to show all years, clear the chart, or
  isolate individual years for a focused comparison. Year colors remain stable
  while filtering; the current calendar year starts the color sequence and uses
  a stronger line and glow for quick comparison with prior years.
- **OFB Warehouse Product History** provides sortable factual observations for
  exact supplier products, including receiving-date count, inbound weight,
  median receiving gap, and the last receiving date. FEED does not classify
  products as occasional, recurring, or core supply.
- **Paid OFB Warehouse Products** provides the complete filtered product-level
  charge, paid-weight, receiving-date, and cost-per-paid-pound detail behind
  the paid-spending visualization.
- **Fresh Food Alliance Receipt Categories** provides sortable weight and event
  totals for broad Fresh Food Alliance reporting categories.

Use the year, procurement-channel, and acquisition-class filters independently.
Select **Manage Procurement Data** to import a fresh export or review import
history. FEED shows a refresh warning when the latest receiving date is more
than 30 calendar days old.

## Generate Analytics Reports

Select **Generate Report** to choose up to eight visible cards across the
Operations and Procurement tabs. FEED downloads one ZIP containing a printable
PDF, a CSV for each selected card, and a manifest recording the active date
range and filters. Reports can also be saved as shared templates and run again
for another date range.

Read [Generating Reports](14-analytics-reports.md) for card selection, condensed
versus raw CSV data, saved templates, and table behavior.

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
- To import or reverse external data, read [Data Management](12-data-management.md).
- To turn current inventory into client-facing lists, read [Shopping Lists](07-shopping-lists.md).
