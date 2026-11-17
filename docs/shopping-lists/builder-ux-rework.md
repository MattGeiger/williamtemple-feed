# Shopping List Builder — UX Rework (v1.9.0 slot)

**Status**: Implemented in the working tree, 2026-11-15. Not yet released.
**Scope**: The Builder's chrome only — how its controls are arranged, nested,
and reached. What a template can contain, the template JSON, the backend
routes, the planner, and the PDF renderer are unchanged.

This document records what changed, why, how it was measured, and what was
left alone. `AGENTS.md` remains the source of truth for Builder rules; this is
the design record behind its "Builder workspace" section.

---

## 1. Why

The roadmap called the Builder "a working v1.0 MVP" whose control layout was
"clunky in parts". An audit of the 1.8.2 Builder against the four saved
templates found the specific costs:

| Problem in 1.8.2 | Cost |
| --- | --- |
| Left panel held seven things in one column: name, apply-template, three palettes in fixed 172px scroll boxes, and zoom at the very bottom | Zoom sat a full page-scroll away from the canvas it controls; palettes scrolled inside a panel that scrolled inside a page that scrolled |
| The page scrolled (the canvas was `150vh` tall) | Panels left the viewport while working on the lower half of a page |
| Properties were split across **Layout** and **Content** tabs, opening on Layout | The common edits (text, columns, style) were one tab away; position fields (rarely used in Guided mode) came first |
| Page setup was pinned above Properties | A component's properties started ~280px down the panel |
| Binary choices used dropdowns (Guided/Freeform, grid, bold, alignment, body layout, print sides, table flow) | Two clicks for a one-click decision, dozens of times per template |
| Every section table was styled one at a time | A ten-table list with a shared look cost ~8 actions × 10 tables |
| Inventory sections were added one at a time | Ten clicks, ten toasts |
| A new text block needed Content tab → click field → select text before typing | Four actions before the first keystroke |
| Duplicate/Delete lived in a toolbar and were enabled with nothing selected; no keyboard shortcuts | Long pointer travel; warnings instead of prevention |
| Each table row was a card: badge, textarea, input, badge | 13 rows needed a nested 300px scroll area |

## 2. Approaches considered

1. **Tabbed left rail** (Canva-style: Components / Inventory / Saved as
   tabs). Rejected: it hides two of three lists behind a click, and the lists
   are short enough to show together once the fixed-height scroll boxes go.
2. **Wizard / step flow** (page → sections → style → save). Rejected: staff
   edit existing templates far more often than they build new ones, and a
   wizard taxes every return visit.
3. **Contextual inspector with a three-zone workspace** (Figma / Google Slides
   / Word convention). **Chosen.** It keeps the left-insert / centre-page /
   right-properties arrangement staff already know, so the workflow stays
   recognisable under time pressure, and it removes the nesting rather than
   relocating it.

Patterns deliberately **not** borrowed, and why:

- **Inline text editing on the canvas.** The page is a scaled print preview
  whose text is measured by the typography engine; a `contenteditable` layer
  would need its own wrap measurement to stay honest. Double-click instead
  moves focus to the component's text field, which gets most of the benefit.
- **Multi-select.** It would touch selection, drag, reorder, and the planner.
  "Apply to all tables" covers the case that actually dominated the benchmark.
- **A layers panel.** In Guided mode the page order *is* the layer order.

## 3. What changed

### Header row
- One row: page title on the left; template **name** (inline, with its 48
  character counter), **Open**, **Preview language**, **Save Template**,
  **Download PDF** on the right. The title's description wraps before the
  controls do; below that width the controls drop to their own row.
- **Open** lists saved templates (the current one is marked) and holds
  **New blank template** — the old Reset, moved beside the thing it replaces.
- Save Template shows a dot when there are unsaved changes; the status bar
  says `Unsaved changes` / `Saved`.

### Insert panel (left)
- One scroll, no nested scroll boxes: **Components** (icon tiles),
  **Inventory**, **Saved components**. Click to add or drag onto the page, as
  before.
