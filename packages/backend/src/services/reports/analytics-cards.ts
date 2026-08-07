// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { hBarSvg, kpiGrid, legendSvg, lineChartSvg, stackedBarSvg } from './analytics-print';
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

/** Categories plus their series, at one grain. */
export interface CardGrain {
  categories: string[];
  series: Series[];
  /** CSV heading for the category column. */
  categoryColumn: string;
}

export interface CardData extends CardGrain {
  /** Resolved at render time — some titles depend on the active filter. */
  title: string;
  /** Set when the grain was coarsened for readability. Printed on the card. */
  note: string | null;
  grain?: Grain;
  /**
   * The series before any condensing, when the two differ.
   *
   * The chart always draws the condensed form — that is the whole point of the
   * readability threshold. But the CSV is a data file, not a picture, and the
   * threshold does not apply to it, so the export offers both: `condensed` to
   * match the chart, `raw` for the underlying grain. Absent when nothing was
   * condensed, in which case the two are the same file.
   */
  raw?: CardGrain;
}

/** Which grain a CSV should carry. */
export type CsvGrain = 'condensed' | 'raw';

export interface AnalyticsCard {
  id: string;
  /** Fallback name for menus; `data().title` is what gets printed. */
  defaultTitle: string;
  lens: 'operations' | 'procurement';
  /**
   * `chart` prints an SVG; `kpi` prints HTML tiles.
   *
   * Declared rather than inferred, because the two differ in ways callers care
   * about: a KPI card never condenses, and it legitimately renders tiles for an
   * empty range where a chart renders nothing.
   */
  kind: 'chart' | 'kpi';
  /**
   * @param options this card's own controls, frozen when selection began.
   *   Cards whose state is fully described by the page filters ignore it.
   */
  data(analytics: unknown, options?: unknown): CardData;
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
  kind: 'chart',
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
  kind: 'chart',
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
  kind: 'chart',
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
      raw: condensed.condensed
        ? { categories, series, categoryColumn: 'month' }
        : undefined,
    };
  },
  print: data => stackedBarSvg(data.categories, data.series) + legendSvg(data.series.map(s => s.name)),
};


/** `pounds()` on the screen: two decimals, or "Unknown" for a null. */
const poundsLabel = (hundredths: number | null): string =>
  hundredths === null
    ? 'Unknown'
    : `${toPounds(hundredths).toLocaleString('en-US', { maximumFractionDigits: 2 })} lb`;

const countLabel = (n: number): string => n.toLocaleString('en-US');

/**
 * Inbound Supply Summary.
 *
 * The hardest parity case so far: the channel filter changes tile *labels* and
 * which tiles exist at all, across four conditions the screen derives
 * (`allChannels`, `includesWarehouse`, `includesFreshAlliance`, and the
 * fresh-alliance wording). Reproducing that faithfully is what "what you see is
 * what you get" costs on a card like this — ~45 lines rather than the ~7 a
 * chart card takes.
 *
 * Values are formatted here and carried as `text`, because the tiles mix
 * pounds, counts, and days; a single numeric column would be ambiguous in the
 * CSV. The numeric column is kept alongside for anything that can be summed.
 */
