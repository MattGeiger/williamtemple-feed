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

const PALETTE = ['#2964A3', '#3090A8', '#78C0C0', '#F0D848', '#B08CC0', '#E08050', '#8FB339'];
const INK = '#231F20';
const MUTED = '#6B7684';
const GRID = '#E3E8EE';

const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

// ---------- shared primitives ----------

/** Horizontal bars with a label column. Used for any "mix" breakdown. */
export function hBarSvg(rows: { label: string; value: number }[], width = 900, rowH = 30): string {
  const labelW = 220, pad = 12, chartW = width - labelW - pad - 90;
  const max = Math.max(1, ...rows.map(r => r.value));
  const height = rows.length * rowH + pad * 2;
  const bars = rows.map((r, i) => {
    const y = pad + i * rowH;
    const w = Math.max(1, (r.value / max) * chartW);
    return `<text x="0" y="${y + rowH / 2 + 4}" font-size="12" fill="${INK}">${esc(r.label)}</text>` +
      `<rect x="${labelW}" y="${y + 5}" width="${w}" height="${rowH - 14}" rx="2" fill="${PALETTE[i % PALETTE.length]}"/>` +
      `<text x="${labelW + w + 8}" y="${y + rowH / 2 + 4}" font-size="11" fill="${MUTED}">${fmt(r.value)} lb</text>`;
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
