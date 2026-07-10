// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { describe, test, expect } from 'vitest';
import {
  computeBurn,
  daysOfCover,
  median,
  priceTypeOf,
  projectedCostCents,
  purchasesNeeded,
  requiredUnits,
  weeklyBurn,
} from '../../../src/services/inventory-analytics/calculations';
import {
  isValidTimeZone,
  localDateStartUtc,
  resolveRange,
  shiftLocalDate,
  shiftLocalDateMonths,
} from '../../../src/services/inventory-analytics/timezone';
import { buildCardCsv, toCsv } from '../../../src/services/reports/csv';
import {
  isValidCardSelection,
  MAX_REPORT_SELECTION,
  REPORT_CARDS,
} from '../../../src/services/reports/card-registry';

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));

describe('computeBurn', () => {
  test('spec fixture: 1,000 → 0 over 14 days ≈ 500 units/week', () => {
    const burn = computeBurn([
      { at: day(0), quantity: 1000 },
      { at: day(14), quantity: 0 },
    ]);
    expect(burn.dailyBurn).toBeCloseTo(1000 / 14, 6);
    expect(weeklyBurn(burn.dailyBurn)).toBeCloseTo(500, 6);
  });

  test('positive changes are replenishment boundaries, never negative burn', () => {
    // 100 → 40 over 3 days (burn), restock to 200, 200 → 150 over 2 days.
    const burn = computeBurn([
      { at: day(0), quantity: 100 },
      { at: day(3), quantity: 40 },
      { at: day(4), quantity: 200 },
      { at: day(6), quantity: 150 },
    ]);
    expect(burn.totalDecrease).toBe(60 + 50);
    expect(burn.decreaseDays).toBe(3 + 2);
    expect(burn.dailyBurn).toBeCloseTo(110 / 5, 6);
  });

  test('an Unknown observation breaks adjacency', () => {
    const burn = computeBurn([
      { at: day(0), quantity: 100 },
      { at: day(2), quantity: null },
      { at: day(4), quantity: 20 },
    ]);
    // 100→(unknown)→20 must not count as a decrease interval.
    expect(burn.dailyBurn).toBeNull();
    expect(burn.knownObservations).toBe(2);
  });

  test('insufficient history is null, not zero', () => {
    expect(computeBurn([]).dailyBurn).toBeNull();
    expect(computeBurn([{ at: day(0), quantity: 50 }]).dailyBurn).toBeNull();
    // Flat quantity: no decrease intervals.
    expect(
      computeBurn([
        { at: day(0), quantity: 50 },
        { at: day(5), quantity: 50 },
      ]).dailyBurn
    ).toBeNull();
  });
});

describe('replenishment math', () => {
  test('days of cover and required units follow the spec formulas', () => {
    expect(daysOfCover(100, 10)).toBe(10);
    expect(daysOfCover(null, 10)).toBeNull();
    expect(daysOfCover(100, null)).toBeNull();

    // required = max(0, ceil(dailyBurn × horizon − currentQuantity))
    expect(requiredUnits(10, 30, 100)).toBe(200);
    expect(requiredUnits(1, 14, 100)).toBe(0);
    expect(requiredUnits(null, 30, 100)).toBeNull();

    expect(purchasesNeeded(200, 50)).toBe(4);
    expect(purchasesNeeded(201, 50)).toBe(5);
    expect(purchasesNeeded(null, 50)).toBeNull();

    expect(projectedCostCents(4, 10000)).toBe(40000);
    expect(projectedCostCents(4, 0)).toBe(0); // donated stays numeric 0
    expect(projectedCostCents(4, null)).toBeNull(); // unknown stays null
  });

  test('price types are tri-state', () => {
    expect(priceTypeOf(null)).toBe('unknown');
    expect(priceTypeOf(0)).toBe('donated');
    expect(priceTypeOf(499)).toBe('paid');
  });

  test('median', () => {
    expect(median([])).toBeNull();
    expect(median([3])).toBe(3);
    expect(median([1, 9])).toBe(5);
    expect(median([1, 3, 9])).toBe(3);
  });
});

