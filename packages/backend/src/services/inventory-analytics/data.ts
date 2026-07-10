// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Shared analytics data loading (Reports initiative §2). One context load
 * feeds every tab so interactive queries and exports agree.
 *
 * Deleted items keep contributing while they existed: their ledger events
 * carry an immutable `sourceFoodItemId` plus denormalized identity, and the
 * final `deleted` event bounds their lifetime.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../db';
import { QuantityObservation } from './calculations';
import { ResolvedRange } from './timezone';

export type FoodItemWithCategory = Prisma.FoodItemGetPayload<{
  include: { category: true };
}>;

export interface LedgerEvent {
  id: number;
  sourceFoodItemId: number;
  itemName: string;
  categoryId: number;
  categoryName: string;
  isInStock: boolean;
  isLimited: boolean;
  isClearance: boolean;
  purchasePriceCents: number | null;
  unitsPerPurchase: number;
  estimatedQuantity: number | null;
  eventKind: string;
  recordsQuantity: boolean;
  recordsPrice: boolean;
  recordsStatus: boolean;
  recordsIdentity: boolean;
  recordedAt: Date;
}

export interface ItemTimeline {
  sourceFoodItemId: number;
  /** Latest known identity (live item wins over last event). */
  name: string;
  categoryId: number;
  categoryName: string;
  isLive: boolean;
  liveItem: FoodItemWithCategory | null;
  /** Time of the final 'deleted' event, when the item no longer exists. */
  deletedAt: Date | null;
  /** First ledger event; all earlier time is untracked. */
  firstTrackedAt: Date | null;
  /** Every event before the range end, ascending. */
  events: LedgerEvent[];
}

export interface AnalyticsContext {
  range: ResolvedRange;
  horizonDays: number;
  asOf: Date;
  /** Timelines for live and (range-relevant) deleted items. */
  timelines: ItemTimeline[];
  liveItems: FoodItemWithCategory[];
}

export interface LoadAnalyticsContextOptions {
  range: ResolvedRange;
  horizonDays: number;
  categoryIds?: number[];
  asOf?: Date;
  client?: PrismaClient;
}

export async function loadAnalyticsContext(
  options: LoadAnalyticsContextOptions
): Promise<AnalyticsContext> {
  const client = options.client ?? prisma;
  const asOf = options.asOf ?? new Date();
  const { range, horizonDays } = options;

  const [liveItems, events] = await Promise.all([
    client.foodItem.findMany({
      include: { category: true },
      orderBy: { name: 'asc' },
    }),
    client.foodItemInventoryEvent.findMany({
      where: { recordedAt: { lt: range.endUtc } },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const liveById = new Map(liveItems.map((item) => [item.id, item]));
  const eventsBySource = new Map<number, LedgerEvent[]>();
  for (const event of events) {
    const list = eventsBySource.get(event.sourceFoodItemId) ?? [];
    list.push(event);
    eventsBySource.set(event.sourceFoodItemId, list);
  }

  let timelines: ItemTimeline[] = [];
  for (const [sourceId, itemEvents] of eventsBySource) {
    const liveItem = liveById.get(sourceId) ?? null;
    const lastEvent = itemEvents[itemEvents.length - 1];
    const deletedEvent = liveItem
      ? null
      : [...itemEvents].reverse().find((e) => e.eventKind === 'deleted') ?? null;

    // An item deleted before the range start contributed nothing to it.
    if (!liveItem && deletedEvent && deletedEvent.recordedAt < range.startUtc) {
      continue;
    }
    // Events for a deleted-and-recreated name stay separate by source id.

    timelines.push({
      sourceFoodItemId: sourceId,
      name: liveItem?.name ?? lastEvent.itemName,
      categoryId: liveItem?.categoryId ?? lastEvent.categoryId,
      categoryName: liveItem?.category.name ?? lastEvent.categoryName,
      isLive: liveItem !== null,
      liveItem,
      deletedAt: deletedEvent?.recordedAt ?? null,
      firstTrackedAt: itemEvents[0]?.recordedAt ?? null,
      events: itemEvents,
    });
  }

  // Live items with no events yet (shouldn't happen post-migration, but a
  // raw-SQL insert could create one) still deserve a timeline.
  for (const item of liveItems) {
    if (!eventsBySource.has(item.id)) {
      timelines.push({
        sourceFoodItemId: item.id,
        name: item.name,
        categoryId: item.categoryId,
        categoryName: item.category.name,
        isLive: true,
        liveItem: item,
        deletedAt: null,
        firstTrackedAt: null,
        events: [],
      });
    }
  }

  if (options.categoryIds?.length) {
    const allowed = new Set(options.categoryIds);
    timelines = timelines.filter((timeline) => allowed.has(timeline.categoryId));
  }

  timelines.sort((a, b) => a.name.localeCompare(b.name));

  const filteredLive = options.categoryIds?.length
    ? liveItems.filter((item) => new Set(options.categoryIds).has(item.categoryId))
    : liveItems;

  return { range, horizonDays, asOf, timelines, liveItems: filteredLive };
}

/**
 * Quantity observations for burn math: the latest pre-range anchor event
 * plus every in-range quantity-recording event.
 */
export function quantityObservations(
  timeline: ItemTimeline,
  range: ResolvedRange
): QuantityObservation[] {
  let anchor: QuantityObservation | null = null;
  const inRange: QuantityObservation[] = [];
  for (const event of timeline.events) {
    if (!event.recordsQuantity) continue;
    if (event.recordedAt < range.startUtc) {
      anchor = { at: event.recordedAt, quantity: event.estimatedQuantity };
    } else {
      inRange.push({ at: event.recordedAt, quantity: event.estimatedQuantity });
    }
  }
  return anchor ? [anchor, ...inRange] : inRange;
}

/** Stock status at an instant; null while untracked. */
export function stockStatusAt(
  timeline: ItemTimeline,
  at: Date
): boolean | null {
  if (timeline.deletedAt && at >= timeline.deletedAt) return null;
  let latest: LedgerEvent | null = null;
  for (const event of timeline.events) {
    if (event.recordedAt > at) break;
    latest = event;
  }
  return latest ? latest.isInStock : null;
}

export interface PricePoint {
  at: Date;
  purchasePriceCents: number | null;
  unitsPerPurchase: number;
  eventKind: string;
}

/** Price-recording history (anchor included), ascending. */
export function pricePoints(timeline: ItemTimeline): PricePoint[] {
  return timeline.events
    .filter((event) => event.recordsPrice)
    .map((event) => ({
      at: event.recordedAt,
      purchasePriceCents: event.purchasePriceCents,
      unitsPerPurchase: event.unitsPerPurchase,
      eventKind: event.eventKind,
    }));
}
