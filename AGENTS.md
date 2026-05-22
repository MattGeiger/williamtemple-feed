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
- `packages/frontend/docs/components/ui/README.md` for Shadcn/Radix UI usage.
- `packages/frontend/docs/styling/README.md` for centralized styling and theme conventions.
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
- Use Shadcn/Radix components from `packages/frontend/src/components/ui` where possible.
- Use Lucide icons for icon buttons when an icon exists.
- Action menu icon convention: use `Pencil` for Rename and `SquarePen` for Edit.
- Use centralized design tokens from `packages/frontend/src/index.css`; avoid hard-coded colors.
- Follow existing layout density and component conventions. This is an operations tool, not a marketing site.
- Use `ScrollArea`, dropdowns, dialogs, alert dialogs, tables, tabs, tooltips, buttons, inputs, labels, and menus consistently with existing Shadcn patterns.
- **Shadcn-first policy.** Always prefer the Shadcn/Radix component for a given UI need over a hand-rolled or native equivalent. Deviations require a clear, written technical justification — e.g. a compatibility requirement tied to a specific dependency that breaks with Shadcn, a documented Shadcn bug, or a collision with explicit design intent. When you must deviate, add an inline comment at the call site explaining why, and prefer fixing inconsistencies *toward* Shadcn rather than introducing new non-Shadcn variants. Do not mix mechanisms for the same job across the app.
- **Scrolling: use the Shadcn `ScrollArea` for scrollable content regions** (dialog bodies, lists, panels, tab panels). Do not introduce native `overflow-y-auto` / `overflow-auto` scroll containers for app-level content; convert existing ones toward `ScrollArea` (tracked in ISSUES.md #32). Native overflow that is *built into* a Shadcn primitive (Table, Command, Sidebar, DropdownMenu poppers) is the exception and stays. **`ScrollArea` height rule:** give it a **definite** height (e.g. `h-[calc(85vh-13rem)]`), never only a `max-h-*` cap. Under `max-h-*` alone the Radix viewport height is unbounded and will not scroll (the root cause behind issues #29a/#30); a definite height bounds the viewport and also settles correctly inside the animate-ui `auto-height` `TabsContents` wrapper.
- Do not add visible instructional copy to compensate for unclear interactions. Improve the interaction.
- Dark mode must not corrupt print previews. Anything representing printed output should render independently from app theme colors.

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

Important product principle: the goal is not merely to dump inventory data into PDFs. The goal is to empower pantry staff to build reusable templates and control how inventory content is represented while keeping data-derived values accurate.

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
cd /Users/russbook/wth_app_clean/packages/frontend && npm run build
cd /Users/russbook/wth_app_clean/packages/frontend && npm test
cd /Users/russbook/wth_app_clean/packages/backend && npm run test:shopping-lists
cd /Users/russbook/wth_app_clean/packages/backend && npm test
```

When validating the Phase 1/reference pdfmake generator locally, use a Node runtime compatible with pdfmake/fontkit embedded TTF parsing. Node 20/24 have worked in this project; Node 23 has produced `Unknown font format` failures with embedded fonts. In the current macOS setup, this command has been used successfully:

```bash
cd /Users/russbook/wth_app_clean/packages/backend && PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:shopping-lists
```

Development servers typically run as:

```bash
cd /Users/russbook/wth_app_clean/packages/backend && npm run dev
cd /Users/russbook/wth_app_clean/packages/frontend && npm run dev
```

Expected local ports in recent work:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

**Port discipline:** The user's active dev server runs on port 5173, served from the root repo at `/Users/russbook/wth_app_clean/packages/frontend/`. All file edits must target that path. Even when Claude Code opens a session inside a git worktree (e.g. `/Users/russbook/wth_app_clean/.claude/worktrees/<name>/`), the user's browser still points at port 5173. Write files to the main repo path (`/Users/russbook/wth_app_clean/packages/frontend/...`), not the worktree mirror. Never start a second Vite process on a different port — the user cannot see changes served on any port other than 5173, and the worktree's preview server (if one starts automatically) is invisible to the user's active browser session.

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

## Dependency Rules

Discuss new dependencies before installing them unless the user has already approved the direction. Include tradeoffs and why the dependency fits the existing stack.

Known dependency note: backend installs may surface an npm peer conflict involving `zod` v4 and the OpenAI package's optional `zod` v3 peer range. `--legacy-peer-deps` has been used for `pdfmake` after this conflict was identified as pre-existing. Do not normalize broad dependency churn without explicit reason.

## Database and Auth Changes

Be careful with anything that weakens authentication or changes database semantics.

- Local login may require the backend server to be running.
- Do not add a localhost auth bypass unless the user explicitly approves the design and the bypass is impossible to enable in production by accident.
- Prisma/schema changes need migration awareness and backend tests.
- Food inventory data is operationally meaningful; do not treat limits, statuses, or category relationships as cosmetic fields.

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
- **Port 5173 is the only valid test target**: all file edits must target the main repo at `/Users/russbook/wth_app_clean/packages/frontend/`. Even when Claude Code opens a session in a git worktree, the user's browser points at port 5173, not the worktree's preview server. Never treat a worktree preview server screenshot as evidence of correctness. Frontend-only testing is never sufficient — the app requires the backend at port 3001 for authentication and all data. If the browser shows a login screen, ask the user to authenticate rather than attempting a bypass or concluding the change is untestable.
