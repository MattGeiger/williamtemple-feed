// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Ranking a brand's colours into roles.
 *
 * A brand is not one colour, it is an ordered set — Coca-Cola is red then
 * white; Pepsi is red, blue, then a black-and-white split; Google runs four
 * chromatics over neutrals; IBM is one blue and nothing else. Getting the
 * *order* right is most of what makes a derived theme feel like the brand, so
 * the derivation takes a ranked hierarchy rather than a single accent.
 *
 * Mirrors LOTTO's `color-story.ts` so the two products rank identically and a
 * staff member sees the same roles in both wizards. Phase 2 populates the
 * hierarchy by median-cut extraction from the uploaded logo, scored by pixel
 * population weighted by chroma salience — a small saturated mark beats a large
 * pale wash for identity — with the operator able to reorder the ranks.
 */

import { hueDifference, type Oklch } from './color';

/** Below this chroma a colour reads as a neutral rather than as an identity. */
export const NEUTRAL_CHROMA_THRESHOLD = 0.04;

/**
 * Hue bands carrying operational meaning in FEED's inventory status flags.
 * A brand colour landing here is not rejected — plenty of food banks are green —
 * but it earns a warning when it would take a signalling role.
 */
export const RESERVED_HUE_BANDS = [
  { hue: 25, halfWidth: 20, meaning: 'Clearance red' },
  { hue: 75, halfWidth: 20, meaning: 'Limited-stock amber' },
  { hue: 150, halfWidth: 20, meaning: 'In-stock green' },
] as const;

/** Chroma at which a reserved-band hue starts reading as a status signal. */
export const RESERVED_BAND_SIGNAL_CHROMA = 0.09;

export type ColorClass = 'chromatic' | 'dark-neutral' | 'light-neutral';

export const classifyColor = (color: Oklch): ColorClass => {
  if (color.c >= NEUTRAL_CHROMA_THRESHOLD) return 'chromatic';
  return color.l < 0.6 ? 'dark-neutral' : 'light-neutral';
};

export type StoryRole =
  | 'primary'
  | 'accent'
  | 'ambient'
  | 'surface-dark'
  | 'surface-light';

export const ROLE_LABELS: Record<StoryRole, string> = {
  primary: 'Main colour — buttons, links, and selection',
  accent: 'Accent — hover surfaces and secondary highlights',
  ambient: 'Ambient — background tints only, never a signal',
  'surface-dark': 'Dark anchor — dark-mode surfaces',
  'surface-light': 'Light anchor — light-mode page surface',
};

export type StoryAssignment = {
  color: Oklch;
  role: StoryRole;
  label: string;
  warning: string | null;
};

export const reservedBandWarning = (
  color: Oklch,
  role: StoryRole
): string | null => {
  if (role === 'ambient') return null;
  if (color.c < RESERVED_BAND_SIGNAL_CHROMA) return null;
  for (const band of RESERVED_HUE_BANDS) {
    if (Math.abs(hueDifference(color.h, band.hue)) <= band.halfWidth) {
      return `This colour sits in the ${band.meaning} band. Staff read that hue as a stock status, so it may be misread in a signalling role.`;
    }
  }
  return null;
};

export type ColorStory = {
  assignments: StoryAssignment[];
  primary: Oklch | null;
  accent: Oklch | null;
  ambient: Oklch[];
  surfaceDark: Oklch | null;
  surfaceLight: Oklch | null;
  warnings: string[];
  /** True when the brand offers only one chromatic — an IBM, not a Google. */
  isMonochrome: boolean;
};

/**
 * Assign roles to a ranked hierarchy, index 0 most important.
 *
 * Chromatics take primary, then accent, then ambient. The first dark neutral
 * becomes the dark anchor and the first light neutral the light anchor; surplus
 * neutrals fall through to ambient.
 */
export const proposeColorStory = (hierarchy: readonly Oklch[]): ColorStory => {
  const assignments: StoryAssignment[] = [];
  const ambient: Oklch[] = [];
  let primary: Oklch | null = null;
  let accent: Oklch | null = null;
  let surfaceDark: Oklch | null = null;
  let surfaceLight: Oklch | null = null;
  let chromaticRank = 0;

  for (const color of hierarchy.slice(0, 5)) {
    const kind = classifyColor(color);
    let role: StoryRole;

    if (kind === 'dark-neutral' && !surfaceDark) {
      role = 'surface-dark';
      surfaceDark = color;
    } else if (kind === 'light-neutral' && !surfaceLight) {
      role = 'surface-light';
      surfaceLight = color;
    } else if (kind === 'chromatic' && chromaticRank === 0) {
      role = 'primary';
      primary = color;
      chromaticRank += 1;
    } else if (kind === 'chromatic' && chromaticRank === 1) {
      role = 'accent';
      accent = color;
      chromaticRank += 1;
    } else {
      role = 'ambient';
    }

    if (role === 'ambient' && ambient.length < 3) ambient.push(color);
    assignments.push({
      color,
      role,
      label: ROLE_LABELS[role],
      warning: reservedBandWarning(color, role),
    });
  }

  return {
    assignments,
    primary,
    accent,
    ambient,
    surfaceDark,
    surfaceLight,
    warnings: assignments.flatMap((entry) => (entry.warning ? [entry.warning] : [])),
    isMonochrome: chromaticRank <= 1,
  };
};
