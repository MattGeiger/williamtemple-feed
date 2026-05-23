# Changelog

All notable changes to FEED are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Information section** in the sidebar with a searchable, Markdown-sourced
  Help center and a concise About page. Help guides are written for pantry
  staff in plain language and include a screenshot backlog for future visual
  workflow references.

## [1.1.2] — 2026-05-22

More UI motion polish plus a breadcrumb fix. No backend or database changes.

### Changed

- **Alerts bell** now uses an animated bell in the "no new alerts" state that
  rings on hover/tap (no page-load animation). The "new alerts" bell still
  shakes on appearance.
- **Filter inputs** on every data-table page (Categories, Food Items,
  Translations, Shopping Lists, Document Translator, AI Configuration) animate
  their funnel icon on page load + filter-field hover/click.
- **Language Management search** field animates its magnifying-glass icon
  (a hop/nudge) on page load + field hover/click.
- **Translate Document dialog**: added vertical spacing around the
  "Select All" row so it isn't squeezed against the Basic/Advanced tabs.

### Fixed

- **Breadcrumb dead links**: non-route group labels (Inventory, Tools,
  Language & Translation) rendered as buttons with link-hover styling but did
  nothing when clicked. They now render as non-interactive text; routed
  crumbs still navigate.

## [1.1.1] — 2026-05-22

UI motion polish — animated icons throughout the app. No backend or database
changes. Hand-rolled icons that have no upstream animate-ui version are
authored as native animate-ui icons using Lucide v0.522.0 geometry verbatim,
so they're visually identical to the static icons at rest.

### Changed

- **Animated toolbar action icons** across the management pages — the
  Create/Add buttons (Categories, Food Items, Translations, AI Configuration),
  Find Missing Translations, Document Translator's Upload Document and Run
  Storage Check, AI Configuration's Reset to Defaults, and Shopping Lists'
  Export Settings (now a square-arrow-out icon) animate on hover/tap.
- **Animated page-title icons on every page** — Categories, Food Items,
  Translations, Document Translator, Shopping Lists, and Language Management
  now animate their title icon on load + hover, matching the AI Configuration
  page (extracted into a shared `createPageTitleIcon` helper).
- **Sidebar toggle** uses an animated `panel-left-close` icon whose chevron
  nudges on hover.
- **Sidebar Log out** icon animates (arrow slides out) on row hover.
- **Global Limit Settings** button uses a custom animated `globe-lock` icon
  (globe lines trace in, the lock bobs).
- **Alerts bell shakes** when unread alerts are present — on appearance / page
  load and on hover — drawing attention to newly-spawned alerts.

## [1.1.0] — 2026-05-22

The Shopping List Builder gains a batch of layout/printing controls plus an
org-wide Export Settings panel. Every builder change is applied identically
in the canvas preview and the Chromium PDF export (verified by rendered-PDF
parity smokes).

### Added

- **Show/hide the Want column** on section tables (A5). Mirrors the existing
  Limit toggle, so a table can be Item+Limit+Want, Item+Limit, Item+Want, or
  **Item-only** (names with the category in the header). The item column
  widens to fill freed space.
- **Show/hide column dividers and table/cell borders** (A1/A3) on section
  tables **and** form-field groups. Independent toggles, both default on.
- **Limited / Clearance status icons** on section-table rows (A2), shown
  inline with the item name when enabled.
- **Legend base component** (A4) that explains the Limited/Clearance status
  icons, with horizontal/vertical layouts and editable labels. Right-to-left
  target languages flip the legend's alignment and reading order.
- **Per-row checkbox in the Want column** (A6) as an alternative to the
  blank fill-in space.
- **Show Global Limit** option per section table (B3): rows with no
  item-level limit display the current org-wide Global Limit value in the
  Limit column instead of a blank cell. Resolved live at render time.
- **English in the Translate & Download PDF modal** (B2): English is now a
  selectable export target and takes the identity path (skips translation).
- **Export Settings** panel on the Shopping Lists page (B1): org-wide shared
  configuration for exported-PDF filenames — base names for single vs.
  translated downloads, plus optional template-name / language / date-stamp
  tokens and date position, with a live filename preview.

### Changed

- **All Shopping List text and icons render in pure black** (`#000000`) for
  maximum print contrast, aligning the PDF renderer with the canvas.
- **Default builder component width is now 267pt** (was 270).
- **Enhanced the animated Save icon motion.**

### Fixed

- **Builder translation failures now show a specific, actionable message.**
  A transient AI-provider overload (503 "high demand") during shopping-list
  translation previously surfaced as a generic "unexpected error"; it now
  names the language, explains the condition is temporary, and reassures
  that no work was lost. Curated backend messages are no longer masked by a
  generic frontend fallback.
