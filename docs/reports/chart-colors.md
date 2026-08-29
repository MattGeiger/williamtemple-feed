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

## Usage: Seasonal Inbound Weight (Analytics)

- The current calendar year always uses the first Carbon categorical color.
  Each preceding year advances one position through the 20-color sequence.
- A year's color is derived from its distance from the current year, not its
  position in the selected subset. Selecting or clearing years therefore never
  recolors the series that remain visible.
- The current-year line uses a wider stroke and a restrained glow derived from
  the same light/dark chart color. The legend and tooltip retain explicit year
  labels so the emphasis does not make color the only means of identification.
- The sequence repeats after 20 years. This keeps the mapping deterministic for
  longer histories while preserving distinct colors throughout FEED's current
  imported procurement range.

## Adding a new multi-series chart

1. Fix semantically meaningful series to a family with
   `carbonTheme('<family>')` (e.g. warnings → orange, alerts → red).
2. Color dynamic series with `carbonCategoricalTheme(index)`, or filter
   `CARBON_CATEGORICAL_ORDER` to exclude the families you fixed in
   step 1.
3. Don't rely on color alone — keep the legend and tooltip labels.

## Print readiness: the palette is isoluminant

Carbon's categorical grades are chosen to sit at roughly equal luminance, so no
series visually dominates another. That is the right property on a screen and
it is what makes the palette colour-vision safe. It has one consequence that
only matters on paper.

Measured on a real exported report — three procurement cards, actual data, a
configured non-default brand:

| series    | contrast on white | greyscale value |
| --------- | ----------------- | --------------- |
| `#007d79` | 4.99:1            | 111             |
| `#ba4e00` | 5.03:1            | 111             |
| `#8a3ffc` | 5.00:1            | 111             |
| `#198038` | 5.02:1            | 111             |

Every series is comfortably legible against paper. Adjacent series, however,
differ by **1.00–1.01:1** — they are separated by hue alone. Converted to
greyscale all four map to exactly **111/255**, a spread of zero. On a mono
printer or a photocopy every bar becomes the same grey and the legend is the
only remaining way to read the chart.

This is inherent to Carbon and predates the white-label work; it is specific to
the PDF path because that is the output that gets printed. Pantries print on
whatever is in the office.

### Planned: ship colour and greyscale together

**Slated for the next beta.** An export packages two renderings of the same
report, and the reader chooses which to print.

The colour version stays exactly as it is — Carbon, isoluminant, unchanged. The
greyscale version varies **lightness** across the series, because with no hue
available lightness is the only channel left to carry the distinction.

Three alternatives were considered and rejected:

- **Patterns or hatching on bars.** Works regardless of colour, and adds visual
  noise to every chart including the colour one, where there is no problem to
  solve.
- **Varying lightness in the colour version.** Lightness reads as rank, so it
  would imply a hierarchy among series that do not have one. That objection is
  exactly why it is the right choice in a greyscale-only rendering, where the
  reader knows hue has been removed.
- **Direct-labelling every series.** Adds text to a visualisation to compensate
  for a rendering problem, and the report already direct-labels values.

Two artifacts cost more bytes than one and are otherwise free: nothing about the
colour output changes, so no screen reader of the report can regress.