export const INBOUND_SUPPLY_SUMMARY: AnalyticsCard = {
  id: 'procurement-inbound-supply-summary',
  kind: 'kpi',
  defaultTitle: 'Inbound Supply Summary',
  lens: 'procurement',
  data: (analytics: any) => {
    const summary = analytics?.summary ?? {};
    const channel: string | null = analytics?.filters?.channel ?? null;
    const allChannels = channel === null;
    const isFreshAlliance = channel === 'fresh_alliance';
    const includesWarehouse = channel !== 'fresh_alliance';
    const includesFreshAlliance = channel !== 'ofb_warehouse';

    const tiles: { label: string; value: number | null; text: string }[] = [];
    const add = (label: string, value: number | null, text: string) =>
      tiles.push({ label, value, text });

    add(
      isFreshAlliance ? 'Partner Donation Weight' : 'Total Inbound Weight',
      summary.totalWeightHundredths ?? null,
      poundsLabel(summary.totalWeightHundredths ?? null)
    );
    if (allChannels) {
      add('Source Events', summary.sourceEventCount ?? 0, countLabel(summary.sourceEventCount ?? 0));
      add('OFB Warehouse Orders', summary.warehouseOrderCount ?? 0, countLabel(summary.warehouseOrderCount ?? 0));
      add('Fresh Food Alliance Receipts', summary.freshAllianceReceiptCount ?? 0, countLabel(summary.freshAllianceReceiptCount ?? 0));
    } else {
      add(
        isFreshAlliance ? 'Fresh Food Alliance Receipts' : 'OFB Warehouse Orders',
        summary.sourceEventCount ?? 0,
        countLabel(summary.sourceEventCount ?? 0)
      );
    }
    add('Receiving Dates', summary.receivingDateCount ?? 0, countLabel(summary.receivingDateCount ?? 0));

    if (!allChannels) {
      add(
        isFreshAlliance ? 'Typical Fresh Food Alliance Event' : 'Typical OFB Warehouse Event',
        summary.medianEventWeightHundredths ?? null,
        poundsLabel(summary.medianEventWeightHundredths ?? null)
      );
      const lower = summary.lowerQuartileEventWeightHundredths ?? null;
      const upper = summary.upperQuartileEventWeightHundredths ?? null;
      add(
        isFreshAlliance ? 'Middle 50% of Fresh Events' : 'Middle 50% of Warehouse Events',
        null,
        lower === null || upper === null ? 'Unknown' : `${poundsLabel(lower)}–${poundsLabel(upper)}`
      );
      add(
        isFreshAlliance ? 'Typical Category Lines' : 'Typical Order Lines',
        summary.medianLinesPerEvent ?? null,
        summary.medianLinesPerEvent?.toLocaleString('en-US', { maximumFractionDigits: 1 }) ?? 'Unknown'
      );
    }
    if (includesWarehouse) {
      add('Warehouse Products', summary.warehouseProductCodes ?? 0, countLabel(summary.warehouseProductCodes ?? 0));
    }
    if (includesFreshAlliance) {
      add('Fresh Food Alliance Categories', summary.freshAllianceCategoryCodes ?? 0, countLabel(summary.freshAllianceCategoryCodes ?? 0));
    }
    add(
      'Median Receiving Gap',
      summary.medianReceivingGapDays ?? null,
      summary.medianReceivingGapDays === null || summary.medianReceivingGapDays === undefined
        ? 'Insufficient history'
        : `${summary.medianReceivingGapDays.toLocaleString('en-US', { maximumFractionDigits: 1 })} days`
    );

    return {
      title: 'Inbound Supply Summary',
      categories: tiles.map(t => t.label),
      series: [{
        name: 'value',
        values: tiles.map(t => t.value ?? 0),
        text: tiles.map(t => t.text),
      }],
      categoryColumn: 'metric',
      note: null,
    };
  },
  print: data =>
    kpiGrid(
      data.categories.map((label, i) => ({
        label,
        value: data.series[0]?.text?.[i] ?? String(data.series[0]?.values[i] ?? ''),
      }))
    ),
};


/** `dollars()` on the screen. Locale pinned — see the note below. */
const dollarsLabel = (cents: number): string =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** `attributableDollars()`: null means the figure cannot be attributed. */
const attributableDollarsLabel = (cents: number | null): string =>
  cents === null || cents === undefined ? 'Not attributable' : dollarsLabel(cents);

/**
 * Paid Procurement Summary.
 *
 * Absent entirely when the channel filter is Fresh Alliance, matching the
 * screen: those are donation receipts, so product charges do not apply. An
 * empty cost card there would imply the charges were zero rather than absent.
 *
 * Three of the four figures are nullable on purpose. Service fees, grants, and
 * net cost sit on the order, not the product line, so under an acquisition-class
 * filter they cannot be attributed to one class — the screen says "Not
 * attributable" rather than showing a number that would be a guess, and so does
 * the report.
 *
 * The screen formats these with `toLocaleString(undefined, ...)`, so its
 * currency grouping follows the viewer's locale. This pins en-US: a report is a
 * document that gets filed and re-read, and the same export should not differ
 * by who generated it. That leaves a small screen/report difference on
 * non-en-US browsers, which is the screen's drift to fix, not the report's to
 * copy.
 */
