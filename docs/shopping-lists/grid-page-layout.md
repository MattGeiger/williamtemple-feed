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
| What fits in a square? | Text, date, form fields, section tables (inventory included), lines, legends, saved components. |
| How many pages? | **One.** Max pages is locked to 1 in Grid. **Make 2-sided** prints the same page on the back. |
| Content too long for its square? | **Not allowed.** A change that would not fit — adding a component, adding rows, a larger font, a smaller grid — is refused and an error message says which component would not fit. |
| What if it stops fitting on its own? | Inventory can grow after a template is saved. The template still opens; a warning names the component and the status bar shows how many do not fit. |
| Header and footer? | **None.** Every component sits in a square. Header and Footer are locked in the Page region control, with a tooltip saying why. The header and footer *heights* still act as the top and bottom margins. |
| Cut marks? | Dashed lines are printed between squares, edge to edge. On by default; **Page → Print → Cut marks** hides them. Split pages get one down the middle of the body. |
| Guided or Freeform? | Both. Guided stacks components from the top of the square. Freeform lets you place them anywhere inside the square, without snapping; they cannot leave it. |
| Section-table font size? | Capped at 12pt, as in Split: a square is as narrow as a split lane. |
| Translation? | Per component, unchanged. |

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
  are one chain; a grid is one chain per square on its single page.
- **Overflow guard**: one check after every template change compares which
  components fit before and after, and reverts a user edit that made it worse
  before the browser paints.
- **Freeform**: the planner places each component at its stored position,
  clamped inside its square, instead of stacking.
- **Cut marks**: one helper returns the lines; the canvas and the PDF both
  draw them.
- **Duplicate all is plan output**: the planner lays out the first square and
  appends copies offset by whole columns and rows, flagged `isDuplicate`. The
  canvas and the Chromium PDF renderer draw the plan as given, so the renderer
  did not change.
- **Mirrored code**: the grid helper block and `planChain` are the same in
  `frontend/.../builder/types.ts` + `ShoppingListBuilder.tsx` and
  `backend/src/routes/shopping-list-builder.ts`.

## Approaches considered

1. **Squares as lanes with per-square chains** — chosen. Reuses the planner,
   row measurement and the PDF path.
2. **One flowing sequence through the squares** (square 1 fills, then 2…).
   Smallest change, but a long table would run into the next slip, and there
   would be no way to say "this goes in square 4".
3. **A nested mini-page per square** with its own component list. Cleanest
   model, but a second template format, a second renderer path, and a rewrite
   of selection, drag and save.

The first build let overflow continue in the same square on a second page,
kept a page-level header and footer, printed no cut marks, and disabled
Freeform. The owner reviewed it the same day and set the rules above instead.

## Validation

- Built slips in the Builder in both content modes and both layout modes.
- Tried to add a 13-row inventory table to a 2 × 4 square: refused, with the
  error message, and the page unchanged.
- Clicked a locked Header option: tooltip shown, region stayed Body.
- Dragged a Freeform component far outside its square: it stopped at the
  square's edge, and every copy moved with it.
- Exported and rendered to PNG: Guided Individual 2 × 3, Guided Duplicate all
  2 × 4, Freeform Duplicate all 2 × 3 with cut marks and Make 2-sided (two
  identical pages, although Max pages was 3), and a Split page with its cut
  mark.
- `refresh-inventory` returns the grid fields and each table's `gridCell`
  unchanged.
- Ten backend planner tests and twenty-one frontend tests assert the same
  geometry on both sides.

## Not done

- Two-sided printing does not mirror columns: on a long-edge flip the back of
  a left-hand slip is the right-hand square. With Duplicate all this does not
  matter; with Individual it does.
- Freeform does not stop components overlapping inside a square.
- Staff have not tried it.
