// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import {
  CategoryInventoryEvent,
  FoodItemInventoryEvent,
  PrismaClient,
} from '@prisma/client';
import prisma from '../../db';
import {
  localDateStartUtc,
  ResolvedRange,
  shiftLocalDate,
} from '../inventory-analytics/timezone';

export const CORRECTION_WINDOW_MINUTES = 5;
export const CORRECTION_WINDOW_MS = CORRECTION_WINDOW_MINUTES * 60 * 1000;
export const OPERATIONAL_ANALYTICS_VERSION = 'operational-analytics-v1';
export const NO_LIMIT_SENTINEL = 100;

type LifecycleKind = 'migration_baseline' | 'created' | 'updated' | 'deleted';

interface SampledEvent<TEvent> {
  event: TEvent;
  sourceEventIds: number[];
}

const isBoundary = (kind: string) =>
  kind === 'migration_baseline' || kind === 'created' || kind === 'deleted';

/**
 * Collapses rapid updates to their final state while retaining lifecycle
 * boundaries. The ledger itself is never changed.
 */
export function sampleCorrectionSessions<TEvent extends {
  id: number;
  eventKind: string;
  recordedAt: Date;
}>(
  events: TEvent[],
  stateOf: (event: TEvent) => string
): SampledEvent<TEvent>[] {
  const ordered = [...events].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime() || a.id - b.id
  );
  const output: SampledEvent<TEvent>[] = [];
  let priorState: string | null = null;
  let session: TEvent[] = [];

  const flush = () => {
    if (session.length === 0) return;
    const final = session[session.length - 1];
    const finalState = stateOf(final);
    if (finalState !== priorState) {
      output.push({ event: final, sourceEventIds: session.map((event) => event.id) });
      priorState = finalState;
    }
    session = [];
  };

  for (const event of ordered) {
    if (isBoundary(event.eventKind)) {
      flush();
      output.push({ event, sourceEventIds: [event.id] });
      priorState = event.eventKind === 'deleted' ? null : stateOf(event);
      continue;
    }
    const previous = session[session.length - 1];
    if (
      previous &&
      event.recordedAt.getTime() - previous.recordedAt.getTime() >
        CORRECTION_WINDOW_MS
    ) {
      flush();
    }
    session.push(event);
  }
  flush();
  return output;
}

export interface AvailabilityTimelinePoint {
  date: string;
  trackedItems: number;
  available: number;
  unavailable: number;
  limitedSupply: number;
  clearance: number;
  itemRationed: number;
  /**
   * Rationed-item counts keyed by limit configuration ("<limit>|<limitType>",
   * e.g. "1|household"). Every key in {@link OperationalAnalyticsResult.rationedLimitSeries}
   * is present on every point (zero-filled) so chart lines stay continuous.
   */
  rationedByLimit: Record<string, number>;
  availabilityPercent: number | null;
}

/** One distinct limit configuration observed in the range's timeline. */
export interface RationedLimitSeries {
  key: string;
  limit: number;
  limitType: string;
}

export interface UnavailableEpisode {
  itemId: number;
  itemName: string;
  categoryName: string;
  startedAt: string;
  endedAt: string | null;
  durationHours: number;
  resolution: 'restored' | 'deleted' | 'open_at_range_end';
}

export interface LimitChange {
  entityType: 'food_item' | 'category';
  entityId: number;
  entityName: string;
  categoryName: string | null;
  limit: number;
  limitType: string;
  isNoLimit: boolean;
  recordedAt: string;
}

export interface OperationalAnalyticsResult {
  dataAsOf: string;
  range: {
    startDate: string;
    endDate: string;
    timeZone: string;
  };
  calculationVersion: string;
  correctionWindowMinutes: number;
  summary: {
    trackedItems: number;
    availableNow: number;
    unavailableNow: number;
    limitedSupplyNow: number;
    clearanceNow: number;
    itemRationedNow: number;
    categoryRationedNow: number;
    availabilityPercentNow: number | null;
    trackedAvailabilityPercent: number | null;
    unavailableEpisodes: number;
    medianRestorationHours: number | null;
  };
  timeline: AvailabilityTimelinePoint[];
  /** Distinct limit configurations in the timeline, ordered by type then limit. */
  rationedLimitSeries: RationedLimitSeries[];
  episodes: UnavailableEpisode[];
  limitChanges: LimitChange[];
  sampledStatusEventIds: number[];
  sampledFoodLimitEventIds: number[];
  sampledCategoryLimitEventIds: number[];
  rawFoodEvents: FoodItemInventoryEvent[];
  rawCategoryEvents: CategoryInventoryEvent[];
}

