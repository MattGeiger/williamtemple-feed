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
  INBOUND_WEIGHT_OVER_TIME,
  PROCUREMENT_CHANNELS,
  cardCsv,
} from '../analytics-cards';
import { MIN_BAR_MM, maxReadableCategories } from '../condense';

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
    const labels = ACQUISITION_MIX.data(analytics).categories;

    // The exact bug the spike shipped: the enum reaching paper.
    expect(labels).not.toContain('PURCH-DON');
    expect(labels).toEqual(['Donated', 'Government', 'Purchased', 'Purch-Don']);
  });

  it('stacks legacy partner history onto Fresh Alliance, as the screen does', () => {
    const d = PROCUREMENT_CHANNELS.data(analytics);
    const ffa = d.series[0].values[d.categories.indexOf('Fresh Food Alliance')];

    // 50,000,000 + 75,000,000 hundredths = 1,250,000 lb. Omitting the legacy
    // term understates the channel by 750,000 lb.
    expect(ffa).toBe(1_250_000);
  });

  it('converts to display units, not wire units', () => {
    const d = ACQUISITION_MIX.data(analytics);
    expect(d.series[0].values[d.categories.indexOf('Donated')]).toBe(3_074_677);
  });

  it.each(ANALYTICS_CARDS)('$defaultTitle: chart and CSV read the same data', card => {
    const data = card.data(analytics);
    const csv = cardCsv(data);
    const svg = card.print(data);

    // Same categories, same numbers, in both outputs. If a renderer recomputed
    // anything, one of these drifts and this fails.
    for (const category of data.categories) {
      expect(csv, `${category} missing from CSV`).toContain(category);
    }
    for (const s of data.series) {
      expect(csv.split('\r\n')[0], 'series missing from CSV header').toContain(s.name);
      for (const v of s.values) {
        if (v > 0) expect(csv).toContain(String(v));
      }
    }
    expect(csv.split('\r\n')[0].split(',')[0]).toBe(data.categoryColumn);
    // A chart prints SVG; a KPI card prints HTML tiles.
    expect(svg.startsWith(card.kind === 'chart' ? '<svg' : '<div')).toBe(true);
  });

  it.each(ANALYTICS_CARDS)('$defaultTitle: chart depends on no stylesheet', card => {
    const svg = card.print(card.data(analytics));

    // The property that makes this approach deterministic. A `var()` here means
    // the chart would render differently depending on where it was drawn.
    expect(svg).not.toMatch(/var\(--/);
    expect(svg).not.toMatch(/class=/);
  });

  it('has no duplicate card ids', () => {
    const ids = ANALYTICS_CARDS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('survives an empty payload without throwing', () => {
    // A filtered range can legitimately return nothing.
    for (const card of ANALYTICS_CARDS) {
      const data = card.data({});
      expect(() => card.print(data)).not.toThrow();
      // A chart has nothing to draw. A KPI card still shows its tiles, reading
      // zero or "Unknown" — which is what the screen does, so the report
      // matches rather than going blank.
      if (card.kind === 'chart') expect(data.categories).toEqual([]);
      else expect(data.categories.length).toBeGreaterThan(0);
    }
  });
});

/** `count` months of a single flat series, starting 2009-11. */
const monthsPayload = (count: number, channel: string | null = null) => {
  const monthly = Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(2009, 10 + i, 1));
    return {
      month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      donatedWeightHundredths: 100_000,
      purchDonWeightHundredths: 0,
      governmentWeightHundredths: 0,
      purchasedWeightHundredths: 0,
      ofbWarehouseWeightHundredths: 100_000,
      freshAllianceWeightHundredths: 50_000,
      communityDonationWeightHundredths: 0,
    };
  });
  return { monthlyWeight: monthly, filters: { channel } };
};

