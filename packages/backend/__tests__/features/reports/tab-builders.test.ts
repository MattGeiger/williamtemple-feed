// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Fixture tests for the Unit Prices, Scarcity, Replenishment, and Data
 * Coverage builders. Contexts are constructed in memory — the builders are
 * pure over the loaded ledger context.
 */

import { describe, test, expect } from 'vitest';
import {
  buildScarcity,
  buildUnitPrices,
  buildReplenishment,
  buildCoverage,
  computeItemOutlooks,
} from '../../../src/services/inventory-analytics';
import type {
  AnalyticsContext,
  ItemTimeline,
  LedgerEvent,
} from '../../../src/services/inventory-analytics';
import { resolveRange } from '../../../src/services/inventory-analytics/timezone';

const DAY = 86_400_000;
// Range: 2026-01-01 .. 2026-01-31 UTC (custom, timezone UTC).
const range = resolveRange('custom', 'UTC', new Date('2026-02-01T00:00:00Z'), {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
});
const asOf = new Date('2026-02-01T00:00:00.000Z');

let nextEventId = 1;

interface EventSpec {
  daysFromRangeStart: number;
  kind?: LedgerEvent['eventKind'];
  quantity?: number | null;
  priceCents?: number | null;
  units?: number;
  inStock?: boolean;
  records?: Partial<
    Pick<LedgerEvent, 'recordsQuantity' | 'recordsPrice' | 'recordsStatus' | 'recordsIdentity'>
  >;
}

