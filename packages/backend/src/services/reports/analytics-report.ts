// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import JSZip from 'jszip';

import { renderHtmlToPdf } from '../pdf/chromium';
import { cardCsv, getAnalyticsCard, type CardData, type CsvGrain } from './analytics-cards';

/**
 * Assembles a selection of Analytics cards into one downloadable archive.
 *
 * This is the ZEV flow's server half: the client sends the card ids it
 * selected, in the order it selected them, and gets back a single ZIP. There is
 * deliberately no per-card export endpoint — the rejected workflow put a button
 * on every card and left people unsure how to produce a report at all.
 *
 * Card order is the client's order. Selection order is the report's order, and
 * the numbered filenames preserve it outside the PDF too.
 */

const MAX_CARDS = 8;

export interface AnalyticsReportRequest {
  cardIds: string[];
  title: string;
  includePdf: boolean;
  includeCsv: boolean;
  csvGrain: CsvGrain;
}

export interface AnalyticsReportResult {
  zip: Buffer;
  filename: string;
  /** Cards that were requested but are not in the registry. */
  unknownCardIds: string[];
}

const slug = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The printed document. Cards keep the order they were selected in. */
const documentHtml = (
  title: string,
  analytics: { range: { startDate: string; endDate: string; preset: string; timeZone: string }; filters: { channel: string | null; acquisitionClass: string | null }; dataAsOf: string },
  cards: { data: CardData; svg: string }[]
): string => `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: letter landscape; margin: 0.5in; }
  body { font-family: Helvetica, Arial, sans-serif; color:#231F20; margin:0; }
  header { border-bottom:3px solid #2964A3; padding-bottom:10px; margin-bottom:18px; }
  h1 { font-size:19px; margin:0 0 3px 0; }
  .meta { font-size:11px; color:#6B7684; line-height:1.5; }
  .card { break-inside: avoid; page-break-inside: avoid; margin-bottom:22px;
          border:1px solid #E3E8EE; border-radius:8px; padding:14px 16px; }
  .card h2 { font-size:13px; margin:0 0 6px 0; color:#2964A3;
             text-transform:uppercase; letter-spacing:.06em; }
  .note { font-size:10px; color:#8A5A00; background:#FFF8E1; border:1px solid #FFE9A8;
          border-radius:4px; padding:5px 8px; margin:0 0 10px 0; }
  svg { max-width:100%; height:auto; display:block; }
</style></head><body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      Range ${analytics.range.startDate} – ${analytics.range.endDate} (${analytics.range.preset}) · ${analytics.range.timeZone}<br>
      Filters: channel ${analytics.filters.channel ?? 'all'} · acquisition class ${analytics.filters.acquisitionClass ?? 'all'}<br>
      Data as of ${analytics.dataAsOf}
    </div>
  </header>
  ${cards
    .map(
      c => `<section class="card"><h2>${escapeHtml(c.data.title)}</h2>${
        c.data.note ? `<p class="note">${escapeHtml(c.data.note)}</p>` : ''
      }${c.svg}</section>`
    )
    .join('')}
</body></html>`;

export async function buildAnalyticsReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analytics: any,
  request: AnalyticsReportRequest
): Promise<AnalyticsReportResult> {
  const ids = request.cardIds.slice(0, MAX_CARDS);
  const unknownCardIds: string[] = [];
  const resolved: { data: CardData; svg: string; id: string }[] = [];

  for (const id of ids) {
    const card = getAnalyticsCard(id);
    // A stale id surfaces rather than being silently dropped — a saved template
    // that quietly produces a smaller report is worse than one that says why.
    if (!card) {
      unknownCardIds.push(id);
      continue;
    }
    const data = card.data(analytics);
    resolved.push({ id, data, svg: card.print(data) });
  }

  const zip = new JSZip();

  if (request.includeCsv) {
    resolved.forEach((card, index) => {
      const position = String(index + 1).padStart(2, '0');
      zip.file(`${position}-${slug(card.data.title)}.csv`, cardCsv(card.data, request.csvGrain));
    });
  }

  if (request.includePdf) {
    const html = documentHtml(request.title, analytics, resolved);
    const pdf = await renderHtmlToPdf(html, {
      width: '11in',
      height: '8.5in',
      margin: { top: '0in', right: '0in', bottom: '0in', left: '0in' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-size:8px;font-family:Arial;color:#555;text-align:center;padding-bottom:8px;">
        ${escapeHtml(request.title)} — Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
    });
    zip.file(`${slug(request.title)}.pdf`, pdf);
  }

  // Provenance travels with the data. A CSV separated from its range and
  // filters is exactly the misread this is meant to prevent.
  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        title: request.title,
        generatedAt: new Date().toISOString(),
        dataAsOf: analytics.dataAsOf,
        range: analytics.range,
        filters: analytics.filters,
        cards: resolved.map(c => ({ id: c.id, title: c.data.title, grain: c.data.grain ?? null, note: c.data.note })),
        csvGrain: request.csvGrain,
        unknownCardIds,
      },
      null,
      2
    )
  );

  return {
    zip: await zip.generateAsync({ type: 'nodebuffer' }),
    filename: `${slug(request.title)}-${analytics.range.startDate}-to-${analytics.range.endDate}.zip`,
    unknownCardIds,
  };
}
