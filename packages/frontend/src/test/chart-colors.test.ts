// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { carbonChartColors } from '@/lib/colors';

type Rgb = [number, number, number];

const cssPathCandidates = [
  resolve(process.cwd(), 'src/index.css'),
  resolve(process.cwd(), 'packages/frontend/src/index.css'),
];
const cssPath = cssPathCandidates.find((candidate) => existsSync(candidate));
if (!cssPath) {
  throw new Error('Unable to locate packages/frontend/src/index.css.');
}
const css = readFileSync(cssPath, 'utf8');

const hslToRgb = (hue: number, saturationPercent: number, lightnessPercent: number): Rgb => {
  const saturation = saturationPercent / 100;
  const lightness = lightnessPercent / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const offset = lightness - chroma / 2;
  const [red, green, blue] =
    segment < 1 ? [chroma, x, 0] :
    segment < 2 ? [x, chroma, 0] :
    segment < 3 ? [0, chroma, x] :
    segment < 4 ? [0, x, chroma] :
    segment < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return [red, green, blue].map(
    (channel) => Math.round((channel + offset) * 255)
  ) as Rgb;
};

const parseCardBackgrounds = (): [Rgb, Rgb] => {
  const matches = [...css.matchAll(
    /--card:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g
  )];
  if (matches.length < 2) {
    throw new Error('Unable to read light and dark card tokens from index.css.');
  }
  return matches.slice(0, 2).map((match) =>
    hslToRgb(Number(match[1]), Number(match[2]), Number(match[3]))
  ) as [Rgb, Rgb];
};

const hexToRgb = (hex: string): Rgb => {
  const channels = hex.match(/[\da-f]{2}/gi);
  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}.`);
  }
  return channels.map((channel) => Number.parseInt(channel, 16)) as Rgb;
};

const relativeLuminance = ([red, green, blue]: Rgb) => {
  const linear = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrastRatio = (foreground: string, background: Rgb) => {
  const foregroundLuminance = relativeLuminance(hexToRgb(foreground));
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
};

describe('Carbon chart palette accessibility', () => {
  test('every light and dark grade maintains 4.5:1 contrast on FEED cards', () => {
    const [lightCard, darkCard] = parseCardBackgrounds();

    for (const [family, grades] of Object.entries(carbonChartColors)) {
      for (const [grade, colors] of Object.entries(grades)) {
        expect(
          contrastRatio(colors.light, lightCard),
          `${family}.${grade}.light lacks contrast`
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(colors.dark, darkCard),
          `${family}.${grade}.dark lacks contrast`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