function makeTimeline(
  sourceId: number,
  name: string,
  specs: EventSpec[],
  liveState: {
    isInStock?: boolean;
    estimatedQuantity?: number | null;
    purchasePriceCents?: number | null;
    unitsPerPurchase?: number;
  } | null
): ItemTimeline {
  const events: LedgerEvent[] = specs.map((spec) => ({
    id: nextEventId++,
    sourceFoodItemId: sourceId,
    itemName: name,
    categoryId: 1,
    categoryName: 'Canned Goods',
    isInStock: spec.inStock ?? true,
    isLimited: false,
    isClearance: false,
    purchasePriceCents: spec.priceCents ?? null,
    unitsPerPurchase: spec.units ?? 1,
    estimatedQuantity: spec.quantity ?? null,
    eventKind: spec.kind ?? 'updated',
    recordsQuantity: spec.records?.recordsQuantity ?? true,
    recordsPrice: spec.records?.recordsPrice ?? true,
    recordsStatus: spec.records?.recordsStatus ?? true,
    recordsIdentity: spec.records?.recordsIdentity ?? false,
    recordedAt: new Date(range.startUtc.getTime() + spec.daysFromRangeStart * DAY),
  }));

  const deletedEvent = events.find((event) => event.eventKind === 'deleted');
  const isLive = liveState !== null;

  return {
    sourceFoodItemId: sourceId,
    name,
    categoryId: 1,
    categoryName: 'Canned Goods',
    isLive,
    liveItem: isLive
      ? ({
          id: sourceId,
          name,
          nameSearch: name.toLowerCase(),
          limit: 10,
          limitType: 'household',
          isInStock: liveState.isInStock ?? true,
          isLimited: false,
          isClearance: false,
          categoryId: 1,
          vegan: false,
          vegetarian: false,
          glutenFree: false,
          organic: false,
          halal: false,
          kosher: false,
          readyToEat: false,
          purchasePriceCents: liveState.purchasePriceCents ?? null,
          unitsPerPurchase: liveState.unitsPerPurchase ?? 1,
          estimatedQuantity: liveState.estimatedQuantity ?? null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          category: {
            id: 1,
            name: 'Canned Goods',
            nameSearch: 'canned goods',
            limit: 10,
            limitType: 'household',
            icon: 'package',
            createdAt: new Date(0),
            updatedAt: new Date(0),
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      : null,
    deletedAt: deletedEvent?.recordedAt ?? null,
    firstTrackedAt: events[0]?.recordedAt ?? null,
    events,
  };
}

function makeContext(timelines: ItemTimeline[]): AnalyticsContext {
  return {
    range,
    horizonDays: 30,
    asOf,
    timelines,
    liveItems: timelines
      .filter((timeline) => timeline.liveItem)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((timeline) => timeline.liveItem as any),
  };
}

describe('buildScarcity', () => {
  test('episodes end by restock, deletion, or range end; only restocks feed averages', () => {
    const context = makeContext([
      // Out day 2 → restocked day 5 (3-day episode).
      makeTimeline(1, 'Tuna', [
        { daysFromRangeStart: 0, inStock: true, quantity: 10 },
        { daysFromRangeStart: 2, inStock: false, quantity: 0 },
        { daysFromRangeStart: 5, inStock: true, quantity: null },
      ], { isInStock: true }),
      // Out day 10, deleted day 12 (2-day episode ended by deletion).
      makeTimeline(2, 'Rice', [
        { daysFromRangeStart: 1, inStock: true, quantity: 5 },
        { daysFromRangeStart: 10, inStock: false, quantity: 0 },
        { daysFromRangeStart: 12, kind: 'deleted', inStock: false, quantity: 0 },
      ], null),
      // Out day 20, still out at range end (ongoing, 11 days to Feb 1).
      makeTimeline(3, 'Beans', [
        { daysFromRangeStart: 0, inStock: true, quantity: 8 },
        { daysFromRangeStart: 20, inStock: false, quantity: 0 },
      ], { isInStock: false, estimatedQuantity: 0 }),
    ]);

    const result = buildScarcity(context);
    expect(result.kpis.stockoutEpisodes).toBe(3);
    expect(result.kpis.ongoingStockouts).toBe(1);
    // Only Tuna's restocked episode counts toward the restock average.
    expect(result.kpis.averageRestockDays).toBeCloseTo(3, 5);

    const byItem = Object.fromEntries(
      result.episodes.map((episode) => [episode.itemName, episode])
    );
    expect(byItem['Tuna'].endedBy).toBe('restock');
    expect(byItem['Rice'].endedBy).toBe('deletion');
    expect(byItem['Rice'].durationDays).toBeCloseTo(2, 5);
    expect(byItem['Beans'].endedBy).toBe('range-end');
    expect(byItem['Beans'].endAt).toBeNull();
  });

  test('item-days availability weights time, not just item counts', () => {
    const context = makeContext([
      // In stock the whole 31 days.
      makeTimeline(1, 'Tuna', [
        { daysFromRangeStart: 0, inStock: true, quantity: 10 },
      ], { isInStock: true }),
      // Out from day 0 until restock at day 15.5 → half the range out.
      makeTimeline(2, 'Rice', [
        { daysFromRangeStart: 0, inStock: false, quantity: 0 },
        { daysFromRangeStart: 15.5, inStock: true, quantity: 4 },
      ], { isInStock: true }),
    ]);
    const result = buildScarcity(context);
    expect(result.kpis.availabilityItemDaysPercent).toBeCloseTo(75, 1);
  });

  test('a pre-range anchor seeds the initial status', () => {
    const context = makeContext([
      // Went out 10 days BEFORE the range; still out entering it.
      makeTimeline(1, 'Tuna', [
        { daysFromRangeStart: -10, inStock: false, quantity: 0 },
        { daysFromRangeStart: 3, inStock: true, quantity: 5 },
      ], { isInStock: true }),
    ]);
    const result = buildScarcity(context);
    expect(result.kpis.stockoutEpisodes).toBe(1);
    // The episode is clipped to the range window: 3 days, ended by restock.
    expect(result.episodes[0].durationDays).toBeCloseTo(3, 5);
    expect(result.episodes[0].endedBy).toBe('restock');
  });
});

describe('buildUnitPrices', () => {
  test('cost outlook compares the latest positive paid cost with the preceding one', () => {
    const context = makeContext([
      // $1.00/unit → $1.50/unit (50% up), burn 2/day ⇒ demand 60 over 30d.
      makeTimeline(1, 'Tuna', [
        { daysFromRangeStart: 0, priceCents: 100, units: 1, quantity: 100 },
        { daysFromRangeStart: 10, priceCents: 150, units: 1, quantity: 80 },
      ], {
        isInStock: true,
        estimatedQuantity: 80,
        purchasePriceCents: 150,
        unitsPerPurchase: 1,
      }),
      // Donated item: never enters paid comparisons.
      makeTimeline(2, 'Rice', [
        { daysFromRangeStart: 0, priceCents: 0, units: 1, quantity: 50 },
      ], { isInStock: true, estimatedQuantity: 50, purchasePriceCents: 0 }),
    ]);

    const result = buildUnitPrices(context);
    expect(result.kpis.paidItems).toBe(1);
    expect(result.kpis.donatedItems).toBe(1);

    expect(result.unitCostChanges).toHaveLength(1);
    expect(result.unitCostChanges[0].changeCents).toBe(50);
    expect(result.unitCostChanges[0].changePercent).toBeCloseTo(50, 5);

    // Burn: 100 → 80 over 10 days = 2/day ⇒ demand 60 ⇒ impact 60 × 50¢.
    expect(result.costImpacts).toHaveLength(1);
    expect(result.costImpacts[0].projectedDemandUnits).toBeCloseTo(60, 5);
    expect(result.costImpacts[0].impactCents).toBeCloseTo(3000, 3);
  });

  test('price history keeps deltas within one price type only', () => {
    const context = makeContext([
      // unknown → paid → donated → paid: only paid→paid gets a delta.
      makeTimeline(1, 'Tuna', [
        { daysFromRangeStart: 0, priceCents: null, quantity: 10 },
        { daysFromRangeStart: 1, priceCents: 200, units: 2, quantity: 10 },
        { daysFromRangeStart: 2, priceCents: 0, quantity: 10 },
        { daysFromRangeStart: 3, priceCents: 300, units: 2, quantity: 10 },
      ], { isInStock: true, purchasePriceCents: 300, unitsPerPurchase: 2 }),
    ]);
    const result = buildUnitPrices(context);
    const rows = [...result.priceHistory].reverse(); // ascending
    expect(rows.map((row) => row.priceType)).toEqual([
      'unknown', 'paid', 'donated', 'paid',
    ]);
    expect(rows[1].changeCents).toBeNull(); // vs unknown
    expect(rows[2].changeCents).toBeNull(); // donated vs paid
    expect(rows[3].changeCents).toBeNull(); // paid vs donated
  });
});

describe('buildReplenishment', () => {
  test('known spend sums only paid items; missing inputs are flagged', () => {
    const context = makeContext([
      // Paid: burn 10/day, qty 100 ⇒ required 200, packages of 50 ⇒ 4 × $100.
      makeTimeline(1, 'Tuna', [
        { daysFromRangeStart: 0, quantity: 200, priceCents: 10000, units: 50 },
        { daysFromRangeStart: 10, quantity: 100, priceCents: 10000, units: 50 },
      ], {
        isInStock: true,
        estimatedQuantity: 100,
        purchasePriceCents: 10000,
        unitsPerPurchase: 50,
      }),
      // Unknown price, no history: three missing inputs.
      makeTimeline(2, 'Rice', [
        { daysFromRangeStart: 0, quantity: null, priceCents: null },
      ], { isInStock: true, estimatedQuantity: null, purchasePriceCents: null }),
    ]);

    const result = buildReplenishment(context);
    expect(result.kpis.itemsNeedingPurchase).toBe(1);
    expect(result.kpis.knownSpendCents).toBe(40000);
    expect(result.kpis.missingInputItems).toBe(1);

    const tuna = result.plan.find((row) => row.name === 'Tuna')!;
    expect(tuna.requiredUnits).toBe(200);
    expect(tuna.purchasesNeeded).toBe(4);
    expect(tuna.projectedCostCents).toBe(40000);
    expect(tuna.missingInputs).toEqual([]);

    const rice = result.plan.find((row) => row.name === 'Rice')!;
    expect(rice.missingInputs).toEqual(['quantity', 'burn-history', 'price']);

    expect(result.spendByCategory[0].knownSpendCents).toBe(40000);
  });
});

describe('buildCoverage', () => {
  test('coverage percentages and last quantity change (never "last counted")', () => {
    const context = makeContext([
      makeTimeline(1, 'Tuna', [
        { daysFromRangeStart: 0, kind: 'migration_baseline', quantity: null },
        { daysFromRangeStart: 5, quantity: 40, priceCents: 100 },
      ], {
        isInStock: true,
        estimatedQuantity: 40,
        purchasePriceCents: 100,
      }),
      makeTimeline(2, 'Rice', [
        { daysFromRangeStart: 0, kind: 'migration_baseline', quantity: null },
      ], { isInStock: true, estimatedQuantity: null }),
    ]);

    const result = buildCoverage(context);
    expect(result.kpis.liveItems).toBe(2);
    expect(result.kpis.quantityCoveragePercent).toBe(50);
    expect(result.kpis.priceCoveragePercent).toBe(50);

    const tuna = result.gaps.find((row) => row.name === 'Tuna')!;
    // The baseline is not a "quantity change"; the day-5 update is.
    expect(tuna.lastQuantityChangeAt).toBe(
      new Date(range.startUtc.getTime() + 5 * DAY).toISOString()
    );
    const rice = result.gaps.find((row) => row.name === 'Rice')!;
    expect(rice.lastQuantityChangeAt).toBeNull();

    // Recording activity buckets cover the whole range.
    expect(result.recordingActivity.length).toBeGreaterThanOrEqual(5);
    const totalEvents = result.recordingActivity.reduce(
      (sum, row) => sum + row.eventCount,
      0
    );
    expect(totalEvents).toBe(3);
  });
});
