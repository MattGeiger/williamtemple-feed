// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { hBarSvg, legendSvg, stackedBarSvg } from './analytics-print';
import { condenseTimeSeries, type Grain, type Series } from './condense';

/**
 * The card contract: one accessor, two outputs.
 *
 * Every card declares a single `data()` that turns the analytics payload into
 * display-ready categories and series — already labelled, already in display
 * units, already condensed if the range is too long to print. The chart and the
 * CSV both consume *that*, so their numbers cannot disagree. Only the drawing
 * differs, which is the point: the print chart is designed for paper rather
 * than imitating the screen.
 *
 * The first spike skipped this and re-derived rows inside each renderer. It
 * drifted on its first output — raw `PURCH-DON` where the screen shows
 * `Purch-Don`, and Fresh Alliance missing the legacy history the screen stacks
 * onto it, understating that channel by 62%. Neither was visible without
 * comparing outputs side by side. Hence one accessor.
 *
 * **Filters are part of the data.** A card's title and series set can depend on
 * the active filter, so `data()` reads the filter off the payload the API
 * returned rather than taking it separately. The screen and the report are then
 * looking at the same source of truth and cannot disagree about what was asked
 * for.
 */

/**
 * Display vocabulary, canonical.
 *
 * The frontend holds its own copies in `analytics/index.tsx` because the two
 * packages share no module. `src/test/analytics-card-parity.test.ts` in the
 * frontend reads these from source and fails if they diverge — the same
 * technique the audit-action labels use.
 */
export const ACQUISITION_LABELS: Record<string, string> = {
  DONATED: 'Donated',
  'PURCH-DON': 'Purch-Don',
  GOVERNMENT: 'Government',
  PURCHASED: 'Purchased',
};

export const CHANNEL_LABELS: Record<string, string> = {
  ofb_warehouse: 'OFB Warehouse',
  fresh_alliance: 'Fresh Food Alliance',
  community_donation: 'Donations (Legacy Data)',
};

/** Hundredths of a pound to pounds. The screen's `toPounds`. */
export const toPounds = (hundredths: number): number => hundredths / 100;

export interface CardData {
  /** Resolved at render time — some titles depend on the active filter. */
  title: string;
  /** X-axis values, or row labels for a breakdown. */
  categories: string[];
  series: Series[];
  /** CSV heading for the category column. */
  categoryColumn: string;
  /** Set when the grain was coarsened for readability. Printed on the card. */
  note: string | null;
  grain?: Grain;
}

