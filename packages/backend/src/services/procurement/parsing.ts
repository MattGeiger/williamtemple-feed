// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

// Primitives shared by every OFB export parser. Both the Completed Orders
// ledger and the Agency Pickups export are produced by the same exporter and
// therefore share date, numeric, and product-family contracts. Keeping these in
// one place prevents the two parsers from drifting apart — a drift whose
// failure mode is silently wrong normalization rather than a loud error.

export const ACQUISITION_CLASSES = ['DONATED', 'PURCH-DON', 'GOVERNMENT', 'PURCHASED'] as const;
export type AcquisitionClass = typeof ACQUISITION_CLASSES[number];

export class ProcurementImportError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, code: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'ProcurementImportError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const monthNames = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const acquisitionClassByPrefix: Record<string, AcquisitionClass> = {
  '0': 'DONATED',
  '1': 'DONATED',
  '2': 'DONATED',
  '3': 'DONATED',
  '6': 'PURCH-DON',
  '7': 'PURCH-DON',
  '8': 'GOVERNMENT',
  '9': 'PURCHASED',
};

// `4xxxx` is the supplier's Fresh Alliance catalog family. It constrains the
// acquisition class only; it never classifies an event's procurement channel.
export function expectedAcquisitionClass(productCode: string): AcquisitionClass | null {
  if (/^4\d{4}$/.test(productCode)) return 'DONATED';
  return acquisitionClassByPrefix[productCode[0]] ?? null;
}

export function invalidRow(
  rowNumber: number,
  field: string,
  instruction: string,
  code = 'INVALID_OFB_CSV'
): never {
  throw new ProcurementImportError(
    `Row ${rowNumber} has an invalid ${field}. ${instruction}`,
    code,
    400,
    { rowNumber, field }
  );
}

/** Parses the exporter's `M/D/YY` receiving date. */
export function parseSourceDate(
  value: string,
  rowNumber: number,
  code = 'INVALID_OFB_CSV'
): { iso: string; month: number } {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) invalidRow(rowNumber, 'Date', 'Export the range again and retry the import.', code);
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = 2000 + Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 || month > 12 || day < 1 ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    invalidRow(rowNumber, 'Date', 'Export the range again and retry the import.', code);
  }
  return { iso: candidate.toISOString().slice(0, 10), month };
}

/** Quantities and weights are integer hundredths to match the exporter contract. */
export function parseHundredths(
  value: string,
  rowNumber: number,
  field: string,
  code = 'INVALID_OFB_CSV'
): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value ?? '').trim());
  if (!match) invalidRow(rowNumber, field, 'Use the standardized OFB CSV exporter.', code);
  const amount = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) {
    invalidRow(rowNumber, field, 'The value is too large to import safely.', code);
  }
  return amount;
}

/** Monetary values are integer cents. */
export function parseCents(
  value: string,
  rowNumber: number,
  field: string,
  code = 'INVALID_OFB_CSV'
): number {
  const match = /^\$?(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) invalidRow(rowNumber, field, 'Use the standardized OFB CSV exporter.', code);
  const amount = Number(match[1].replace(/,/g, '')) * 100 + Number(match[2]);
  if (!Number.isSafeInteger(amount)) {
    invalidRow(rowNumber, field, 'The value is too large to import safely.', code);
  }
  return amount;
}

/**
 * Source references may contain an alphabetic suffix, so they are preserved as
 * bounded strings rather than parsed as numbers.
 */
export function assertSafeReference(
  value: string,
  rowNumber: number,
  field: string,
  code = 'INVALID_OFB_CSV'
): string {
  const reference = String(value ?? '').trim();
  if (
    reference.length === 0 ||
    reference.length > 64 ||
    /[\u0000-\u001F\u007F]/.test(reference)
  ) {
    invalidRow(rowNumber, field, 'Export the range again and retry the import.', code);
  }
  return reference;
}
