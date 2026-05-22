# Changelog

All notable changes to FEED are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.11] — 2026-05-21

### Fixed

- **Keyboard arrow keys (and Home/End) now work in text fields** (ISSUES.md
  #37). A global sidebar keyboard-navigation listener was intercepting
  those keys app-wide, even while typing, so the caret couldn't be moved by
  keyboard. It now ignores those keys when focus is in an editable element.

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
