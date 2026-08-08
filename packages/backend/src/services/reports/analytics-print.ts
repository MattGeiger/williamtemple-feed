// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Shared chart primitives for print.
 *
 * Every card draws with these; a card itself contributes only a `series()` and
 * a one-line `print()` (see `analytics-cards.ts`). Keeping the drawing here is
 * what makes the marginal cost of an exportable card a handful of lines.
 *
 * Deliberately free of CSS: colours and type are attributes on the elements, so
 * the output is identical wherever it is rendered. There is no stylesheet to
 * resolve, which is the property the serialized-SVG approach had to reconstruct
 * by inlining computed styles.
 */

import type { Series } from './condense';

const PALETTE = ['#2964A3', '#3090A8', '#78C0C0', '#F0D848', '#B08CC0', '#E08050', '#8FB339'];
const INK = '#231F20';
const MUTED = '#6B7684';
const GRID = '#E3E8EE';

const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

// ---------- label fitting ----------

/**
 * Helvetica advance widths, in 1/1000 em, for ASCII 32–126.
 *
 * Real metrics rather than an average character width. "Meat, Chicken
 * Drumsticks (12/3.4 lb trays)" and "MMMMMMMMMMMMMMMMMMMMMMMMMMMMM" are the
 * same length and nowhere near the same width, so an average truncates one far
 * too early and lets the other run straight under the bars — which is the bug
 * this exists to fix. Arial was drawn to these same widths, so one table is
 * correct for both families in the SVG's font stack.
 */
const HELVETICA_WIDTHS: readonly number[] = [
  //  ␣    !    "    #    $    %    &    '
  278, 278, 355, 556, 556, 889, 667, 191,
  //  (    )    *    +    ,    -    .    /
  333, 333, 389, 584, 278, 333, 278, 278,
  //  0    1    2    3    4    5    6    7
  556, 556, 556, 556, 556, 556, 556, 556,
  //  8    9    :    ;    <    =    >    ?
  556, 556, 278, 278, 584, 584, 584, 556,
  //  @    A    B    C    D    E    F    G
  1015, 667, 667, 722, 722, 667, 611, 778,
  //  H    I    J    K    L    M    N    O
  722, 278, 500, 667, 556, 833, 722, 778,
  //  P    Q    R    S    T    U    V    W
  667, 778, 722, 667, 611, 722, 667, 944,
  //  X    Y    Z    [    \    ]    ^    _
  667, 667, 611, 278, 278, 278, 469, 556,
  //  `    a    b    c    d    e    f    g
  333, 556, 556, 500, 556, 556, 278, 556,
  //  h    i    j    k    l    m    n    o
  556, 222, 222, 500, 222, 833, 556, 556,
  //  p    q    r    s    t    u    v    w
  556, 556, 333, 500, 278, 556, 500, 722,
  //  x    y    z    {    |    }    ~
  500, 500, 500, 334, 260, 334, 584,
];

const ELLIPSIS = '…';
/** Helvetica's own ellipsis advance; it is not in the ASCII table above. */
const ELLIPSIS_UNITS = 1000;
const FALLBACK_UNITS = 556;

const charUnits = (char: string): number => {
  if (char === ELLIPSIS) return ELLIPSIS_UNITS;
  const code = char.codePointAt(0) ?? 0;
  return code >= 32 && code <= 126 ? HELVETICA_WIDTHS[code - 32] : FALLBACK_UNITS;
};

/** Rendered width of `text` in px at `fontSize`. */
export function textWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const char of text) units += charUnits(char);
  return (units / 1000) * fontSize;
}

/**
 * Shortens a label to fit `maxWidth`, ending in an ellipsis when it had to cut.
 *
 * Label columns are a fixed width and the bars start at their right edge, so an
 * over-long label used to print straight through the bar beside it. Cutting is
 * the lesser loss: the CSV beside the PDF carries every name in full, so
 * nothing is actually lost — only the picture is abbreviated, and the ellipsis
 * says so without a legend.
 */
