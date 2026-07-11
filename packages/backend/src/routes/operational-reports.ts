// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { Router } from 'express';
import { z } from 'zod';
import {
  isValidLocalDate,
  isValidTimeZone,
  resolveRange,
} from '../services/inventory-analytics/timezone';
import {
  computeOperationalAnalytics,
  OperationalAnalyticsResult,
} from '../services/operational-analytics';

const router = Router();

const requestSchema = z.object({
  preset: z.enum([
    'last-30-days',
    'last-90-days',
    'last-6-months',
    'last-12-months',
    'ytd',
    'custom',
  ]),
  timeZone: z.string().refine(isValidTimeZone, 'Choose a valid timezone.'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).superRefine((value, context) => {
  if (value.preset !== 'custom') return;
  if (!value.startDate || !isValidLocalDate(value.startDate)) {
    context.addIssue({ code: 'custom', path: ['startDate'], message: 'Choose a valid start date.' });
  }
  if (!value.endDate || !isValidLocalDate(value.endDate)) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'Choose a valid end date.' });
  }
});

const CARD_IDS = [
  'availability-summary',
  'availability-over-time',
  'operational-pressure',
  'unavailable-episodes',
  'rationing-history',
] as const;

const formulaSafe = (value: unknown): string => {
  const text = value == null ? '' : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};

const csv = (headers: string[], rows: unknown[][]): Buffer => {
  const quote = (value: unknown) => `"${formulaSafe(value).replace(/"/g, '""')}"`;
  const body = [headers, ...rows]
    .map((row) => row.map(quote).join(','))
    .join('\r\n');
  return Buffer.from(`\uFEFF${body}\r\n`, 'utf8');
};

function cardCsv(cardId: typeof CARD_IDS[number], result: OperationalAnalyticsResult) {
  switch (cardId) {
    case 'availability-summary':
      return csv(
        [
          'tracked_items', 'available_now', 'unavailable_now',
          'limited_supply_now', 'clearance_now', 'item_rationed_now',
          'category_rationed_now', 'availability_percent_now',
          'tracked_availability_percent', 'unavailable_episodes',
          'median_restoration_hours', 'data_as_of',
          'correction_window_minutes', 'calculation_version',
        ],
        [[
          result.summary.trackedItems,
          result.summary.availableNow,
          result.summary.unavailableNow,
          result.summary.limitedSupplyNow,
          result.summary.clearanceNow,
          result.summary.itemRationedNow,
          result.summary.categoryRationedNow,
          result.summary.availabilityPercentNow,
          result.summary.trackedAvailabilityPercent,
          result.summary.unavailableEpisodes,
          result.summary.medianRestorationHours,
          result.dataAsOf,
          result.correctionWindowMinutes,
          result.calculationVersion,
        ]]
      );
    case 'availability-over-time':
    case 'operational-pressure':
      return csv(
        [
          'date', 'tracked_items', 'available', 'unavailable',
          'limited_supply', 'clearance', 'item_rationed',
          'availability_percent',
        ],
        result.timeline.map((point) => [
          point.date, point.trackedItems, point.available, point.unavailable,
          point.limitedSupply, point.clearance, point.itemRationed,
          point.availabilityPercent,
        ])
      );
    case 'unavailable-episodes':
      return csv(
        [
          'item_id', 'item_name', 'category_name', 'started_at', 'ended_at',
          'duration_hours', 'resolution',
        ],
        result.episodes.map((episode) => [
          episode.itemId, episode.itemName, episode.categoryName,
          episode.startedAt, episode.endedAt, episode.durationHours,
          episode.resolution,
        ])
      );
    case 'rationing-history':
      return csv(
        [
          'entity_type', 'entity_id', 'entity_name', 'category_name', 'limit',
          'limit_type', 'is_no_limit', 'recorded_at',
        ],
        result.limitChanges.map((change) => [
          change.entityType, change.entityId, change.entityName,
          change.categoryName, change.limit, change.limitType,
          change.isNoLimit, change.recordedAt,
        ])
      );
  }
}

const resolveRequest = (body: unknown) => {
  const parsed = requestSchema.parse(body);
  const now = new Date();
  const range = resolveRange(
    parsed.preset,
    parsed.timeZone,
    now,
    parsed.preset === 'custom'
      ? { startDate: parsed.startDate!, endDate: parsed.endDate! }
      : undefined
  );
  return { range, now };
};

router.post('/query', async (req, res, next) => {
  try {
    const { range, now } = resolveRequest(req.body);
    const result = await computeOperationalAnalytics(range, now);
    const { rawFoodEvents: _food, rawCategoryEvents: _category, ...publicResult } = result;
    res.json(publicResult);
  } catch (error) {
    next(error);
  }
});

router.post('/cards/:cardId/csv', async (req, res, next) => {
  try {
    const cardId = z.enum(CARD_IDS).parse(req.params.cardId);
    const { range, now } = resolveRequest(req.body);
    const result = await computeOperationalAnalytics(range, now);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cardId}.csv"`);
    res.send(cardCsv(cardId, result));
  } catch (error) {
    next(error);
  }
});

router.post('/raw/csv', async (req, res, next) => {
  try {
    const { range, now } = resolveRequest(req.body);
    const result = await computeOperationalAnalytics(range, now);
    const statusIds = new Set(result.sampledStatusEventIds);
    const foodLimitIds = new Set(result.sampledFoodLimitEventIds);
    const categoryLimitIds = new Set(result.sampledCategoryLimitEventIds);
    const rows = [
      ...result.rawFoodEvents.filter((event) => event.recordedAt >= range.startUtc).map((event) => [
        'food_item', event.id, event.sourceFoodItemId, event.itemName,
        event.categoryName, event.eventKind, event.isInStock, event.isLimited,
        event.isClearance, event.limit, event.limitType,
        event.estimatedQuantity, event.supplySource, event.recordsStatus,
        event.recordsLimit, event.recordsQuantity, event.recordsSupply,
        statusIds.has(event.id), foodLimitIds.has(event.id),
        event.recordedAt.toISOString(),
      ]),
      ...result.rawCategoryEvents.filter((event) => event.recordedAt >= range.startUtc).map((event) => [
        'category', event.id, event.sourceCategoryId, event.categoryName,
        '', event.eventKind, '', '', '', event.limit, event.limitType,
        '', '', '', event.recordsLimit, '', '', '',
        categoryLimitIds.has(event.id), event.recordedAt.toISOString(),
      ]),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="operational-history-raw.csv"');
    res.send(csv([
      'entity_type', 'event_id', 'source_entity_id', 'entity_name',
      'category_name', 'event_kind', 'is_in_stock', 'is_limited_supply',
      'is_clearance', 'limit', 'limit_type', 'estimated_quantity',
      'supply_source', 'records_status', 'records_limit', 'records_quantity',
      'records_supply', 'included_in_status_analysis',
      'included_in_limit_analysis', 'recorded_at',
    ], rows));
  } catch (error) {
    next(error);
  }
});

export default router;
