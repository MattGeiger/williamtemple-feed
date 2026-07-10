// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Report card registry (Reports initiative §2–3). Every selectable block
 * has ONE stable id shared by the frontend, this registry, templates, the
 * PDF renderer, the CSV serializer, and runtime validation. Never rename an
 * id — templates persist them.
 */

export type ReportSource = 'reports' | 'dashboard';
export type ReportBlockType = 'kpi' | 'chart' | 'table';

export interface ReportCardDefinition {
  id: string;
  source: ReportSource;
  /** Reports tab (or dashboard section) the card lives on. */
  tab: string;
  type: ReportBlockType;
  title: string;
}

export const MAX_REPORT_SELECTION = 8;

export const REPORT_CARDS: ReportCardDefinition[] = [
  // Inventory Outlook
  { id: 'inventory-outlook-kpi', source: 'reports', tab: 'inventory-outlook', type: 'kpi', title: 'Stock, Coverage & Risk' },
  { id: 'inventory-outlook-cover-bands', source: 'reports', tab: 'inventory-outlook', type: 'chart', title: 'Days-of-Cover Bands' },
  { id: 'inventory-outlook-stockout-timeline', source: 'reports', tab: 'inventory-outlook', type: 'chart', title: 'Projected Stockout Timeline' },
  { id: 'inventory-outlook-item-table', source: 'reports', tab: 'inventory-outlook', type: 'table', title: 'Item Outlook' },
  // Unit Prices
  { id: 'unit-prices-kpi', source: 'reports', tab: 'unit-prices', type: 'kpi', title: 'Price Coverage & Changes' },
  { id: 'unit-prices-cost-trends', source: 'reports', tab: 'unit-prices', type: 'chart', title: 'Unit Cost Trends' },
  { id: 'unit-prices-cost-impact', source: 'reports', tab: 'unit-prices', type: 'chart', title: 'Paid Replacement Cost Impact' },
  { id: 'unit-prices-history-table', source: 'reports', tab: 'unit-prices', type: 'table', title: 'Price History' },
  // Scarcity & Availability
  { id: 'scarcity-kpi', source: 'reports', tab: 'scarcity', type: 'kpi', title: 'Availability, Stockouts & Restock' },
  { id: 'scarcity-availability-over-time', source: 'reports', tab: 'scarcity', type: 'chart', title: 'Availability Over Time' },
  { id: 'scarcity-stockout-frequency', source: 'reports', tab: 'scarcity', type: 'chart', title: 'Stockout Frequency' },
  { id: 'scarcity-episodes-table', source: 'reports', tab: 'scarcity', type: 'table', title: 'Stockout Episodes' },
  // Replenishment Planning
  { id: 'replenishment-kpi', source: 'reports', tab: 'replenishment', type: 'kpi', title: 'Urgency, Spend & Missing Inputs' },
  { id: 'replenishment-reorder-priority', source: 'reports', tab: 'replenishment', type: 'chart', title: 'Reorder Priority' },
  { id: 'replenishment-spend-by-category', source: 'reports', tab: 'replenishment', type: 'chart', title: 'Projected Spend by Category' },
  { id: 'replenishment-plan-table', source: 'reports', tab: 'replenishment', type: 'table', title: 'Replenishment Plan' },
  // Data Coverage
  { id: 'data-coverage-kpi', source: 'reports', tab: 'data-coverage', type: 'kpi', title: 'Recording Coverage' },
  { id: 'data-coverage-burn-readiness', source: 'reports', tab: 'data-coverage', type: 'chart', title: 'Burn-Rate Readiness' },
  { id: 'data-coverage-recording-activity', source: 'reports', tab: 'data-coverage', type: 'chart', title: 'Recording Activity' },
  { id: 'data-coverage-gaps-table', source: 'reports', tab: 'data-coverage', type: 'table', title: 'Item-Level Data Gaps' },
];

const cardsById = new Map(REPORT_CARDS.map((card) => [card.id, card]));

export function getReportCard(id: string): ReportCardDefinition | undefined {
  return cardsById.get(id);
}

export function isValidCardSelection(
  source: ReportSource,
  cardIds: string[]
): { ok: true } | { ok: false; message: string } {
  if (cardIds.length === 0) {
    return { ok: false, message: 'Select at least one report block.' };
  }
  if (cardIds.length > MAX_REPORT_SELECTION) {
    return {
      ok: false,
      message: `Select at most ${MAX_REPORT_SELECTION} report blocks.`,
    };
  }
  if (new Set(cardIds).size !== cardIds.length) {
    return { ok: false, message: 'Report blocks must not repeat.' };
  }
  for (const id of cardIds) {
    const card = cardsById.get(id);
    if (!card) {
      return { ok: false, message: `Unknown report block: ${id}` };
    }
    if (card.source !== source) {
      // Templates are source-bound; Dashboard and Reports cards never mix.
      return {
        ok: false,
        message: `Report block ${id} does not belong to the ${source} source.`,
      };
    }
  }
  return { ok: true };
}
