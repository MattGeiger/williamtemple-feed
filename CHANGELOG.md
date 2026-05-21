# Changelog

All notable changes to FEED are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
