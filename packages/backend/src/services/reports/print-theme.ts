// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-local print colours used by the server-authored SVG primitives.
 * AsyncLocalStorage keeps simultaneous report requests isolated while retaining
 * the deliberately small card renderer API (`print(data)`).
 */
export interface ReportPrintTheme {
  palette: string[];
  ink: string;
  muted: string;
  grid: string;
  background: string;
  primary: string;
  primarySoft: string;
}

export const DEFAULT_REPORT_PRINT_THEME: ReportPrintTheme = {
  palette: ['#2964A3', '#3090A8', '#78C0C0', '#F0D848', '#B08CC0', '#E08050', '#8FB339'],
  ink: '#231F20',
  muted: '#6B7684',
  grid: '#E3E8EE',
  background: '#FFFFFF',
  primary: '#2964A3',
  primarySoft: '#EEF3F8',
};

const reportPrintTheme = new AsyncLocalStorage<ReportPrintTheme>();

export const currentReportPrintTheme = (): ReportPrintTheme =>
  reportPrintTheme.getStore() ?? DEFAULT_REPORT_PRINT_THEME;

export const withReportPrintTheme = <T>(theme: ReportPrintTheme, render: () => T): T =>
  reportPrintTheme.run(theme, render);
