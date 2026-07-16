// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

export type AnalyticsRangePreset =
  | 'last-7-days'
  | 'last-30-days'
  | 'last-90-days'
  | 'ytd'
  | 'all'
  | 'custom';

export interface AnalyticsDateRange {
  preset: AnalyticsRangePreset;
  startDate?: string;
  endDate?: string;
}

export const DEFAULT_ANALYTICS_RANGE: AnalyticsDateRange = {
  preset: 'last-90-days',
};
