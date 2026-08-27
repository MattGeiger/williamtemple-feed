// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * `TokenMap` → the formats FEED's three colour systems consume.
 *
 * `serializeOklch` is the active app serializer. `serializeHslTriplets` remains
 * available as a compatibility boundary for older artifacts and for measuring
 * the perceptual fidelity of the OKLCH migration.
 */

import { oklchToHex, oklchToHsl } from './color';
import type { TokenMap } from './derive';
import { BRAND_TOKENS, THEME_SCOPES, type BrandToken, type ThemeScope } from './tokens';
import { isProtectedToken } from './tokens';

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/** `222 50% 5%` — the legacy bare-triplet shape. */
export const hslTriplet = (color: Parameters<typeof oklchToHsl>[0]): string => {
  const { h, s, l } = oklchToHsl(color);
  return `${round(h, 1)} ${round(s, 1)}% ${round(l, 1)}%`;
};

/** `oklch(0.145 0.021 263)` — the active v1.7.5 shape. */
export const oklchLiteral = ({ l, c, h }: { l: number; c: number; h: number }): string =>
  `oklch(${round(l, 4)} ${round(c, 4)} ${round(h, 1)})`;

type Formatter = (color: { l: number; c: number; h: number }) => string;

const declarationsFor = (
  tokens: Record<BrandToken, { l: number; c: number; h: number }>,
  format: Formatter,
  indent: string
): string =>
  BRAND_TOKENS.map((token) => {
    // Belt and braces: the vocabulary cannot name a protected token, but the
    // generator asserts it rather than trusting that it never will.
    if (isProtectedToken(token)) {
      throw new Error(`Refusing to emit protected token "${token}".`);
    }
    return `${indent}--${token}: ${format(tokens[token])};`;
  }).join('\n');

const SCOPE_SELECTOR: Record<ThemeScope, string> = {
  // Mirrors the three-state model in docs/frontend-services/theme-control.md:
  // no stamp on the root element is the default, where only
  // `prefers-color-scheme` separates light from dark.
  light: ':root, .light',
  dark: '.dark',
};

const buildCss = (theme: TokenMap, format: Formatter): string => {
  const blocks = THEME_SCOPES.map(
    (scope) =>
      `${SCOPE_SELECTOR[scope]} {\n${declarationsFor(theme[scope], format, '  ')}\n}`
  );

  // The un-stamped dark case: `prefers-color-scheme: dark` with no `.light`
  // override present. Guarded so an explicit light choice still wins.
  blocks.push(
    `@media (prefers-color-scheme: dark) {\n  :root:not(.light) {\n${declarationsFor(
      theme.dark,
      format,
      '    '
    )}\n  }\n}`
  );

  return `${blocks.join('\n\n')}\n`;
};

/** Legacy HSL stylesheet retained for compatibility and fidelity tests. */
export const serializeHslTriplets = (theme: TokenMap): string =>
  buildCss(theme, hslTriplet);

/** Active v1.7.5 app stylesheet. */
export const serializeOklch = (theme: TokenMap): string => buildCss(theme, oklchLiteral);

/**
 * Print and PDF. `analytics-print.ts` and `pdf.ts` build SVG and inline CSS with
 * hex literals, so they take a flat map rather than a stylesheet. Print always
 * renders the light scope — a report represents paper, and must not follow the
 * app theme (AGENTS.md, UI Standards).
 */
export const serializePrintHex = (theme: TokenMap): Record<BrandToken, string> =>
  Object.fromEntries(
    BRAND_TOKENS.map((token) => [token, oklchToHex(theme.light[token])])
  ) as Record<BrandToken, string>;
