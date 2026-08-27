// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * The Phase 0 gate: can the pipeline reproduce the theme FEED already ships?
 *
 * If it cannot recreate William Temple House from brand inputs, it is not ready
 * for anyone else's identity. This is deliberately a *perceptual* comparison
 * rather than an exact one — snapping trades precision for a provable space, so
 * demanding equality would assert the opposite of the design. What it holds is
 * that every token stays perceptually close and, more importantly, that nothing
 * crosses a contrast floor the current theme clears.
 *
 * This same comparison is re-run across the v1.7.5 OKLCH boundary; identical
 * brand inputs must produce identical output before and after (plan, Phase 5).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { hexToOklch, hslToOklch, parseHslTriplet, perceptualDistance } from '../color';
import { deriveTheme } from '../derive';
import { BRAND_TOKENS, type BrandToken, type ThemeScope } from '../tokens';

const INDEX_CSS = resolve(__dirname, '../../../../../frontend/src/index.css');

/** William Temple House's two identity colours, from the logo and email brand. */
const WTH_BLUE = '#186090';
const WTH_GOLD = '#FFE066';
const WTH_SURFACE = { h: 222, s: 50, l: 10 };

/**
 * Read the shipped light and dark values for a token. `index.css` declares the
 * light block first and the dark block second, and some tokens alias others via
 * `var(--...)`, which this deliberately skips.
 */
const shippedTokens = (): Record<ThemeScope, Partial<Record<BrandToken, string>>> => {
  const css = readFileSync(INDEX_CSS, 'utf8');
  const result: Record<ThemeScope, Partial<Record<BrandToken, string>>> = {
    light: {},
    dark: {},
  };

  // Parsed line by line rather than by one regex per token: the declarations are
  // one per line, and a hand-escaped pattern built inside a template string is
  // exactly the sort of thing that silently matches nothing and leaves the
  // comparison below asserting over an empty set.
  const seen = new Map<string, string[]>();
  for (const line of css.split('\n')) {
    const match = line.match(/^\s*--([a-z-]+):\s*([^;]+);/);
    if (!match) continue;
    const [, name, value] = match;
    const values = seen.get(name) ?? [];
    values.push(value.trim());
    seen.set(name, values);
  }

  for (const token of BRAND_TOKENS) {
    const values = seen.get(token);
    if (!values) continue;
    // index.css declares the light block before the dark one.
    if (values[0]) result.light[token] = values[0];
    if (values[1]) result.dark[token] = values[1];
  }

  return result;
};

/**
 * Tokens where the derived value deliberately differs from what FEED ships.
 *
 * Kept as an explicit list with reasons rather than by loosening the threshold:
 * a wider bound would hide real drift everywhere to excuse four known cases. The
 * test also asserts each of these *still* diverges, so the list cannot quietly
 * rot once a divergence is resolved.
 */
const ACCEPTED_DIVERGENCES: Record<string, string> = {
  'light --input':
    'FEED ships --input at 50% lightness in both themes, and the Input primitive ' +
    'does not consume it (it hardcodes border-slate-200). The derived slate-300 ' +
    'is the value the token is supposed to carry.',
  'dark --primary-foreground':
    'FEED hand-picks WTH blue as the text on the gold primary. The derived value ' +
    'is near-black, which is higher contrast and brand-neutral. Restoring the ' +
    'exact pairing is an Advanced-tier override (plan, D9).',
  'dark --accent':
    'FEED\'s --accent is internally inconsistent — teal-tinted in light, neutral ' +
    'in dark, neither matching the brand. The derived value carries the brand hue ' +
    'into hover and selected surfaces, which is the point of the token.',
  // The next three are FEED's untuned sidebar defaults. All three carry the
  // identical value `222 10.9% 18%` that `--ring` does — the one measuring
  // 1.50:1 — which is the signature of copied placeholders rather than chosen
  // colours. The derived values follow the same accent logic as the rest of the
  // app and clear their contrast floors.
  'dark --sidebar-primary':
    'FEED ships the same untuned value here as for --ring. The derived value ' +
    'carries the dark accent and passes its contrast pair.',
  'dark --sidebar-primary-foreground':
    'Follows --sidebar-primary: FEED pairs white on its dark placeholder, the ' +
    'derived theme pairs near-black on a light accent. Each is correct for its ' +
    'own fill.',
  'dark --sidebar-ring':
    'Same untuned placeholder as --ring and --sidebar-primary.',
  'dark --sidebar-accent':
    'FEED hand-tunes the selected nav item to a saturated dark blue — the ' +
    'light-mode brand hue — while the derived theme uses the dark accent ' +
    'family, as every other accent-role token in the dark scope does. A ' +
    'deliberate consistency choice over FEED\'s hand-tuned exception.',
  'dark --ring':
    'FEED\'s dark focus ring measures 1.50:1 against the page — below the WCAG ' +
    '1.4.11 floor for focus indicators. The derived ring clears 3:1. This ' +
    'divergence is a correction, not drift.',
};

describe('Phase 0 fidelity gate — reproducing William Temple House', () => {
  const derived = deriveTheme({
    accent: hexToOklch(WTH_BLUE),
    accentDark: hexToOklch(WTH_GOLD),
    neutral: hslToOklch(WTH_SURFACE),
  });

  it('reads the shipped theme out of index.css', () => {
    const shipped = shippedTokens();
    expect(Object.keys(shipped.light).length).toBeGreaterThan(10);
    expect(Object.keys(shipped.dark).length).toBeGreaterThan(10);
  });

  it('resolves William Temple House onto sky and a blue-leaning neutral', () => {
    expect(derived.accentFamily).toBe('sky');
    // Dark mode carries the gold half of the identity, not a lighter blue.
    expect(derived.accentDarkFamily).toBe('amber');
    expect(derived.neutralFamily).toBe('slate');
  });

  it('stays perceptually close to every shipped token it can compare', () => {
    const shipped = shippedTokens();
    const drifted: string[] = [];
    let compared = 0;
    const stillDiverging = new Set<string>();

    for (const scope of ['light', 'dark'] as const) {
      for (const token of BRAND_TOKENS) {
        const raw = shipped[scope][token];
        if (!raw) continue;
        const triplet = parseHslTriplet(raw);
        // `var(--primary)` style aliases are not comparable values.
        if (!triplet) continue;

        compared += 1;
        const distance = perceptualDistance(
          hslToOklch(triplet),
          derived.tokens[scope][token]
        );
        // 0.20 in OKLab is a generous but meaningful bound: same colour family
        // and broadly the same lightness, which is what "still reads as FEED"
        // requires. Anything larger is a different colour, not a snap.
        const key = `${scope} --${token}`;
        const diverges = distance > 0.2;

        if (diverges && !(key in ACCEPTED_DIVERGENCES)) {
          drifted.push(`${key}: ${raw} drifted ${distance.toFixed(3)}`);
        }
        if (diverges) stillDiverging.add(key);
      }
    }

    expect(drifted, `\n${drifted.join('\n')}`).toEqual([]);

    // A green run here means nothing unless tokens were actually compared.
    expect(compared).toBeGreaterThanOrEqual(20);

    // Every accepted divergence must still be one. If a change brings a token
    // back into line, the entry should be deleted rather than left to imply a
    // difference that no longer exists.
    const stale = Object.keys(ACCEPTED_DIVERGENCES).filter(
      (key) => !stillDiverging.has(key)
    );
    expect(stale, `no longer diverging: ${stale.join(', ')}`).toEqual([]);
  });
});