export const PAID_PROCUREMENT_SUMMARY: AnalyticsCard = {
  id: 'procurement-paid-summary',
  kind: 'kpi',
  defaultTitle: 'Paid Procurement Summary',
  lens: 'procurement',
  data: (analytics: any) => {
    const summary = analytics?.summary ?? {};
    const isFreshAlliance = analytics?.filters?.channel === 'fresh_alliance';

    const tiles: { label: string; value: number | null; text: string }[] = isFreshAlliance
      ? []
      : [
          {
            label: 'Gross Product Charges',
            value: summary.calculatedGrossProductChargesCents ?? 0,
            text: dollarsLabel(summary.calculatedGrossProductChargesCents ?? 0),
          },
          {
            label: 'Service Fees',
            value: summary.serviceFeesCents ?? null,
            text: attributableDollarsLabel(summary.serviceFeesCents ?? null),
          },
          {
            label: 'Grants Applied',
            value: summary.grantsAppliedCents ?? null,
            text: attributableDollarsLabel(summary.grantsAppliedCents ?? null),
          },
          {
            label: 'Net Recorded Charge',
            value: summary.netRecordedCostCents ?? null,
            text: attributableDollarsLabel(summary.netRecordedCostCents ?? null),
          },
        ];

    return {
      title: 'Paid Procurement Summary',
      categories: tiles.map(t => t.label),
      series: [
        { name: 'value_cents', values: tiles.map(t => t.value ?? 0), text: tiles.map(t => t.text) },
      ],
      categoryColumn: 'metric',
      note: isFreshAlliance
        ? 'Not applicable to Fresh Food Alliance, which records donations rather than purchases.'
        : null,
    };
  },
  print: data =>
    kpiGrid(
      data.categories.map((label, i) => ({
        label,
        value: data.series[0]?.text?.[i] ?? String(data.series[0]?.values[i] ?? ''),
      }))
    ),
};


/**
 * Where Paid Procurement Dollars Went.
 *
 * The first card whose own control reaches the report. Its search box is not a
 * page filter, so without `options` an export would show the unfiltered top 15
 * while the screen showed three matching rows — a report that looks right and
 * is not what was asked for.
 *
 * Mirrors the screen exactly: with a query, the matching products up to the
 * search limit; without one, the top 15 by spend plus a grouped tail. The tail
 * is grouped because individually those products are hairlines — the largest is
 * about 1% of paid spend — so stacking them would be unreadable.
 */
const PAID_PRODUCT_SEARCH_LIMIT = 25;
const PAID_PRODUCT_TOP_N = 15;

export const PAID_PRODUCT_SPEND: AnalyticsCard = {
  id: 'procurement-paid-product-spend',
  kind: 'chart',
  defaultTitle: 'Where Paid Procurement Dollars Went',
  lens: 'procurement',
  data: (analytics: any, options?: any) => {
    const products = analytics?.paidProducts ?? [];
    const query = String(options?.search ?? '').trim().toLocaleLowerCase();

    let rows: { label: string; value: number }[];
    let note: string | null = null;

    if (query.length > 0) {
      const matches = products.filter(
        (p: any) =>
          p.description.toLocaleLowerCase().includes(query) ||
          p.productCode.toLocaleLowerCase().includes(query)
      );
      rows = matches
        .slice(0, PAID_PRODUCT_SEARCH_LIMIT)
        .map((p: any) => ({ label: p.description, value: p.totalSpendCents / 100 }));
      // Stated on the card: a filtered report that does not say it is filtered
      // is the misread this whole contract exists to prevent.
      note =
        `Filtered to "${options.search}" — ${matches.length} matching product` +
        `${matches.length === 1 ? '' : 's'}` +
        (matches.length > PAID_PRODUCT_SEARCH_LIMIT
          ? `, showing the first ${PAID_PRODUCT_SEARCH_LIMIT}.`
          : '.');
    } else {
      rows = products
        .slice(0, PAID_PRODUCT_TOP_N)
        .map((p: any) => ({ label: p.description, value: p.totalSpendCents / 100 }));
      const tail = products.slice(PAID_PRODUCT_TOP_N);
      const tailCents = tail.reduce((sum: number, p: any) => sum + p.totalSpendCents, 0);
      if (tailCents > 0) {
        rows.push({
          label: `Other paid products (${tail.length} ${tail.length === 1 ? 'code' : 'codes'})`,
          value: tailCents / 100,
        });
      }
    }

    return {
      title: 'Where Paid Procurement Dollars Went',
      categories: rows.map(r => r.label),
      series: [{ name: 'spend_usd', values: rows.map(r => r.value) }],
      categoryColumn: 'product',
      note,
    };
  },
  print: breakdownPrint,
};