- **Add all** inserts every remaining inventory section in category order.
- Adding one component no longer raises a toast; it appears selected and the
  page scrolls to it. Bulk inserts and "added for editing" still confirm.

### Canvas (centre)
- The workspace is fitted to the viewport; the page no longer scrolls and each
  panel scrolls on its own.
- Toolbar: **Guided / Freeform** (one click), grid toggle (one click), Undo,
  and zoom (− / value menu / +) — zoom now sits on the canvas. The value menu
  has **Fit width**, **Fit whole page**, **100%**, and the slider.
- Zoom starts in *fit* mode: the page tracks the canvas width (capped at
  100%) until the user picks a zoom, so it never opens cropped. Minimum zoom
  is 40% (was 70%) so a full page width fits the narrowest layout.
- A status bar replaces the row of badges: page summary on the left (click it
  to open Page settings), save state and component count on the right. The
  overflow warning badge is unchanged.
- The selected component carries a floating toolbar — region, repeat,
  duplicate, delete — that stays one size at any zoom.
- An empty page offers the saved templates directly (one click to open one).
- Keyboard: `Delete`/`Backspace` delete, `⌘/Ctrl+D` duplicate, `⌘/Ctrl+Z`
  undo, `Esc` deselect, arrows nudge (canvas focus only). None of them fire
  from a text field, menu, list, or slider. A nudge obeys the same Guided
  collision placement as a drag, so a blocked move is ignored and a move past
  a neighbour lands on the next free position rather than one grid step away.
- Double-click a component to jump to its main field with the text selected.
- Deleting clears the selection instead of selecting another component, so a
  second Delete cannot remove something the user did not pick.

### Inspector (right)
- Two tabs, **Component** and **Page**. It follows the selection — Component
  when something is selected, Page when nothing is — and either tab is one
  click away at any time.
- A component's properties are one scroll of short sections instead of two
  tabs. Order follows frequency of use: content, then columns & style,
  placement, translation, rows; **Position & size** is collapsed by default
  and remembers its state.
- Rows are label-left / control-right, which halves the panel's height.
- One-click controls replace dropdowns wherever the options fit: bold,
  alignment, region, table behaviour, corners, line direction, legend layout,
  date source, body layout, max pages, print sides.
- **Apply to all** copies the selected table's columns and style to every
  other section table (not its title, rows, limits, translation settings, or
  placement).
- Table rows and form fields are inline-edit lists: plain rows until hovered
  or focused. The limit source (`Item` / `Category` / `No limit`) shows inside
  the limit field.
- Sub-options (Global Limit, Checkbox in Want, Repeats on) stay in place and
  disable rather than appearing and disappearing, so nothing shifts under the
  pointer while working down a list.

## 4. Benchmark

The benchmark is the saved templates themselves: build each from a blank page
and count pointer actions (a click, a drag, or a click-into-field followed by
typing each count once). Both columns are counted from the control path each
version requires. For the reworked column every kind of step was also
performed with real clicks in the running app at 1920×1080 — page setup, Add
all, table styling, Apply to all, table behaviour, a title, a legend, save —
though not as one uninterrupted 53-action run.

**Pantry Inventory** (14 components: title, language tag, date, ten uniform
inventory tables, legend)

| Step | 1.8.2 | Reworked |
| --- | ---: | ---: |
| Name, max pages, header height | 6 | 3 |
| Add the inventory sections | 10 | 1 |
| Give all tables the shared style (10.5pt, no Limit/Want, no borders, no shading, status icons) | 80 | 9 |
| Set five tables to Fixed | 20 | 10 |
| Title (text, header, bold, centred, 14pt, not translated, show once, full width) | 21 | 12 |
| Language tag | 6 | 5 |
| Date | 12 | 9 |
| Legend in the footer, full width | 6 | 3 |
| Save | 1 | 1 |
| **Total** | **162** | **53** |

