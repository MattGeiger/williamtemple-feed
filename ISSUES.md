# FEED — Known Issues & Future Work

**Last Updated**: May 28, 2026
**Status**: v1.0.0 release prep in progress (see `docs/V1-RELEASE-PLAN.md`)
**Production**: https://feed.williamtemple.app

This file tracks open issues, planned work, and recently-resolved items
during the v1.0.0 release-prep window. Detailed root-cause writeups for
pre-v1.0.0 resolutions have been condensed to one-liners here — the full
discussions are preserved in git history (`git log -p ISSUES.md` before
this sweep).

---

## v1.0.0 Release Triage

### Blockers
None identified. The application is running in production at
https://feed.williamtemple.app; the core flows (OTP auth, document
translation, shopping list builder, AI configuration) are working and
verified.

### Recommended-but-optional cleanups before public flip
- **A11y warnings** — missing `DialogTitle` on several `DialogContent` /
  `SheetContent` usages (~12 dev-time warnings on `/food-items` alone).
  See issue #27b below. Quick to fix with `<VisuallyHidden>`.
- **TypeScript debt** — 697 pre-existing errors documented in
  `docs/TSC-DEBT.md`. The recommended "Option C quick wins" drops the
  count to ~250 in roughly 3 hours of focused work. Doesn't block ship,
  but the count is visible to anyone who clones the public repo.
- **Security review** — see issue #7 below. AGPL-3.0 license + going
  public means external eyes on the auth path. Worth a focused review.

### Deferred to post-launch
Everything else in this file. The application is shippable today.

---

## Open Issues

### #5 — Translation Request Batching for RPM Efficiency
**Priority**: Medium · **Status**: Implementation landed Dec 2025;
Chinese DOCX sub-issue tracked separately as #17
**Bucket**: v1.x backlog (monitoring)

Type-aware batching reduced API calls by 95%+ for Food Item/Category
bulk translations. Validation confirmed Food Item + Category bulk
translations succeed; Custom Text and DOCX paths remain on the new
batched code path. Watch for partial failures (especially Chinese DOCX,
which is #17).

---

### #7 — Security & Authentication Hardening
**Priority**: High · **Status**: Planned
**Bucket**: v1.x backlog (recommended before public flip)

Auth system is functional but needs hardening before a wider audience
sees the source. Areas: OTP rate limiting, session-management review,
CSRF audit, cookie-security flags, JWT rotation strategy, email-attack
mitigation, audit logging for auth events.

---

### #8b — AI Translation System Performance Optimization
**Priority**: Medium · **Status**: Planned
**Bucket**: v2

Optimization targets: batch processing efficiency, caching strategy
refinement, API request pooling, DB query optimization for large
documents, memory usage during multi-document operations. Current
performance is acceptable for production usage.

---

### #9 — Unit Testing Update for Docker Environment
**Priority**: Medium · **Status**: Planned
**Bucket**: v2

Backend service / API endpoint / encryption / DB-operation /
auth-flow tests need restoration. Tests were archived in v0.13.x to
reduce technical debt during rapid development; see `/archived_tests/`
for the historical suite. The Docker test environment needs to be set
up so coverage is meaningful.

---

### #17 — DOCX Batch Translation Partial Failures (Chinese)
**Priority**: Medium · **Status**: Investigating
**Bucket**: v1.x backlog

Document translations to Chinese occasionally fail with partial batch
errors after retries (`Non-retryable error detected, stopping retry
attempts` → `All 3 translation attempts failed for batch` →
`Partial translation failure for Chinese: 15 segments failed`). Other
languages succeed. Position-based docx modification still runs with
missing segments.

Next: capture raw provider error response, decide whether smaller
chunk sizes or stricter JSON/tool output for batch responses fixes it.

---

### #19 — System Prompt Save Does Not Close Modal
**Priority**: Low (UX) · **Status**: Fix implemented, pending verification
**Bucket**: v1.x backlog (verify and close)

Root cause was `BaseAIConfigDialog` expecting a boolean from `onSave`;
`AddSystemPromptDialog` returned `void`. Fix standardized `onSave` to
return `Promise<boolean>`. Manual verification still pending.

---

### #22 — Shopping List Builder Phase 5 Layout Mode
**Priority**: Medium · **Status**: Core work landed (April–May 2026);
remaining scope is optional refinement
**Bucket**: v1.x backlog (incremental enhancements)

Core Phase 5 landed: Guided/Freeform toggle, 9pt grid system, snap-to-
grid for drag/drop/add/duplicate/insert, header/footer page anatomy,
explicit Header/Body/Footer regions, split-page body controls, Guided
collision placement, planner-backed Body sequencing, flowing section
tables that split across lanes/pages, RTL + multilingual + emoji-aware
Chromium PDF export.

Remaining scope (not blocking):
- Pagination UX refinement and continuous-table preview accuracy.
- Alignment controls (Left/Center/Right/Top/Middle/Bottom) and
  distribution controls in Guided mode.
- Additional split-page rules (lane resize, overflow controls,
  multi-page editing affordances).
- RITE-based UX refinement once the above are in place.

---

### #26 — Shopping List Builder Table Vertical Density
**Priority**: Medium · **Status**: 3pt re-base + tagged-header alignment
landed May 15–16 2026; monitoring for stacking edge cases
**Bucket**: v1.x backlog (watchpoint)

Phase 0 prototype validated; Phase 1 + the 3pt re-base + the
category-header icon-overhead fix + the adaptive-row tag-measurement
bump all landed. The user mental model is restored (one coordinate
system at 3pt with 9pt major grid). Watch for new multi-component
stacking regressions; the planner is height-agnostic but tight slack
budgets mean wrap-estimation misses are more expensive than before.

---

### #27a — Animated UI Primitive Theme Token Drift
**Priority**: Medium · **Status**: Partial fix landed (Checkbox, Switch);
ongoing watchpoint
**Bucket**: documented pattern (recurring footgun)

When adopting Animate UI / shadcn primitives, generated styling encodes
hard-coded neutral palette classes (`slate-*`, black/white states) that
ignore FEED theme tokens. Strip these and replace with `primary`,
`background`, `muted`, `ring`, etc. in the local wrapper before
shipping. Verify both light and dark mode plus focus/disabled states.

Guidance is captured in `AGENTS.md` ("Lessons From Recent Work") and
should be checked whenever a new animated primitive is added.

---

### #27b — Radix `DialogContent` Missing `DialogTitle` (A11y Warnings)
**Priority**: Medium (Accessibility) · **Status**: Open
**Bucket**: v1.x backlog (recommended pre-public-flip)

Several pages emit dev-time Radix warnings about missing `DialogTitle`.
~12 warnings on a single load of `/food-items`. Screen-reader users
opening these dialogs don't get an announceable title.

Fix: audit every `DialogContent` / `SheetContent` usage. Add a visible
`<DialogTitle>` or wrap a hidden title in Radix's `<VisuallyHidden>`:

```tsx
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
<DialogContent>
  <VisuallyHidden.Root>
    <DialogTitle>Edit Food Item</DialogTitle>
  </VisuallyHidden.Root>
  …
</DialogContent>
```

Grep for `DialogContent` / `SheetContent`, list dialogs missing a
title, add (visible or visually-hidden) titles, then reload affected
pages and confirm zero warnings.

---

### #29b — Animated-Icon `viewBox` Typo in Registries
**Priority**: Low (recurring footgun) · **Status**: Workaround documented
**Bucket**: documented pattern

Icons from `@lucide-animated/<name>` and `@animate-ui/icons-<name>`
consistently ship with `viewBox="0 24"` instead of `"0 0 24 24"`. The
SVG renders only a slice of the upper-left corner. Reinstalling
reintroduces the bug because the registry sources are themselves wrong.

Workaround: grep `viewBox="0 24"` immediately after every install and
patch in place. Documented in `docs/motion/ICON_ANIMATIONS.md` and
`AGENTS.md`.

Long-term fix: upstream issues / PRs against the registries.

---

### #30 — "Find Missing Translations" Modal Needs Scroll Area + Card Reordering
**Priority**: Medium (UX) · **Status**: Fix in progress (May 21, 2026)
**Bucket**: v1.x backlog
**Component**: `packages/frontend/src/components/translation-management/enhanced-find-missing-dialog.tsx`

Adding the new **"Generated (Shopping List)"** translation category increased
the modal's content height beyond what fits in the dialog. When a run
produces failed or stuck-in-pending translations, a results card is
appended at the **bottom** of the modal, pushing it out of view and
leaving it **partially cut off** with no way to scroll to it.

**Reproduced (May 21, 2026):** in the post-scan **Overview** tab, the
results/action card is rendered *after* the category-count grid, so with a
large result (observed: 847 missing) the action card and its buttons are
clipped at the bottom. The cut-off content is the **"Missing Translations
Found"** card — count line, "Missing translations were found", the "Select
which categories… / Choose how to handle…" copy, and the **Queue for
Translation / Retry Failed / Delete** action buttons. The Overview tab
already wraps its body in a Radix `ScrollArea`, but it does **not** scroll —
the same failure mode as resolved issue #29a (Radix `ScrollArea` does not
get a bounded height inside the dialog's `flex` + `max-h-*` chain, so the
viewport grows with content and `overflow-hidden` clips it without a
scrollbar).