const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Seasonal Inbound Weight — twelve months across, one series per compared year.
 *
 * Not a time series: the x-axis is the calendar month, so it never condenses.
 * Twelve categories are always printable.
 *
 * Two card-level controls travel in `options`:
 *
 * - `channel` — the card offers its own breakdown *only* when the page filter
 *   is All Channels; otherwise the payload is already scoped and a second
 *   control could contradict the filter visible at the top of the page
 *   (procurement-unification-plan.md: one source of truth). The client sends
 *   the effective value, so that resolution is not duplicated here.
 * - `years` — which calendar years are being compared. Absent, nothing is
 *   drawn, because "all years" is not what the screen shows either: it shows
 *   the years the user selected.
 */
export const SEASONAL_INBOUND_WEIGHT: AnalyticsCard = {
  id: 'procurement-seasonal-inbound-weight',
  kind: 'chart',
  defaultTitle: 'Seasonal Inbound Weight',
  lens: 'procurement',
  data: (analytics: any, options?: any) => {
    const channel: string = options?.channel ?? 'all';
    const years: string[] = Array.isArray(options?.years) ? options.years : [];

    // Same source split the screen uses: the all-channel series is
    // pre-aggregated, the per-channel one is not and must be summed.
    const points =
      channel === 'all'
        ? (analytics?.seasonalWeight ?? []).map((p: any) => ({ ...p, channel: 'all' }))
        : (analytics?.seasonalChannelWeight ?? []).filter((p: any) => p.channel === channel);

    const series = years.map(year => {
      const values = new Array(12).fill(0);
      for (const point of points) {
        if (String(point.year) !== String(year)) continue;
        values[point.month - 1] += toPounds(point.weightHundredths);
      }
      return { name: year, values };
    });

    return {
      title: 'Seasonal Inbound Weight',
      categories: MONTH_LABELS,
      series,
      categoryColumn: 'month',
      note:
        years.length === 0
          ? 'No calendar years were selected for comparison, so this card is empty.'
          : channel === 'all'
            ? null
            : `${CHANNEL_LABELS[channel] ?? channel} only.`,
    };
  },
  // Lines, not stacked bars: stacking years would sum unrelated periods into a
  // total the screen never shows and nobody asked for.
  print: data =>
    lineChartSvg(data.categories, data.series) + legendSvg(data.series.map(s => s.name)),
};

/** Registry. A card is exportable exactly when it appears here. */
export const ANALYTICS_CARDS: AnalyticsCard[] = [
  INBOUND_SUPPLY_SUMMARY,
  PAID_PROCUREMENT_SUMMARY,
  ACQUISITION_MIX,
  PROCUREMENT_CHANNELS,
  INBOUND_WEIGHT_OVER_TIME,
  PAID_PRODUCT_SPEND,
  SEASONAL_INBOUND_WEIGHT,
];

export const getAnalyticsCard = (id: string): AnalyticsCard | undefined =>
  ANALYTICS_CARDS.find(card => card.id === id);

/**
 * CSV from exactly the data the chart drew, or from the grain beneath it.
 *
 * Generic — no per-card serializer, so a new card gets its CSV for free and
 * cannot disagree with its chart.
 */
export function cardCsv(data: CardData, grain: CsvGrain = 'condensed'): string {
  // `raw` is only present when condensing actually changed something; falling
  // back to the condensed view keeps "raw" meaningful for every card.
  const source: CardGrain = grain === 'raw' && data.raw ? data.raw : data;
  const escape = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const header = [source.categoryColumn, ...source.series.map(s => s.name)].map(escape).join(',');
  const lines = [header];
  source.categories.forEach((category, i) => {
    lines.push(
      [
        escape(category),
        ...source.series.map(s => (s.text ? escape(s.text[i] ?? '') : (s.values[i] ?? 0))),
      ].join(',')
    );
  });
  return lines.join('\r\n') + '\r\n';
}
