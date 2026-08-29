// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { describe, expect, it } from 'vitest';
import { contrastRatioHex } from '../../brand-theme/color';
import { PRINT_GREYSCALE_SERIES } from '../../brand-theme/charts';
import { greyscalePrintTheme, type ReportPrintTheme } from '../print-theme';

/**
 * A report is a document that gets printed, often on whatever is in the office.
 *
 * Carbon's categorical grades are isoluminant so that no series dominates
 * another, which is right on screen and is what makes them colour-vision safe.
 * On paper it means the series are separated by hue alone: measured on a real
 * export, all four mapped to greyscale 111/255, a spread of zero, so a mono
 * printer turned every bar the same grey.
 */
const isGrey = (hex: string) => {
  const [r, g, b] = hex.replace('#', '').match(/../g)!.map(h => parseInt(h, 16));
  return Math.abs(r - g) <= 1 && Math.abs(g - b) <= 1;
};

const COLOUR_THEME: ReportPrintTheme = {
  palette: ['#007d79', '#ba4e00', '#8a3ffc', '#198038', '#1192e8', '#a56eff', '#005d5d'],
  ink: '#0c0c09',
  muted: '#5b5b4b',
  grid: '#d8d8d0',
  background: '#ffffff',
  primary: '#3c6300',
  primarySoft: '#ecfccb',
};

describe('the black-and-white rendering', () => {
  const bw = greyscalePrintTheme(COLOUR_THEME);

  it('leaves no colour anywhere in the document', () => {
    const offenders = [
      ...bw.palette,
      bw.ink,
      bw.muted,
      bw.grid,
      bw.background,
      bw.primary,
      bw.primarySoft,
    ].filter(hex => !isGrey(hex));
    expect(offenders, `not grey: ${offenders.join(', ')}`).toEqual([]);
  });

  it('keeps every contrast ratio the colour version had', () => {
    // Luminance-preserving conversion is why the greyscale rendering needs no
    // separate contrast proof: a heading that cleared 7:1 in colour still does.
    for (const key of ['ink', 'muted', 'primary'] as const) {
      const before = contrastRatioHex(COLOUR_THEME[key], '#ffffff');
      const after = contrastRatioHex(bw[key], '#ffffff');
      expect(Math.abs(before - after), `${key}: ${before} -> ${after}`).toBeLessThan(0.1);
    }
  });

  it('separates the series by lightness, which converting could never do', () => {
    // The whole point. Converting the Carbon grades by luminance maps them all
    // to one value, so the ramp replaces them rather than transforming them.
    const converted = new Set(bw.palette);
    expect(converted.size).toBe(bw.palette.length);
    expect(bw.palette).toEqual(
      COLOUR_THEME.palette.map((_, i) => PRINT_GREYSCALE_SERIES[i % PRINT_GREYSCALE_SERIES.length])
    );
  });

  it('keeps every series readable against paper', () => {
    // WCAG 1.4.11: meaningful non-text graphics need 3:1.
    for (const hex of PRINT_GREYSCALE_SERIES) {
      expect(contrastRatioHex(hex, '#ffffff'), hex).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps adjacent series far enough apart to tell apart', () => {
    const ratios = PRINT_GREYSCALE_SERIES.map(hex => contrastRatioHex(hex, '#ffffff'));
    for (let i = 1; i < ratios.length; i += 1) {
      expect(ratios[i - 1] / ratios[i], `steps ${i - 1}->${i}`).toBeGreaterThan(1.2);
    }
  });
});