export function truncateToWidth(text: string, maxWidth: number, fontSize: number): string {
  if (maxWidth <= 0) return '';
  if (textWidth(text, fontSize) <= maxWidth) return text;

  const budget = maxWidth - textWidth(ELLIPSIS, fontSize);
  if (budget <= 0) return ELLIPSIS;

  const chars = [...text];
  let width = 0;
  let kept = 0;
  for (const char of chars) {
    const next = width + textWidth(char, fontSize);
    if (next > budget) break;
    width = next;
    kept += 1;
  }
  // A trailing space before the ellipsis reads as a gap, not a cut.
  return `${chars.slice(0, kept).join('').trimEnd()}${ELLIPSIS}`;
}

// ---------- shared primitives ----------

/**
 * How a bar's value is written beside it.
 *
 * Pounds are the common case and stay the default, but the unit was hard-coded
 * here and two cards were quietly wrong on paper as a result: "Where Paid
 * Procurement Dollars Went" printed `43,245 lb` for $43,245 of spend, and
 * Availability Summary printed `58 lb` for a count of items. A caller passes
 * its own formatter now, because only the card knows what it is measuring.
 */
export type BarValueFormat = (value: number) => string;

export const POUNDS: BarValueFormat = v => `${fmt(v)} lb`;
export const COUNT: BarValueFormat = v => fmt(v);
/** Matches the screen's `dollars()`: currency style, en-US. */
export const DOLLARS: BarValueFormat = v =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Horizontal bars with a label column. Used for any "mix" breakdown. */
export function hBarSvg(
  rows: { label: string; value: number }[],
  width = 900,
  rowH = 30,
  formatValue: BarValueFormat = POUNDS
): string {
  const labelW = 220, pad = 12, chartW = width - labelW - pad - 90;
  // The bars begin at `labelW`, so a label may occupy everything up to it less
  // a small gutter. Anything longer is cut rather than drawn over the bar.
  const labelMaxW = labelW - 10;
  const max = Math.max(1, ...rows.map(r => r.value));
  const height = rows.length * rowH + pad * 2;
  const bars = rows.map((r, i) => {
    const y = pad + i * rowH;
    const w = Math.max(1, (r.value / max) * chartW);
    return `<text x="0" y="${y + rowH / 2 + 4}" font-size="12" fill="${INK}">${esc(truncateToWidth(r.label, labelMaxW, 12))}</text>` +
      `<rect x="${labelW}" y="${y + 5}" width="${w}" height="${rowH - 14}" rx="2" fill="${PALETTE[i % PALETTE.length]}"/>` +
      `<text x="${labelW + w + 8}" y="${y + rowH / 2 + 4}" font-size="11" fill="${MUTED}">${esc(formatValue(r.value))}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">${bars}</svg>`;
}

/** Stacked vertical bars over an ordered category axis. Used for time series. */
export function stackedBarSvg(
  categories: string[],
  series: { name: string; values: number[] }[],
  width = 900, height = 260
): string {
  const padL = 62, padR = 8, padT = 10, padB = 42;
  const plotW = width - padL - padR, plotH = height - padT - padB;
  const totals = categories.map((_, i) => series.reduce((s, x) => s + (x.values[i] || 0), 0));
  const max = Math.max(1, ...totals);
  const step = plotW / Math.max(1, categories.length);
  const barW = Math.max(2, step * 0.68);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const y = padT + plotH - f * plotH;
    return `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="${GRID}" stroke-width="1"/>` +
      `<text x="${padL - 8}" y="${y + 4}" font-size="10" fill="${MUTED}" text-anchor="end">${fmt(Math.round(max * f))}</text>`;
  }).join('');

  const bars = categories.map((c, i) => {
    let acc = 0;
    const x = padL + i * step + (step - barW) / 2;
    const segs = series.map((s, si) => {
      const v = s.values[i] || 0;
      if (v <= 0) return '';
      const h = (v / max) * plotH;
      const y = padT + plotH - acc - h;
      acc += h;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${PALETTE[si % PALETTE.length]}"/>`;
    }).join('');
    // Thin out labels so a long series stays readable on paper.
    const showLabel = categories.length <= 14 || i % Math.ceil(categories.length / 12) === 0;
    const label = showLabel
      ? `<text x="${x + barW / 2}" y="${height - padB + 16}" font-size="9" fill="${MUTED}" text-anchor="middle" transform="rotate(-40 ${x + barW / 2} ${height - padB + 16})">${esc(c)}</text>`
      : '';
    return segs + label;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">${ticks}${bars}</svg>`;
}

/** Legend drawn into the SVG, so it cannot be lost the way an HTML one is. */
export function legendSvg(names: string[], width = 900): string {
  const items = names.map((n, i) => {
    const x = (i % 4) * (width / 4);
    const y = Math.floor(i / 4) * 18 + 12;
    return `<rect x="${x}" y="${y - 8}" width="10" height="10" rx="2" fill="${PALETTE[i % PALETTE.length]}"/>` +
      `<text x="${x + 15}" y="${y + 1}" font-size="11" fill="${INK}">${esc(n)}</text>`;
  }).join('');
  const rows = Math.ceil(names.length / 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${rows * 18 + 6}" font-family="Helvetica, Arial, sans-serif">${items}</svg>`;
}

/**
 * One polyline per series over a shared category axis.
 *
 * For comparisons where stacking would be a lie: a year-over-year seasonal
 * chart stacked would sum unrelated years into a total nobody asked for. The
 * screen draws these as lines, and so does the report.
 */
export function lineChartSvg(
  categories: string[],
  series: Series[],
  width = 900,
  height = 260,
  /**
   * Fills under the first series.
   *
   * Available Assortment Over Time draws its combined total as an area and each
   * category as a line, so the total reads as the envelope the categories sit
   * inside. Rendering all of them as bare lines would lose that hierarchy and
   * make the total look like just another category.
   */
  fillFirst = false
): string {
  const padL = 62, padR = 8, padT = 10, padB = 34;
  const plotW = width - padL - padR, plotH = height - padT - padB;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const step = categories.length > 1 ? plotW / (categories.length - 1) : 0;
  const x = (i: number) => padL + i * step;
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const ty = padT + plotH - f * plotH;
    return `<line x1="${padL}" y1="${ty}" x2="${width - padR}" y2="${ty}" stroke="${GRID}" stroke-width="1"/>` +
      `<text x="${padL - 8}" y="${ty + 4}" font-size="10" fill="${MUTED}" text-anchor="end">${fmt(Math.round(max * f))}</text>`;
  }).join('');

  const lines = series.map((s, si) => {
    const points = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const stroke = PALETTE[si % PALETTE.length];
    const area =
      fillFirst && si === 0 && s.values.length > 0
        ? `<polygon points="${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} ${points} ${x(s.values.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)}" fill="${stroke}" fill-opacity="0.18"/>`
        : '';
    return area + `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`;
  }).join('');

  // A daily timeline cannot label every point; thin to roughly a dozen.
  const stride = Math.max(1, Math.ceil(categories.length / 12));
  const labels = categories.map((c, i) =>
    i % stride === 0
      ? `<text x="${x(i)}" y="${height - padB + 16}" font-size="10" fill="${MUTED}" text-anchor="middle">${esc(c)}</text>`
      : ''
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">${ticks}${lines}${labels}</svg>`;
}

/**
 * Horizontal bars split into stacked segments, with a label column.
 *
 * For a breakdown-within-a-breakdown: categories down the side, each bar
 * divided by a second dimension. Stacking is correct here — unlike the seasonal
 * chart, the segments are parts of one whole, so the bar length is a real
 * total.
 */
export function stackedHBarSvg(
  categories: string[],
  series: Series[],
  width = 900,
  rowH = 26
): string {
  const labelW = 230, pad = 12, valueW = 96;
  const chartW = width - labelW - pad - valueW;
  const labelMaxW = labelW - 10;
  const totals = categories.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const height = categories.length * rowH + pad * 2;

  const rows = categories.map((label, i) => {
    const y = pad + i * rowH;
    let x = labelW;
    const segments = series.map((s, si) => {
      const v = s.values[i] ?? 0;
      if (v <= 0) return '';
      const w = (v / max) * chartW;
      const rect = `<rect x="${x.toFixed(1)}" y="${y + 4}" width="${w.toFixed(1)}" height="${rowH - 12}" fill="${PALETTE[si % PALETTE.length]}"/>`;
      x += w;
      return rect;
    }).join('');
    return `<text x="0" y="${y + rowH / 2 + 4}" font-size="11" fill="${INK}">${esc(truncateToWidth(label, labelMaxW, 11))}</text>` +
      segments +
      `<text x="${(x + 8).toFixed(1)}" y="${y + rowH / 2 + 4}" font-size="10" fill="${MUTED}">${fmt(totals[i])} lb</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">${rows}</svg>`;
}

/**
 * Horizontal bars grouped, not stacked: several independent measures per row.
 *
 * The distinction matters and is not cosmetic. `stackedHBarSvg` is for parts of
 * one whole, where bar length is a real total. These series are independent
 * signals — Category Pressure's own description says so — and stacking them
 * would produce a combined length that means nothing.
 */
export function groupedHBarSvg(
  categories: string[],
  series: Series[],
  width = 900,
  groupH = 13
): string {
  const labelW = 150, pad = 12, valueW = 8;
  const chartW = width - labelW - pad - valueW;
  const labelMaxW = labelW - 10;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const rowH = groupH * series.length + 8;
  const height = categories.length * rowH + pad * 2;

  const rows = categories.map((label, i) => {
    const top = pad + i * rowH;
    const bars = series.map((s, si) => {
      const v = s.values[i] ?? 0;
      const w = Math.max(0, (v / max) * chartW);
      const y = top + si * groupH;
      return `<rect x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="${groupH - 3}" rx="1.5" fill="${PALETTE[si % PALETTE.length]}"/>`;
    }).join('');
    return `<text x="0" y="${top + (rowH - 8) / 2 + 4}" font-size="11" fill="${INK}">${esc(truncateToWidth(label, labelMaxW, 11))}</text>${bars}`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">${rows}</svg>`;
}

/**
 * A print-ready table.
 *
 * HTML, not SVG: a table is text in a grid, and Chromium already lays that out
 * with real typography, hyphenation, and page breaks. Drawing it as SVG would
 * mean reimplementing text measurement to no benefit.
 *
 * `break-inside: avoid` on rows keeps a row off a page boundary, and the header
 * repeats on each page via `thead` — the two things that make a long table
 * usable on paper and that a screenshot of a web table never gives you.
 */
export function tableHtml(
  headers: string[],
  rows: string[][],
  aligns: Array<'left' | 'right'> = []
): string {
  const th = headers
    .map(
      (h, i) =>
        `<th style="text-align:${aligns[i] ?? 'left'};border-bottom:1.5px solid ${INK};padding:5px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:${MUTED};">${esc(h)}</th>`
    )
    .join('');
  const tr = rows
    .map(
      row =>
        `<tr style="break-inside:avoid;page-break-inside:avoid;">${row
          .map(
            (cell, i) =>
              `<td style="text-align:${aligns[i] ?? 'left'};border-bottom:1px solid ${GRID};padding:5px 8px;font-size:11px;color:${INK};">${esc(cell)}</td>`
          )
          .join('')}</tr>`
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;font-family:Helvetica, Arial, sans-serif;">
    <thead style="display:table-header-group;"><tr>${th}</tr></thead>
    <tbody>${tr}</tbody>
  </table>`;
}

/**
 * KPI tiles, as HTML rather than SVG.
 *
 * The report document is HTML on its way to Chromium, so text-only cards need
 * no SVG at all — and get real text layout, hyphenation, and selectable output
 * in the PDF instead of positioned glyphs.
 */
export function kpiGrid(tiles: { label: string; value: string }[]): string {
  const cells = tiles.map(t => `
    <div style="border:1px solid ${GRID};border-radius:6px;padding:9px 11px;">
      <div style="font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:${MUTED};">${esc(t.label)}</div>
      <div style="font-size:15px;font-weight:700;color:${INK};margin-top:3px;">${esc(t.value)}</div>
    </div>`).join('');
  return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">${cells}</div>`;
}
