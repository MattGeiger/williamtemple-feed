// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { describe, expect, it } from 'vitest';

import { contrastRatio, oklchToRgb } from '../color';
import { hexToOklch, oklchToHex } from '../color';
import { classifyColor, proposeColorStory } from '../color-story';
import { deriveTheme } from '../derive';
import { isMuddy, mudEscapeFamily, paletteEntry } from '../snap';

/** William Temple House's logo reads blue → teal → gold, left to right. */
const WTH_HIERARCHY = ['#186090', '#2AA198', '#FFE066'].map(hexToOklch);
/** IBM-style: one chromatic and nothing else. */
const MONOCHROME = ['#186090', '#2D2D2D'].map(hexToOklch);

describe('ranking a brand into roles', () => {
  it('separates chromatics from light and dark neutrals', () => {
    expect(classifyColor(hexToOklch('#186090'))).toBe('chromatic');
    expect(classifyColor(hexToOklch('#2D2D2D'))).toBe('dark-neutral');
    expect(classifyColor(hexToOklch('#F7F7F7'))).toBe('light-neutral');
  });

  it('assigns primary and accent by rank, the rest as ambience', () => {
    const story = proposeColorStory(WTH_HIERARCHY);
    expect(oklchToHex(story.primary!)).toBe('#186090');
    expect(story.accent).not.toBeNull();
    expect(story.ambient.length).toBe(1);
    expect(story.isMonochrome).toBe(false);
  });

  it('recognises a single-colour brand', () => {
    const story = proposeColorStory(MONOCHROME);
    expect(story.isMonochrome).toBe(true);
    expect(story.accent).toBeNull();
    expect(story.surfaceDark).not.toBeNull();
  });

  it('warns when a signalling colour lands in a stock-status hue band', () => {
    // A pantry branded in in-stock green: allowed, but staff read that hue as
    // a stock status, so a signalling role earns a note.
    const story = proposeColorStory([hexToOklch('#1A9E4B')]);
    expect(story.warnings.length).toBeGreaterThan(0);
    expect(story.warnings[0]).toContain('In-stock green');
  });

  it('does not warn for the same hue used only as ambience', () => {
    const story = proposeColorStory(
      ['#186090', '#2AA198', '#1A9E4B'].map(hexToOklch)
    );
    const ambient = story.assignments.find((a) => a.role === 'ambient');
    expect(ambient?.warning).toBeNull();
  });
});

describe('the mud guard', () => {
  it('recognises the brown zone', () => {
    // amber-800 keeps 73% of its chroma, so this is not a saturation test —
    // it sits at hue 46 and lightness 47%, and dark orange is brown.
    expect(isMuddy(paletteEntry('amber', 800))).toBe(true);
    expect(isMuddy(paletteEntry('orange', 800))).toBe(true);
    expect(isMuddy(paletteEntry('sky', 800))).toBe(false);
    expect(isMuddy(paletteEntry('emerald', 800))).toBe(false);
  });

  it('escapes toward green rather than toward the clearance band', () => {
    const escaped = mudEscapeFamily('amber');
    expect(escaped).not.toBe('amber');
    expect(isMuddy(paletteEntry(escaped, 800))).toBe(false);
    // Rotating the other way lands on clearance red; a hover surface reading as
    // a danger tint is worse than one reading as deep olive.
    expect(['red', 'rose', 'orange']).not.toContain(escaped);
  });
});

describe('the accent surface', () => {
  it('takes the brand\'s second colour when there is one', () => {
    const derived = deriveTheme({ accent: WTH_HIERARCHY[0], hierarchy: WTH_HIERARCHY });
    expect(derived.accentSecondaryIsNeutral).toBe(false);
    expect(derived.accentSecondaryFamily).not.toBe(derived.neutralFamily);
  });

  it('falls back to the neutral ramp for a single-colour brand', () => {
    // Rather than darkening the primary, which is what produced amber-800 —
    // a brown — across every dark-mode hover state.
    const derived = deriveTheme({ accent: MONOCHROME[0], hierarchy: MONOCHROME });
    expect(derived.accentSecondaryIsNeutral).toBe(true);
    expect(derived.accentSecondaryFamily).toBe(derived.neutralFamily);
  });

  it('never leaves a muddy dark accent surface, and keeps the brand its colour', () => {
    // A warm-branded agency with two warm colours is the case that produced the
    // original defect. The invariant is about the surface that ships, not the
    // family: a muddy family is no longer swapped out, its dark surface is
    // inverted to a light stop instead, so the agency keeps the colour it chose.
    const derived = deriveTheme({
      accent: hexToOklch('#FFE066'),
      hierarchy: ['#FFE066', '#E8A33D'].map(hexToOklch),
    });
    const surface = derived.tokens.dark.accent;
    expect(isMuddy({ family: derived.accentSecondaryFamily, stop: 0, ...surface })).toBe(false);
    // And the pair remains readable, measured rather than assumed.
    expect(
      contrastRatio(
        oklchToRgb(derived.tokens.dark['accent-foreground']),
        oklchToRgb(surface)
      )
    ).toBeGreaterThanOrEqual(4.5);
  });
});