describe('time-series grain follows the readability threshold', () => {
  it('leaves a printable range at its native grain', () => {
    const limit = maxReadableCategories();
    const data = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(limit));

    expect(data.grain).toBe('month');
    expect(data.note).toBeNull();
    expect(data.categories).toHaveLength(limit);
  });

  it('condenses one step past the threshold, and says so', () => {
    const data = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(201));

    expect(data.grain).toBe('quarter');
    // 2009 Q4 through 2026 Q3 — partial quarters at both ends.
    expect(data.categories).toHaveLength(68);
    expect(data.categories[0]).toBe('2009 Q4');
    expect(data.note).toContain('Condensed to quarters');
    expect(data.note).toContain(`${MIN_BAR_MM}mm`);
    // The way out is stated, not just the fact.
    expect(data.note).toContain('Narrow the date range');
  });

  it('falls to years when quarters are still too dense', () => {
    const data = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(1200));

    expect(data.grain).toBe('year');
    expect(data.note).toContain('Condensed to years');
  });

  it('conserves the totals it condenses', () => {
    // Bucketing must move weight between buckets, never create or lose it.
    const fine = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(24));
    const coarse = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(201));
    const sum = (d: { series: { values: number[] }[] }) =>
      d.series.reduce((t, s) => t + s.values.reduce((a, b) => a + b, 0), 0);

    expect(sum(fine)).toBe(24 * (1000 + 500));
    expect(sum(coarse)).toBe(201 * (1000 + 500));
  });

  it('offers both grains, and defaults to the one the chart drew', () => {
    const data = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(201));

    const condensed = cardCsv(data, 'condensed');
    const raw = cardCsv(data, 'raw');

    expect(condensed.split('\r\n')[0].split(',')[0]).toBe('quarter');
    expect(raw.split('\r\n')[0].split(',')[0]).toBe('month');
    expect(raw).toContain('2009-11');
    expect(raw.trim().split('\r\n')).toHaveLength(202); // header + 201 months
    // Default matches the picture, so an unqualified export is never a file
    // that disagrees with the chart beside it.
    expect(cardCsv(data)).toBe(condensed);
  });

  it('raw and condensed carry the same totals', () => {
    // Different buckets, same weight. If these diverge, condensing is losing
    // or inventing data.
    const data = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(201));
    const total = (csv: string) =>
      csv.trim().split('\r\n').slice(1)
        .reduce((sum, line) => sum + line.split(',').slice(1).reduce((a, b) => a + Number(b), 0), 0);

    expect(total(cardCsv(data, 'raw'))).toBe(total(cardCsv(data, 'condensed')));
  });

  it('falls back to the condensed view when nothing was condensed', () => {
    // "Raw" must mean something for every card, including ones with no
    // coarser form — otherwise the option is a trap on short ranges.
    const data = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(12));

    expect(data.raw).toBeUndefined();
    expect(cardCsv(data, 'raw')).toBe(cardCsv(data, 'condensed'));
  });

  it('condenses the CSV with the chart, so the two agree', () => {
    const data = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(201));
    const csv = cardCsv(data);

    // Header names the coarser grain; no monthly key survives.
    expect(csv.split('\r\n')[0].split(',')[0]).toBe('quarter');
    expect(csv).toContain('2009 Q4');
    expect(csv).not.toContain('2009-11');
    expect(csv.trim().split('\r\n')).toHaveLength(69); // header + 68 quarters
  });
});

describe('time-series card follows the channel filter, as the screen does', () => {
  it('no filter: one series per channel, community only when present', () => {
    const data = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(12, null));

    expect(data.title).toBe('Inbound Weight Over Time');
    expect(data.series.map(s => s.name)).toEqual(['OFB Warehouse', 'Fresh Food Alliance']);
  });

  it('ofb_warehouse: acquisition classes, with the matching title', () => {
    const data = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(12, 'ofb_warehouse'));

    expect(data.title).toBe('Warehouse Weight by Acquisition Class');
    expect(data.series.map(s => s.name)).toEqual([
      'Donated', 'Purch-Don', 'Government', 'Purchased',
    ]);
  });

  it('fresh_alliance: that channel alone', () => {
    const data = INBOUND_WEIGHT_OVER_TIME.data(monthsPayload(12, 'fresh_alliance'));

    expect(data.title).toBe('Fresh Food Alliance Weight Over Time');
    expect(data.series.map(s => s.name)).toEqual(['Fresh Food Alliance']);
  });

  it('includes the community sidecar only when that history is loaded', () => {
    // D22: an always-present empty line would imply every agency has a source
    // it will never have.
    const withCommunity = monthsPayload(12, null);
    withCommunity.monthlyWeight[3].communityDonationWeightHundredths = 5_000;

    expect(INBOUND_WEIGHT_OVER_TIME.data(withCommunity).series.map(s => s.name)).toContain(
      'Donations (Legacy Data)'
    );
  });
});
