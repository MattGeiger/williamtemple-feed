# Chart Color System (IBM Carbon)

Reports charts with multiple series use the IBM Carbon Design System
data-visualization palette, ported from the approach proven on the ZEV
Dashboard project.

## Why Carbon

- All colors meet WCAG 2.1 contrast requirements for data visualization
  (3.5:1 minimum against the chart background).
- Tested for deuteranopia, protanopia, and tritanopia.
- Every light-mode value has an equivalent-weight dark-mode variant, so
  theme switching needs no per-chart tuning.

References:

- <https://medium.com/carbondesign/color-palettes-and-accessibility-features-for-data-visualization-7869f4874fca>
- <https://v10.carbondesignsystem.com/guidelines/accessibility/color/>

## Implementation

`packages/frontend/src/lib/colors.ts` defines:

- `carbonChartColors` — ten hue families (blue, cyan, teal, green,
  magenta, purple, red, orange, yellow, warm gray), each with a
  `primary` and `secondary` grade and light/dark values. Light mode uses
  mid grades (50/60-range Carbon tokens); dark mode uses lighter grades
  (30/40-range).
- `CARBON_CATEGORICAL_ORDER` — a hue-hopping order for categorical
  series so adjacent lines sit far apart on the color wheel.
- `carbonTheme(family, grade)` — a ChartConfig-ready `{ light, dark }`
  theme object.
- `carbonCategoricalTheme(index)` — the Nth categorical color: primaries
  first, then secondaries (20 distinct colors).

## Usage: Operational Pressure (Reports)

- **Limited Supply** is fixed to Carbon orange (warning-adjacent) and
  **Clearance** to Carbon purple.
- The adaptive per-limit series ("1 Per Household", "2 Per Person", …)
  draw from the remaining eight families in hue-hopping order, then
  their secondary grades — so up to 16 limit configurations render
  before any color repeats, and no series ever collides with the two
  fixed lines.

A regression test
(`packages/frontend/src/test/operational-reports-tooltips.test.tsx`)
asserts every line color is distinct in both light and dark schemes.

## Adding a new multi-series chart

1. Fix semantically meaningful series to a family with
   `carbonTheme('<family>')` (e.g. warnings → orange, alerts → red).
2. Color dynamic series with `carbonCategoricalTheme(index)`, or filter
   `CARBON_CATEGORICAL_ORDER` to exclude the families you fixed in
   step 1.
3. Don't rely on color alone — keep the legend and tooltip labels.