export interface AnalyticsCard {
  id: string;
  /** Fallback name for menus; `data().title` is what gets printed. */
  defaultTitle: string;
  lens: 'operations' | 'procurement';
  data(analytics: unknown): CardData;
  print(data: CardData): string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Single-series breakdown drawn as labelled horizontal bars. */
const breakdownPrint = (data: CardData): string =>
  hBarSvg(
    data.categories.map((label, i) => ({ label, value: data.series[0]?.values[i] ?? 0 }))
  );

export const ACQUISITION_MIX: AnalyticsCard = {
  id: 'procurement-acquisition-mix',
  defaultTitle: 'Acquisition Mix',
  lens: 'procurement',
  data: (analytics: any) => {
    const rows = (analytics?.acquisitionMix ?? [])
      .map((row: any) => ({
        // Labelled, not raw. The screen shows "Purch-Don", so the report does.
        label: ACQUISITION_LABELS[row.acquisitionClass] ?? row.acquisitionClass,
        value: toPounds(row.weightHundredths),
      }))
      .sort((a: any, b: any) => b.value - a.value);
    return {
      title: 'Acquisition Mix',
      categories: rows.map((r: any) => r.label),
      series: [{ name: 'inbound_weight_lb', values: rows.map((r: any) => r.value) }],
      categoryColumn: 'acquisition_class',
      note: null,
    };
  },
  print: breakdownPrint,
};

export const PROCUREMENT_CHANNELS: AnalyticsCard = {
  id: 'procurement-channels',
  defaultTitle: 'Procurement Channels',
  lens: 'procurement',
  data: (analytics: any) => {
    // Fresh Alliance carries its matched partners' pre-Primarius history
    // stacked on, so the bar reflects the whole relationship rather than only
    // the years OFB recorded (D16). The screen does this; omitting it here
    // understated the channel by the entire legacy total.
    const legacy = analytics?.summary?.freshAllianceLegacyWeightHundredths ?? 0;
    const rows = (analytics?.channelMix ?? [])
      .map((row: any) => ({
        label: CHANNEL_LABELS[row.channel] ?? row.channel,
        value: toPounds(
          row.channel === 'fresh_alliance' ? row.weightHundredths + legacy : row.weightHundredths
        ),
      }))
      .sort((a: any, b: any) => b.value - a.value);
    return {
      title: 'Procurement Channels',
      categories: rows.map((r: any) => r.label),
      series: [{ name: 'inbound_weight_lb', values: rows.map((r: any) => r.value) }],
      categoryColumn: 'channel',
      note: null,
    };
  },
  print: breakdownPrint,
};

/**
 * Inbound weight over time.
 *
 * Title *and* series set depend on the channel filter, exactly as on screen:
 *
 * - `ofb_warehouse` → "Warehouse Weight by Acquisition Class", four classes;
 * - `fresh_alliance` → "Fresh Food Alliance Weight Over Time", that one series;
 * - no filter → "Inbound Weight Over Time", one series per channel.
 *
 * The community series appears only when that history is actually loaded — it
 * is a single-agency sidecar (D22), so an always-present empty line would imply
 * every other agency has a source it will never have.
 */
export const INBOUND_WEIGHT_OVER_TIME: AnalyticsCard = {
  id: 'procurement-inbound-weight-over-time',
  defaultTitle: 'Inbound Weight Over Time',
  lens: 'procurement',
  data: (analytics: any) => {
    const monthly = analytics?.monthlyWeight ?? [];
    const channel: string | null = analytics?.filters?.channel ?? null;
    const hasCommunity = monthly.some((r: any) => (r.communityDonationWeightHundredths ?? 0) > 0);

    let title: string;
    let defs: [string, string][];
    if (channel === 'ofb_warehouse') {
      title = 'Warehouse Weight by Acquisition Class';
      defs = [
        [ACQUISITION_LABELS.DONATED, 'donatedWeightHundredths'],
        [ACQUISITION_LABELS['PURCH-DON'], 'purchDonWeightHundredths'],
        [ACQUISITION_LABELS.GOVERNMENT, 'governmentWeightHundredths'],
        [ACQUISITION_LABELS.PURCHASED, 'purchasedWeightHundredths'],
      ];
    } else if (channel === 'fresh_alliance') {
      title = 'Fresh Food Alliance Weight Over Time';
      defs = [[CHANNEL_LABELS.fresh_alliance, 'freshAllianceWeightHundredths']];
    } else {
      title = 'Inbound Weight Over Time';
      defs = [
        [CHANNEL_LABELS.ofb_warehouse, 'ofbWarehouseWeightHundredths'],
        [CHANNEL_LABELS.fresh_alliance, 'freshAllianceWeightHundredths'],
        ...(hasCommunity
          ? ([[CHANNEL_LABELS.community_donation, 'communityDonationWeightHundredths']] as [
              string,
              string,
            ][])
          : []),
      ];
    }

    const categories = monthly.map((r: any) => r.month);
    const series = defs.map(([name, key]) => ({
      name,
      values: monthly.map((r: any) => toPounds(r[key] ?? 0)),
    }));

    // Grain is chosen here, before either output, so the chart and the CSV
    // always describe the same buckets.
    const condensed = condenseTimeSeries(categories, series);

    return {
      title,
      categories: condensed.categories,
      series: condensed.series,
      categoryColumn: condensed.grain === 'month' ? 'month' : condensed.grain,
      note: condensed.note,
      grain: condensed.grain,
    };
  },
  print: data => stackedBarSvg(data.categories, data.series) + legendSvg(data.series.map(s => s.name)),
};

/** Registry. A card is exportable exactly when it appears here. */
export const ANALYTICS_CARDS: AnalyticsCard[] = [
  ACQUISITION_MIX,
  PROCUREMENT_CHANNELS,
  INBOUND_WEIGHT_OVER_TIME,
];

export const getAnalyticsCard = (id: string): AnalyticsCard | undefined =>
  ANALYTICS_CARDS.find(card => card.id === id);

/** CSV from exactly the data the chart drew. Generic — no per-card serializer. */
export function cardCsv(data: CardData): string {
  const escape = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const header = [data.categoryColumn, ...data.series.map(s => s.name)].map(escape).join(',');
  const lines = [header];
  data.categories.forEach((category, i) => {
    lines.push([escape(category), ...data.series.map(s => s.values[i] ?? 0)].join(','));
  });
  return lines.join('\r\n') + '\r\n';
}
