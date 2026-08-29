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

### Shipped in 1.7.5-beta.5: colour and greyscale together

An export packages two renderings of the same
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
colour output changes, so no reader of the colour report can regress.

### How it is built

`greyscalePrintTheme` in `packages/backend/src/services/reports/print-theme.ts`
converts every colour except the series with `greyscaleOf`, which returns the
grey of identical relative luminance. Because luminance is preserved, contrast
survives the conversion exactly — a heading that cleared 7.05:1 in colour clears
7.00:1 in grey — so the greyscale rendering needs no separate contrast proof.

The series ramp is replaced rather than converted, since converting is the thing
that fails. `PRINT_GREYSCALE_SERIES` is seven steps spaced evenly in perceptual
lightness between L 0.20 and L 0.66:

| step | hex       | on white |
| ---- | --------- | -------- |
| 1    | `#161616` | 18.10:1  |
| 2    | `#282828` | 14.74:1  |
| 3    | `#3b3b3b` | 11.20:1  |
| 4    | `#505050` | 8.06:1   |
| 5    | `#656565` | 5.83:1   |
| 6    | `#7b7b7b` | 4.23:1   |
| 7    | `#929292` | 3.11:1   |

The lightest step clears 3:1 (WCAG 1.4.11 for meaningful graphics) and adjacent
steps differ by 1.23–1.39x in contrast, which is a visible difference in grey.

**The order the ladder is handed out matters more than the ladder.** Charts take
`palette[0]`, `palette[1]`, and so on in sequence, so a two-series chart gets
whatever the first two entries are. Shipping the ladder in lightness order gave
that chart steps 1 and 2 — the two darkest *neighbours*, 1.23x apart, which is
the ramp's worst possible pair and was unreadable in print. The fix is to spend
the extremes first and subdivide from there, a bisection order:

    [0, 6, 3, 5, 1, 4, 2]

Separation then degrades gracefully instead of starting at its worst. Measured
as the smallest contrast gap between any two series a chart of *n* bars gets:

| series | worst pair | before (sequential) |
| ------ | ---------- | ------------------- |
| 2      | 5.82x      | 1.23x               |
| 3      | 2.25x      | 1.23x               |
| 4      | 1.36x      | 1.23x               |
| 5–7    | 1.23x      | 1.23x               |

Two- and three-series charts are the common case and are now unmistakable; a
seven-series chart is no worse than it was.

### Past seven series: texture

Seven is the ramp's real ceiling. The steps are already 1.23x apart at the close
end, which is about what a mono printer resolves, so an eighth step buys a
distinction nobody can see. But `procurement-legacy-donations-over-time` carries
**twelve** series, and the ramp wrapped: series 8 through 12 printed as exact
copies of series 1 through 5, with a legend confidently naming both.

The range is extended with texture instead, and only once the greys are gone:

| series | treatment                         |
| ------ | --------------------------------- |
| 1–7    | solid grey, no pattern at all     |
| 8–14   | the same seven greys, hatched     |
| 15–21  | the same seven greys, cross-hatch |

Texture is noisier than a flat fill. That is exactly why it is the extension and
not the scheme — a chart of seven or fewer series never sees one, and the colour
rendering never sees one at all, because hue has as many usable steps as a chart
has series and would be paying the noise for nothing.

The hatch lines are cut in the paper colour rather than drawn in a darker grey,
so a textured series reads *lighter* than the solid series it shares a step
with. The pair is separated twice over, by texture and by apparent lightness.

Lines get the same idea by a different mechanism: a 2-unit stroke is too thin to
hold a fill pattern, so `seriesDash` dashes them. A reader matching a hatched
legend swatch to a dashed line is doing a small translation, but both read as
"the marked one" against a solid twin of the same grey, and the grey still
carries the primary identity.

Two implementation points worth keeping:

- **Every SVG that draws series carries its own `<defs>`, the legend included.**
  A legend swatch that does not carry its bars' texture is worse than no legend,
  because it asserts a correspondence that is not there.
- **Pattern ids are a pure function of what they define** (`feed-tx-1-161616`),
  not a counter. A page holds many card SVGs inline, so two charts that both
  reach series eight emit the same id twice. A counter would avoid the duplicate
  at the cost of output that differs run to run; identical definitions render
  correctly under either resolution, so determinism is the better trade.

A bar that carries its own label is left flat regardless — in `hBarSvg` the row
fill is decorative, and texturing something already named is noise with no
information in it. Only the segments, which are decoded from a legend, take it.

One trap worth recording. `card.print` reads the print theme from an
async-local scope and bakes the series colours into the SVG it returns, so
rendering the cards once and handing the same SVG strings to both variants
produces a "greyscale" PDF whose chrome is grey and whose bars are still full
Carbon. The charts must be drawn once per variant; only the card *data* is
computed once, because it does not depend on colour. This was caught by
inspecting the PDF's own colour operators rather than by looking at the file,
and `greyscale-print.test.ts` now holds the theme half of it.

A second trap, same shape: any colour written as a literal in the document CSS
rather than read from the theme cannot be greyscaled, because
`greyscalePrintTheme` only transforms the theme. The caution-note box shipped
amber (`#FFF8E1` on `#8A5A00`) hardcoded in `analytics-report.ts`, so it stayed
amber in a PDF that was supposed to have no colour in it. It is now
`theme.note`, and the check that catches this class of bug is to decompress the
PDF's content streams and assert that **no** `rg` operator has unequal
components — not to read the CSS.
