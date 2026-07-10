# Inventory Reports

Inventory Reports turns FEED's shared inventory history into live summaries, planning tables, charts, PDFs, and CSV data.

## Before You Generate A Report

Reports use the information staff record on Food Items.

For the clearest results:

- Keep stock status current.
- Add an estimated quantity when a useful count is available.
- Record a purchase price and units per purchase when the item is purchased.
- Leave a value Unknown when it has not been measured. Do not enter zero unless the value is truly zero.

FEED starts calculating history when inventory tracking begins. It does not invent earlier quantities, prices, or stock changes.

## Choose A Report View

Open **Reports** under **Inventory** in the sidebar. Reports opens to the last 90 days with a 30-day planning horizon.

Use the controls at the top to choose another date range or planning horizon. The five tabs answer different questions:

- **Inventory Outlook** shows current stock, estimated quantities, burn rates, days of cover, and projected stockout dates.
- **Unit Prices** separates purchased, donated, and Unknown costs and shows recorded price changes.
- **Scarcity & Availability** shows stockout frequency, availability, and time to restock.
- **Replenishment Planning** shows priority items, packages needed, known paid cost, and missing information.
- **Data Coverage** shows which items have enough quantity, price, and history data for planning.

Unknown or insufficient-history results are intentionally left blank or labeled. They are not treated as zero.

## Generate A PDF And CSV Package

1. Choose the date range and planning horizon.
2. Select **Generate Report**.
3. Move through any of the five tabs and select up to eight report blocks.
4. Select **Continue**.
5. Review the selected blocks and use Move Up or Move Down to set their export order.
6. Enter a report title.
7. Choose PDF, CSV, or both. At least one format must remain selected.
8. Select **Generate**.

When PDF and CSV are both selected, FEED downloads one ZIP package containing:

- A landscape PDF with the selected summaries, charts, and tables.
- One numbered CSV file for each selected block.
- A manifest with the report range, timezone, filters, selected blocks, and generation time.

The PDF and CSV files use the same inventory snapshot so their values agree.

## Export One CSV Quickly

Outside report-selection mode, use **Export CSV** on any report block to download only that block's underlying data.

Use this when you need to sort, filter, or share one table or chart series without building a full report package.

## Save A Shared Report Template

In the Generate Report confirmation window, turn on **Save/Update Shared Template** before generating.

Saved report templates are shared across FEED. Any authenticated staff member can apply, generate, rename, duplicate, or delete them from **Reports → Templates**.

- Relative ranges such as Last 90 Days are recalculated each time the template is used.
- Custom start and end dates stay fixed.
- A template marked **Needs attention** contains a report block that is no longer available. Edit the selection before relying on it.

## Read Planning Numbers Carefully

Burn rates are estimates based on decreases between known quantities. A delivery, correction, or other quantity increase starts a new interval instead of becoming negative use.

Projected costs include only items with a known paid price. Donated items remain separate, and items with an Unknown price are not silently counted as free.

## What To Read Next

- To update the information used by reports, read [Inventory](03-inventory.md).
- To turn current inventory into client-facing lists, read [Shopping Lists](07-shopping-lists.md).
