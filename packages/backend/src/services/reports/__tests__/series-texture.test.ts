// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { describe, expect, it } from 'vitest';
import { legendSvg, stackedBarSvg } from '../analytics-print';
import {
  DEFAULT_REPORT_PRINT_THEME,
  greyscalePrintTheme,
  withReportPrintTheme,
} from '../print-theme';

/**
 * Twelve series on seven greys.
 *
 * `procurement-legacy-donations-over-time` really does carry twelve, and the
 * ramp wrapped, so series 8 through 12 printed as pixel-identical copies of
 * series 1 through 5. There is no eighth grey to add — the steps are already
 * about as close as a mono printer resolves — so the range is extended with
 * texture instead.
 */
const series = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    name: `series ${i}`,
    values: [1, 2, 3],
  }));

const COLOUR = DEFAULT_REPORT_PRINT_THEME;
const BW = greyscalePrintTheme(COLOUR);

const fillsOf = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map(m => m[1]);

describe('series texture', () => {
  it('spends every solid grey before reaching for a pattern', () => {
    const svg = withReportPrintTheme(BW, () => stackedBarSvg(['a', 'b', 'c'], series(7)));
    expect(svg).not.toContain('<pattern');
    expect(fillsOf(svg).filter(f => f.startsWith('url('))).toEqual([]);
  });

  it('gives a twelve-series chart twelve distinguishable fills', () => {
    const svg = withReportPrintTheme(BW, () => stackedBarSvg(['a'], series(12)));
    const barFills = fillsOf(svg).filter(f => f !== 'none');
    // One bar per series in a single-category chart, plus the pattern tiles.
    const distinct = new Set(barFills);
    expect(distinct.size).toBeGreaterThanOrEqual(12);
    // The five that used to duplicate now reference a pattern instead.
    expect(barFills.filter(f => f.startsWith('url(')).length).toBe(5);
  });

  it('defines every pattern it references, in the same SVG', () => {
    const svg = withReportPrintTheme(BW, () => stackedBarSvg(['a'], series(12)));
    for (const ref of fillsOf(svg).filter(f => f.startsWith('url('))) {
      const id = ref.slice(5, -1);
      expect(svg, `undefined pattern ${id}`).toContain(`<pattern id="${id}"`);
    }
  });

  it('textures the legend the same way it textures the bars', () => {
    // A swatch that does not match its bars is worse than no legend: it
    // asserts a correspondence that is not there.
    const names = series(12).map(s => s.name);
    const chart = withReportPrintTheme(BW, () => stackedBarSvg(['a'], series(12)));
    const legend = withReportPrintTheme(BW, () => legendSvg(names));
    const refs = (svg: string) =>
      fillsOf(svg).filter(f => f.startsWith('url('));
    expect(refs(legend)).toEqual(refs(chart));
    for (const ref of refs(legend)) {
      expect(legend).toContain(`<pattern id="${ref.slice(5, -1)}"`);
    }
  });

  it('leaves the colour rendering flat', () => {
    // Texture is the compensation for grey having fewer usable steps than hue.
    // Applying it to the colour PDF would be noise bought with nothing.
    const svg = withReportPrintTheme(COLOUR, () => stackedBarSvg(['a'], series(12)));
    expect(svg).not.toContain('<pattern');
    expect(fillsOf(svg).filter(f => f.startsWith('url('))).toEqual([]);
  });
});