const groupBy = <T>(rows: T[], keyOf: (row: T) => number) => {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const values = grouped.get(key) ?? [];
    values.push(row);
    grouped.set(key, values);
  }
  return grouped;
};

const foodStatusState = (event: FoodItemInventoryEvent) =>
  `${event.isInStock}|${event.isLimited}|${event.isClearance}|${event.itemName}|${event.categoryId}`;
const foodLimitState = (event: FoodItemInventoryEvent) =>
  `${event.limit}|${event.limitType}|${event.itemName}|${event.categoryId}`;
const categoryLimitState = (event: CategoryInventoryEvent) =>
  `${event.limit}|${event.limitType}|${event.categoryName}`;

const sampledByItem = <TEvent extends {
  id: number;
  eventKind: string;
  recordedAt: Date;
}>(
  rows: TEvent[],
  keyOf: (row: TEvent) => number,
  stateOf: (row: TEvent) => string
) => {
  const result = new Map<number, SampledEvent<TEvent>[]>();
  for (const [key, events] of groupBy(rows, keyOf)) {
    result.set(key, sampleCorrectionSessions(events, stateOf));
  }
  return result;
};

function stateAt<TEvent extends { eventKind: string; recordedAt: Date }>(
  samples: SampledEvent<TEvent>[] | undefined,
  instant: Date
): TEvent | null {
  let current: TEvent | null = null;
  for (const sample of samples ?? []) {
    if (sample.event.recordedAt >= instant) break;
    current = sample.event.eventKind === 'deleted' ? null : sample.event;
  }
  return current;
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
};