Intended resolution:
1. **Reorder cards** — move the results/action card to the **top** of the
   Overview tab, above the category-count grid, so the actionable results
   are immediately visible.
2. **Make the body scrollable** — ensure clipped content can be reached.

Implementation note: prefer an `overflow-y-auto` container over Radix
`ScrollArea` with a `max-h-*` constraint — see resolved issue #29a, where
`ScrollArea` failed to scroll under a `max-h-*` cap in
`translate-and-generate-dialog.tsx`. The existing Radix `ScrollArea` in
this modal is exhibiting exactly that failure, so the fix replaces it with
an `overflow-y-auto` container.

---

### #31 — Shopping List Templates & Saved Components Are Per-User, Not Org-Shared
**Priority**: High · **Status**: Fixed (May 20, 2026) — pending deploy
**Bucket**: v1.x backlog
**Component**: `packages/backend/src/routes/shopping-list-builder.ts`,
`packages/backend/prisma/schema.prisma`
 (`ShoppingListBuilderTemplate`, `ShoppingListBuilderComponent`)

**Observed behavior**: Saved Shopping List templates (and Saved
Components) are sequestered by login. If `user1@williamtemple.org`
creates a template, only that account sees it; if
`user2@williamtemple.org` logs in, they see only their own templates and
none of user1's. Each account gets a private set of templates/components.

**Expected behavior**: FEED is designed around a single
whole-organization data environment. Changes made by one user should be
visible to all users. Inventory, templates, saved components,
translations, and translated documents should be identical regardless of
which account is logged in. This is a shared environment, not a
per-account experience.