**Shopping List – Split Page** (18 components) follows the same shape: 13
actions put ten styled tables on the page where 1.8.2 needed about 90; the
three tables without a Limit column are two actions each afterwards.

Opening an existing template went from two clicks to one (empty page) or
stayed at two (Open menu).

The exported PDF of the template built this way was rendered to an image and
compared with the canvas: same column assignment, same order, title in the
header, legend in the footer.

## 5. Evaluation

Self-assessed after each round of using the tool, 0–10. A criterion only
moved when the tool was changed and re-tested. These are the implementer's
scores, not staff feedback; RITE sessions with Social Services staff are the
real test and have not happened yet.

| Criterion | Round 1 | Final | What moved it |
| --- | ---: | ---: | --- |
| Task efficiency | 9.5 | 9.5 | Benchmark above |
| Hierarchy & clutter | 9.0 | 9.5 | Inline-edit row lists; status bar instead of badges |
| Discoverability | 8.5 | 9.2 | Starter card on an empty page; shortcuts in tooltips; summary opens Page |
| Feedback & error prevention | 8.0 | 9.2 | Save state; reveal-on-insert; no layout shift; delete clears selection |
| Consistency with FEED standards | 9.0 | 9.3 | Shadcn ToggleGroup added rather than hand-rolled segments |
| Visual polish (dark + light) | 8.5 | 9.2 | Compact-width label wraps and panel overflow fixed |
| Fit at 1920×1080 and 1280×720 | 8.5 | 9.3 | Measured viewport fit; fit-mode zoom; compact column widths |
| Accessibility | 9.0 | 9.2 | Every control named; palette buttons previously had no accessible name |
| Capability parity | — | 9.5 | Checklist in §6 |

Defects found only by clicking through, and fixed:

- Arrow keys pulled focus into the app sidebar (it listens for arrows on
  `document`); a blocked nudge in Guided mode moved the component the opposite
  way.
- A tooltip wrapped around an animated button swallowed the button's click
  ("Apply to all" did nothing). See the lesson in `AGENTS.md`.
- Turning off a column removed its sub-option and shifted every switch below.
- A component added in Guided mode could land below the fold with no sign it
  had been added.
- The panel's scroll viewport let rows grow wider than the panel at compact
  width.

## 6. Capability parity checklist

Everything the 1.8.2 Builder could do is still reachable:

- Template: name, save/update, open saved, new blank, preview language,
  download PDF (including in the preview language).
- Page: body layout, max pages, header/footer heights, print mode, category
  icons, Guided/Freeform, grid and guides.
- Canvas: click-add and drag-add for all three palettes, drag to move,
  drag to reorder in Guided mode, undo, duplicate, delete, region and repeat
  chips, zoom slider and presets.
- Components: every property of text, date, language tag, form fields,
  section table, line, and legend, including per-field translation mode,
  Global Limit display, Want checkbox, status icons, translated-table preview
  height, and the translation dialogs.
- Inventory rows: edit, mark out of stock, clearance, change category,
  delete, add new item, restock, limit write-back on blur, edit category.
- Saved components: save, update-when-editing, rename, edit, delete.

Changed presentation, same information: the limit-source badge is now inside
the limit field; the status badges are now the status-bar summary; "Reset" is
"New blank template" in the Open menu; the "Editing saved component" badge is
now the button reading "Update saved component".

## 7. Known limits and follow-ups

- **Grid layouts were built the next day** in the Page tab's Body section,
  as planned here; see `grid-page-layout.md`.
- The floating toolbar can cover content directly above the selected
  component. This is the usual trade for an on-canvas toolbar.
- Leaving the page with unsaved changes is still not intercepted; the save
  state is now visible, which it was not before.
- Clicking a control while a Select list is still closing can miss (Radix
  dismisses on the first outside press). Pre-existing behaviour.
- No automated test drives the Builder UI; validation is the click-through
  above plus the existing unit tests.
