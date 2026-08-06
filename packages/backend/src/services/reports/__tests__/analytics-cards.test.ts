// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { describe, expect, it } from 'vitest';

import {
  ACQUISITION_MIX,
  ANALYTICS_CARDS,
  PROCUREMENT_CHANNELS,
  cardCsv,
} from '../analytics-cards';

/**
 * The card contract, enforced.
 *
 * The first spike re-derived rows inside each renderer and drifted from the
 * screen on its very first output: raw `PURCH-DON` instead of `Purch-Don`, and
 * Fresh Alliance missing the legacy history the screen stacks onto it. These
 * assertions are the mechanism that would have caught both.
 */

/** Shaped like the real payload, with values chosen to be recognisable. */
const analytics = {
  acquisitionMix: [
    { acquisitionClass: 'PURCH-DON', weightHundredths: 33_423_400 },
    { acquisitionClass: 'DONATED', weightHundredths: 307_467_700 },
    { acquisitionClass: 'GOVERNMENT', weightHundredths: 87_372_500 },
    { acquisitionClass: 'PURCHASED', weightHundredths: 49_331_600 },
  ],
  channelMix: [
    { channel: 'ofb_warehouse', weightHundredths: 200_000_000 },
    { channel: 'fresh_alliance', weightHundredths: 50_000_000 },
    { channel: 'community_donation', weightHundredths: 10_000_000 },
  ],
  summary: { freshAllianceLegacyWeightHundredths: 75_000_000 },
};

describe('analytics card contract', () => {
  it('labels rows the way the screen labels them', () => {
    const labels = ACQUISITION_MIX.series(analytics).map(r => r.label);

    // The exact bug the spike shipped: the enum reaching paper.
    expect(labels).not.toContain('PURCH-DON');
    expect(labels).toEqual(['Donated', 'Government', 'Purchased', 'Purch-Don']);
  });

  it('stacks legacy partner history onto Fresh Alliance, as the screen does', () => {
    const rows = PROCUREMENT_CHANNELS.series(analytics);
    const ffa = rows.find(r => r.label === 'Fresh Food Alliance');

    // 50,000,000 + 75,000,000 hundredths = 1,250,000 lb. Omitting the legacy
    // term understates the channel by 750,000 lb.
    expect(ffa?.value).toBe(1_250_000);
  });

  it('converts to display units, not wire units', () => {
    const donated = ACQUISITION_MIX.series(analytics).find(r => r.label === 'Donated');
    expect(donated?.value).toBe(3_074_677);
  });

  it.each(ANALYTICS_CARDS)('$title: chart and CSV read the same rows', card => {
    const rows = card.series(analytics);
    const csv = cardCsv(card, rows);
    const svg = card.print(rows);

    // Every row's value must appear in both outputs. If a renderer recomputed
    // anything, one of these drifts and this fails.
    for (const row of rows) {
      const rounded = Math.round(row.value).toLocaleString('en-US');
      expect(csv, `${row.label} missing from CSV`).toContain(String(row.value));
      expect(svg, `${row.label} missing from chart`).toContain(rounded);
      expect(svg).toContain(row.label);
    }
    expect(csv.split('\r\n')[0]).toBe(card.columns.join(','));
  });

  it.each(ANALYTICS_CARDS)('$title: chart depends on no stylesheet', card => {
    const svg = card.print(card.series(analytics));

    // The property that makes this approach deterministic. A `var()` here means
    // the chart would render differently depending on where it was drawn.
    expect(svg).not.toMatch(/var\(--/);
    expect(svg).not.toMatch(/class=/);
    expect(svg.startsWith('<svg')).toBe(true);
  });

  it('has no duplicate card ids', () => {
    const ids = ANALYTICS_CARDS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('survives an empty payload without throwing', () => {
    // A filtered range can legitimately return nothing.
    for (const card of ANALYTICS_CARDS) {
      const rows = card.series({});
      expect(rows).toEqual([]);
      expect(() => card.print(rows)).not.toThrow();
    }
  });
});