**Root cause**: The `ShoppingListBuilderTemplate` and
`ShoppingListBuilderComponent` tables carry an `ownerId String` column
(indexed `@@index([ownerId])`), and every builder CRUD route scopes its
query by it. `getOwnerId(req)` returns `req.auth.userId` (the logged-in
user's id) and all reads/writes filter `where: { ownerId }`:
- List/save/update/delete templates — lines ~3648, 3661, 3697, 3739
- List/save/update/delete components — lines ~3530, 3544, 3582, 3623
- Same-name dedup helpers `findSavedTemplateByName` /
  `findSavedComponentByName` — lines ~1614, 1626

So each user's id partitions the data. By contrast, the shared inventory
and translation tables (`Category`, `FoodItem`, `CategoryTranslation`,
`FoodItemTranslation`, `Translation`) have **no** `ownerId` column — they
are already global, which is why inventory and translations are correctly
shared across logins. The builder tables are the only ones that diverged
from the org-shared model.

**Resolution** (Option 1 — drop `ownerId` entirely; chosen because the
deployment is <24h old with minimal staff content, so the merge risk is
negligible):
1. Dropped the `ownerId` column and its `@@index([ownerId])` from
   `ShoppingListBuilderTemplate` and `ShoppingListBuilderComponent` in
   `schema.prisma`.
2. Migration `20260520000000_drop_shopping_list_builder_owner` rebuilds
   both SQLite tables without `ownerId`, copying every existing row so
   prior per-user content survives as shared content. Applied
   automatically on container start (`prisma migrate deploy` in the
   Docker CMD).
3. All builder routes now read/write one shared set: removed
   `where: { ownerId }` from every find/list, dropped `ownerId` from
   creates, and dropped the `ownerId` argument from the
   `findSavedTemplateByName` / `findSavedComponentByName` dedup helpers
   (a same-name collision across former users is now a real collision,
   resolved by the existing newest-match update logic).
4. `getOwnerId` (which both returned the per-user id and gated login) was
   replaced by `requireAuth`, which only enforces that the caller is
   logged in. The translation auditor already read all templates with no
   owner filter, so it was unaffected.
5. Backend tests updated: delete now asserts `where: { id }` only, plus a
   new test that `GET /templates` lists without an owner filter. Full
   shopping-list suite (119 tests) passes; backend `tsc` build clean.

**Remaining**: deploy to production (Pi) so the migration runs there.

---

### #32 — Standardize Scroll Containers on shadcn `ScrollArea`
**Priority**: Medium (UX consistency) · **Status**: Resolved (May 21, 2026) — pending deploy
**Bucket**: v1.x backlog (incremental cleanup)

Project direction (see AGENTS.md "UI Standards"): scrollable **content
regions** should use the shadcn `ScrollArea` consistently, not a mix of
`ScrollArea` and native `overflow-y-auto` / `overflow-auto` divs. Mixed
scroll mechanisms produce inconsistent scrollbars and behavior.

**Key insight from #30 (May 21, 2026):** the earlier belief (resolved
issue #29a) that "Radix `ScrollArea` doesn't scroll, use `overflow-y-auto`"
was incomplete. `ScrollArea` fails under a **`max-h-*`** cap (its viewport
height is unbounded), but works correctly when given a **definite height**
(e.g. `h-[calc(85vh-13rem)]`). So the standard fix is a definite-height
`ScrollArea`, not abandoning it for native overflow. #29a's
`overflow-y-auto` workaround is therefore a convert-candidate below.

**Refined finding (the "fixed-height impact" evaluation):** the original
"convert candidates" split cleanly into two groups. **Fixed-height** scroll
regions are genuine `ScrollArea` conversions. **Grow-to-fit** (`max-h-*`)
content previews and **nested** scroll boxes are *not* — a fixed-height
`ScrollArea` would render mostly-empty boxes for small/variable content,
and a nested `ScrollArea` would trap scrolling. Those are legitimate
documented native-overflow exceptions (AGENTS.md "UI Standards" was
refined to codify the three exception cases). Blanket-converting would have
worsened UX.

**Resolution (May 21, 2026):**

Converted to definite-height `ScrollArea`:
- `ai-configuration/shared/BaseAIConfigDialog.tsx` and
  `ai-configuration/EditSystemPromptDialog.tsx` — `h-[480px]` dialog bodies.
- `dashboard/translation-metrics.tsx` — `h-[250px]` response-times chart
  (verified scrollable: 250px viewport, ~280px content).
- (Already done under #30: the three result-tab `ScrollArea`s in
  `enhanced-find-missing-dialog.tsx`.)

Kept as documented native-overflow exceptions (inline-justified):
- `components/ui/view-text-dialog.tsx` — single, usually-short string;
  grow-to-fit. (Stale `view-text-dialog.tsx.backup` deleted.)
- `enhanced-find-missing-dialog.tsx` Details-tab sample box — nested +
  short variable lists.
- `document-translator/dialogs/reconciliation-dialog.tsx` — 5 preview boxes
  listing variable, often-tiny issue/action lists; grow-to-fit.
- `shopping-lists/dialogs/translate-and-generate-dialog.tsx` — per-language
  progress list (commonly 1–3 rows); grow-to-fit. (Supersedes #29a's
  workaround framing: the box correctly stays native here.)
- Shadcn primitives (`ui/table.tsx`, `ui/command.tsx`, `ui/sidebar.tsx`,
  `ui/enhanced-data-table`) and the `FoodItemList` `DropdownMenuContent`
  popper — native overflow is inherent/standard.

**Remaining**: ships with the next image/deploy (frontend change).

---

### #33 — Builder Row-Height Under-Calculation at Higher Font Sizes
**Priority**: Medium · **Status**: Fixed (May 21, 2026) — pending deploy
**Bucket**: v1.1.0
**Component**: typography engine
(`packages/frontend/src/components/shopping-lists/builder/typography.ts`
⇄ `packages/backend/src/lib/builder-typography.ts`)

At the upper end of `BUILDER_FONT_SIZES` (14/16/18pt), wrapped text can
overflow its computed row: `estimateWrappedLineCount` /
`estimateWrappedSegmentLineCount` under-estimate the wrapped line count
(the average-character-advance approximation drifts as glyphs widen and
fixed paddings consume proportionally more of the row), so the row band is
too short and content spills. Related watchpoint: #26.

Approach: make the wrap estimate progressively more conservative as font
size grows (monotonic safety factor keyed off `fontSize` so 10–12pt is
unchanged), and feed the *actual* item-cell content width into the
estimate (status icons / Want checkbox / hidden Want column all change it).
Keep the two typography engines byte-equivalent; re-validate with the
typography unit tests, the inventory-section height tests in
`shopping-list-builder.test.ts`, and a rendered-PDF smoke at 14/16/18pt
(including RTL and long item names). Full design notes:
`docs/shopping-lists/v1.1.0-feature-plan.md` (section C).

**Resolution (May 21, 2026):** the actual root cause was narrower than the
hypothesis above. The live wrap engine (`estimateWrappedSegmentLineCount`,
duplicated in the backend route and `ShoppingListBuilder.tsx`) already
reserved a **flat 6pt** of wrap slack to absorb real Chromium rendering
~3-5% wider than the per-glyph estimator. That flat value only covered
cells up to ~120pt, so mid-width cells under-counted lines and clipped —
even at 12pt (e.g. "Hot Dog & Hamburger Buns"). Fix: reserve
`max(6pt, 5% of cell width)` so the wrap threshold tracks Chrome's
percentage over-width at every font size. Applied identically to both
engines; 119 shopping-list tests still pass (10pt inventory-height
assertions unchanged); confirmed against a full real-inventory pass in the
running builder. Follow-on: `SPLIT_PAGE_MAX_BUILDER_FONT_SIZE` raised 12→14
so 14pt section tables are now offered in Split-page layout (16-18pt remain
Full-page-only).

---

### #34 — v1.1.0 Shopping List Builder + Export Settings (Complete)
**Priority**: Medium · **Status**: Released — shipped to production as 1.1.0 on 2026-05-22 (migration applied, /api/health + in-app tag both report 1.1.0)
**Bucket**: v1.1.0

**Progress (May 21–22, 2026)** — landed and pushed to `main`, each its own
revertable commit, every one validated (backend `tsc` + 119 tests +
rendered-PDF parity check):
- ✅ **A5** — show/hide Want column (`293defa`)
- ✅ **A1 + A3** — show/hide column dividers + table/cell borders (`13a746e`)
- ✅ **A6** — per-row checkbox in the Want column (`293e018`)
- ✅ **B2** — English in the Translate & Download modal (`53147eb`)
- ✅ **A2** — Limited/Clearance status icons on rows (`c4f2d65`)
- ✅ **A4** — Legend base component (`d497125`)
- ✅ **B1** — Export Settings modal (shared filename-structure settings).
  New `ExportSettings` Prisma model + migration
  (`20260522000000_add_export_settings`), org-wide shared singleton (id=1,
  no ownerId per #31). Filenames assembled client-side in
  `builder/export-filename.ts` (unit-tested); GET/PUT
  `/export-settings` routes; modal on the Shopping Lists page with live
  preview; wired into single, bulk, and Translate & Generate downloads.
- ✅ **B3** — per-section-table "Show Global Limit" option. When enabled,
  rows with no item-level limit ("No Limit") display the current org-wide
  Global Limit value in the Limit column instead of a blank cell. New
  optional `showGlobalLimit` flag on `SectionTableBuilderComponent` (default
  false, read as `=== true`), mirrored in both packages. Value resolved live
  at render time (canvas: `PreviewLanguageContext.globalLimit`, fetched via
  `GlobalLimitService`; PDF: backend reads `GlobalLimit` only when a table
  opts in) — never baked into saved rows. Shared `resolveRowLimitText` mirror
  in both renderers; Properties toggle nested under "Show limit column".

All features are designed in `docs/shopping-lists/v1.1.0-feature-plan.md`
(B3 added per follow-up request after the initial plan).

A1 scope note: divider/border toggles now cover **section tables** AND
**form-field groups** — the form-field follow-up landed, mapping
`showColumnDividers` to the vertical label|value divider and `showBorders`
to the outer box + horizontal row separators (canvas + PDF, with the
`[dir="rtl"]` override gated). A1 is fully complete.

Planned v1.1.0 feature set, fully designed in
`docs/shopping-lists/v1.1.0-feature-plan.md`:
- Builder: show/hide column dividers; status tags (Limited/Clearance) as
  icons; show/hide table & cell borders; new **Legend** base component;
  show/hide the **Want** column; per-row **checkbox** in the Want column.
- Shopping Lists page: **Export Settings** modal (filename structure —
  date/time, template name, language, default preview/translated base
  names; org-wide shared per #31); add **English** to the Translate &
  Download modal (identity path, skips translation).

Cross-cutting constraints captured in the plan: canvas/PDF parity, the
frontend/backend typography + icon mirrors, 9pt grid, back-compat template
JSON fields, shadcn-first UI, and org-wide shared persistence.

---

### #35 — AI Model Type-Chooser Icon Animates Only on Direct Icon Hover
**Priority**: Low (UX polish) · **Status**: Fixed (May 21, 2026) — pending deploy
**Bucket**: v1.x
**Component**: `packages/frontend/src/components/ai-configuration/index.tsx`

In the "Add AI Configuration" type-chooser (step 1 of the multi-step
modal), the **AI Model** card's icon animated only when hovering the icon
itself, while the **Prompt** card's icon animated on hover anywhere over
the card (the desired behavior).

**Root cause**: the two cards use different animated-icon systems (see
AGENTS.md "Lessons From Recent Work"). Prompt uses `MessageSquareQuoteIcon`
from `@/components/animate-ui/icons` (native, context-driven) wrapped in
`<AnimateIcon asChild animateOnHover>` on the Card, so card-hover drives it.
AI Model used `CpuIcon` from `@/components/ui/cpu` (imperative-ref,
self-animating) with no ref — the native `AnimateIcon` context cannot drive
an imperative-ref icon, so it fell back to its own direct-icon-hover
trigger. There is no native animate-ui `Cpu` icon (only `bot`,
`message-square-*`).

**Fix**: attach a `CpuIconHandle` ref to the `CpuIcon` (which flips it into
controlled mode, disabling its own direct-hover trigger) and call
`startAnimation()` / `stopAnimation()` from the Card's `onMouseEnter` /
`onMouseLeave`. Hovering anywhere on the card now animates the icon,
matching the Prompt card — using the imperative icon's own documented ref
API, with no new icon installed (avoiding the registry viewBox/path
hazards documented in AGENTS.md).

---

### #36 — Prompt Category "Document Text Translation" Icon Animates Only on Direct Hover
**Priority**: Low (UX polish) · **Status**: Fixed (May 21, 2026) — pending deploy
**Bucket**: v1.x
**Component**: `packages/frontend/src/components/ai-configuration/steps/PromptCategoryStep.tsx`

Second instance of the #35 pattern. In the "Prompt Category" step (Add
System Prompt flow), all four category cards are wrapped in
`<AnimateIcon asChild animateOnHover>`, but three icons (`LanguagesIcon`,
`MessageSquareMoreIcon`, `BlocksIcon`) are native animate-ui (context-
driven → animate on whole-card hover) while **Document Text Translation**
used `FileTextIcon` from `@/components/ui/file-text` (imperative-ref). The
native `AnimateIcon` context can't drive an imperative-ref icon, so it only
animated on direct icon hover. No native animate-ui `file-text` icon exists
(only `file-down`).

**Fix**: same controlled-ref approach as #35 — attach a `FileTextIconHandle`
ref to the `FileTextIcon` (controlled mode) and drive `startAnimation()` /
`stopAnimation()` from that card's `onMouseEnter` / `onMouseLeave`; the
other three remain driven by the `AnimateIcon` wrapper.

**Recurring-pattern note**: imperative-ref icons from `@/components/ui/*`
placed inside an `<AnimateIcon>` wrapper will silently fall back to
direct-hover. When adding an icon to an `AnimateIcon`-wrapped element,
prefer a native `@/components/animate-ui/icons/*` icon; if only an
imperative-ref icon exists, wire it via its ref handle as in #35/#36. Worth
a sweep for other occurrences.

---

### #37 — Arrow / Home / End Keys Don't Work in Text Fields (Cursor Can't Move)
**Priority**: Medium (UX) · **Status**: Fixed (May 21, 2026) — pending deploy
**Bucket**: v1.x
**Component**: `packages/frontend/src/hooks/use-navigation-keyboard.ts`

**Observed**: in every text field across the app, the keyboard arrow keys
(and Home/End) could not move the caret — users had to reposition the
cursor by mouse-click. (Originally recalled as a side effect of "Title
Case" validation; that recollection was incorrect — there is no title-case
input transform. The real cause was the sidebar keyboard-navigation hook.)

**Root cause**: `useNavigationKeyboard` adds a **document-level** `keydown`
listener that `preventDefault()`s `ArrowUp/Down/Left/Right`, `Home`, and
`End` to drive sidebar item navigation. It's mounted by `app-sidebar.tsx`
and `navigation-section.tsx` (always-present layout), so it ran on every
page and swallowed those keys **including while focus was in an
input/textarea** — blocking caret movement everywhere.

**Fix**: bail out of the handler (no `preventDefault`, no navigation) when
`event.target` is an editable element (`INPUT`, `TEXTAREA`, `SELECT`, or
`contentEditable`). Arrow/Home/End now work normally in fields; sidebar
keyboard navigation still works when focus is outside a field. Verified in
the running app: from inside an input the keys are no longer
`defaultPrevented`; from `document.body` they still are.

---

### #38 — Title Case Enforced Per-Keystroke Reset the Caret While Typing
**Priority**: Medium (UX) · **Status**: Fixed (May 21, 2026) — pending deploy
**Bucket**: v1.x
**Component**: `packages/frontend/src/lib/formatting/text.ts` and the
food-item / category name forms

**Observed**: after arrow-keying back to edit mid-string in a name field
(food item, category), typing pushed the caret back to the **end** of the
string — making in-place edits impossible. (This is the "Title Case
compromise" originally recalled — and it was real, distinct from the
arrow-key blocker #37.)

**Root cause**: `createFormattedChangeHandler` ran `formatText` (the
Title-Case enforcer) on **every keystroke** and wrote the formatted value
back to the controlled input. When the formatted value differed from the
typed value (capitalizing a letter, collapsing spaces), React re-set the
input's `value` and the browser moved the caret to the end — the classic
controlled-input live-reformat anti-pattern.

**Fix**: stop reformatting on change — the change handler now stores the
raw typed value (caret preserved), and `formatText` is applied **once at
submit** in each form (`FoodItemForm` create, `useEditForm` edit,
`CategoryForm`). Users type freely; Title Case is enforced when they save.
Native `maxLength={36}` on the inputs still caps length caret-safely. Only
the name fields used live formatting; other fields were unaffected.
Verified in-app: typing "hot dog & buns" stays raw while editing and saves
as "Hot Dog & Buns".

---

### #39 — Builder Section Tables Ignore Food-Item Limits and the Global Limit
**Priority**: High · **Status**: Fixed (May 26, 2026) — pending deploy
**Bucket**: v1.x
**Component**: `packages/backend/src/routes/shopping-list-builder.ts`,
`packages/frontend/src/components/shopping-lists/builder/ShoppingListBuilder.tsx`,
`packages/frontend/src/components/shopping-lists/builder/types.ts`

Two related bugs in how Inventory Section tables surface request-limit
values. Both stem from confusing two **independent** food-item fields:

- `limit` (Int; `100` = the `NO_LIMIT_SENTINEL` "No Limit") — the cap on how
  much a client may request. Set in the Food Item form's **Basic** tab.
- `isLimited` (Bool) — a **low-stock** status flag that only drives the
  optional Limited status icon. Set in the **Status** tab. An item can be
  low-stock yet uncapped, or capped yet well-stocked.

**Bug 1 — food-item limits not shown.** `buildInventorySectionComponent`
derived the row limit as `item.isLimited && item.limit !== 100 ? item.limit
: null`, gating the displayed cap on the unrelated low-stock flag. So an item
with `limit = 5` but `isLimited = false` showed **"5"** in Food Item
Management ([data-table/columns.tsx](packages/frontend/src/components/food-item-management/data-table/columns.tsx)
never gates on `isLimited`) but a **blank** Limit cell in the builder. It
only appeared after editing the cap in the Content tab — because the
write-back route (`PUT /inventory-items/:id/limit`) force-set
`isLimited = true` as a side effect, which also silently flipped the
low-stock badge.

**Bug 2 — Global Limit ignored.** The Global-Limit fallback for "No Limit"
rows was wired through canvas and PDF via `resolveRowLimitText`, but gated on
a per-table `showGlobalLimit` flag that **defaulted off** (`=== true`). So by
default the org-wide cap never constrained "No Limit" items.

**Resolution:**
1. Row limit now reads `item.limit !== NO_LIMIT_SENTINEL ? item.limit : null`
   — independent of `isLimited`, matching Food Item Management. `isLimited` /
   `isClearance` are still passed through for the A2 status icons.
2. The write-back route writes only the cap (`{ limit }` on a value,
   `{ limit: NO_LIMIT_SENTINEL }` on clear) and no longer touches `isLimited`,
   so builder edits are bidirectional with Food Item Management without
   side effects.
3. `showGlobalLimit` now defaults **ON**, read as `!== false` in all four
   call sites (canvas render, Properties checkbox, PDF render, and the
   backend `needsGlobalLimit` query). An explicit `false` opts a table out.
4. Tests: added decoupled-limit and default-on / opt-out cases to
   `shopping-list-builder.test.ts`; updated the write-back assertions; added
   the `globalLimit` Prisma mock to both shopping-list test files. Full
   suite (121 tests) passes.

**Remaining**: ships with the next image/deploy. Existing saved templates
begin applying the Global Limit to their "No Limit" rows (the intended fix).

---

### #40 — Builder Canvas Wraps Long Names in Safari at Non-100% Browser Zoom
**Priority**: Low (cosmetic, preview-only, Safari-only) · **Status**: Known limitation — not fixing (May 26, 2026)
**Bucket**: v1.x watchpoint
**Component**: `packages/frontend/src/components/shopping-lists/builder/ShoppingListBuilder.tsx`

**Observed**: In the preview canvas, some long section-table item names
(e.g. "Great Northern Beans (Dried)", "Hot Dog & Hamburger Buns",
"Chickpeas/Garbanzo Beans", "Fruit Flavored Greek Yogurt") wrap to a second
line that overflows into the row below, because the row stays at single-line
height. The **exported PDF renders the same template correctly**, so the
deliverable is unaffected — only the on-screen preview misleads.

**Reproduction is browser- and zoom-specific** (user-confirmed): the overlap
appears **only in Safari on macOS** and **only when Safari's page zoom is set
to something other than 100%** (e.g. 75%). At 100% Safari zoom it renders
correctly, and Chrome is unaffected at any zoom.

**Root cause**: a Safari sub-pixel rounding quirk. The builder canvas scales
the whole page via CSS `transform: scale(...)` (`ShoppingListBuilder.tsx`
~line 5060) and section-table columns are fixed-pixel widths. When Safari's
own page zoom is applied on top of that transform, Safari rounds the scaled
sub-pixel cell widths differently than at 100%, shaving a fraction of a pixel
off the item cell's usable width — just enough to tip a name that *exactly*
fits onto a second line. The row height comes from the Noto-Sans-calibrated
typography engine (which assumes the unrounded width), so it stays single-line
and the wrapped line overflows. Chrome's rounding doesn't hit this, and the
PDF is rendered by server-side Chromium with no browser zoom, so neither is
affected. (An earlier font-mismatch hypothesis was investigated and
**disproven** — the canvas paper already pins the Noto Sans stack via
`.shopping-list-print-page` in `index.css`, matching the PDF; live inspection
of a real cell confirmed it computes Noto Sans.)

**Decision — not fixing**: any mitigation would require shaving sub-pixel
slack into the item-cell width or the row-height math, which is the delicately
calibrated typography engine that canvas/PDF parity depends on (see #26, #33 —
"change one constant and you may break the schedule"). That risk is not worth
trading for a cosmetic glitch confined to one browser at a non-default zoom,
especially when the PDF deliverable is always correct. Browser page zoom is
also not reliably detectable from JS, so we cannot compensate precisely.
**Workaround for users**: view the builder canvas in Safari at 100% page zoom,
or use Chrome. Revisit only if it surfaces in Safari at 100% or in another
browser.

---

### #41 — Public Inventory Feed Omits Translations That Exist in the App
**Priority**: Medium · **Status**: Fixed (May 27, 2026) — pending deploy
**Bucket**: v1.x
**Component**: `packages/backend/src/routes/public-inventory.ts`

**Observed**: The public feed at `/api/public/inventory.json` omitted translated
names for some categories/items (e.g. "Canned Goods") even though those
translations exist — they show as **Completed / Category** in Translation
Management and render correctly in the Shopping List Builder.

**Root cause**: FEED stores category/item name translations in **two** places:
1. The generic `Translation` table (`type` `Category` / `FoodItem`), keyed by
   English `originalText` + language. This is the de-facto source of truth that
   Translation Management reads/writes.
2. The denormalized `CategoryTranslation` / `FoodItemTranslation` tables, keyed
   by entity id + language, written only by the translation-trigger service.

The public feed read **only** the denormalized tables (via the Prisma
`translations` relation include) with **no fallback**. Those tables have gaps
(see #42), so any translation living only in the generic table was absent from
the feed. The Shopping List Builder already worked around the same gap with a
generic-table fallback in `lookupInventoryBuilderTranslations`; the feed never
replicated it, so it was the one consumer that surfaced the drift directly.

**Resolution**: Mirror the builder's fallback in the feed. After loading the
denormalized translations, fill any missing (entity, enabled-language) pair from
the generic `Translation` table by English name + `type` + `status='completed'`,
**denormalized winning** on conflict. Name matching is unambiguous
(`Category.nameSearch` / `FoodItem.nameSearch` are `@unique`, and `Translation`
is unique per `originalText`+`language`+`type`); only `completed` rows are read,
so failed-row error strings (stored in `translatedText`) never reach the public
feed. Added a route test for gap-fill, denormalized-wins, the null-`translatedText`
guard, and the completed-only query. Focused test (2/2) + backend `tsc` clean.

**Remaining**: ships with the next image/deploy. This is a read-side backstop,
not a cure for the underlying drift — see #42.

---

### #42 — Translation Storage Drift: Generic `Translation` vs Denormalized Tables
**Priority**: Medium (architectural tech debt) · **Status**: Open — deferred
(documented May 27, 2026)
**Bucket**: v2 (architecture)
**Component**: `packages/backend/src/services/translation-trigger.ts`,
`packages/backend/src/routes/categories.ts`,
`packages/backend/src/routes/translations.ts`,
`packages/backend/src/services/translation-auditor.ts`,
`packages/backend/src/db.ts`

This is the root cause behind #41 and behind the builder's existing fallback. It
is filed as deliberate, deferred tech debt — **not** something to fix under
hotfix pressure, because it touches the sensitive translation pipeline (#5, #17)
and runs against archived backend tests (#9).

**The drift**: Category/food-item name translations live in two stores that fall
out of sync:
- **Generic `Translation` table** — the de-facto source of truth. Written by
  `categories.ts` (seeds `pending` rows), `translations.ts` (manual add / Find
  Missing / retry completions), and the trigger (writes it first). This is what
  Translation Management shows.
- **Denormalized `CategoryTranslation` / `FoodItemTranslation`** — the id-keyed
  fast store for inventory rendering. Written in exactly **one** place:
  `translation-trigger.ts` `applyBatchResults`.

**Why the denormalized tables develop gaps**: the trigger only writes them for a
translation it **freshly** performs, and two things routinely prevent that:
1. `prepareBatchTranslations` **skips** any generic row that already exists and
   is not `failed` (`status !== 'failed'` → `continue`). So once a generic row
   is `pending` or `completed`, the trigger never (re)translates it and never
   writes the denormalized row.
2. `categories.ts` create/update **pre-seeds** generic `Translation` rows as
   `pending` for every enabled language. The `db.ts` Prisma middleware also
   queues a trigger translation on the same write, but by the time it runs the
   `pending` rows already exist → the skip-guard fires → the denormalized
   `CategoryTranslation` row is never written. Those pending rows are later
   completed by the Find Missing / auditor path in `translations.ts`, which
   writes **only** the generic table.
3. Manual add / edit / retry in `translations.ts` likewise never touch the
   denormalized tables (confirmed: they are referenced only in
   `translation-trigger.ts` and `shopping-list-builder.ts`).

Net effect: an entity can have complete translations in the generic table and
none/partial in the denormalized tables. Whether a given category/item has
denormalized rows is a historical accident of *how* its translations were
completed — which is why only some categories were missing from the feed.

**Current mitigations are read-side backstops, not cures**: the Shopping List
Builder (`lookupInventoryBuilderTranslations`) and now the public feed (#41)
both read denormalized-first then fall back to the generic table. The logic is
**duplicated** in two places; a third consumer reading the denormalized tables
directly would hit the same bug unless it copies the fallback again.

**Long-term options (pick deliberately)**:
- **Option C — fix the write path.** Stop `categories.ts` pre-seeding `pending`
  rows that poison the skip-guard, and/or have `translations.ts` + the auditor
  write the denormalized rows whenever a generic row completes. Largest blast
  radius; does **not** fix existing data on its own.
- **Option D — one-time backfill.** Migration/script to populate the
  denormalized tables from completed generic rows by English name. Fixes
  existing data; without C, drift returns for new content.
- **Option (consolidate) — remove the second store.** Reconsider whether the
  denormalized tables should exist at all, or whether inventory rendering should
  resolve translations from the generic table directly. Eliminates the drift
  class entirely; biggest change.

**Recommended when picked up**: C + D together (prevent future drift *and* repair
existing data), then delete the now-redundant read-side fallbacks in the builder
and feed (or consolidate them into one shared resolver). Until then, the
#41/builder fallbacks keep consumers correct.

---

### #43 — Section Table "Checkbox in Want Column" — UX Lift to Table Level + Persistence Bug
**Priority**: Medium (UX + correctness) · **Status**: Fixed (May 28, 2026) — pending deploy
**Bucket**: v1.x
**Component**: `packages/frontend/src/components/shopping-lists/builder/types.ts`,
`packages/frontend/src/components/shopping-lists/builder/ShoppingListBuilder.tsx`,
`packages/backend/src/routes/shopping-list-builder.ts`

**Observed**:
1. **UX**: The "Checkbox in Want column" toggle in the section-table Properties
   panel was per-row. The realistic use case is "apply to the whole table" — per-row
   toggling was tedious without offering value, and no user wanted a table where
   only some rows had checkboxes and others had blank fill-in space.
2. **Bug**: After enabling the per-row checkbox on every row of an inventory-backed
   section table and saving the template, the checkboxes reverted immediately. The
   same revert happened on PDF download.

**Root cause of the bug**: `refreshInventoryBackedTemplate`
([packages/backend/src/routes/shopping-list-builder.ts](packages/backend/src/routes/shopping-list-builder.ts),
the `refreshInventoryBackedTemplate` export) rebuilds inventory-backed section
tables from the live DB:

```ts
return {
  ...component,         // preserves component-level fields
  rows: refreshed.rows, // OVERWRITES rows — fresh rows have no wantControl
  ...
};
```

The refresh is invoked in three places: `saveCurrentTemplate` in the builder
(before each save), `POST /preview-pdf` (before PDF render), and
`POST /translate-missing-strings`. So the per-row `wantControl` was wiped on
**every** save, every PDF, every translate-missing run — it never reliably
persisted on inventory-backed tables. The realistic "did any user ever ship
this?" answer is "almost no one, because saving immediately wiped it."

**Resolution — elevate to the component level**: `wantControl?: 'blank' |
'checkbox'` is now a property of `SectionTableBuilderComponent` itself, alongside
`showWant`/`showLimit`/`showColumnDividers`/`showBorders`/`showStatusIcons`/
`showGlobalLimit`. It rides through the refresh path's `...component` spread for
free, so the persistence regression cannot recur.

**Back-compat shim** (read-side, transparent): a mirrored helper
`resolveSectionTableWantControl(component)` returns the component-level value if
set; otherwise falls back to legacy per-row `wantControl` ('checkbox' if ANY row
carries it) so older saved templates render correctly without any migration.
Legacy per-row values are left in place (the few that exist are harmless once
ignored by the renderer; no quiet cleanup pass).

**Changes**:
- `SectionTableBuilderComponent.wantControl?: 'blank' | 'checkbox'` added to both
  the frontend type and the mirrored backend interface. `SectionTableRow.wantControl`
  marked LEGACY in both files; documented as fallback-only.
- `resolveSectionTableWantControl` helper added to both
  `packages/frontend/src/components/shopping-lists/builder/ShoppingListBuilder.tsx`
  and `packages/backend/src/routes/shopping-list-builder.ts`, alongside
  `resolveRowLimitText`. Backend helper is `export`ed for unit testing.
- Canvas `PreviewSectionTable` and the backend `sectionTableComponentHtml`
  renderer compute `wantCheckbox` once outside the row loop and use it for every
  row, replacing the previous `row.wantControl === 'checkbox'` per-row check.
- Properties panel: the per-row "Checkbox in Want column" toggle in the Rows
  tab is removed. A new table-level "Checkbox in Want column" toggle is nested
  under "Show want column" in the Layout/Display section (same pattern as
  "Show Global Limit" nests under "Show limit column"). The toggle is hidden
  when `showWant === false`, because there is no Want column to check.

**Tests**: five new cases in `shopping-list-builder.test.ts` cover the
resolver precedence (explicit checkbox / explicit blank overrides legacy /
unset + legacy / unset + no legacy) and a `POST /refresh-inventory` test proving
that table-level `wantControl` survives the row rebuild that wiped per-row
values. 126/126 shopping-list tests pass (was 121); backend `tsc` clean;
frontend `tsc && vite build` clean.

**Remaining**: ships with the next image/deploy.

---

### #6 — Shopping List Feature Incomplete (OBSOLETE)
**Status**: Superseded by Shopping List Builder; closed in v1.0.0 release prep

The wizard-based shopping list flow this referred to was removed in
v1.0.0 release prep (commit `da7f060d` — 39 files, ~9.6K lines). The
Shopping List Builder is now the canonical implementation. Leaving this
entry as a tombstone for future readers who find references to the old
flow in git history or older docs.

---

## Recently Resolved

### v1.0.0 release prep (May 18–19, 2026)
- Created `release/v1.0.0` branch off `main`
- Removed wizard-era shopping list subgraph (39 files / ~9,650 lines)
- Obvious-orphan icon files removed (10 files / ~1,500 lines)
- Documentation archived to `docs/archive/` (32 files moved)
- TSC debt diagnosed and triaged in `docs/TSC-DEBT.md` (deferred)
- V1-RELEASE-PLAN.md captures the four-phase plan (Phase 0 + Phase 1
  complete; Phase 2 public-readiness audit and Phase 3 release pending)

### Pre-v1.0.0 resolutions (most-recent first)
- **#29a** (May 18 2026): Radix `ScrollArea` does not scroll with
  `max-h-*` constraint — replaced with `overflow-y-auto` div; guidance
  in `dialogs/translate-and-generate-dialog.tsx`
- **#28** (May 17 2026): `AnimateIcon` `animate` prop leaves
  `localAnimate` stuck — first hover miss; fix is the
  `onOpenChange`-driven state pattern documented in
  `docs/motion/ICON_ANIMATIONS.md`
- **#25**: Shopping List Builder generated translation settings gaps
- **#24**: Shopping List Builder translated inventory table row
  measurement
- **#23**: Shopping List Builder PDF export — category icon parity
- **#21** (April 26 2026): Shopping List Builder Phase 5 readiness
  (inventory sync, saved-components CRUD, drag affordances, scroll
  bounds, template discovery)
- **#20** (April 29 2026): Shared row action resets table pagination
  state — added `preservePageOnDataChange` to `EnhancedDataTable` /
  `DataList`
- **#18** (Dec 30 2025): OpenAI GPT-5 thinking-level mapping; per-config
  `reasoning_effort` overrides
- **#16** (Dec 29 2025): Anthropic max-tokens exceed model limit;
  clamping added
- **#15** (Dec 29 2025): Daily token limit was using request counts;
  now derived from TPM × 1440
- **#14** (Dec 29 2025): OpenAI token-usage metrics mismatch
- **#13** (Dec 29 2025): Google Gemini token-usage tracking used
  estimates; now uses provider-reported tokens
- **#12** (Dec 29 2025): Dashboard usage-summary configuration filter
- **#11** (Dec 29 2025): Gemini 3 thinking-level configuration
- **#10** (Dec 28 2025): AI cost control — per-configuration limits
- **#8a** (Dec 31 2025): Updated default AI models (Claude 4.5,
  Gemini 2.5, GPT-5 family)
- **#4** (Dec 26 2025): Dashboard state handling complete across all
  cards (Cost Forecast, Cost Comparison, Translation Performance &
  Success, Response Times, Multi-Service AI Usage)
- **#3**: Cost forecast zero-pricing display
- **#2**: Alert system toast errors
- **#1**: Environment variable cleanup — AI model configuration

Full root-cause writeups for each item are preserved in git history.

---

## Completed Milestones

✅ Docker multi-architecture deployment infrastructure
✅ Database-backed encryption setup (browser-driven initialization)
✅ Cloudflare Tunnel integration
✅ Raspberry Pi 5 production deployment
✅ OTP authentication system
✅ AI-powered document translation (core feature)
✅ Multi-language support (59 languages, including RTL Arabic/Farsi and
   Hebrew, plus CJK)
✅ Shopping List Builder (Phase 5 core)
✅ Animated icon system across action menus, palettes, section headers,
   and dialog hero icons
✅ Dashboard UX with comprehensive state handling
✅ Wizard-era prototype code removed; builder is canonical

---

## Development Workflow Notes

**Current environment**: Docker-based development and deployment.
**Testing**: Manual on localhost (Mac) before Pi deployment.
**Deployment**: Multi-arch Docker images pushed to Docker Hub
(`et2geiger/feed-*`); production runs on Raspberry Pi 5 with Cloudflare
Tunnel → `feed.williamtemple.app`.

**Key files**:
- `/docker-compose.yml` — production stack
- `/docker-compose.local.yml` — development overrides
- `/Dockerfile` — multi-stage build
- `/docs/deployment/DOCKER_DEPLOYMENT.md` — complete deployment guide

---

## Contributing

When addressing these issues:
1. Branch from `main` (or `release/v1.0.0` during release prep)
2. Follow established patterns documented in `AGENTS.md`
3. Test locally with Docker compose override
4. Update `CHANGELOG.md`
5. Update this `ISSUES.md` to reflect the new status
6. Submit a PR with a description of intent and verification steps

---

## Support

For deployment issues, see:
- `/docs/deployment/DOCKER_DEPLOYMENT.md`
- `/docs/deployment/troubleshooting.md`
- `/docs/deployment/raspberry-pi-cloudflare-tunnel.md`

For release-prep status: `docs/V1-RELEASE-PLAN.md`.
For tsc error triage: `docs/TSC-DEBT.md`.
