// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

// Routes an uploaded OFB CSV to the parser that matches it.
//
// Staff export two different reports from the OFB portal, and asking them to
// declare which one they are holding is a decision they can get wrong — the
// files look alike, and a wrong choice would surface as a confusing header
// error mid-task. The header row identifies the export unambiguously, so FEED
// reads it instead of asking.
//
// Detection is exact-match only. It never guesses at a near-miss, because a
// partially recognized file is exactly the case where a clear failure is worth
// more than a lenient import.

import { parse } from 'csv-parse/sync';
import {
  FRESH_ALLIANCE_HEADERS,
  FreshAllianceImportResult,
  importFreshAllianceCsv,
} from './fresh-alliance';
import { OFB_HEADERS, ProcurementImportResult, importOfbCsv } from './index';
import { ProcurementImportError } from './parsing';
import { UNIFIED_HEADERS, UnifiedImportResult, importUnifiedOfbCsv } from './unified';

export type OfbExportKind = 'completed_orders' | 'agency_pickups' | 'unified';

export type DetectedImportResult =
  | ({ exportKind: 'completed_orders' } & ProcurementImportResult)
  | ({ exportKind: 'agency_pickups' } & FreshAllianceImportResult)
  | ({ exportKind: 'unified' } & UnifiedImportResult);

function readHeaderRow(buffer: Buffer): string[] {
  if (buffer.length === 0) {
    throw new ProcurementImportError(
      'The selected CSV is empty. Export the range again from the OFB portal and retry.',
      'EMPTY_OFB_CSV'
    );
  }
  try {
    const rows = parse(buffer, {
      bom: true,
      to_line: 1,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: false,
    }) as string[][];
    return rows[0] ?? [];
  } catch {
    throw new ProcurementImportError(
      'FEED could not read this CSV. Export the range again from the OFB portal and retry.',
      'MALFORMED_OFB_CSV'
    );
  }
}

function matches(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length
    && actual.every((header, index) => header === expected[index]);
}

export function detectOfbExportKind(buffer: Buffer): OfbExportKind {
  const headers = readHeaderRow(buffer);
  if (matches(headers, UNIFIED_HEADERS)) return 'unified';
  if (matches(headers, OFB_HEADERS)) return 'completed_orders';
  if (matches(headers, FRESH_ALLIANCE_HEADERS)) return 'agency_pickups';
  throw new ProcurementImportError(
    'This file does not match a standardized OFB export. Choose a unified export, a Completed Orders export, or an Agency Pickups export from the OFB exporter and retry.',
    'UNRECOGNIZED_OFB_EXPORT',
    400,
    {
      accepted: [
        { exportKind: 'unified', headers: UNIFIED_HEADERS },
        { exportKind: 'completed_orders', headers: OFB_HEADERS },
        { exportKind: 'agency_pickups', headers: FRESH_ALLIANCE_HEADERS },
      ],
      actual: headers,
    }
  );
}

export async function importOfbExport(
  buffer: Buffer,
  importedBy?: string
): Promise<DetectedImportResult> {
  const exportKind = detectOfbExportKind(buffer);
  if (exportKind === 'unified') {
    return { exportKind, ...(await importUnifiedOfbCsv(buffer, importedBy)) };
  }
  return exportKind === 'completed_orders'
    ? { exportKind, ...(await importOfbCsv(buffer, importedBy)) }
    : { exportKind, ...(await importFreshAllianceCsv(buffer, importedBy)) };
}
