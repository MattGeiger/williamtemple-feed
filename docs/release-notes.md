# Release Notes

## Version 1.4.0 — 2026-07-25

- Rebuilt Analytics around two distinct live lenses: **Operations** for
  availability and service pressure, and **Procurement** for inbound supply,
  source activity, recorded costs, and seasonal history.
- Added one-step unified Oregon Food Bank imports in Data Management, including
  Warehouse orders, Fresh Food Alliance pickups, donor attribution, coverage,
  rollback/restore, legacy community history, and agency-authored shaping rules.
- Replaced the Analytics custom-date control with a compact calendar featuring
  month/year dropdowns, synced date fields, and a frosted shared surface.
- Planned Service as the third Analytics lens, covering pantry visits,
  households, and people served from Link2Feed and SIMC, with William Temple
  House's supplemental log kept as a separate agency-specific source.
- Reframed the experimental Logistics tab as an optional **Supply** tab with
  only Estimated Quantity and Source. Both may be left Unknown.
- Restored one-action Out of Stock updates. Changing availability no longer
  asks for or changes an estimated quantity.
- Added history for the operational choices staff already make: availability,
  Limited Supply, Clearance, and Food Item or Category limits.
- Replaced the experimental planning reports with focused availability and
  service-pressure reports. Burn rate, projected depletion, price, and
  replenishment claims are no longer shown.
- Added direct spreadsheet exports for every supported report block and a raw
  operational-history export for auditing.
- Added five-minute correction sampling so a quickly corrected edit does not
  become a false operational episode while the complete raw history remains
  available.
- Added Unavailable Items and Limited Supply shortcuts to Dashboard.
- Updated Help with the Supply and operational-report workflows.

## Version 1.3.6 — 2026-07-10

- Added a Logistics tab to Food Items for purchase price, units per purchase, and estimated quantity.
- Added inventory history so FEED can estimate burn rates, days of cover, stockout risk, scarcity, and replenishment needs without inventing earlier data.
- Added the Reports workspace with Inventory Outlook, Unit Prices, Scarcity & Availability, Replenishment Planning, and Data Coverage views.
- Added quick CSV downloads and ordered report packages containing a landscape PDF, one CSV per selected report block, and a manifest.
- Added organization-wide shared report templates with Apply, Generate, Rename, Duplicate, and Delete actions.
- Added an Inventory Reports guide to Help with the complete report-generation workflow and guidance for reading Unknown or incomplete results.
- Matched report-selection motion to the faster ZEV reference style while preserving reduced-motion accessibility.
- Added four inventory-logistics cards to Dashboard and report generation for eleven trusted Dashboard cards.
- Added report filters for item/category text, category, stock status, and price type, plus Top 5/Top 10 ranking options.
- Fixed future time being counted in Scarcity, lifecycle snapshots inflating activity, and out-of-stock items disappearing from replenishment urgency.
- Improved Reports on phones and hardened PDF/Docker cleanup after repeated exports.

## Version 1.2.6 — 2026-05-28

- Pop-up notifications ("toasts") now stay on screen just long enough to read them — about three reads' worth — instead of lingering.
- Fixed a problem where tapping or clicking a notification could leave it stuck on screen indefinitely.
- Notifications now close purely on a timer, or when you click their close (×) button or an action button (like Retry).

## Version 1.2.5 — 2026-05-28

- Moved the Shopping List Builder's "Checkbox in Want column" setting to apply to the whole section table at once.
- Previously the setting was per-row, which was tedious to apply and never actually stuck — saving the template cleared the checkboxes back to blank, and PDFs printed without them.
- Turn it on once per table and every row in that table renders a checkbox in the Want column; the setting now persists across saves, PDF downloads, and reloads.

## Version 1.2.4 — 2026-05-27

- Fixed the public inventory feed so translated category and item names that already exist in the app now appear in the feed.
- Some categories (such as "Canned Goods") were missing their translations in the feed even though Translation Management showed them.
- The feed now reads the same translations the rest of the app uses, falling back to the main translation store when needed.

## Version 1.2.3 — 2026-05-26

- Fixed Shopping List Builder so food item limits show automatically from inventory, without re-entering them in the builder.
- Separated a food item's request limit from its "Limited" low-stock status, so changing one no longer affects the other.
- Made the Global Limit apply to "No Limit" items by default on shopping lists, with an option to turn it off per table.

## Version 1.2.2 — 2026-05-24

- Added technical notes for the public inventory JSON feed.
- Documented the endpoint URL, access model, update behavior, and response shape.
- Documented how LOTTO should use translated category and food item names.

## Version 1.2.1 — 2026-05-24

- Added a public read-only inventory JSON feed for LOTTO.
- Included categories, available food items, limits, status tags, and dietary flags.
- Included enabled-language translations for category and food item names.
- Omitted out-of-stock items from the public feed.

## Version 1.2.0 — 2026-05-24

- Added Help screenshots for each guide section.
- Added matching light and dark screenshots so Help reflects the user's current theme.
- Made Help search results link directly to the matching guide section.
- Added release notes from the sidebar version label.
- Updated Help copy after review for clearer, shorter guidance.

## Version 1.1.3 — 2026-05-23

- Added the in-app Help section.
- Added plain-language guides for daily pantry workflows.
- Added an About modal with project, source, and license information.
- Simplified the login and logout screens.
- Updated auth screen branding and attribution.

## Version 1.1.2 — 2026-05-22

- Added more animated icons across navigation and page actions.
- Improved the alerts bell animation.
- Improved table filter and search field icon motion.
- Fixed breadcrumb items that looked clickable but did not navigate.

## Version 1.1.1 — 2026-05-22

- Added animated icons across main action buttons, page titles, and dialogs.
- Improved sidebar, logout, global limit, and alert icon motion.
- Kept sidebar icon animation tied to hover and tap instead of page load.

## Version 1.1.0 — 2026-05-22

- Added more Shopping List Builder layout and print controls.
- Added export filename settings for shopping list PDFs.
- Added English as an export option in translated shopping lists.
- Improved printed shopping list contrast.
- Fixed several builder editing, translation, and keyboard issues.

## Version 1.0.10 — 2026-05-21

- Fixed Food Items editing when a status filter is active.
- Improved the Find Missing Translations modal layout.
- Improved Shopping List Builder row height handling.
- Standardized more scroll areas.

## Version 1.0.8 — 2026-05-21

- Made Shopping List Builder templates and saved components shared across the organization.
- Removed per-user separation from saved builder content.
- Removed legacy hardcoded credentials from tracked documentation and test files.

## Version 1.0.0 — 2026-05-19

- Published FEED as open-source software under AGPL-3.0-or-later.
- Included inventory management for food categories, items, limits, and stock status.
- Included the Shopping List Builder for printable, multilingual shopping lists.
- Included AI-powered document translation.
- Included multilingual rendering for right-to-left languages and CJK text.
- Included dashboards for translation, cost, and usage information.
- Included passwordless email sign-in.
