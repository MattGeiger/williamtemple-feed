# Shopping List Builder — Grid Page Layout

**Status**: Implemented in the working tree, 2026-11-16. Not yet released.
**Roadmap**: v1.8.0 slot in `docs/roadmap/v1.6-to-v2.0.md`. **Issue**: #88.

A third body layout beside Full and Split. A grid divides the page body into
2 columns × 2, 3 or 4 rows, so one Letter sheet prints 4, 6 or 8 slips —
small forms, tickets, reminders — to be cut apart.

## Using it

Page → **Layout: Grid**, then:

- **Grid size** — 2 × 2, 2 × 3, 2 × 4.
- **Squares**
  - **Duplicate all** (default) — build the first square; every square repeats
    it. Copies on the canvas select the original when clicked.
  - **Individual** — each square has its own content. The active square is
    outlined; click a square to make it active, then click components in
    Insert to fill it. Drag a component into another square, or pick its
    **Grid square** in the inspector.

Switching from Individual to Duplicate all gathers everything into the first
square without forgetting where each component was, so switching back restores
it. Changing the grid size keeps components in their squares; a component whose
square no longer exists moves to the last square.

## Rules

| Question | Answer |
| --- | --- |
| What fits in a square? | Anything a body lane can hold: text, date, form fields, section tables (inventory included), lines, legends, saved components. |
| Content too long for its square? | It continues in the **same square on the next page**, if Max pages allows, and is otherwise reported in the status bar. It never spills into the neighbouring slip. |
| Header and footer? | One per page, as on other layouts. A slip that needs its own title carries it as a component. |
| Section-table font size? | Capped at 12pt, as in Split: a square is as narrow as a split lane. |
| Freeform? | Not available in Grid. The squares are the layout. |
| Translation? | Per component, unchanged. In Individual, each square's components carry their own settings. |
| Cut marks? | None are printed. The green guides are canvas-only. |

## How it is built

- **Template fields**: `bodyLayoutMode: 'grid'`, `gridLayout`,
  `gridContentMode`; `gridCell` on a body component. All optional, so older
  templates are unaffected.
- **Squares are planner lanes** (`cell-0` … `cell-N`, row-major). A square
  takes its column's horizontal extent from the same halves split lanes use,
  and its row's vertical extent inset by half the column gap, so stacked
  squares keep the gutter the columns have. Rows are equal, sit on the 3pt
  placement grid, and give any remainder to the last row.
- **Lane chains**: the Guided planner fills independent chains. Full and Split
  are one chain; a grid is one chain per square, running through that square
  on each page.
- **Duplicate all is plan output**: the planner lays out the first square and
  appends copies offset by whole columns and rows, flagged `isDuplicate`. The
  canvas and the Chromium PDF renderer draw the plan as given, so the renderer
  did not change.
- **Mirrored code**: the grid helper block and `planChain` are the same in
  `frontend/.../builder/types.ts` + `ShoppingListBuilder.tsx` and
  `backend/src/routes/shopping-list-builder.ts`.

## Approaches considered

1. **Squares as lanes with per-square chains** — chosen. Reuses the planner,
   row splitting, repeated table headers and the PDF path; overflow has an
   obvious home (the back of the slip).
2. **One flowing sequence through the squares** (square 1 fills, then 2…).
   Smallest change, but a long table would run into the next slip, and there
   would be no way to say "this goes in square 4".
3. **A nested mini-page per square** with its own component list. Cleanest
   model, but a second template format, a second renderer path, and a rewrite
   of selection, drag and save.

## Validation

- Built a slip in the Builder in both modes at 1920×1080; checked the Page
  panel at 1280×720 with the sidebar open.
- Exported Individual 2 × 3 and Duplicate all 2 × 4 through
  `/api/shopping-list-builder/preview-pdf`, rendered to PNG, compared with the
  canvas: same squares, same positions.
- Dragged a component from square 4 into the open area of square 2.
- `refresh-inventory` returns the grid fields and each table's `gridCell`
  unchanged.
- `builder-grid-layout.test.ts`: eight planner tests (copy counts for each
  size, copy offsets, Individual placement, stale `gridCell` clamping,
  same-square overflow, overflow reporting, Guided forced, Full/Split
  unaffected).

## Not done

- No cut marks, and no column mirroring for two-sided printing: on a
  long-edge flip the back of a left-hand slip is the right-hand square.
- The Shopping Lists table does not show which layout a template uses.
- No frontend unit test covers the grid planner; the backend mirror is tested.
- Staff have not tried it.
