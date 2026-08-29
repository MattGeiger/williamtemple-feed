# AGENTS.md

## Purpose

This file is required reading for AI coding agents working in this repository. It captures project-specific context, workflow rules, and lessons learned so future work stays consistent with FEED's established patterns.

This repository is mature and has been shaped through iterative design, user testing, and production deployment. Do not treat it as a blank slate. Inspect first, preserve existing patterns, change incrementally, document milestones, and validate behavior like a user.

## Project Snapshot

- Product: FEED, a food pantry management system for William Temple House.
- Production: deployed through Docker on a Raspberry Pi with Cloudflare Tunnel at `https://feed.williamtemple.app`.
- Repo shape: monorepo with a Vite/React frontend and Node/Express backend.
- Frontend: React, TypeScript/TSX, Vite, Tailwind CSS, Shadcn/Radix UI components, Lucide icons.
- Backend: Node.js, Express, TypeScript, Prisma, SQL database, document and translation services.
- PDF generation: Phase 1/reference generation uses pdfmake. The interactive Shopping List Builder `/preview-pdf` export uses Chromium/HTML-to-PDF so canvas and exported PDFs share browser font fallback, bidi ordering, and Arabic-script shaping. pdfme has been evaluated as UX inspiration, not adopted as the generation engine.
- Root `package.json` is not the app runtime package. Run most commands from `packages/frontend` or `packages/backend`.

## Core Architecture Principle: Shared Whole-Organization Environment

FEED is a single shared-data environment for one organization, not a multi-tenant or per-account product. **Every authenticated user sees and acts on the same dataset.** Inventory (categories, food items, limits, statuses), translations, translated documents, shopping list templates, saved components, AI configuration, and any other feature data are identical regardless of who is logged in. A change one user makes is immediately observed by all users. Authentication exists to gate access to the organization's shared workspace, not to partition data per person.

Implications for any new feature:

- Do **not** add per-user / per-account scoping to feature data — no `ownerId`/`userId` column, no `where: { ownerId: req.auth.userId }` filter, no per-session private copies. Default all feature tables and queries to org-wide shared scope.
- Authentication identity (`req.auth.userId`) is for *gating access* (is the caller logged in?) and audit/attribution, **not** for filtering what data a user can see.
- If a future requirement genuinely needs per-user state (e.g. a personal draft or UI preference), treat that as an explicit, discussed exception — confirm the design with the user first; it runs against this baseline.

This is a hard-won rule. Shopping-list templates and saved components originally shipped with an `ownerId` partition, which sequestered each user's templates behind their own login and broke the shared-environment expectation (one user couldn't see another's templates). That design flaw was removed in ISSUES.md #31 — the `ownerId` column was dropped and all builder routes now read/write one shared set. Keep this precedent in mind: when in doubt, shared is the default.

## Required Reading

Read these before broad changes:

- `README.md` for product and repo overview.
- `CHANGELOG.md` for recent behavior changes.
- `ISSUES.md` for current known issues, priorities, and resolved decisions.
- `docs/frontend-services/message-system.md` for centralized frontend messaging.
- `docs/toast/unified-error-handling.md` for ASK-aligned error handling.
- `docs/frontend-services/theme-control.md` before changing the theme control
  or any themed surface.
- `packages/frontend/docs/components/ui/README.md` for Shadcn/Radix UI usage.
- `packages/frontend/docs/styling/README.md` for centralized styling and theme conventions.
- `docs/layout/page-layout-standard.md` before adding or restructuring any route.
- `docs/layout/table-standard.md` before adding or changing any data table.
- `docs/motion/ICON_ANIMATIONS.md` before adding or changing any icon.
- `docs/reports/service-analytics-plan.md` before changing anything that counts
  households, visits, or people — see "How each kind is counted".
- `docs/reports/analytics-report-architecture.md` before adding or changing an
  Analytics card, because screen, PDF, and CSV share one accessor.
- `docs/layout/assistant-orientation.md` for historical orientation context. Treat `AGENTS.md` as the current source of truth if details differ.

Read these before shopping list work:

- `packages/frontend/src/components/shopping-lists/builder/ShoppingListBuilder.tsx`
- `packages/backend/src/routes/shopping-list-builder.ts`
- `packages/frontend/src/services/shopping-list-builder/index.ts`
- `packages/frontend/src/services/error/ErrorHandlerService.ts`

Read these before deployment, auth, runtime mode, or infrastructure changes:

- `docs/deployment/DOCKER_DEPLOYMENT.md`
- `docs/deployment/deployment-checklist.md`
- `docs/deployment/raspberry-pi-cloudflare-tunnel.md`
- `docs/deployment/troubleshooting.md`

The per-year Link2Feed client exports are measured, not guessed:
`scripts/measure-l2f-client-coverage.ts` points at a directory of real exports
(kept outside the repo) and reports what the union actually covers against the
all-time export's 4,324 matched clients. The arithmetic is in
`services/data-import/l2f-client-coverage.ts` and is unit-tested against
fixtures, because real exports carry PII and are never committed. The all-time
review's verdict — and the 3,344 clients whose ids sit below the file's floor —
is recorded on `link2feed_clients_v1` in `source-contracts.ts`.

Read these before external-data import, Data Management, backup/restore, or
administrator-authority work:

- `docs/data-management/procurement-imports.md`
- `docs/data-management/backup-and-restore.md`
- `docs/auth/administrator-authorization.md`

## Repo Map

- `packages/frontend/src/components` - React feature components and shared UI.
- `packages/frontend/src/components/ui` - Shadcn/Radix UI primitives and wrappers.
- `packages/frontend/src/services` - Frontend API and error/message service layer.
- `packages/frontend/src/index.css` - Central theme, color, and global style tokens.
- `packages/frontend/docs` - Frontend component, state, styling, and feature docs.
- `packages/backend/src/routes` - Express route handlers.
- `packages/backend/src/services` - Backend business logic.
- `packages/backend/prisma` - Prisma schema and migrations.
- `packages/backend/__tests__` - Backend tests.
- `docs` - Project documentation, design decisions, runbooks, and feature plans.

## Core Workflow

1. State whether the change is within established patterns or against them.
2. Explore before editing. Use `rg --files`, `rg`, `ls`, and `sed -n` to understand relevant files and behavior.
3. Verify destination paths exist before editing or adding files.
4. Read existing files before changing them. For related code, inspect the service, component, route, docs, and tests together.
5. Prefer line-based edits with `apply_patch`. Avoid full rewrites unless they are truly safer.
6. Write complete code only. Never leave placeholders, TODO stubs, or partial implementations.
7. Do not revert unrelated work. The worktree may contain user changes or generated files. Work with them or leave them alone.
8. Discuss major architecture, dependency, framework, auth, deployment, or data-model changes before acting.
9. Keep documentation current as milestones are reached. Important behavior changes should update docs and `CHANGELOG.md`.
10. Validate with tests, builds, and browser smoke checks appropriate to the risk.
11. When validation is skipped or blocked, say exactly why and provide a manual test checklist.

For substantial or ambiguous work, start with discovery and synthesis before coding:

- Identify the root cause or design pressure from the code and docs, not assumptions.
- Offer at least three viable approaches with pros and cons when architecture, dependencies, UX direction, or data semantics are involved.
- Recommend one approach and explain why it best fits this project.
- Break implementation into reviewable increments. This project works best when UX can be tested locally before deeper backend logic is made permanent.

## Pattern Rules

Before editing, decide:

- Within pattern: extending existing service, component, hook, route, table, modal, toast, or documentation conventions.
- Against pattern: bypassing centralized services, hard-coding messages, adding one-off styling, replacing established libraries, changing auth/deployment behavior, or adding a new framework/dependency.

If a change goes against a current pattern, stop and explain:

```text
This change goes against the current [pattern name] pattern. Here is why, here are the alternatives, and here is the recommended path.
```

## UI Standards

- Use TypeScript `.ts` and `.tsx`; do not add JSX files.
- **Page layout is fixed.** Every route's root element is exactly
  `space-y-6 min-w-0 w-full pt-6`, with `SectionHeader` as its first child.
  `RootLayout`'s `<main>` already supplies the horizontal padding
  (`px-4 sm:px-6`) and the bottom padding, so a page contributes only the top —
  `p-6` or any `px-*` on a page root double-pads it and insets that route
  further than the rest of the app. The header icon is **static** (from
  `@/components/ui/icons`) because its parent is not interactive; the matching
  sidebar entry uses the animated variant. Full specification, the conforming
  route list, and a one-line measurement check:
  `docs/layout/page-layout-standard.md`.
- **Tables follow one standard**: render through `EnhancedDataTable`, declare
  width once as `size` (the table resolves it for every viewport — never
  compute widths in a column file), sort with `<SortableHeader>` rather than an
  inline button, and declare alignment once as `meta.align` so the header and
  cells move together. Aligning a cell directly is what produced the reported
  Actions offset. Every actions column is labelled `Actions`. There is one
  table component — `EnhancedDataTable` scales down via `enableFiltering={false}`,
  `enableColumnVisibility={false}`, and `emptyMessage`, so a small set is never a
  reason to hand-roll a second `<Table>`. Enforced by
  `src/test/table-standard.test.tsx`; rationale, the column reference, and
  measurements in `docs/layout/table-standard.md`.
- **Dates read as data use `@/lib/formatting/date`** (`formatDate`,
  `formatDateTime`, `formatDateRange`) — `m/d/yyyy`, no leading zeros, locale
  pinned to `en-US` so a browser set to en-GB cannot silently render delivery
  windows day-first. Never write a local `toLocaleDateString` options object.
  Chart axes and prose keep the compact `MMM d` forms.