describe('timezone ranges', () => {
  test('validates IANA timezones', () => {
    expect(isValidTimeZone('America/Los_Angeles')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  test('inclusive local dates become [local start, day-after-end) UTC', () => {
    // PST is UTC-8 in January.
    const start = localDateStartUtc('2026-01-10', 'America/Los_Angeles');
    expect(start.toISOString()).toBe('2026-01-10T08:00:00.000Z');
    // PDT is UTC-7 in July.
    const july = localDateStartUtc('2026-07-10', 'America/Los_Angeles');
    expect(july.toISOString()).toBe('2026-07-10T07:00:00.000Z');
  });

  test('spring-forward DST day still resolves to a valid instant', () => {
    // 2026-03-08 02:00 PST → 03:00 PDT; local midnight itself exists.
    const dst = localDateStartUtc('2026-03-08', 'America/Los_Angeles');
    expect(dst.toISOString()).toBe('2026-03-08T08:00:00.000Z');
  });

  test('presets resolve relative to now in the given timezone', () => {
    const now = new Date('2026-07-10T03:00:00.000Z'); // still Jul 9 in LA
    const range = resolveRange('last-90-days', 'America/Los_Angeles', now);
    expect(range.endDate).toBe('2026-07-09');
    expect(range.startDate).toBe(shiftLocalDate('2026-07-09', -89));
    expect(range.endUtc.getTime()).toBeGreaterThan(range.startUtc.getTime());

    const ytd = resolveRange('ytd', 'America/Los_Angeles', now);
    expect(ytd.startDate).toBe('2026-01-01');

    const months = resolveRange('last-6-months', 'America/Los_Angeles', now);
    expect(months.startDate).toBe(shiftLocalDateMonths('2026-07-09', -6));
  });

  test('custom ranges are exact and validated', () => {
    const range = resolveRange('custom', 'UTC', new Date(), {
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(range.startUtc.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(range.endUtc.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(() =>
      resolveRange('custom', 'UTC', new Date(), {
        startDate: '2026-02-01',
        endDate: '2026-01-01',
      })
    ).toThrow();
  });
});

describe('CSV serialization', () => {
  test('BOM, CRLF, quoting, and formula-injection protection', () => {
    const csv = toCsv(
      ['name', 'note'],
      [
        ['Tuna, canned', '=SUM(A1)'],
        ['Rice', null],
      ]
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Tuna, canned"');
    expect(csv).toContain("'=SUM(A1)");
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(4); // header + 2 rows + trailing
  });

  test('empty dataset still emits headers', () => {
    const csv = toCsv(['a', 'b'], []);
    expect(csv).toBe('﻿a,b\r\n');
  });

  test('rejects ragged rows', () => {
    expect(() => toCsv(['a', 'b'], [[1]])).toThrow(/width/);
  });

  test('every registered card has a CSV serializer', () => {
    const dataAsOf = new Date().toISOString();
    const emptyTabs = {
      'inventory-outlook': {
        kpis: {
          totalItems: 0,
          inStockItems: 0,
          outOfStockItems: 0,
          availabilityPercent: null,
          itemsWithKnownQuantity: 0,
          itemsWithComputableCover: 0,
          medianDaysOfCover: null,
          projectedStockoutsWithinHorizon: 0,
          horizonDays: 30,
        },
        daysOfCoverBands: [],
        stockoutTimeline: [],
        items: [],
        dataAsOf,
      },
      'unit-prices': {
        kpis: {
          totalItems: 0,
          paidItems: 0,
          donatedItems: 0,
          unknownPriceItems: 0,
          priceChangesInRange: 0,
          itemsWithPriceChangeInRange: 0,
          horizonDays: 30,
        },
        unitCostChanges: [],
        costImpacts: [],
        priceHistory: [],
        dataAsOf,
      },
      scarcity: {
        kpis: {
          availabilityItemDaysPercent: null,
          stockoutEpisodes: 0,
          itemsWithStockout: 0,
          ongoingStockouts: 0,
          averageRestockDays: null,
          medianRestockDays: null,
        },
        availabilityOverTime: [],
        stockoutFrequency: [],
        episodes: [],
        dataAsOf,
      },
      replenishment: {
        kpis: {
          horizonDays: 30,
          itemsNeedingPurchase: 0,
          urgentItems: 0,
          knownSpendCents: 0,
          donatedDemandItems: 0,
          missingInputItems: 0,
        },
        reorderPriority: [],
        spendByCategory: [],
        plan: [],
        dataAsOf,
      },
      'data-coverage': {
        kpis: {
          liveItems: 0,
          quantityCoveragePercent: null,
          priceCoveragePercent: null,
          burnReadyPercent: null,
          eventsInRange: 0,
        },
        burnReadiness: [],
        recordingActivity: [],
        gaps: [],
        dataAsOf,
      },
    };
    for (const card of REPORT_CARDS) {
      const { headers, rows } = buildCardCsv(card.id, emptyTabs);
      expect(headers.length).toBeGreaterThan(0);
      // Empty datasets still emit their headers-only CSV.
      expect(() => toCsv(headers, rows)).not.toThrow();
    }
  });
});

describe('card registry', () => {
  test('enforces the selection cap, uniqueness, and source binding', () => {
    const ids = REPORT_CARDS.map((card) => card.id).slice(0, MAX_REPORT_SELECTION);
    expect(isValidCardSelection('reports', ids).ok).toBe(true);
    expect(isValidCardSelection('reports', []).ok).toBe(false);
    expect(isValidCardSelection('reports', [ids[0], ids[0]]).ok).toBe(false);
    expect(isValidCardSelection('reports', ['nope']).ok).toBe(false);
    expect(isValidCardSelection('dashboard', [ids[0]]).ok).toBe(false);
    expect(
      isValidCardSelection(
        'reports',
        Array.from({ length: MAX_REPORT_SELECTION + 1 }, (_, i) => `card-${i}`)
      ).ok
    ).toBe(false);
  });
});
