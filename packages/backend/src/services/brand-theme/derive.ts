// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Brand inputs → `TokenMap`.
 *
 * The output is structured palette data, never CSS text, because three colour
 * systems consume it: the app's CSS tokens, the PDF/print palette (hardcoded
 * hex today), and the Carbon chart ranking. Serializers live in `serialize.ts`
 * and `charts.ts`; swapping the app serializer from HSL to OKLCH is the whole of
 * the v1.7.5 migration.
 */

import type { Oklch } from './color';
import { entryToOklch, paletteEntry, snap, type SnapCandidate } from './snap';
import {
  BRAND_TOKENS,
  STOP_MAP,
  THEME_SCOPES,
  type BrandToken,
  type ThemeScope,
} from './tokens';

/**
 * What an operator supplies. `accentFamily` and `neutralFamily` are normally
 * the snap results, but are accepted directly so the wizard can honour an
 * operator who picks a runner-up.
 */
export type BrandInput = {
  /** The agency's own accent colour, before snapping. */
  accent: Oklch;
  /**
   * A separate accent for dark mode, before snapping.
   *
   * Not a nicety — William Temple House is the proof case. FEED's light primary
   * is WTH blue and its dark primary is WTH gold, because a mid-blue that reads
   * as confident on white goes muddy on near-black. An agency with two identity
   * colours normally wants exactly this. Omitted, dark reuses the light accent's
   * family, which is the right default for a single-colour brand.
   */
  accentDark?: Oklch;
  /** The agency's surface or text colour, before snapping. Optional. */
  neutral?: Oklch;
  /** Overrides the snapped accent family. */
  accentFamily?: string;
  /** Overrides the snapped dark accent family. */
  accentDarkFamily?: string;
  /** Overrides the snapped neutral family. */
  neutralFamily?: string;
};

export type ResolvedFamilies = {
  accentFamily: string;
  /** Equals `accentFamily` unless the brand supplies a separate dark accent. */
  accentDarkFamily: string;
  neutralFamily: string;
  accentSnap: SnapCandidate;
  accentDarkSnap: SnapCandidate | null;
  neutralSnap: SnapCandidate | null;
};

/** A complete theme: every token resolved to a concrete colour, per scope. */
export type TokenMap = Record<ThemeScope, Record<BrandToken, Oklch>>;

export type DerivedTheme = ResolvedFamilies & { tokens: TokenMap };

/** Palette-adjacent extremes the stop map may name. */
const EXTREMES: Record<'white' | 'black', Oklch> = {
  white: { l: 1, c: 0, h: 0 },
  black: { l: 0, c: 0, h: 0 },
};

/**
 * A neutral is not always supplied — many agencies have one brand colour and no
 * stated surface. Falling back to the accent's own hue at very low chroma picks
 * the neutral family that leans toward the brand, which is what a designer would
 * do by hand (FEED's blue surfaces sit on `slate`, not `zinc`).
 */
const neutralTargetFor = (input: BrandInput): Oklch =>
  input.neutral ?? { l: 0.5, c: 0.02, h: input.accent.h };

export const resolveFamilies = (input: BrandInput): ResolvedFamilies => {
  const accentSnap = snap(input.accent, 'chromatic');
  const accentDarkSnap = input.accentDark ? snap(input.accentDark, 'chromatic') : null;
  const neutralTarget = neutralTargetFor(input);
  const neutralSnap = snap(neutralTarget, 'neutral');

  const accentFamily = input.accentFamily ?? accentSnap.entry.family;

  return {
    accentFamily,
    accentDarkFamily:
      input.accentDarkFamily ?? accentDarkSnap?.entry.family ?? accentFamily,
    neutralFamily: input.neutralFamily ?? neutralSnap.entry.family,
    accentSnap,
    accentDarkSnap,
    neutralSnap: input.neutral ? neutralSnap : null,
  };
};

const colorFor = (
  token: BrandToken,
  scope: ThemeScope,
  families: ResolvedFamilies
): Oklch => {
  const rule = STOP_MAP[token];
  const stop = rule[scope];
  if (stop === 'white' || stop === 'black') return EXTREMES[stop];

  const accentFamily =
    scope === 'dark' ? families.accentDarkFamily : families.accentFamily;
  const family = rule.role === 'accent' ? accentFamily : families.neutralFamily;
  return entryToOklch(paletteEntry(family, stop));
};

export const deriveTheme = (input: BrandInput): DerivedTheme => {
  const families = resolveFamilies(input);

  const tokens = Object.fromEntries(
    THEME_SCOPES.map((scope) => [
      scope,
      Object.fromEntries(
        BRAND_TOKENS.map((token) => [token, colorFor(token, scope, families)])
      ) as Record<BrandToken, Oklch>,
    ])
  ) as TokenMap;

  return { ...families, tokens };
};

/**
 * Derive straight from two family names, skipping the snap. Used by the
 * exhaustive contrast proof, which walks all 153 combinations rather than
 * starting from a colour.
 */
export const deriveFromFamilies = (
  accentFamily: string,
  neutralFamily: string
): TokenMap => {
  const families: ResolvedFamilies = {
    accentFamily,
    accentDarkFamily: accentFamily,
    neutralFamily,
    accentSnap: { entry: paletteEntry(accentFamily, 500), distance: 0 },
    accentDarkSnap: null,
    neutralSnap: null,
  };

  return Object.fromEntries(
    THEME_SCOPES.map((scope) => [
      scope,
      Object.fromEntries(
        BRAND_TOKENS.map((token) => [token, colorFor(token, scope, families)])
      ) as Record<BrandToken, Oklch>,
    ])
  ) as TokenMap;
};