export async function computeOperationalAnalytics(
  range: ResolvedRange,
  dataAsOf = new Date(),
  client: PrismaClient = prisma
): Promise<OperationalAnalyticsResult> {
  const analysisEnd = new Date(Math.min(range.endUtc.getTime(), dataAsOf.getTime()));
  const [foodEvents, categoryEvents] = await Promise.all([
    client.foodItemInventoryEvent.findMany({
      where: { recordedAt: { lt: analysisEnd } },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
    }),
    client.categoryInventoryEvent.findMany({
      where: { recordedAt: { lt: analysisEnd } },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const statusRows = foodEvents.filter(
    (event) => isBoundary(event.eventKind) || event.recordsStatus
  );
  const foodLimitRows = foodEvents.filter(
    (event) => isBoundary(event.eventKind) || event.recordsLimit
  );
  const categoryLimitRows = categoryEvents.filter(
    (event) => isBoundary(event.eventKind) || event.recordsLimit
  );

  const statusSamples = sampledByItem(
    statusRows,
    (event) => event.sourceFoodItemId,
    foodStatusState
  );
  const foodLimitSamples = sampledByItem(
    foodLimitRows,
    (event) => event.sourceFoodItemId,
    foodLimitState
  );
  const categoryLimitSamples = sampledByItem(
    categoryLimitRows,
    (event) => event.sourceCategoryId,
    categoryLimitState
  );

  const timeline: AvailabilityTimelinePoint[] = [];
  let date = range.startDate;
  while (date <= range.endDate) {
    const pointAt = new Date(
      Math.min(
        localDateStartUtc(shiftLocalDate(date, 1), range.timeZone).getTime(),
        analysisEnd.getTime()
      )
    );
    if (pointAt > range.startUtc) {
      const statuses = [...statusSamples.values()]
        .map((samples) => stateAt(samples, pointAt))
        .filter((event): event is FoodItemInventoryEvent => event !== null);
      const limits = [...foodLimitSamples.values()]
        .map((samples) => stateAt(samples, pointAt))
        .filter((event): event is FoodItemInventoryEvent => event !== null);
      const available = statuses.filter((event) => event.isInStock).length;
      // Dates before the first baseline are untracked, not zero-availability
      // observations. Omit them from both charts and item-day denominators.
      if (statuses.length > 0) {
        const rationedByLimit: Record<string, number> = {};
        for (const event of limits) {
          if (event.limit === NO_LIMIT_SENTINEL) continue;
          const key = `${event.limit}|${event.limitType}`;
          rationedByLimit[key] = (rationedByLimit[key] ?? 0) + 1;
        }
        timeline.push({
          date,
          trackedItems: statuses.length,
          available,
          unavailable: statuses.length - available,
          limitedSupply: statuses.filter((event) => event.isLimited).length,
          clearance: statuses.filter((event) => event.isClearance).length,
          itemRationed: limits.filter((event) => event.limit !== NO_LIMIT_SENTINEL).length,
          rationedByLimit,
          availabilityPercent: (available / statuses.length) * 100,
        });
      }
    }
    date = shiftLocalDate(date, 1);
    if (localDateStartUtc(date, range.timeZone) >= analysisEnd) break;
  }

  // The chart draws one line per limit configuration seen anywhere in the
  // range; zero-fill every point so a configuration that appears mid-range
  // still plots a continuous line (and CSV rows stay rectangular).
  const rationedLimitSeries: RationedLimitSeries[] = [
    ...new Set(timeline.flatMap((point) => Object.keys(point.rationedByLimit))),
  ]
    .map((key) => {
      const [limit, limitType] = key.split('|');
      return { key, limit: Number(limit), limitType };
    })
    .sort(
      (a, b) => a.limitType.localeCompare(b.limitType) || a.limit - b.limit
    );
  for (const point of timeline) {
    for (const series of rationedLimitSeries) {
      point.rationedByLimit[series.key] ??= 0;
    }
  }

  const episodes: UnavailableEpisode[] = [];
  const restorationDurations: number[] = [];
  for (const samples of statusSamples.values()) {
    let open: FoodItemInventoryEvent | null = null;
    for (const { event } of samples) {
      if (event.eventKind === 'deleted') {
        if (open) {
          const end = event.recordedAt;
          const duration = (end.getTime() - open.recordedAt.getTime()) / 3_600_000;
          if (end > range.startUtc && open.recordedAt < analysisEnd) {
            episodes.push({
              itemId: open.sourceFoodItemId,
              itemName: open.itemName,
              categoryName: open.categoryName,
              startedAt: open.recordedAt.toISOString(),
              endedAt: end.toISOString(),
              durationHours: duration,
              resolution: 'deleted',
            });
          }
          open = null;
        }
        continue;
      }
      // A migration baseline seeds current state but is not an observed
      // transition and must not inflate episode frequency.
      if (
        !event.isInStock &&
        !open &&
        (event.eventKind === 'created' ||
          (event.eventKind === 'updated' && event.recordsStatus))
      ) open = event;
      if (event.isInStock && open) {
        const duration =
          (event.recordedAt.getTime() - open.recordedAt.getTime()) / 3_600_000;
        if (event.recordedAt > range.startUtc && open.recordedAt < analysisEnd) {
          episodes.push({
            itemId: open.sourceFoodItemId,
            itemName: open.itemName,
            categoryName: open.categoryName,
            startedAt: open.recordedAt.toISOString(),
            endedAt: event.recordedAt.toISOString(),
            durationHours: duration,
            resolution: 'restored',
          });
          restorationDurations.push(duration);
        }
        open = null;
      }
    }
    if (open && open.recordedAt < analysisEnd) {
      episodes.push({
        itemId: open.sourceFoodItemId,
        itemName: open.itemName,
        categoryName: open.categoryName,
        startedAt: open.recordedAt.toISOString(),
        endedAt: null,
        durationHours:
          (analysisEnd.getTime() - open.recordedAt.getTime()) / 3_600_000,
        resolution: 'open_at_range_end',
      });
    }
  }

  const sampledFoodLimitIds = new Set(
    [...foodLimitSamples.values()].flatMap((samples) =>
      samples.map((sample) => sample.event.id)
    )
  );
  const sampledCategoryLimitIds = new Set(
    [...categoryLimitSamples.values()].flatMap((samples) =>
      samples.map((sample) => sample.event.id)
    )
  );
  const limitChanges: LimitChange[] = [
    ...foodEvents
      .filter(
        (event) =>
          event.eventKind === 'updated' &&
          event.recordsLimit &&
          sampledFoodLimitIds.has(event.id) &&
          event.recordedAt >= range.startUtc
      )
      .map((event) => ({
        entityType: 'food_item' as const,
        entityId: event.sourceFoodItemId,
        entityName: event.itemName,
        categoryName: event.categoryName,
        limit: event.limit,
        limitType: event.limitType,
        isNoLimit: event.limit === NO_LIMIT_SENTINEL,
        recordedAt: event.recordedAt.toISOString(),
      })),
    ...categoryEvents
      .filter(
        (event) =>
          event.eventKind === 'updated' &&
          event.recordsLimit &&
          sampledCategoryLimitIds.has(event.id) &&
          event.recordedAt >= range.startUtc
      )
      .map((event) => ({
        entityType: 'category' as const,
        entityId: event.sourceCategoryId,
        entityName: event.categoryName,
        categoryName: null,
        limit: event.limit,
        limitType: event.limitType,
        isNoLimit: event.limit === NO_LIMIT_SENTINEL,
        recordedAt: event.recordedAt.toISOString(),
      })),
  ].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const currentStatuses = [...statusSamples.values()]
    .map((samples) => stateAt(samples, analysisEnd))
    .filter((event): event is FoodItemInventoryEvent => event !== null);
  const currentFoodLimits = [...foodLimitSamples.values()]
    .map((samples) => stateAt(samples, analysisEnd))
    .filter((event): event is FoodItemInventoryEvent => event !== null);
  const currentCategoryLimits = [...categoryLimitSamples.values()]
    .map((samples) => stateAt(samples, analysisEnd))
    .filter((event): event is CategoryInventoryEvent => event !== null);
  const availableNow = currentStatuses.filter((event) => event.isInStock).length;
  const itemDays = timeline.reduce((sum, point) => sum + point.trackedItems, 0);
  const availableItemDays = timeline.reduce((sum, point) => sum + point.available, 0);

  const sampledStatusIds = new Set(
    [...statusSamples.values()].flatMap((samples) =>
      samples.map((sample) => sample.event.id)
    )
  );

  return {
    dataAsOf: dataAsOf.toISOString(),
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      timeZone: range.timeZone,
    },
    calculationVersion: OPERATIONAL_ANALYTICS_VERSION,
    correctionWindowMinutes: CORRECTION_WINDOW_MINUTES,
    summary: {
      trackedItems: currentStatuses.length,
      availableNow,
      unavailableNow: currentStatuses.length - availableNow,
      limitedSupplyNow: currentStatuses.filter((event) => event.isLimited).length,
      clearanceNow: currentStatuses.filter((event) => event.isClearance).length,
      itemRationedNow: currentFoodLimits.filter(
        (event) => event.limit !== NO_LIMIT_SENTINEL
      ).length,
      categoryRationedNow: currentCategoryLimits.filter(
        (event) => event.limit !== NO_LIMIT_SENTINEL
      ).length,
      availabilityPercentNow:
        currentStatuses.length === 0
          ? null
          : (availableNow / currentStatuses.length) * 100,
      trackedAvailabilityPercent:
        itemDays === 0 ? null : (availableItemDays / itemDays) * 100,
      unavailableEpisodes: episodes.length,
      medianRestorationHours: median(restorationDurations),
    },
    timeline,
    rationedLimitSeries,
    episodes: episodes.sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    limitChanges,
    sampledStatusEventIds: [...sampledStatusIds],
    sampledFoodLimitEventIds: [...sampledFoodLimitIds],
    sampledCategoryLimitEventIds: [...sampledCategoryLimitIds],
    rawFoodEvents: foodEvents,
    rawCategoryEvents: categoryEvents,
  };
}
