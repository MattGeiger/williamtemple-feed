import { describe, expect, test } from 'vitest';
import {
  computeOperationalAnalytics,
  CORRECTION_WINDOW_MINUTES,
  sampleCorrectionSessions,
} from '../../../src/services/operational-analytics';
import { resolveRange } from '../../../src/services/inventory-analytics/timezone';

const event = (id: number, minutes: number, state: string, eventKind = 'updated') => ({
  id,
  state,
  eventKind,
  recordedAt: new Date(Date.UTC(2026, 0, 1, 12, minutes)),
});

describe('operational correction sampling', () => {
  test('uses a five-minute centralized window', () => {
    expect(CORRECTION_WINDOW_MINUTES).toBe(5);
  });

  test('collapses rapid revisions to their final effective state', () => {
    const sampled = sampleCorrectionSessions([
      event(1, 0, 'in', 'migration_baseline'),
      event(2, 10, 'out'),
      event(3, 12, 'in'),
    ], (row) => row.state);
    expect(sampled.map((row) => row.event.id)).toEqual([1]);
  });

  test('keeps transitions separated by more than five minutes', () => {
    const sampled = sampleCorrectionSessions([
      event(1, 0, 'in', 'migration_baseline'),
      event(2, 10, 'out'),
      event(3, 16, 'in'),
    ], (row) => row.state);
    expect(sampled.map((row) => row.event.id)).toEqual([1, 2, 3]);
  });

  test('never removes lifecycle boundaries', () => {
    const sampled = sampleCorrectionSessions([
      event(1, 0, 'in', 'created'),
      event(2, 1, 'in', 'deleted'),
    ], (row) => row.state);
    expect(sampled.map((row) => row.event.eventKind)).toEqual(['created', 'deleted']);
  });
});

const foodEvent = (
  id: number,
  recordedAt: string,
  overrides: Record<string, unknown> = {}
) => ({
  id,
  foodItemId: 10,
  sourceFoodItemId: 10,
  itemName: 'Tuna',
  categoryId: 2,
  categoryName: 'Canned Goods',
  isInStock: true,
  isLimited: false,
  isClearance: false,
  limit: 100,
  limitType: 'household',
  estimatedQuantity: null,
  supplySource: null,
  eventKind: 'updated',
  recordsQuantity: false,
  recordsSupply: false,
  recordsStatus: false,
  recordsLimit: false,
  recordsIdentity: false,
  recordedAt: new Date(recordedAt),
  ...overrides,
});

const categoryEvent = (
  id: number,
  recordedAt: string,
  overrides: Record<string, unknown> = {}
) => ({
  id,
  categoryId: 2,
  sourceCategoryId: 2,
  categoryName: 'Canned Goods',
  limit: 100,
  limitType: 'household',
  icon: null,
  eventKind: 'migration_baseline',
  recordsLimit: true,
  recordsIdentity: true,
  recordedAt: new Date(recordedAt),
  ...overrides,
});

const analyticsClient = (foodEvents: unknown[], categoryEvents: unknown[] = []) => ({
  foodItemInventoryEvent: {
    findMany: async () => foodEvents,
  },
  categoryInventoryEvent: {
    findMany: async () => categoryEvents,
  },
});

describe('operational analytics semantics', () => {
  const now = new Date('2026-07-11T20:00:00.000Z');
  const range = resolveRange('last-30-days', 'UTC', now);

  test('treats pre-baseline time as untracked and an unavailable baseline as state, not an episode', async () => {
    const result = await computeOperationalAnalytics(
      range,
      now,
      analyticsClient([
        foodEvent(1, '2026-07-10T12:00:00.000Z', {
          eventKind: 'migration_baseline',
          isInStock: false,
          recordsStatus: true,
          recordsLimit: true,
          recordsIdentity: true,
        }),
      ]) as never
    );

    expect(result.summary.unavailableNow).toBe(1);
    expect(result.summary.unavailableEpisodes).toBe(0);
    expect(result.timeline).toHaveLength(2);
    expect(result.timeline[0].date).toBe('2026-07-10');
  });

  test('collapses a quickly corrected availability toggle without losing raw events', async () => {
    const rows = [
      foodEvent(1, '2026-07-10T12:00:00.000Z', {
        eventKind: 'migration_baseline', recordsStatus: true,
      }),
      foodEvent(2, '2026-07-11T10:00:00.000Z', {
        isInStock: false, recordsStatus: true,
      }),
      foodEvent(3, '2026-07-11T10:03:00.000Z', {
        isInStock: true, recordsStatus: true,
      }),
    ];
    const result = await computeOperationalAnalytics(
      range,
      now,
      analyticsClient(rows) as never
    );

    expect(result.episodes).toEqual([]);
    expect(result.rawFoodEvents).toHaveLength(3);
    expect(result.sampledStatusEventIds).toEqual([1]);
  });

  test('keeps a limit change when an identity-only edit follows inside the correction window', async () => {
    const result = await computeOperationalAnalytics(
      range,
      now,
      analyticsClient(
        [
          foodEvent(1, '2026-07-10T12:00:00.000Z', {
            eventKind: 'migration_baseline', recordsStatus: true, recordsLimit: true,
          }),
          foodEvent(2, '2026-07-11T10:00:00.000Z', {
            limit: 1, recordsLimit: true,
          }),
          foodEvent(3, '2026-07-11T10:02:00.000Z', {
            itemName: 'Canned Tuna', limit: 1, recordsIdentity: true,
          }),
        ],
        [categoryEvent(1, '2026-07-10T12:00:00.000Z')]
      ) as never
    );

    expect(result.limitChanges).toHaveLength(1);
    expect(result.limitChanges[0]).toMatchObject({
      entityType: 'food_item',
      limit: 1,
    });
    expect(result.sampledFoodLimitEventIds).toContain(2);
  });

  test('breaks the rationed timeline down by limit configuration', async () => {
    const result = await computeOperationalAnalytics(
      range,
      now,
      analyticsClient([
        foodEvent(1, '2026-07-09T12:00:00.000Z', {
          eventKind: 'migration_baseline', recordsStatus: true, recordsLimit: true,
          limit: 1, limitType: 'household',
        }),
        foodEvent(2, '2026-07-09T12:00:00.000Z', {
          foodItemId: 11, sourceFoodItemId: 11, itemName: 'Rice',
          eventKind: 'migration_baseline', recordsStatus: true, recordsLimit: true,
          limit: 2, limitType: 'person',
        }),
        // No Limit (sentinel 100): rationed in no series.
        foodEvent(3, '2026-07-09T12:00:00.000Z', {
          foodItemId: 12, sourceFoodItemId: 12, itemName: 'Beans',
          eventKind: 'migration_baseline', recordsStatus: true, recordsLimit: true,
        }),
        // Rice moves from 2-per-person to 1-per-household the next day.
        foodEvent(4, '2026-07-10T12:00:00.000Z', {
          foodItemId: 11, sourceFoodItemId: 11, itemName: 'Rice',
          limit: 1, limitType: 'household', recordsLimit: true,
        }),
      ]) as never
    );

    expect(result.rationedLimitSeries.map((series) => series.key)).toEqual([
      '1|household',
      '2|person',
    ]);

    const first = result.timeline[0];
    expect(first.rationedByLimit).toEqual({ '1|household': 1, '2|person': 1 });

    // After the change, both rationed items share 1-per-household and the
    // vacated 2-per-person series is zero-filled, not dropped.
    const last = result.timeline[result.timeline.length - 1];
    expect(last.rationedByLimit).toEqual({ '1|household': 2, '2|person': 0 });
    expect(last.itemRationed).toBe(2);
  });
});
