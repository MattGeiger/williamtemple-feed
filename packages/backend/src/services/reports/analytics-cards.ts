// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { hBarSvg } from './analytics-print';

/**
 * The card contract: one accessor, two outputs.
 *
 * Every card declares a single `series()` that turns the analytics payload into
 * display rows — already labelled, already in display units. The print renderer
 * and the CSV serializer both consume *that*, so their numbers cannot disagree.
 * Only the drawing can differ, which is the point: the print chart is designed
 * for paper rather than imitating the screen.
 *
 * The first spike skipped this and re-derived rows inside each renderer. It
 * drifted immediately — the sample PDF printed the raw enum `PURCH-DON` where
 * the screen shows `Purch-Don`, and dropped the legacy history that the screen
 * stacks onto Fresh Alliance. Both are parity bugs, and both were invisible
 * until the outputs were compared side by side. Hence one accessor.
 */

/**
 * Display vocabulary, canonical.
 *
 * The frontend holds its own copies in `analytics/index.tsx` because the two
 * packages do not share a module. `src/test/analytics-card-parity.test.ts` in
 * the frontend reads these from source and fails if they diverge — the same
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

export interface CardRow {
  label: string;
  value: number;
}

export interface AnalyticsCard {
  id: string;
  title: string;
  lens: 'operations' | 'procurement';
  /** Column headings for the CSV. Must line up with `series()` row fields. */
  columns: [string, string];
  /** The single source both outputs read. */
  series(analytics: unknown): CardRow[];
  /** Chart for paper. Receives exactly what the CSV receives. */
  print(rows: CardRow[]): string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export const ACQUISITION_MIX: AnalyticsCard = {
  id: 'procurement-acquisition-mix',
  title: 'Acquisition Mix',
  lens: 'procurement',
  columns: ['acquisition_class', 'inbound_weight_lb'],
  series: (analytics: any) =>
    (analytics?.acquisitionMix ?? [])
      .map((row: any) => ({
        // Labelled, not raw. The screen shows "Purch-Don", so the report does.
        label: ACQUISITION_LABELS[row.acquisitionClass] ?? row.acquisitionClass,
        value: toPounds(row.weightHundredths),
      }))
      .sort((a: CardRow, b: CardRow) => b.value - a.value),
  print: rows => hBarSvg(rows),
};

export const PROCUREMENT_CHANNELS: AnalyticsCard = {
  id: 'procurement-channels',
  title: 'Procurement Channels',
  lens: 'procurement',
  columns: ['channel', 'inbound_weight_lb'],
  series: (analytics: any) => {
    // Fresh Alliance carries its matched partners' pre-Primarius history
    // stacked on, so the bar reflects the whole relationship rather than only
    // the years OFB recorded (D16). The screen does this; omitting it here
    // understated the channel by the entire legacy total.
    const legacy = analytics?.summary?.freshAllianceLegacyWeightHundredths ?? 0;
    return (analytics?.channelMix ?? [])
      .map((row: any) => ({
        label: CHANNEL_LABELS[row.channel] ?? row.channel,
        value: toPounds(
          row.channel === 'fresh_alliance' ? row.weightHundredths + legacy : row.weightHundredths
        ),
      }))
      .sort((a: CardRow, b: CardRow) => b.value - a.value);
  },
  print: rows => hBarSvg(rows),
};

/** Registry. A card is exportable exactly when it appears here. */
export const ANALYTICS_CARDS: AnalyticsCard[] = [ACQUISITION_MIX, PROCUREMENT_CHANNELS];

export const getAnalyticsCard = (id: string): AnalyticsCard | undefined =>
  ANALYTICS_CARDS.find(card => card.id === id);

/** CSV from the same rows the chart drew. Generic — no per-card serializer. */
export function cardCsv(card: AnalyticsCard, rows: CardRow[]): string {
  const escape = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = [card.columns.join(',')];
  for (const row of rows) {
    lines.push(`${escape(row.label)},${row.value}`);
  }
  return lines.join('\r\n') + '\r\n';
}