- Use Shadcn/Radix components from `packages/frontend/src/components/ui` where possible.
- Use Lucide icons for icon buttons when an icon exists.
- Action menu icon convention: use `Pencil` for Rename and `SquarePen` for Edit.
- Use centralized design tokens from `packages/frontend/src/index.css`; avoid hard-coded colors.
- Follow existing layout density and component conventions. This is an operations tool, not a marketing site.
- Use `ScrollArea`, dropdowns, dialogs, alert dialogs, tables, tabs, tooltips, buttons, inputs, labels, and menus consistently with existing Shadcn patterns.
- **Shadcn-first policy.** Always prefer the Shadcn/Radix component for a given UI need over a hand-rolled or native equivalent. Deviations require a clear, written technical justification — e.g. a compatibility requirement tied to a specific dependency that breaks with Shadcn, a documented Shadcn bug, or a collision with explicit design intent. When you must deviate, add an inline comment at the call site explaining why, and prefer fixing inconsistencies *toward* Shadcn rather than introducing new non-Shadcn variants. Do not mix mechanisms for the same job across the app.
- **Scrolling: use the Shadcn `ScrollArea` for fixed-height scroll regions** (dialog bodies, panels, tab panels — anything with a definite height that should scroll when content overflows). **`ScrollArea` height rule:** give it a **definite** height (e.g. `h-[480px]`, `h-[calc(85vh-13rem)]`), never only a `max-h-*` cap. Under `max-h-*` alone the Radix viewport height is unbounded and will not scroll (the root cause behind issues #29a/#30); a definite height bounds the viewport and also settles correctly inside the animate-ui `auto-height` `TabsContents` wrapper.
- **Native `overflow` is an acceptable, documented exception in three cases** (add an inline comment citing the reason; do not silently scatter native overflow elsewhere): (1) it is *built into* a Shadcn primitive (Table, Command, Sidebar, DropdownMenu poppers); (2) a **grow-to-fit** content preview where the content is small/variable and a fixed-height `ScrollArea` would render a mostly-empty box (use `max-h-*` + `overflow-auto`); (3) a **nested** scroll box already inside a `ScrollArea`, where a second `ScrollArea` would trap scrolling. The audit + rationale for each current exception is in ISSUES.md #32.
- Do not add visible instructional copy to compensate for unclear interactions. Improve the interaction.
- Dark mode must not corrupt print previews. Anything representing printed output should render independently from app theme colors.
- **The theme control is a two-state toggle, not a three-state picker.** The
  header button switches to the opposite of what is on screen, and clears the
  stored override when that opposite is what the device would have given —
  so "follow this device" is arrived at rather than offered. The deliberate
  three-way choice lives in Settings → Appearance, which labels itself *this
  device only* because appearance is browser-local and not organization shared
  state. **The three-state CSS model is unaffected and must stay**: every
  themed surface still has to render correctly with no stamp on the root
  element (where only `prefers-color-scheme` applies), with `.light`, and with
  `.dark`. Rationale and the accessibility contract:
  `docs/frontend-services/theme-control.md`.

## Error and Message Standards

Messages are centralized. Do not scatter one-off strings through components when the established error/message service should own them.

- Frontend message architecture: `packages/frontend/src/services/error/ErrorHandlerService.ts`
- Toast context: inspect existing toast/message hooks before adding new behavior. `messageService` (`packages/frontend/src/services/message`) supports an `action` button (`{ label, onClick }`); use it for actionable error toasts instead of hand-rolling `ToastAction`.
- `BaseApiService.request` throws an `ApiError` (`packages/frontend/src/services/base`) for non-2xx responses. It extends `Error` (so `.message`-only consumers are unaffected) and also carries `status`, `code`, and `details` (the server's structured `error` object). When a flow needs to branch on a specific server error -- e.g. the duplicate-food-item-name conflict -- have the backend route return `error: { message, code, ... }` and check `err instanceof ApiError && err.code === '...'` on the client rather than string-matching the message.
- When the same dialog/flow is reused on multiple pages (e.g. the shared "Add New Item" dialog used by Food Item Management AND the Shopping List Builder), put the error-notification logic in a shared service-level helper, not in each page. See `packages/frontend/src/services/food-item/duplicate-name-notification.ts`: it owns the duplicate-name toast (including the "Mark In Stock" action) and the food-item data hook suppresses its generic toast for that case so the two never stack.
- Follow ASK:
  - Actionable: tell the user what to do.
  - Specific: name the thing that failed or needs attention.
  - Kind: be helpful and calm.

Avoid vague messages such as:

```text
An error occurred
Something went wrong
Failed to load data
```

Prefer messages such as:

```text
Unable to save the template. Check your connection and try again.
Template names must be 48 characters or fewer. Shorten the name before saving.
```

## Shopping List Generator Context

The shopping list generator is being developed incrementally.

- Phase 1: procedural PDF regression completed. A CLI/backend path generates a PDF from SQL inventory data and matches the reference document closely.
- Phase 2: component-building UX completed. Users can add, drag, select, duplicate, delete, preview, and download printable canvas components.
- Phase 3: persistent configuration completed. Users can save reusable components and retrieve them across sessions.
- Phase 4: shopping list template generation completed and hardened. Users can apply saved templates and inventory-derived sections to the canvas, then generate PDFs from current data.
- Phase 5: in progress. The Guided/Freeform layout-mode toggle, 9pt grid overlay (chosen because Letter paper, page center, and split-body lanes all land on grid lines under 9), 18pt section-table row rhythm, snap-to-grid for drag/drop/add/duplicate/insert, header/footer page-anatomy guides, explicit Header/Body/Footer component regions, split-body controls, Guided collision placement, table flow metadata, print presets, and planner-backed Body sequencing are landed. Flowing body section tables now split by whole rows across split lanes/pages and repeat headers; non-flowing Body components now receive single planned placements in the same sequence. Canvas preview and Chromium PDF export render the same plan. Remaining Phase 5 scope: overflow-control UX, alignment/distribution controls, additional split-page rules, multi-page editing affordances, and RITE-based UX refinement.

Important product principle: the goal is not merely to dump inventory data into PDFs. The goal is to empower Social Services staff to build reusable templates and control how inventory content is represented while keeping data-derived values accurate.

Inventory limits are food equity controls. They regulate per-client burn rates for high-demand items. Inventory-backed shopping list tables should derive limit values from the inventory database. If a user edits an inventory-backed limit in the builder, that edit should update the underlying Food Item or Category record rather than becoming disconnected template text.

## Shopping List Technical Notes

- Builder UI: `packages/frontend/src/components/shopping-lists/builder/ShoppingListBuilder.tsx`
- Builder types: `packages/frontend/src/components/shopping-lists/builder/types.ts`
- Default template: `packages/frontend/src/components/shopping-lists/builder/default-template.ts`
- Frontend service: `packages/frontend/src/services/shopping-list-builder/index.ts`
- Backend routes: `packages/backend/src/routes/shopping-list-builder.ts`
- Backend tests: `packages/backend/__tests__/features/shopping-lists/shopping-list-builder.test.ts`
- Saved template table columns: `packages/frontend/src/components/shopping-lists/data-table/builder-template-columns.tsx`
- Food icon registry (frontend): `packages/frontend/src/lib/food-icons.ts` — source of truth for all 95 category icons
- Shared icon SVG paths (backend): `packages/backend/src/lib/icon-svgs.ts` — exports `FOOD_ICON_SVG_PATHS: Record<string, string>` for PDF export
- Icon SVG generator script: `packages/backend/src/lib/generate-icon-svgs.cjs` — run this when icons are added or removed from `food-icons.ts`
- Typography engine (backend): `packages/backend/src/lib/builder-typography.ts` — exports `BUILDER_FONT_SIZES`, `baseRowHeight`, `taggedHeaderHeight`, `untaggedHeaderHeight`, `snapHeightToGridForFontSize`, `estimateWrappedLineCount`, line-height and padding constants
- Typography engine (frontend mirror): `packages/frontend/src/components/shopping-lists/builder/typography.ts` — byte-equivalent mirror of the backend module (same duplication pattern as `icon-svgs.ts`). The two **must** stay in sync; if you change one, change the other in the same commit
- Builder translation service: `packages/backend/src/services/builder-translation.ts` — exports `lookupBuilderTranslations`, `translateBuilderStrings`, and the `BUILDER_TRANSLATION_TYPE = 'Generated (List)'` constant. Wraps the existing `AIServiceFactory.translateTextBatch` primitive and writes to the generic `Translation` table.
- Builder translation routes: `POST /api/shopping-list-builder/translation-preflight`, `POST /api/shopping-list-builder/translate-missing-strings`, and the optional `targetLanguage` body parameter on `POST /api/shopping-list-builder/preview-pdf`.
- Builder translation UI: `packages/frontend/src/components/shopping-lists/dialogs/translate-and-generate-dialog.tsx` (multi-step modal) and the "Translate & Download PDF" entry in the saved-template row menu.

**Icon parity rule**: The canvas preview uses `lucide-react` React components directly. The PDF export renderer assembles raw SVG strings using `FOOD_ICON_SVG_PATHS` from `icon-svgs.ts`. When you add or remove icons from `food-icons.ts`, you **must** also regenerate `icon-svgs.ts` by running:
```bash
node packages/backend/src/lib/generate-icon-svgs.cjs
```
Failing to do so will cause silent icon fallback (to `package`) in PDF export while the canvas preview shows the correct icon.

**Translation rules**: The Shopping List Builder's render-time translation uses the generic `Translation` table with `type = 'Generated (List)'` -- a value reserved for this pipeline and kept distinct from `'Generated'` (DOCX), `'Custom'`, `'FoodItem'`, and `'Category'`. Slice 1 covers only the text component's `content` field; the helper `extractBuilderTranslatableStrings` in the builder route is the single point where translatable strings are enumerated, and any future slice (form-field labels, section-table strings, inventory-backed names, computed category-limit tag, date formatter) extends that helper. Inventory-backed Category and FoodItem names should NOT route through `'Generated (List)'` -- they have their own denormalized `CategoryTranslation` / `FoodItemTranslation` tables that the `translation-trigger` service keeps populated, and Slice 4 of the translation initiative will read from those tables directly. Those denormalized tables can have gaps (a translation added before a language was enabled, or via a path that only wrote the generic `Translation` table), so `lookupInventoryBuilderTranslations` queries the denormalized tables first and then falls back to the generic `Translation` table by English name (`type` `FoodItem` / `Category`) for any inventory id still missing -- denormalized rows win when both exist. This is the one place inventory names touch the generic table, and only as a read-side backstop. The `translateBuilderStrings` service is synchronous from the caller's perspective: it returns when the AI provider call has completed and the cache has been populated. Missing translations at PDF render time silently fall back to English; the Generate Translated List modal's pre-flight step is the place that surfaces missing translations to the user.

**Per-component translation mode**: Text components persist an optional `translationMode` field on the template. The `BuilderTranslationMode` union is `'skip' | 'translate' | 'translate-with-original' | 'translate-with-original-block' | 'translate-with-original-adaptive'` and is declared in BOTH the frontend `types.ts` and the backend route module -- they MUST stay in sync if you add a new mode value. Default (undefined) is `'translate'` for text components so legacy templates produce the same translated output as before this field existed. `'skip'` excludes the component from both preflight counts AND render-time substitution -- such components always render in English regardless of the requested target language. `'translate-with-original'` renders the cached translation followed by an inline 8pt bold English tag (just the English text in 8pt bold, separated from the translation by a single space; no literal carat or markdown sigils) that wraps word-by-word. `'translate-with-original-block'` is identical except the 8pt bold English tag is placed on its own line beneath the translation. `'translate-with-original-adaptive'` is inline like `translate-with-original` but the English tag is one unbreakable unit (`white-space: nowrap` in the renderers; an `atomic` segment flag in the wrap-measurement helpers) -- it stays on the translation's last line when it fits and otherwise drops whole onto the next line (binary placement, never split mid-tag). All three `-with-original` variants are surfaced in the Form Fields translation control and the section-table Rows tab; the shared renderers (`renderTranslatedBuilderText` / `renderTextBody` frontend, `translatedBuilderTextHtml` backend) support every mode for any component. On cache miss, all `-with-original` modes fall back to the original alone (the tag would be redundant). The mode is set via the "Translation Settings" button in the Properties panel. Section tables (inventory-backed AND base-component) use `translationSettings` (Headers / Tags / Rows) instead of a single `translationMode`; the Rows default is `'translate-with-original-adaptive'` (see `DEFAULT_INVENTORY_SECTION_TRANSLATION_SETTINGS`, mirrored frontend + backend). The section-table settings dialog exposes the two placement variants (`-block`, `-adaptive`) on the Rows tab only -- Headers and Tags are short single words and keep the three base modes. Base-component section-table titles and row items route through the `Generated (List)` cache while inventory-backed titles/rows resolve from the denormalized `CategoryTranslation` / `FoodItemTranslation` tables. The four extraction/render code paths that must stay in sync for section-table strings are: `extractBuilderTranslatableStrings`, `sectionTableComponentHtml` (backend renderer), `PreviewSectionTable` (canvas), and the `sectionTableTitleSegments` / `sectionTableRowItemSegments` measurement helpers (mirrored frontend + backend). The `atomic` flag on `BuilderTextMeasureSegment` (both packages) and its handling in `estimateWrappedSegmentLineCount` (both packages) must also stay in sync.

**RTL layout mirroring**: When the active preview/target language is right-to-left (Arabic, Persian/Farsi -- see `isRTLTargetLanguage` backend / `isRTLLanguage` frontend, both pattern-based), section tables and form-field groups render with `dir="rtl"` on their grid container. CSS grid auto-reverses the column order under `dir="rtl"` (section tables become `Want | Limit | Category`, form-field groups put the label column on the right), so do NOT hand-reverse columns or column widths. Cell dividers MUST be a PHYSICAL border (`border-left` / `border-right`, `border-l` / `border-r`) whose edge is chosen explicitly from the table's direction -- frontend via an `isRtl ? 'border-r' : 'border-l'` class, backend via a `[dir="rtl"] .builder-table-cell-left-border { ... }` descendant override. Do NOT use a logical `border-inline-start` / `border-s` for these dividers: the Limit / Want / label cells carry `dir="auto"` + `unicode-bidi: plaintext` for text shaping, and a logical border resolves against the CELL's OWN content direction -- a digit limit value or an untranslated "Limit" header reads as LTR, which flips the divider to the wrong edge and stacks both dividers on the same side. (A physical border is direction-agnostic; the `[dir="rtl"]` ancestor selector / `isRtl` flag carries the table direction instead.) `text-align: start` over `text-align: left` and `padding-inline-start` over `padding-left` are still correct for cell content alignment because content SHOULD follow its own direction. Text and date components rely on `dir="auto"` for content-direction detection and need no explicit RTL handling. RTL support is canvas + Chromium PDF; validate language changes with a rendered-PDF smoke (see Testing and Validation).

**Typography rules**: All Shopping List Builder body components (text, date, form-field-group, section-table) share one font-size dropdown sourced from `BUILDER_FONT_SIZES = [10, 10.5, 11, 12, 14, 16, 18]`. Row heights and tagged-header bands come exclusively from the typography engine — do not add new ad-hoc `× 13.5pt` or `× 1.06` formulas. The CSS line-height multipliers (`BUILDER_LINE_HEIGHT_MULTIPLIER = 1.18` for body cells / column headers, `BUILDER_TAGGED_HEADER_LINE_HEIGHT_MULTIPLIER = 1.3` for stacked title + tag) and `BUILDER_CELL_VERTICAL_PADDING_PT = 1.5` are tuned together so the rendered content height equals the computed row height with non-zero slack at every supported font size. If you change one of these constants you may break the schedule; re-verify by running the typography unit tests and the inventory-section height tests in `shopping-list-builder.test.ts`. Section-table sizes above 12pt are gated to Full-page layout — when `bodyLayoutMode === 'split'` the dropdown shows 14–18pt as muted entries with a tooltip explaining the constraint. 20pt was evaluated and removed because the 27pt row left only 0.4pt of subpixel slack; if a future need arises it would require either a 36pt row (schedule change) or tightening the body line-height further. Wrapped item names, wrapped category titles, and wrapped form-field labels all expand their row to `baseRowHeight(fontSize) × lineCount`; that math is in `tableRowHeight`, `tableHeaderHeight`, and the form-field-group branches of both `getComponentHeight` (frontend) and `getNonFlowingBodyHeight` (backend) — keep those four paths in sync.

Current builder expectations:

- Base Components, Inventory Sections, and Saved Components should support both click-to-add and drag-and-drop.
- Inventory-backed section tables are Body-only components. They must not offer Header/Footer placement, and stale saved-template data that marks them as Header/Footer should resolve back to Body before preview or PDF export.
- Saved Templates should be easy to discover and apply from the builder.
- Saved template names are capped at 48 characters.
- Saved template saves should update the active saved template. If no active saved-template identity exists, saving with the same normalized name should update the newest matching saved template instead of creating a duplicate.
- Preview canvas output should visually represent printed pages, not the app theme.
- Selected table rings should draw outside and above table content.
- Saved component management should support create, read, rename/edit, and delete. Same-name saves should update the newest matching saved component instead of creating duplicates. The Update action should only apply when the selected canvas component is the one inserted from a saved component for editing; selecting another canvas component must return to Save Selected Component behavior.
- Undo should protect users from common canvas mistakes.
- Guided is the default layout mode. Guided renders a 9pt grid overlay and snaps drag, drop, palette adds, duplicates, and saved/inventory inserts to the grid. Freeform preserves absolute placement and hides the grid. The X/Y inputs in Properties stay un-snapped so users have a precision escape hatch in either mode.
- The grid quantum is 9pt, not 8pt. Letter paper (612 × 792) and the page center (306) are all 9-multiples; 8pt left a partial column on the right edge of the paper and put the page center between grid lines. When changing builder defaults that affect lines or measurements (header, footer, body column gap, snap thresholds, table row heights, etc.), pick 9-multiples so they sit on grid lines.
- Section-table `rowHeight` defaults to 18pt so title rows, normal body rows, component boxes, selected rings, and Guided collision placement all share the same 9pt rhythm. Multiline item or limit rows expand to 36pt. Keep manual defaults, inventory-backed defaults, fixed PDF rendering, and flowing pdfmake table heights aligned when changing this behavior.
- Tagged section-table headers (category name + category-limit tag) use a compact 13.5pt line basis and snap the final measured header height to a 9pt band. The common title + tag case is 27pt. This prevents the previous `+1pt` drift where 28pt tagged headers made each tagged table height `1 mod 9` and shifted every following flowing-table start farther off-grid.
- Header and footer guides are page anatomy and render in both layout modes. Fresh Create Template sessions start from a blank canvas with Guided Mode, Split page, a 54pt header, and a 36pt footer. The Properties card always shows a Page Setup sub-panel at the top with Header and Footer inputs that snap on commit (blur or Enter) in Guided mode and clamp to leave at least 27pt of body. Setting a dimension to 0 hides the corresponding magenta line. Older saved templates without these fields fall back to the default getters; explicit 0 means user-disabled.
- Section-table component boxes measure exactly to their rendered content; the previous 8pt padding hack on table component boxes has been removed. Selection rings draw a symmetric 3pt inset around any selected component.
- Components can belong to `header`, `body`, or `footer` regions. Region membership is semantic, not only geometric: header/footer components are intended for repeated page anatomy, body components are intended for flowing content. Movement and insertion should clamp components to their assigned region in both Guided and Freeform mode.
- Body layout can be `full` or `split`. Split mode renders a green vertical center guide and, in Guided mode, body components are clamped and collision-placed inside their current left/right lane. Freeform keeps overlap-friendly absolute placement.
- Builder templates carry `maxPages` (1-5) and `printMode` (`single-sided` or `two-sided-duplicate`). The two-sided preset is an output behavior, not a canvas mutation.
- Canvas zoom is recalibrated. Zoom state is the user-facing percentage (slider 70-200%, step 5, default 100%). The page transform multiplies the percentage by `CANVAS_ZOOM_SCALE_FACTOR = 1.2`, so 100% renders at `scale(1.2)` and is the new "Full page" anchor (the previous 120% mark). The Canvas controls expose two presets: "Full page" (snap back to 100%) and "Page width" (compute the displayed percentage from the canvas viewport's `clientWidth` minus a 24pt margin). PDF export is unaffected because export uses absolute pt positions; do not divide by the canvas transform when computing PDF coordinates.
- In Guided mode, all Body components participate in sequence planning. Section tables marked `flowing` split by whole rows across split lanes/pages and repeat headers on each segment; non-flowing Body components (text, date, form fields, lines, fixed tables, base components, and saved components) receive one planned placement and move as a whole to the next lane/page when needed. Dragging a planned Body component reorders `template.components` instead of relying on stored x/y. Freeform keeps absolute positioning for non-flowing Body components. The older pdfmake flowing/snaking-column export path remains disabled; pdfmake is reference behavior only unless canvas/PDF parity and multilingual rendering are re-proven.
- Shopping List Builder canvas preview and PDF export use repo-owned Noto assets: Noto Sans (4 weights), Noto Sans Symbols, Noto Sans Symbols 2, Noto Naskh Arabic, and Noto Sans Hebrew. This covers common symbols, accented Latin, Greek, Cyrillic, Arabic/Farsi RTL, and Hebrew RTL in the builder path. Backend font files live in `packages/backend/assets/fonts/noto-sans`; browser preview font files live in `packages/frontend/public/fonts/noto-sans`. The Docker runtime copies backend assets into `/app/assets`. Both directories include the SIL OFL `LICENSE_NOTO`.
- The builder export endpoint intentionally uses Chromium/HTML-to-PDF rather than pdfmake text nodes. Earlier font attempts failed because browser preview had CSS/system font fallback while pdfmake used only the selected document font, did not automatically fall back to registered sibling font families, and did not perform browser-grade bidi ordering for RTL text. Do not declare font/language work complete until a generated PDF is rendered to an image and visually inspected.
- Remaining font caveats:
  - **Color emoji**: not supported in the builder export path yet; it would require emoji-specific handling and visual validation.
  - **CJK (Chinese / Japanese / Korean)**: supported. Noto Sans SC / JP / KR variable fonts live in `packages/backend/assets/fonts/noto-sans-cjk/` (~36 MB combined) and are conditionally inlined as data URLs in the Chromium PDF render only when the active `targetLanguage` matches the `CJK_LANGUAGE_PATTERNS` set in `shopping-list-builder.ts` (Chinese, Mandarin, Cantonese, Japanese, Korean — case-insensitive). English and other Latin / RTL renders skip the CJK payload entirely. The CJK family names sit at the end of `BUILDER_HTML_FONT_STACK` so non-CJK glyphs continue to come from Noto Sans / Naskh Arabic / Noto Sans Hebrew first; Chromium silently skips an unloaded family. If you ever need to render a CJK glyph in an English template (e.g. a clinic name with a Chinese character), set the preview language accordingly so the CJK fonts load.
  - **Other scripts**: add script-specific Noto fonts and rendered-PDF smoke cases before claiming support.

## Testing and Validation

Use targeted validation first, then broaden based on risk.

Common commands:

```bash
cd /Users/russbook/williamtemple-feed/packages/frontend && npm run build
cd /Users/russbook/williamtemple-feed/packages/frontend && npm test
cd /Users/russbook/williamtemple-feed/packages/backend && npm run test:shopping-lists
cd /Users/russbook/williamtemple-feed/packages/backend && npm test
```

When validating the Phase 1/reference pdfmake generator locally, use a Node runtime compatible with pdfmake/fontkit embedded TTF parsing. Node 20/24 have worked in this project; Node 23 has produced `Unknown font format` failures with embedded fonts. In the current macOS setup, this command has been used successfully:

```bash
cd /Users/russbook/williamtemple-feed/packages/backend && PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:shopping-lists
```

Development servers typically run as:

```bash
cd /Users/russbook/williamtemple-feed/packages/backend && npm run dev
cd /Users/russbook/williamtemple-feed/packages/frontend && npm run dev
```

Expected local ports in recent work:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

**Port discipline:** The user's active dev server runs on port 5173, served from the root repo at `/Users/russbook/williamtemple-feed/packages/frontend/`. All file edits must target that path. Even when Claude Code opens a session inside a git worktree (e.g. `/Users/russbook/williamtemple-feed/.claude/worktrees/<name>/`), the user's browser still points at port 5173. Write files to the main repo path (`/Users/russbook/williamtemple-feed/packages/frontend/...`), not the worktree mirror. Never start a second Vite process on a different port — the user cannot see changes served on any port other than 5173, and the worktree's preview server (if one starts automatically) is invisible to the user's active browser session.

**Authentication wall:** The application uses magic-link OTP authentication. There is no dev bypass. Frontend-only testing is never sufficient — the auth flow requires the backend to be running. When browser smoke testing reaches the login page, ask the user to complete authentication; do not attempt to bypass it or treat a login-screen screenshot as evidence that the change works. Once the user confirms they are authenticated, use the preview browser at port 5173 to observe the change in context.

For frontend UX changes, build-only validation is not enough. Click through the workflow like a user. Use the in-app browser when available; if the active browser pane is unavailable, use a headless browser smoke test as a fallback and state that fallback clearly.

For Shadcn/Radix dropdown-to-dialog workflows, explicitly smoke test the full state transition: open the dropdown, choose the dialog-launching action, close the dialog, and confirm the UI is still clickable. Check that no visible menu/dialog/popper remains and that `document.body.style.pointerEvents` is not stuck at `none`.

For Shopping List Builder changes, validation must include a real PDF export check. Download or generate the PDF from `/shopping-lists/builder`, render it to PNG with Poppler (`pdftoppm`) or another visual renderer, and compare it against the canvas preview for layout, spacing, table placement, header/footer boundaries, split-page behavior, and legibility. Backend tests that only assert a `%PDF` response are not enough for this feature.

For font, symbol, and language changes, include a rendered PDF smoke case with content such as `Please turn paper over →`, accented Latin, Greek, Cyrillic, Arabic/Farsi RTL, and Hebrew RTL text. Do not assume success from text extraction or embedded font names; visually inspect rendered pages because unsupported glyphs can appear as boxes, disconnected letters, reversed word order, or incorrect punctuation.

Manual validation checklists should be short and task-specific. For shopping list builder changes, usually include:

- Log in locally.
- Open `/shopping-lists/builder`.
- Add each component type by click and drag.
- Save, rename/edit, delete, and re-add saved components.
- Apply a saved template from the dropdown.
- Download/export the PDF, render it visually, and confirm the PDF matches the canvas preview.
- Toggle light/dark mode and verify printed-page preview remains readable.

## Local Development Environment

The active working repo is `/Users/russbook/williamtemple-feed`.
(`/Users/russbook/wth_app_clean` is a **retired** old checkout kept warm
for operational reference only — do not edit or run it, and never `git
push` from it.)

**Running locally (no Docker):** dependencies and the Prisma client are
already installed in each package. You need two gitignored env files and a
`dev.db`:

- `packages/backend/.env` — at minimum: `DATABASE_URL="file:../dev.db"`
  (SQLite path resolves relative to `prisma/schema.prisma`, so this is
  `packages/backend/dev.db`), `NODE_ENV=development`, `PORT=3001`,
  `JWT_SECRET` (any 64+ char value), `JWT_EXPIRES_IN="7d"`,
  `APP_URL="http://localhost:5173"`, `COOKIE_DOMAIN=""` (empty = host-only
  cookie, which is what works on localhost; the prod `.williamtemple.app`
  value breaks local cookies), and `FORCE_AUTH=false`. Resend keys are
  **not** needed locally (see auth note).
- `packages/frontend/.env` — `VITE_API_BASE_URL=http://localhost:3001`.
- Initialize the DB: `cd packages/backend && npx prisma migrate deploy`
  (creates `dev.db` with all migrations and their indexes/constraints).
- Run: backend `npm run dev` (ts-node-dev, :3001), frontend `npm run dev`
  (Vite, :5173).

**Auth in dev is subtle.** `FORCE_AUTH=false` makes the *backend* skip auth
(`auth-middleware.ts` calls `next()` when `NODE_ENV==='development' &&
FORCE_AUTH!=='true'`), but the **frontend still gates the UI** on
`GET /api/auth/session` reading the `auth_token` cookie — so a fresh
browser still lands on the login screen. To get past it without Resend:
either (a) seed a known OTP and POST `/api/auth/otp/verify` (the code is
stored **hashed** — `sha256` of the code, no secret — so insert a
`VerificationToken` row with `token = sha256('123456')`, `type='otp'`,
future `expires`, then verify to get the real cookie), or (b) mint a JWT
locally (`{ userId, email }` signed with the local `JWT_SECRET`; the
middleware only verifies it, no DB lookup) and set it as the `auth_token`
cookie. Both are valid logins, appropriate for local smoke testing — not
production bypasses.

**Preview/smoke browser** (the `Claude_Preview` MCP) attaches to the
running Vite server via a gitignored `.claude/launch.json`
(`runtimeArgs: ["--prefix","packages/frontend","run","dev"]`, `port:
5173`). It's a separate browser context, so it has no cookie until you
authenticate it as above. Use `preview_resize` for mobile/desktop ratios
and `preview_eval` for DOM checks (e.g. confirming a `ScrollArea`
viewport is bounded: read `[data-radix-scroll-area-viewport]`'s
`scrollHeight` vs `clientHeight`).

**Seeding.** `npm run seed` (`scripts/seed-all.ts`) is the canonical seed
(GlobalLimit, 59 languages, 3 system prompts, 8 categories, ~70 food
items) — all `upsert`, idempotent, but it **resets** inventory states
(stock, limits) and enabled languages to seed defaults, so don't run it if
you've loaded real states you care about. `scripts/seed-system-prompts.ts`
seeds *only* `SystemPrompt` (additive), but has a latent implicit-`any`, so
run it `npx ts-node --transpile-only -r dotenv/config
scripts/seed-system-prompts.ts`.

**Loading production data locally:** copy the whole `production.db`, or
import a `sqlite3 .dump <tables>` extract. ⚠️ **`.dump <table>` does NOT
emit the table's unique indexes** — after a table-scoped import, Prisma
`upsert` fails with `ON CONFLICT clause does not match any PRIMARY KEY or
UNIQUE constraint`. Recreate the unique indexes from the consolidated
migration (`Category_nameSearch_key`, `FoodItem_nameSearch_key`,
`CategoryTranslation_categoryId_language_key`,
`FoodItemTranslation_foodItemId_language_key`, `Language_name_key`, etc.)
after such an import. Prod data also carries the encryption key + encrypted
AI provider keys; for inventory/UI work, import only the inventory tables
and avoid moving secrets onto the dev box.

## Dependency Rules

Discuss new dependencies before installing them unless the user has already approved the direction. Include tradeoffs and why the dependency fits the existing stack.

Known dependency note: backend installs may surface an npm peer conflict involving `zod` v4 and the OpenAI package's optional `zod` v3 peer range. `--legacy-peer-deps` has been used for `pdfmake` after this conflict was identified as pre-existing. Do not normalize broad dependency churn without explicit reason.

## Database and Auth Changes

Be careful with anything that weakens authentication or changes database semantics.

- Local login may require the backend server to be running.
- Do not add a localhost auth bypass unless the user explicitly approves the design and the bypass is impossible to enable in production by accident.
- Prisma/schema changes need migration awareness and backend tests.
- Food inventory data is operationally meaningful; do not treat limits, statuses, or category relationships as cosmetic fields.

## Operational Analytics Direction

`docs/reports/operational-analytics-design.md` is the current source of truth
for analytics, optional Food Item Supply annotations, operational-history
sampling, exports, and future source ingestion. The July 2026 price/burn/
replenishment implementation is a prototype; do not revive its product claims
without a new explicit decision.

Key constraints:

- Availability, Limited Supply, Clearance, and item/category limit changes are
  authoritative operational observations. Do not infer their unobserved cause.
- Food Item estimated quantity and supply source are optional annotations.
  Never require them, sum unlike quantities, infer consumption, calculate burn
  or days of cover, or project stockout.
- Mark Out of Stock is a one-action availability change and never changes or
  requests quantity.
- Preserve raw append-only events. Apply the centralized versioned correction
  window only in analytics; never debounce or rewrite ledger writes.
- The Global Limit is a printable-list fallback, not evidence of item/category
  rationing.
- External imports remain separate from the service catalog unless a future
  approved mapping design says otherwise.
- OFB imports are parsed in memory and the source CSV bytes are discarded after
  the request. Persist normalized observations, provenance, revisions, and calm
  data-quality warnings—not the uploaded file.
- Procurement revisions are grouped by the stable OFB source order reference;
  multiple source orders on one receiving date are normal. The revision hash
  excludes source row order, and a corrected receiving date remains a revision
  of the same source order.
- Preserve procurement channels. The **source reference suffix** classifies the
  event: references ending `AGPCKUP` are Fresh Food Alliance receipts, all other
  OFB references are Warehouse orders. Product-code prefixes are supplier
  catalog metadata and never determine an event's channel — the `4xxxx` rule
  described here through schema v3 was disproved by the direct-export corpus.
  Combined totals may aggregate channels, but filtered views must not silently
  merge them.
- Grocery partner identity is **received, never inferred**. The Agency Pickups
  export (extension v1.2.0) reports donor code and name directly; the Completed
  Orders export does not. FEED records what OFB reports and never derives a
  partner from dates, reference numbers, category mixes, or operational history.
- The same Fresh Alliance events appear in both OFB exports under **disjoint
  identifiers**. Never join them by rank, offset, or content fingerprint — the
  source system does not publish a mapping, and both heuristics are refuted by
  the corpus. See `docs/data-management/procurement-unification-plan.md`, which
  is the North Star for procurement ingestion work.
- OFB order-level fees and grants are not attributable to the product row on
  which the exporter places them. When a channel or acquisition filter divides
  an order, report those adjustments as unavailable rather than allocating
  them.
- Stale procurement data means the latest active delivery is more than 30
  calendar days old in the configured organization timezone. It is a prompt to
  refresh the import, not a data-quality or staff-performance score.

The prototype left reusable report/export infrastructure intentionally dormant
(registry/selection/templates, binary downloads, CSV/ZIP/PDF/SVG rendering,
Chromium, range/timezone helpers). Treat this as explicit technical debt.
Audit it at every analytics milestone and release boundary: connect it to a
validated feature with focused tests, keep it isolated and documented, or
prune it. Do not grow dormant domain-specific calculations solely to preserve
prototype code.

The active operational exploration route is `/analytics` under Inventory.
`/reports` under Information is currently a nonfunctional Reports Management
placeholder. Do not wire the dormant template manager, selection provider,
generation dialogs, or prototype export pipeline into that route without an
explicitly approved report-template contract.

For local report evaluation, the deterministic 90-day fixture is documented in
`docs/reports/development-history-fixture.md` and generated by
`packages/backend/scripts/seed-operational-history.ts`. It may modify only a
development database, requires its explicit confirmation flag, and must never
be run in production. Its OFB-derived weekly presence signals are descriptive;
do not reinterpret them as quantities, consumption, or causal mappings.

## Service and Client Analytics Direction

`docs/reports/service-analytics-plan.md` is the source of truth for the Service
lens; `docs/reports/service-analytics-card-proposal.md` records which cards were
built, which were held back, and the staff answers that unblocked them. Shipped
in 1.5.0-beta.19 with eight cards.

**Service** describes what happened on a service day; **Clients** describes who
the people are. They are separate lenses because they answer separate
questions — a household-size distribution and a count of turned-away households
are not the same kind of fact. Clients reads the same Service payload today,
under its own `clients` key, because the Link2Feed and SIMC client exports are
not imported yet; when they are, the payload changes and the card ids do not.
Both are range-scoped: client cards join demographics to encounters through the
client id, so a date range still means something on the Clients tab.

Service draws on two records that describe the same pantry days and **begin
years apart** — formal intake (Link2Feed from 2020, SIMC
after the June 2026 cutover) and the Service Log, WTH's own end-of-day count,
kept since October 2023.

- **Never sum the two records.** Where both can answer a question the Service
  Log wins, because a hand-counted total does not depend on every client
  completing intake. A card must say which record produced its figure.
- **An anonymous visit is a household.** `identity_unavailable_encounter` rows
  carry a null `clientId` because the source recorded no client id — the
  identity is missing, not the household. Each counts as one household,
  **undeduplicated**. Never reach for `COUNT(DISTINCT "clientId")` alone for a
  household figure: it skips nulls and silently drops 4,506 visits, understating
  2023 by 12.7%. See the counting table in the plan doc.
- **Test the record kind, not the null.** `special_event_people_aggregate` rows
  also have a null `clientId` and must never become households — one of them is
  a 264-person Thanksgiving clicker count.
- **Visits per household stays identified-only**, and is the sole exception. An
  anonymous row says nothing about returning; folding those in drags the average
  toward 1 and reports a recording artefact as behaviour.
- **Absence is not zero.** A series carries `defined: false` where its record
  does not reach, so a line begins where its record begins rather than running
  along the axis for years it did not exist. In CSV that is an empty cell. The
  inverse is also settled: a Service Log day with a blank turned-away entry **is**
  a zero, confirmed by staff.
- **Drop the unfinished month** from monthly charts and name it. A partial month
  beside complete ones reads as a collapse that did not happen.
- **A comma is not reliably a separator in SIMC.** The export joins multiple
  answers with a comma *and* has four category names containing one, so a naive
  split shreds them — "Hispanic, Latino, or Spanish" became three answers, and
  a race breakdown reported "or Spanish" as a race. The delimiter cannot be
  changed, because "Asian, Chinese" really is two answers. The adapter holds
  known comma-bearing labels aside before splitting
  (`SIMC_LABELS_CONTAINING_COMMAS`); extend that list when SIMC adds a category
  with a comma, and treat values arriving as obvious sentence fragments as the
  symptom. Link2Feed is unaffected — it uses ` / ` inside labels and `,`
  between them.
- **Data already stored under a parsing bug needs re-importing.** Fixing an
  adapter fixes the next import, not the rows already written. **Re-import; do
  not scrub first, and prefer it over the repair script.** A re-import
  reproduces exactly what the fixed adapter produces, where a repair
  *reconstructs* from damaged rows.
  - It supersedes rather than duplicates. Revisions are keyed on `(source,
    sourceRecordKey)`, and `refreshCurrentEncounters` / `refreshCurrentProfiles`
    in `import-lifecycle.ts` clear `isCurrent` across the key then re-set it on
    the highest revision from an *active* import. Every demographics query
    joins responses through their revision under `p."isCurrent" = 1`, so
    corrupted responses stop being visible the moment the new revision lands —
    nothing has to delete them.
  - **The safety condition is that the key derivation did not change.** SIMC's
    is `simc_visit:${visitId}`, which the comma fix never touched. If a fix
    *does* change how a key is formed, the new rows will not displace the old
    ones — they will sit alongside them, both current, double-counting.
    Check this before re-importing, every time.
  - **The export must cover the whole period, not a slice.** Superseding only
    touches keys present in the new file. A re-import that stops short leaves
    the tail current and corrupted, and the cards look fixed because the bulk
    was replaced.
  - Scrubbing first buys nothing: it opens a window with the data absent, has
    no undo, and leans on the delete/restore path where #73 was found.
    Supersede leaves the old revisions in place but not current, so a bad
    import is recoverable.
  - `scripts/repair-simc-comma-labels.ts` remains the fallback for when the
    original export is not available. It is an exact inverse rather than a
    guess, because the fragments sit adjacent and in order. Doing neither
    leaves a card drawing corrupted categories.
- **The two records sit at different grains.** Link2Feed writes demographics on
  the *household* profile (`ServiceClientProfileResponse`); SIMC writes them
  per *person* (`ServicePersonProfileResponse`). A card must say which it
  counts and must never sum the two — the same question answered at both
  grains weights a SIMC household by its size and a Link2Feed household by one.
  This is why ethnicity and gender identity each get two cards rather than a
  combined total. (Age is the exception and combines them, because "how many
  seniors did we serve" is one question — it dedupes identities first and states
  the shortfall in a footnote.)
- **Merge language labels only where two labels are the same word.** "Mandarin
  Chinese" folds into "Mandarin" because that is the two intake systems writing
  one answer two ways — a redundant qualifier, not a different name. Answers
  that are *different names* are never merged, however close a linguist would
  call them: "Farsi" and "Persian" are a household's own choice of name,
  "Chinese" could be either variety and resolving it invents data, and
  "American Sign Language" specifies which sign language. Extending the alias
  map means arguing two spellings are the same word. The export always carries
  every answer unmerged, and truncating a chart to the most common values is a
  display limit rather than a merge — provided the card says which it is doing.
- **Report a share against the question's own denominator.** The two intake
  systems ask different demographic questions, so a low answer rate usually
  means the question is newer, not that households refused. `service-response-
  coverage` exists to make that visible; check it before quoting any
  demographic figure. A decline is not an answer — `NON_ANSWER_LABELS` in
  `profiles.ts` strips "prefer not to answer" and its variants at import, so a
  `provided` status always means something substantive was said. Dimensions the
  systems derive rather than ask (`no_fixed_address`, `county_fips`) are kept
  off the card: they sit at 100% by construction and flatter every real
  question beneath them.
- **Do not hardcode operational facts** — program start dates, visit policies,
  system-changeover months. Derive them from the data so the card follows the
  record.
- **Bucket grain is a per-card decision, not a page-wide one.** How Service Was
  Delivered plots every recorded service day at every range, because the Service
  Log holds one row per day the pantry ran and monthly sums hide the shape staff
  recognise. Service Over Time still adapts, because it plots intake records
  whose daily volume is an order of magnitude higher. A card's description must
  name the grain it is actually using — "by day" on a monthly chart is a lie the
  reader has no way to catch.
- **The grain rule is one function, `granularityForRange`,** shared by Service
  and Procurement (`services/analytics-granularity.ts`). Day up to a quarter,
  month beyond it. The two lenses had no reason to disagree, and a rule copied
  into two files is a rule that eventually does. Procurement's short ranges used
  to collapse four charts to one or two monthly points; its full span is 1,710
  delivery dates across seventeen years, which is why "always daily" is wrong
  there too. **Seasonal Inbound Weight is deliberately exempt** — it compares
  calendar months across years, so its buckets are months by definition, and it
  keeps its own `yearMonth` key.
- **`bucket`, not `month`, once a series can be either.** The four Procurement
  over-time payloads carry `bucket` plus a payload-level `bucketGranularity`; a
  field named `month` holding `2026-08-13` misleads the CSV reader as much as
  the next developer. Report cards pass that grain into `condenseTimeSeries`
  (which now has `day` at the bottom of its ladder) so `categoryColumn` names
  what the rows actually are.
- **`MMM yy` is ambiguous the moment a chart can also plot days.** "Aug 26" is
  August 2026 on a monthly axis and reads as the 26th beside a daily one.
  Procurement's month labels are `MMM yyyy` for exactly that reason.
- **A card's tick formatter must follow that card's grain, and never throw.**
  The corollary was missed when the grain went per-card and cost a blank
  Service tab: How Service Was Delivered kept the page-wide labeller, so on
  YTD and All (the two presets with a monthly page grain) a day key reached the
  month formatter, which built `2026-06-02-01`, and `RangeError: Invalid time
  value` inside Recharts' render unmounted the whole lens. Build the labeller
  from the series' own granularity (`labelFor(methodSeries.granularity)`), and
  keep `safeDate` between every formatter and `parseISO` — a tick that cannot be
  parsed must degrade to the raw key, because an ugly axis is a bug report and a
  blank page is a mystery.
- **Drop the period in progress** from any seasonal or monthly comparison, and
  say so. A half-finished month beside eleven complete ones reads as a collapse
  rather than a month that has not happened. Applies to Service Over Time, How
  Service Was Delivered, Households by Season, and Seasonal Inbound Weight on
  Procurement.
- **Figures over 999 carry thousands separators, everywhere.** `formatNumber`
  and `formatAxisNumber` in `lib/formatting/number.ts` are the one place a
  number becomes chart text; `ChartTooltipContent` uses the same function, so an
  axis and the tooltip above it cannot disagree. Every numeric axis needs an
  explicit `tickFormatter={formatAxisNumber}` — Recharts prints bare digits
  otherwise, and `45000` beside `4500` makes a reader count zeros. Do **not**
  apply it to a category or date axis: a month name through a number formatter
  yields an empty label and an axis of blanks. The locale is pinned rather than
  taken from the device, so one page cannot show `1.000` and `1,000` for the
  same quantity.
- **A line ends where its data ends.** Procurement payloads are a dense grid of
  zeros so Recharts cannot bridge a gap and invent a delivery; `trimSeriesToData`
  then nulls the leading and trailing zeros so a partner who stopped delivering
  terminates there. Zeros *between* real values stay — those happened. Do not
  drop an empty series from a fixed taxonomy (the acquisition classes, the two
  OFB channels): a report whose rows change between ranges cannot be compared
  with another.
- Age and geography cards are **built**; the card proposal's §2.8 cutover
  question was answered by combining the records and stating the shortfall in a
  footnote rather than drawing two charts the reader has to add up. Age must
  make identities distinct before counting — the person side scopes to a range
  by joining through encounters, which otherwise repeats anyone who came twice.
- **Where Households Live is a map, and its centre is a weighted median.** The
  household-weighted *mean* is dragged by the handful of postal codes reaching
  Hawaii and the east coast, and opened the map on farmland south of the city;
  a median moves only with how many households sit somewhere, never with how
  far an outlier sits. mapcn's `Map` takes `center`/`zoom` and exposes no
  `fitBounds`, so the opening view is computed rather than fitted — and fitting
  the true extent would draw the whole country and make the local picture, the
  entire point of the card, unreadable.
- **The agency's own postal code is derived, never named in code.** It is the
  modal code among no-fixed-address households (97209 today, 379 of ~418), and
  the card says it is over-represented rather than dropping it: SIMC requires a
  code, so staff enter the agency's for housed households whose code is unknown
  too, and nothing in the record separates those from real residents. Requires a
  clear majority, not a plurality — otherwise `agencyPostalCode` stays null and
  the card says nothing rather than accusing a code on weak evidence.
- Placement uses `us-zips` (MIT) on the backend: a postal code's centroid is a
  property of the code, not of anyone's address. **This does not weaken the PII
  rule** — FEED still never imports or stores an address. Bubbles scale by
  **area**, not radius, or a code with twice the households renders four times
  as large.
- **A map can be printed — just not that map.** `CLIENTS_GEOGRAPHY` prints
  `bubbleMapSvg`, drawn server-side from the `us-zips` centroids the payload
  already carries. No browser, no tiles, no network, no new dependency. Two
  approaches were rejected for concrete reasons worth keeping: capturing the
  WebGL canvas is disqualified because a saved report re-runs from
  `ReportTemplate.templateData` with **no browser present**, so it would work
  once interactively and break every saved report; and fetching basemap tiles
  server-side would put a network call inside a report generator that has none,
  failing on an offline Pi and dragging tile-usage terms into a printed page.
- **Names are what make a printed map identifiable, not outlines.** County
  boundaries alone shipped first and were rightly rejected as "a map aesthetic"
  with nothing saying where you are — anonymous polygons where the screen showed
  Portland, Vancouver and Gresham. `placesFor` in `basemap.ts` adds the largest
  populated places in frame, graded by population the way an atlas does and
  thinned by collision rejection, because a pile of overlapping names is worse
  than four clear ones. GeoNames data via `all-the-cities` (MIT); the data is
  CC-BY, so the map carries an attribution line.
- **The printed map draws land under the bubbles.** Without it the card is a
  scatter plot — the circles sit in the right places relative to each other and
  the reader has nothing to place them against, which is what shipped first and
  was rightly rejected. `basemap.ts` reads Census cartographic boundaries from
  `us-atlas`: counties for a local frame, states once the span passes 3° of
  longitude and county lines stop being orientation and become noise. Decoded
  once per process (~16ms), around 285 vertices at metro zoom. Public domain and
  generic across the country, matching `us-zips`' own scope, so nothing here is
  an agency-specific asset that white-labelling would have to undo.
- **Look at the PDF, not the SVG.** Three defects shipped in this card because I
  previewed the standalone SVG and never generated a report and opened it: a
  blank first page, a key header printing through its own first row, and a place
  name under a bubble. None were visible in the SVG alone. Render the real
  artifact — `buildAnalyticsReport` with `includePdf`, then `qlmanage -t` the
  result — before calling a print change done.
- **A print card has a height budget.** Letter landscape at 0.5in margins leaves
  roughly 447pt under the report header, and `.card` is `break-inside: avoid`,
  so a card one pixel too tall does not overflow gracefully — it jumps whole to
  the next page and leaves the first blank. The map is 900x330 for that reason,
  not for looks. Adding anything to this card means re-checking the budget.
- **Do not fill political boundaries.** Counties tile the entire land area, so a
  fill conveys no land/water information and produces a hard edge wherever a
  polygon happens to end inside the frame — which reads as a rendering fault.
  Stroke only.
- **The printed map centres on the most-frequent postal code.** Deterministic,
  needs no tuning, and for most agencies lands on or beside their own address.
  The extent covers 95% of placed households by distance from that centre, so a
  single household in Hawaii cannot zoom the metro out to nothing — those codes
  are counted in a line above the map instead of vanishing. Bubbles scale by
  area here too.
- **Coordinates never enter an export.** They live on `CardData.map`, which
  `cardCsv` does not read — it serialises `categoryColumn`/`categories`/`series`
  only. A latitude is a rendering detail derived from a postal code, not
  something FEED knows about anyone, and the file a user takes away stays postal
  codes and counts. There is a test asserting this; do not "helpfully" add
  coordinate columns to the CSV.
- `Map` applies `center` only at initialisation unless its viewport is
  controlled, so an HMR edit to the centre appears to do nothing. Reload fully
  before concluding a centring change failed.

Analytics cards are a contract: screen, PDF, and CSV share one accessor, so a
guard applied on screen must be applied in the card too (`analytics-cards.ts`).
A card's own controls are frozen when the user selects it and travel as
`options` — a control the card does not read is a control the export silently
ignores. `docs/reports/analytics-report-architecture.md` has the rest.

- **A terminal status needs its own branch, not a default.** `importPhase`
  handled five of seven job statuses and let `failed` and `cancelled` fall
  through to "Reading the data file…", so a rejected import showed a spinner for
  work that had already stopped and the server's own explanation — naming the
  offending record — was unreachable outside a database shell. The dialog was
  already computing `isTerminal` including `failed`; knowing and saying are
  different things. When a status union grows, assert in a test that every
  member reaches a deliberate branch. See ISSUES.md #75.
- **An import must not abort a file over a condition it can resolve.** Requiring
  exactly one Head of Household per SIMC visit refused 3,799 visits over one
  single-member household where the box was not ticked — and SIMC does not
  require it there. A household of one has exactly one candidate; refusing it
  buys no safety. Zero heads across *several* members stays an error, because
  the export genuinely does not say who the record belongs to and guessing
  attaches demographics to the wrong person. Strictness earns its place where
  there is real ambiguity, not where the answer is forced. See ISSUES.md #76.

## Documentation Standards

Documentation is part of the deliverable.

- Update feature docs when behavior changes.
- Update `ISSUES.md` when a known issue is found, prioritized, fixed, or deferred.
- Update `CHANGELOG.md` for user-visible behavior, tests, docs, and technical milestones.
- Preserve historical docs unless they are actively misleading. If a doc is stale but still useful historically, note the newer source of truth rather than deleting it.

## Git Rules

- Check `git status` before staging.
- Do not stage `.DS_Store` or unrelated local noise.
- Do not use destructive git commands such as `git reset --hard` or broad checkout/revert unless the user explicitly requests it.
- Commit related work with a meaningful message.
- Push only when requested.
- If the branch or remote state is unclear, inspect before acting.

## How to Handoff Work

When passing work to another AI agent, include:

1. Goals and current phase.
2. What was implemented and why.
3. What approaches were considered or rejected.
4. Challenges, regressions, and fixes.
5. Exact paths to key files and docs.
6. Current git status, branch, commit, and push state.
7. Tests/builds/browser checks that passed or failed.
8. Next recommended steps and manual validation checklist.

Passdown messages should be concrete enough that a fresh agent can continue without reconstructing the whole session.

## Lessons From Recent Work

- The fastest path was not choosing the most sophisticated PDF tooling. The useful path was first reproducing a reference PDF procedurally, then building UX toward a working feature.
- pdfmake is viable for current generation needs. pdfme is useful as inspiration for drag/drop template editing, but replacing the generation pipeline would be an architectural decision.
- Seemingly small UI issues can be state-management bugs. After implementing dialogs, dropdowns, drag/drop, and destructive actions, smoke test the actual interaction path.
- Builder previews need special treatment because they represent paper, not app chrome.
- Incremental phases work well here: mock the UX, validate it manually, then connect durable backend logic.
- The user values outcomes, print fidelity, and staff usability over allegiance to any specific tool.
- **Animated-icon `viewBox` typo trap**: every icon installed from the `@lucide-animated` and `@animate-ui` shadcn registries we have used so far has shipped with `viewBox="0 24"` instead of `viewBox="0 0 24 24"` (missing the first two coordinates). The browser silently misinterprets it as `viewBox="0 24 0 0"` (zero-width viewport positioned at y=24), so only one or two glyph elements fall inside the rendered box and the icon appears badly clipped (e.g. `Grip` renders as 4 dots instead of 9; `ClipboardList` shows just a corner). The CLI re-emits the typo on every install, so even running `npx shadcn add … --overwrite` will reintroduce the bug. **Whenever adding a new animated icon, immediately grep the freshly created file for `viewBox="0 24"` and patch it to `viewBox="0 0 24 24"` before using it.** Fix it in-place; do not paper over with CSS scaling or wrappers.
- **Animated-icon SVG path truncation**: both registries also ship icons with truncated `d` attributes — arc commands are missing their large-arc and sweep flags, and relative line commands are missing their endpoint. The icon renders but looks unrecognizable. After install, visually compare the icon in the browser and cross-check each `d` value against the official Lucide source for that icon. See `docs/motion/ICON_ANIMATIONS.md` for the full post-install checklist.
- **`BridgedAnimatedIcon` only works for `animateOnTap`**: the bridge reads `active` from `AnimateIconContext` via a `useEffect`. This async chain works for pointer-down events but silently fails for `animate` (mount) and `animateOnHover` (mouse events) because of ordering races and the imperative-ref icon's extra `<div>` wrapper. If an icon needs all three triggers, convert it to a native animate-ui icon (using `useAnimateIconContext` and `motion.svg`) instead of wiring it through the bridge. The bridge is acceptable only for tap-only contexts. See `docs/motion/ICON_ANIMATIONS.md` for the full explanation.
- **Check before installing any icon from the registry**: this project has animated icons in two locations — `src/components/animate-ui/icons/` (native, context-driven) and `src/components/ui/` (imperative-ref, self-animating). Before running any `npx shadcn@latest add` command for an icon, grep both directories first. If the icon exists in one location and you need it in the other context, create a parallel file — never overwrite the existing one. `npx shadcn@latest add … --overwrite` will silently destroy any file at the target path, including working icons used by unrelated parts of the UI (e.g., the sidebar). See `docs/motion/ICON_ANIMATIONS.md` — "Before Installing from the Registry" — for the full pre-install checklist and guidance on when each system applies.
- **`animate={controls}` on `motion.svg` root causes silent animation failure**: if `controls.start()` is bound to the `motion.svg` element itself (rather than a child `motion.g` or `motion.path`), and any child variant objects are empty (`{}`), Framer Motion silently rejects or no-ops the animation Promise. `AnimateIcon`'s `startAnim` wraps this in `try/catch { return }`, so the error is completely swallowed — the icon looks fine at rest, hover triggers fire, but nothing moves. The fix is always to animate child elements: put `animate={controls}` on a `motion.g` wrapper inside the `motion.svg`, and remove any empty variant keys. See `docs/motion/ICON_ANIMATIONS.md` — "The `motion.svg` root animation silent failure trap" — for the corrected pattern.
- **Port 5173 is the only valid test target**: all file edits must target the main repo at `/Users/russbook/williamtemple-feed/packages/frontend/`. Even when Claude Code opens a session in a git worktree, the user's browser points at port 5173, not the worktree's preview server. Never treat a worktree preview server screenshot as evidence of correctness. Frontend-only testing is never sufficient — the app requires the backend at port 3001 for authentication and all data. If the browser shows a login screen, ask the user to authenticate rather than attempting a bypass or concluding the change is untestable.
- **API response envelopes: unwrap consistently in the service layer.** Backend routes return *enveloped* objects — `{ foodItem }`, `{ foodItems }`, `{ template }`, `{ component }`, etc. Frontend services must unwrap to the inner value. A mismatch is a real bug source: `FoodItemService.updateFoodItem`/`createFoodItem` returned the raw `{ foodItem }` envelope (mistyped as `FoodItem`) while `getFoodItems` correctly returned `response.foodItems`; the malformed object (no `statusFlags`) was stored in state and crashed the next render with `Cannot read properties of undefined (reading 'isInStock')` — but only on *mutations* (initial load worked because GET unwrapped). When adding/editing any service method, mirror the unwrap the GET path uses, and confirm the returned object has the same shape the UI consumes.
- **Keep the three version sources in sync on a release bump.** The in-app version tag is `APP_VERSION` = `packages/frontend/package.json` version (shown in the sidebar/login/logout); the backend `/api/health` reports `packages/backend/package.json` version; the deployed Docker image tag is the `VERSION` build arg (and the Pi's `.env`). They drift independently — bump all three together. (They were stuck at `0.99.0` in the UI while images shipped `1.0.x`.)
- **DB migrations auto-apply on container start** via the backend Docker `CMD` (`prisma migrate deploy && node dist/index.js`). A new migration committed into the image runs automatically on the next Pi deploy — back up `production.db` first when a migration is destructive (e.g. a table rebuild), then build/push the image and `docker compose pull && up -d`.
- **A pre-commit hook blocks operational data; install it.** `git config
  core.hooksPath .githooks` — hooks are not cloned with a repository, so a fresh
  checkout has no protection until someone runs that. `.githooks/pre-commit`
  refuses any staged file that is a SQLite database, write-ahead log or rollback
  journal **by magic number rather than by name**, exceeds 5MB
  (`FEED_ALLOW_LARGE=1` overrides for legitimate assets), matches
  `feed-backup-*.json`, or carries client PII column headers in a data file
  outside a reviewed test-fixture path.
- **`.gitignore` is always one format behind.** It closes filenames; the risk is
  file *kinds*. `*.db` shipped in the very first commit and did not match
  `dev.db-wal`, so write-ahead logs went unignored from 2026-05-19 until
  2026-08-14 — and a WAL holds committed page data not yet checkpointed, so one
  captured after a Link2Feed import contains real client rows. Nothing landed in
  that window, by luck rather than design. `feed-backup-*.json` was the same gap
  a second time: `*.db` does not match it, and a production backup is ~150MB of
  every client record. When a new artifact appears, ask what it *is*, not what
  it is called.
- **Verify history by content, not by filename.** A name scan misses a database
  renamed `notes.txt`. Read the first bytes of every blob and match magic
  numbers — `SQLite format 3`, WAL `0x377f0682/83`, journal
  `0xd9d505f920a163d7` — and grep blob content for the real exports' column
  signatures. Done across all 3,557 blobs on 2026-08-20: zero databases, zero
  WALs, zero journals, and the only five CSVs in history are synthetic fixtures
  whose ids read `L2F-SYNTHETIC-1`.
- **Secret leaks / public repo:** treat any committed secret as permanently compromised — **rotation is the real fix**, not deletion (git history keeps it; removing from the working tree does nothing). Scrub history with `git filter-repo --replace-text` then force-push; reconcile other checkouts with `git fetch && git reset --hard origin/main` (gitignored files like `.env` survive). The runtime encryption key lives in the DB `EncryptionKey` table (`KeyManager.getActiveKey`), **not** in `ENCRYPTION_MASTER_KEY` env — so a leaked env key may not even match the active key; verify before assuming exposure. GitGuardian alerts are legitimate, but verify via `dashboard.gitguardian.com`, never an emailed "grant access" link.
- **`cd packages/frontend && npx tsc --noEmit` checks nothing and reports success anyway.** The frontend root `tsconfig.json` is a solution-style file (`"files": []` plus `references` to `tsconfig.app.json`/`tsconfig.node.json`); a bare `tsc --noEmit` run against it has zero root files to check and exits 0 regardless of real errors elsewhere in the project. An entire session's worth of "typecheck passed" claims were false on this basis — real type errors (a missing import, an incomplete test fixture, a narrowed-type-widened-to-`string` indexing bug) shipped uncaught across several commits before a stray unrelated command (`tsc --project tsconfig.app.json`) exposed the gap. **Always run `npx tsc --noEmit --project tsconfig.app.json`** (or `npx tsc -b`) for a real frontend check. The backend's `tsconfig.json` is an ordinary single-project config with a real `include`, so a bare `npx tsc --noEmit` from `packages/backend` has always been genuine — this trap is frontend-only. If a `tsc --noEmit` claim of "0 errors" seems too clean given the scope of a change, or is going to gate a commit/report to the user, verify the invocation actually names `tsconfig.app.json` before trusting it.
- **When "0 new errors" needs to be trusted, verify against a real historical baseline, not memory.** `git worktree add /tmp/baseline-check <commit>` gives an isolated, disposable checkout to typecheck the pre-change state without touching the working tree or risking a destructive operation on it — `npm install` there, run the real `tsc --project tsconfig.app.json` invocation above, then `git worktree remove --force` when done. Comparing raw error-line counts between two runs is misleading when messages wrap across multiple lines (a 4x count swing can be entirely message-formatting noise); compare deduplicated `(file, code, message)` signatures with line/column numbers stripped instead.
- **TypeScript can hide one missing-property error behind another on the same object literal.** If a nested property already has an incompatible type (e.g. `status: {...}` missing one required field), TS reports only that nested `TS2741` and silently skips the top-level `TS2739` that would otherwise list every other missing top-level property on the same literal. Fixing the first-reported error can reveal a second, larger error that was completely invisible a moment before. Don't treat a single fix as complete without re-running the check — the absence of a follow-up error is not evidence the object is now valid, keep re-checking until a clean run confirms it.
- **Radix Tabs activate on pointer-down, not click.** `fireEvent.click` on a `TabsTrigger` leaves the tab unchanged, and the assertions afterwards run against the *unswitched* view — so a test can look like it exercises a toggle while proving nothing. Use `fireEvent.mouseDown`, as `analytics-report-run.test.tsx` does on the date presets. The same applies to driving the app through a browser tool: a synthetic `.click()` or a plain automated click never switches these tabs, which reads as "the preview pane is broken" when it is not. Dispatching `pointerdown` + `mousedown` works.
- **`oklch()` lightness must be emitted as a PERCENTAGE in runtime-generated CSS.** Safari 15.4 — the engine on the iPad mini 4, which sits on the iPadOS 15 security branch — parses `oklch(44.8% 0.119 151.3)` and *rejects* `oklch(0.448 0.119 151.3)`. Same colour, same channels; only the notation differs, and the bare-number lightness form landed later. Measured on-device, `CSS.supports` returns `true` for the first and `false` for the second. An unsupported value is dropped at computed-value time, so every runtime brand token fell back to `rgba(0, 0, 0, 0)`: cards, popovers and modal surfaces lost their fill and `--border` collapsed to `currentColor`. The compiled default was never affected, because Tailwind authors percentages and `index.css` goes through the build — which is exactly what makes this class of bug invisible in the built-in theme and total in every custom appearance. **The general rule: CSS generated at runtime is legacy-safe only at emit time**, because `/api/brand/theme.css` is injected straight into `<head>` and reaches no build step. Note this is narrower than "oklch needs Safari 16.4" — percentage lightness works on 15.4, so one form serves every engine and no `@supports` layer is needed.
- **`document.startViewTransition` is absent on Safari 15.4**, so the theme switch there takes the crossfade path in `lib/theme-transition.ts`: a `.theme-crossfade` class is applied for the length of the change, the colours interpolate in place, and the class is removed so ordinary hover and focus transitions are untouched the rest of the time. **Do not try to reproduce the circular reveal on that engine.** The reveal needs the old and new frames on screen simultaneously — old content outside the circle, new content inside — and that is exactly what the missing API provides. An attempt to fake it by covering the viewport in the outgoing background colour and sweeping a disc of the incoming one shipped and had to be reverted: a flat colour is not a frame, it is a blank, so the whole dashboard vanished for the length of the sweep. That looked fine in a unit test and in a synthetic harness with two cards on it; it was only obvious on a real screen with a real page. Animate a fallback against actual content before believing it. Covered by `src/test/theme-transition-fallback.test.ts`, whose central assertion is that no overlay is added at all.
- **Never interpolate a `color-mix()` with `transparent` in a polar space (`oklch`, `hsl`, `lch`).** `transparent` is `rgba(0,0,0,0)`, whose hue is a *missing* component that a correct engine carries over from the other colour. Safari 15.4 (iPadOS 15, still in service on the iPad Mini 4) reads it as 0° and interpolates around the wheel instead: measured on-device, `color-mix(in oklch, sky-400 50%, transparent)` returned `oklch(74.6% 0.16 296.33)` against a true `232.661` — 63.7° off, the shorter arc toward 0°. Every dark-mode shadow and glow rendered violet while light mode looked perfect, because black has no hue to rotate. **Use `in oklab`** for any alpha-only mix: it is rectangular, so there is no hue channel to get wrong, it is bit-exact with the polar form, it keeps the wide gamut that `in srgb` clips, and it is already the space Tailwind v4 emits for its own opacity modifiers. Reserve `in oklch` for genuine two-colour mixes, where hue interpolation is the point.
- **Multi-series chart tooltips must be sorted explicitly.** Recharts hands the payload over in series-declaration order, which on overlapping lines is the order they appear in the source, not the order they stack on screen — a 1,543 lb source printed above a 6,480 lb one. Pass `sortByValue` to `ChartTooltipContent`. Do **not** pass it to stacked charts: their payload order *is* the stack order, and re-ordering breaks the correspondence with the bar under the cursor. Paired before/after series (Previous vs Latest Unit Cost) also stay fixed. Recharts' own `itemSorter` prop does not help — only `DefaultTooltipContent` reads it, and this project replaces that component.
- **Print helpers take a value formatter; the default is pounds.** `hBarSvg` and `stackedHBarSvg` default to `POUNDS`, so a card counting households or items prints "1,443 lb" unless it passes `COUNT`. This has now shipped three times (paid procurement dollars, availability counts, response coverage). Check the unit whenever adding a card that is not measuring weight.
- **Run test suites per package, not from the repo root.** `npx vitest run` at the root picks up a config that fails 46 tests across 86 files on `Cannot find package '@/routes/auth'` — pre-existing and unrelated to any change under test. The real gates are `cd packages/backend && npx vitest run` and `cd packages/frontend && npx vitest run`.
- **Every Analytics footnote is a bulleted list.** `FootnoteList` in
  `components/analytics/footnote.tsx` is the only footnote component; there is
  deliberately no paragraph variant, and a one-item list is still a list. These
  notes are always a series of separate facts — a denominator, which system
  asked the question, what a placeholder means — and as prose the reader had to
  parse the whole block to find the one that applied. The list is **flat**:
  nesting was tried for the placeholder birth years under the estimated-age note
  and read worse than the thing it clarified — an indented second level in small
  muted text looks like a rendering fault, and the reader has to work out the
  relationship before reading the fact. Every point carries the same bullet.
  **A reference mark is a marker, not text.** `FootnoteList` takes a `marker`
  prop, so a note keyed to a figure above renders with `*` in place of the
  bullet rather than carrying a literal asterisk inside its sentence, where it
  reads as a second bullet. Service Summary needs one: "treat this as an
  undercount" has to say what is undercounted, and the mark on the *People
  served* tile supplies the referent. A marker only earns its place when
  something above carries the matching mark — the same card's `**` pair pointed
  at a tile that never had it, and decoded to nothing. Where notes group without
  a referent, render two adjacent `FootnoteList`s instead; the gap does the work
  and needs no legend.
- **Axis labels tilt rather than collide.** `useCategoryAxis` in
  `lib/chart-axis.ts` measures the container and angles labels to -35° only when
  a horizontal label would not fit its band, growing the chart by the height the
  tilted labels need. `interval={0}` stays non-negotiable on a banded chart —
  Recharts thins crowded ticks, and an age axis reading "18-29, 45-59, 75-89,
  105+" invites the reader to believe those are the bands — but forcing every
  tick at a narrow width is the same illegibility by another route. Applied to
  every forced category axis: age bands, household size, and both seasonal
  month charts.
- **Measure with a callback ref, never `useRef` + a mount effect.** An effect
  with `[]` deps attaches once and never again, so a chart behind a loading
  state or an empty-data branch is never measured and silently keeps its
  horizontal labels however narrow the screen. Procurement's seasonal chart did
  exactly this while Service's identical one worked, because only one of them
  mounts behind a guard.
- **A measuring hook still cannot sit below an early return.** `useCategoryAxis`
  is a hook; declaring it beside the chart it serves put it under
  `ProcurementAnalyticsWorkspace`'s loading guard and React failed the entire
  workspace. Same trap as the `useMemo` before it — hooks go above every guard,
  however far that is from the JSX they feed.
- **A Recharts test that does not force dimensions asserts against nothing.** jsdom
  reports zero size for every element, and Recharts renders no axes, ticks, or
  formatters at zero size — so a chart test passes whatever the formatters do.
  The first version of `service-bucket-labels.test.tsx` passed with the blank-tab
  bug deliberately reintroduced. Stub `ResizeObserver` to report a real box
  *and* define `offsetWidth`/`offsetHeight`/`clientWidth`/`clientHeight` plus
  `getBoundingClientRect` on the prototypes; the same test then failed with the
  exact production `RangeError`. **Prove a new regression test fails against the
  bug before trusting it** — with charts, a green run is the default, not
  evidence. Note also that Recharts splits tick text across tspans, so
  `getByText('Aug 13, 2026')` never matches; query
  `.recharts-cartesian-axis-tick-value` and strip whitespace.
- **`rg -r` is `--replace`, not "recursive".** ripgrep is recursive by default; `-r` silently rewrites matches in the output, so `rg -rn "beta\.18" .` prints a mangled version of the file contents. Twice in one session this produced output that looked like real findings (`"version": "1.5.0-n"`). Just use `rg -n`.
- **`ColumnDef<X>[]` not assignable to `ColumnDef<unknown>[]`, and Lucide icon `ComponentType` mismatches, are pre-existing accepted debt** — see `docs/TSC-DEBT.md`. They recur on every new table built with `EnhancedDataTable` because of the shared component's generic typing, not because of anything the calling code does wrong. Don't attempt to fix them opportunistically inside an unrelated feature change; that's a systemic `EnhancedDataTable`/`TableRowAction` generics fix requiring its own scoped, discussed pass. Confirm a given error is actually this category (same file, same TS code, same message shape as the doc describes) before assuming it's pre-existing rather than something new.
