# Chart Color System (IBM Carbon)

Reports charts with multiple series use the IBM Carbon Design System
data-visualization palette, ported from the approach proven on the ZEV
Dashboard project.

## Why Carbon

- Carbon provides a broad set of hue families designed with color-vision
  accessibility in mind.
- FEED selects specific grades that achieve at least **4.5:1 contrast** against
  the actual light and dark card surfaces. This exceeds the 3:1 WCAG threshold
  for meaningful non-text graphics.
- Every light-mode value has a paired dark-mode grade, and automated tests read
  FEED's theme tokens and verify every configured pair.
- Charts retain legends and tooltips so meaning never depends on color alone.

References:

- <https://medium.com/carbondesign/color-palettes-and-accessibility-features-for-data-visualization-7869f4874fca>
- <https://v10.carbondesignsystem.com/guidelines/accessibility/color/>

## Implementation

`packages/frontend/src/lib/colors.ts` defines:

- `carbonChartColors` — ten hue families (blue, cyan, teal, green,
  magenta, purple, red, orange, yellow, warm gray), each with a
  `primary` and `secondary` grade and light/dark values. Light mode uses
  darker 60/70-range Carbon tokens; dark mode uses lighter 40/30-range tokens.
- `CARBON_CATEGORICAL_ORDER` — a hue-hopping order for categorical
  series so adjacent lines sit far apart on the color wheel.
- `carbonTheme(family, grade)` — a ChartConfig-ready `{ light, dark }`
  theme object.
- `carbonCategoricalTheme(index)` — the Nth categorical color: primaries
  first, then secondaries (20 distinct colors).

## Usage: Operational Pressure (Reports)

- **Limited Supply** is fixed to Carbon orange (warning-adjacent),
  **Clearance** to Carbon purple, and **Categories with Limits** to teal.
- The adaptive per-limit series ("1 Per Household", "2 Per Person", …)
  draw from the remaining seven families in hue-hopping order, then
  their secondary grades — so up to 14 limit configurations render
  before any color repeats, and no series ever collides with the two
  fixed Food Item status lines or the category-policy line.

Regression tests assert that pressure-chart lines remain distinct and that
every palette color maintains at least 4.5:1 contrast against the corresponding
FEED card surface in both themes.

## Adding a new multi-series chart

1. Fix semantically meaningful series to a family with
   `carbonTheme('<family>')` (e.g. warnings → orange, alerts → red).
2. Color dynamic series with `carbonCategoricalTheme(index)`, or filter
   `CARBON_CATEGORICAL_ORDER` to exclude the families you fixed in
   step 1.
3. Don't rely on color alone — keep the legend and tooltip labels.