- **Keyboard arrow keys (and Home/End) now work in text fields** (ISSUES.md
  #37). A global sidebar keyboard-navigation listener was intercepting
  those keys app-wide, even while typing, so the caret couldn't be moved by
  keyboard. It now ignores those keys when focus is in an editable element.
- **Editing names mid-string no longer jumps the caret to the end**
  (ISSUES.md #38). Title-Case enforcement on food-item / category names
  moved from per-keystroke reformatting (which reset the caret) to a
  one-time transform at submit. You can type freely; the name is
  Title-Cased when saved.
- **AI Configuration icon hover triggers** (ISSUES.md #35, #36): the AI
  Model card's icon (type chooser) and the Document Text Translation card's
  icon (Prompt Category step) now animate on hover anywhere over the card,
  matching their sibling cards, instead of only on a direct icon hover.

## [1.0.10] — 2026-05-21

(1.0.9 was bumped during development but never deployed; production goes
from 1.0.8 directly to 1.0.10.)

### Fixed

- **Food Items: editing an item with a status filter active no longer
  crashes the page.** The food-item service returned the raw API envelope
  instead of the inner item, so state held an item without `statusFlags`
  and the next render threw `Cannot read properties of undefined (reading
  'isInStock')`. Create/update now unwrap `.foodItem` like the list path.
- **Find Missing Translations modal** (ISSUES.md #30): the results/action
  card is shown first and the tab bodies scroll, so the action buttons are
  no longer clipped on large results.
- **Shopping List Builder row heights** (ISSUES.md #33): section-table rows
  now grow to fit wrapped item names at all font sizes. The wrap estimator
  reserves slack proportional to cell width (matching real Chromium's
  ~3-5% over-width) instead of a flat 6pt that under-cushioned mid-width
  cells even at 12pt.

### Changed

- **Scroll containers standardized on the shadcn `ScrollArea`** for
  fixed-height regions (ISSUES.md #32); grow-to-fit / nested previews keep
  documented native overflow.
- **14pt section tables are now available in Split-page layout**
  (16-18pt remain Full-page-only).
- In-app version label reads "Version x.y.z" (dropped the stale
  "Pre-Release" prefix now that FEED is on public 1.0.x).

## [1.0.8] — 2026-05-21

### Fixed

- **Shopping List Builder templates and saved components are now shared
  org-wide** (ISSUES.md #31). They were previously partitioned per user
  account, so a template created by one user was invisible to others.
  FEED is a single shared-data environment; the per-user `ownerId`
  column has been dropped from `ShoppingListBuilderTemplate` and
  `ShoppingListBuilderComponent`, and all builder routes now read and
  write one shared set. Existing rows are preserved by the migration
  and become visible to every authenticated user. Requires the
  `20260520000000_drop_shopping_list_builder_owner` migration (applied
  automatically on container start via `prisma migrate deploy`).

### Security

- Removed hardcoded credentials (a legacy example encryption key and the
  legacy Basic Auth password) from tracked docs and a test script,
  replacing them with environment-variable placeholders. Production was
  unaffected — Basic Auth is disabled and the active encryption key
  differs from the removed example value.

## [1.0.0] — 2026-05-19

Initial public release.

FEED has been in production use at William Temple House prior to this
release; v1.0.0 marks the first public, open-source publication under
AGPL-3.0-or-later.

### Features

- **Inventory management** — categories and food items with per-item
  and per-category limits, in-stock / out-of-stock / clearance status,
  and dietary flags.
- **Shopping List Builder** — interactive, canvas-based template editor
  producing printable, multi-page, multi-language shopping list PDFs
  from current inventory data. Guided and Freeform layout modes, a 9pt
  grid system, header/footer page anatomy, split-page bodies, and
  flowing section tables that paginate across lanes and pages.
- **AI-powered document translation** — upload English DOCX files and
  receive translations across 59 languages, with a managed translation
  cache and configurable AI providers (Anthropic, OpenAI, Google) under
  per-configuration cost limits.
- **Multilingual rendering** — correct right-to-left ordering, font
  fallback, and Arabic-script shaping for Arabic, Persian, and Hebrew,
  plus CJK support, in both the in-browser preview and exported PDFs.
- **Dashboards** — translation throughput, cost projections, token
  usage by provider, and response-time monitoring, with comprehensive
  empty-state handling for fresh installs.
- **Magic-link OTP authentication** — passwordless email sign-in.
- **Animated icon system** — motion-driven iconography across action
  menus, palettes, section headers, and dialogs.

### Deployment

- Docker multi-architecture images (amd64 + arm64).
- Reference production deployment: Raspberry Pi 5 + Cloudflare Tunnel.

### License

- Released under [AGPL-3.0-or-later](./LICENSE).
