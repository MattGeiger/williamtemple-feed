// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { BaseApiService } from '../base';

/**
 * Report generation for the Analytics lenses.
 *
 * Separate from `ReportsService`, which speaks to the operational workspace and
 * carries the dormant registry's vocabulary (`horizonDays`, `cardOptions`,
 * `source`). None of that applies here: an Analytics report is a selection of
 * cards plus the filters the page is already showing.
 */

export interface AnalyticsReportRequest {
  /** Ordered — selection order is the report's order. */
  cardIds: string[];
  title: string;
  includePdf: boolean;
  includeCsv: boolean;
  csvGrain: 'condensed' | 'raw';
  preset: string;
  startDate?: string;
  endDate?: string;
  channel?: 'ofb_warehouse' | 'fresh_alliance';
  acquisitionClass?: 'DONATED' | 'PURCH-DON' | 'GOVERNMENT' | 'PURCHASED';
}

export interface AnalyticsReportCard {
  id: string;
  title: string;
  lens: 'operations' | 'procurement';
  kind: 'chart' | 'kpi';
}

export class AnalyticsReportsService extends BaseApiService {
  constructor() {
    super('/api/analytics-reports');
  }

  /** Which cards the server can render. The client offers only these. */
  async getCards(): Promise<AnalyticsReportCard[]> {
    const response = await this.get<{ cards: AnalyticsReportCard[] }>('/cards');
    return response.cards;
  }

  /** Generates the ZIP (PDF + numbered per-card CSVs + manifest) and downloads it. */
  async downloadReport(request: AnalyticsReportRequest): Promise<void> {
    const { blob, filename } = await this.requestBinary('/export', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename ?? 'feed-report.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export const analyticsReportsService = new AnalyticsReportsService();
