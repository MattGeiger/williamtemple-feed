// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

// Normalizes the OFB Agency Pickups export (OFB Order CSV Exporter v1.2.0).
//
// This export reports the same Fresh Food Alliance donation events as the
// `AGPCKUP` rows of the Completed Orders ledger, but keyed by `Pickup
// Reference` instead of `Order #` and carrying donor identity. The two
// identifier spaces are disjoint and the source system publishes no mapping
// between them; see docs/data-management/procurement-unification-plan.md (D2).
// Nothing here attempts to join the two.
//
// Channel classification is file-level: every event in this export is a Fresh
// Food Alliance receipt because of where it came from. Reference suffixes and
// product-code prefixes are not consulted.

import { createHash } from 'crypto';
import { parse } from 'csv-parse/sync';
import {
  AcquisitionClass,
  ProcurementImportError,
  assertSafeReference,
  expectedAcquisitionClass,
  invalidRow,
  monthNames,
  parseCents,
  parseHundredths,
  parseSourceDate,
} from './parsing';

/** Fresh Alliance observations persist under their own source namespace so the
 *  two OFB exports can never collide on a reference or share a revision lineage. */
export const FRESH_ALLIANCE_SOURCE = 'ofb_pickup';
export const FRESH_ALLIANCE_IMPORT_SCHEMA_VERSION = 1;
export const FRESH_ALLIANCE_EVENT_KIND = 'fresh_alliance_receipt';
export const FRESH_ALLIANCE_CHANNEL = 'fresh_alliance';

const ERROR_CODE = 'INVALID_FRESH_ALLIANCE_CSV';

export const FRESH_ALLIANCE_HEADERS = [
  'Date',
  'Period',
  'Pickup Time',
  'Pickup ID',
  'Pickup Reference',
  'Pickup Line ID',
  'Donor Code',
  'Donor Name',
  'Product #',
  'Product Description',
  'Category',
  'Fresh Alliance Category',
  'Qty',
  'Weight',
  'Received Qty',
  'Received Weight',
  'Temperature',
  'Submitted Date/Time',
  'Donor Value Per Pound',
] as const;

export type FreshAllianceWarningCode =
  | 'PERIOD_MISMATCH'
  | 'DEPRECATED_PRODUCT_CODE'
  | 'UNKNOWN_PICKUP_TIME'
  | 'MISSING_DONOR_VALUATION'
  | 'RECEIVED_VARIANCE';

export interface FreshAllianceWarning {
  code: FreshAllianceWarningCode;
  message: string;
  deliveryDate: string;
  rowNumbers: number[];
}

export interface NormalizedFreshAllianceLine {
  sourceRowNumber: number;
  deliveryDate: string;
  sourcePeriod: string;
  sourcePickupReference: string;
  sourcePickupLineId: string;
  productCode: string;
  sourceDescription: string;
  acquisitionClass: AcquisitionClass;
  freshAllianceCategory: string;
  quantityHundredths: number;
  weightHundredths: number;
  receivedQuantityHundredths: number | null;
  receivedWeightHundredths: number | null;
  receivedMatchesRequested: boolean;
  /** Literal source rate. `0` means OFB recorded no valuation, not a zero-value
   *  donation — 29% of historical poundage arrives this way. */
  donorValuePerPoundCents: number;
  hasDonorValuation: boolean;
}

export interface NormalizedFreshAlliancePickup {
  sourcePickupReference: string;
  sourcePickupId: string;
  eventKind: typeof FRESH_ALLIANCE_EVENT_KIND;
  deliveryDate: string;
  /** `null` when the source reported the `12:00 AM` placeholder. */
  pickupTime: string | null;
  submittedAt: string;
  donorCode: string;
  donorName: string;
  snapshotHash: string;
  warningCodes: FreshAllianceWarningCode[];
  lines: NormalizedFreshAllianceLine[];
}

export interface ParsedFreshAllianceImport {
  fileHash: string;
  rowCount: number;
  rangeStart: string;
  rangeEnd: string;
  warnings: FreshAllianceWarning[];
  pickups: NormalizedFreshAlliancePickup[];
}

function headerMismatch(actual: string[]): ProcurementImportError {
  return new ProcurementImportError(
    'This file does not match the standardized OFB Agency Pickups export. Export the pickup range again and retry the import.',
    'INVALID_FRESH_ALLIANCE_HEADERS',
    400,
    { expected: FRESH_ALLIANCE_HEADERS, actual }
  );
}

function parseDigits(value: string, rowNumber: number, field: string): string {
  const digits = String(value ?? '').trim();
  if (!/^\d{1,18}$/.test(digits)) {
    invalidRow(rowNumber, field, 'Use the standardized OFB CSV exporter.', ERROR_CODE);
  }
  return digits;
}

/**
 * Converts the exporter's `h:mm AM/PM` pickup time to 24-hour `HH:MM`.
 * Returns `null` for `12:00 AM`, which Primarius emits as a missing-time
 * placeholder rather than an observed midnight collection.
 */
function parsePickupTime(value: string, rowNumber: number): string | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(value ?? '').trim());
  if (!match) {
    invalidRow(rowNumber, 'Pickup Time', 'Export the pickup range again and retry the import.', ERROR_CODE);
  }
  const hour12 = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (hour12 < 1 || hour12 > 12 || minute > 59) {
    invalidRow(rowNumber, 'Pickup Time', 'Export the pickup range again and retry the import.', ERROR_CODE);
  }
  if (hour12 === 12 && minute === 0 && meridiem === 'AM') return null;
  const hour24 = meridiem === 'AM'
    ? (hour12 === 12 ? 0 : hour12)
    : (hour12 === 12 ? 12 : hour12 + 12);
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Parses the exporter's `M/D/YYYY h:mm AM/PM` submission stamp to `YYYY-MM-DDTHH:MM`. */
function parseSubmittedAt(value: string, rowNumber: number): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i
    .exec(String(value ?? '').trim());
  if (!match) {
    invalidRow(rowNumber, 'Submitted Date/Time', 'Export the pickup range again and retry the import.', ERROR_CODE);
  }
  const [month, day, year, hour12, minute] = match.slice(1, 6).map(Number);
  const meridiem = match[6].toUpperCase();
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 || month > 12 || day < 1 ||
    hour12 < 1 || hour12 > 12 || minute > 59 ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    invalidRow(rowNumber, 'Submitted Date/Time', 'Export the pickup range again and retry the import.', ERROR_CODE);
  }
  const hour24 = meridiem === 'AM'
    ? (hour12 === 12 ? 0 : hour12)
    : (hour12 === 12 ? 12 : hour12 + 12);
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour24)}:${pad(minute)}`;
}

/** Optional numeric field: blank is a legitimate absence, not a malformed row. */
function parseOptionalHundredths(value: string, rowNumber: number, field: string): number | null {
  const text = String(value ?? '').trim();
  if (text.length === 0) return null;
  return parseHundredths(text, rowNumber, field, ERROR_CODE);
}

/**
 * Temperature is validated when present so a malformed export still fails
 * loudly, then discarded. The agency maintains separate, more detailed
 * food-safety temperature logs; these readings are not actionable in FEED.
 * See procurement-unification-plan.md (D7).
 */
function validateAndDiscardTemperature(value: string, rowNumber: number): void {
  const text = String(value ?? '').trim();
  if (text.length === 0) return;
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) {
    invalidRow(rowNumber, 'Temperature', 'Use the standardized OFB CSV exporter.', ERROR_CODE);
  }
}

function pickupSnapshotHash(
  pickup: Omit<NormalizedFreshAlliancePickup, 'snapshotHash' | 'warningCodes' | 'lines'>,
  lines: NormalizedFreshAllianceLine[]
): string {
  const canonical = lines
    .map(({ sourceRowNumber: _row, ...line }) => line)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return createHash('sha256')
    .update(JSON.stringify({ pickup, lines: canonical }))
    .digest('hex');
}

function conflict(message: string, details: unknown): ProcurementImportError {
  return new ProcurementImportError(message, 'FRESH_ALLIANCE_PICKUP_CONFLICT', 400, details);
}

export function parseFreshAllianceCsv(buffer: Buffer): ParsedFreshAllianceImport {
  if (buffer.length === 0) {
    throw new ProcurementImportError(
      'The selected CSV is empty. Export the OFB pickup range again and retry.',
      'EMPTY_FRESH_ALLIANCE_CSV'
    );
  }
  if (buffer.toString('utf8').includes('�')) {
    throw new ProcurementImportError(
      'FEED could not read this file as UTF-8. Export the OFB pickup range again and retry.',
      'INVALID_FRESH_ALLIANCE_ENCODING'
    );
  }

  let records: Record<string, string>[];
  try {
    records = parse(buffer, {
      bom: true,
      columns: (headers: string[]) => {
        if (
          headers.length !== FRESH_ALLIANCE_HEADERS.length ||
          headers.some((header, index) => header !== FRESH_ALLIANCE_HEADERS[index])
        ) {
          throw headerMismatch(headers);
        }
        return headers;
      },
      skip_empty_lines: true,
      relax_column_count: false,
      trim: false,
    });
  } catch (error) {
    if (error instanceof ProcurementImportError) throw error;
    throw new ProcurementImportError(
      'FEED could not read this CSV. Export the OFB pickup range again and retry.',
      'MALFORMED_FRESH_ALLIANCE_CSV',
      400,
      error instanceof Error ? error.message : undefined
    );
  }

  if (records.length === 0) {
    throw new ProcurementImportError(
      'The selected CSV contains no pickup lines. Choose an OFB Agency Pickups export with pickup data.',
      'EMPTY_FRESH_ALLIANCE_CSV'
    );
  }

  const warnings: FreshAllianceWarning[] = [];
  // Pickup-level facts are repeated on every line of a pickup. The first row
  // establishes them; later rows must agree or the snapshot is ambiguous.
  interface PickupHeader {
    sourcePickupId: string;
    deliveryDate: string;
    pickupTime: string | null;
    rawPickupTime: string;
    submittedAt: string;
    donorCode: string;
    donorName: string;
  }
  const headersByReference = new Map<string, PickupHeader>();
  const seenLineIds = new Map<string, number>();

  const lines: NormalizedFreshAllianceLine[] = records.map((record, index) => {
    const rowNumber = index + 2;
    const parsedDate = parseSourceDate(record.Date, rowNumber, ERROR_CODE);
    const sourcePeriod = record.Period.trim();
    const expectedPeriod = `${parsedDate.month}-${monthNames[parsedDate.month]}`;
    if (sourcePeriod !== expectedPeriod) {
      warnings.push({
        code: 'PERIOD_MISMATCH',
        message: `Row ${rowNumber} uses period ${sourcePeriod}; the pickup date belongs to ${expectedPeriod}.`,
        deliveryDate: parsedDate.iso,
        rowNumbers: [rowNumber],
      });
    }

    const sourcePickupReference = assertSafeReference(
      record['Pickup Reference'], rowNumber, 'Pickup Reference', ERROR_CODE
    );
    const sourcePickupId = parseDigits(record['Pickup ID'], rowNumber, 'Pickup ID');
    const sourcePickupLineId = parseDigits(record['Pickup Line ID'], rowNumber, 'Pickup Line ID');

    const priorRow = seenLineIds.get(sourcePickupLineId);
    if (priorRow !== undefined) {
      throw conflict(
        `Pickup line ${sourcePickupLineId} appears on rows ${priorRow} and ${rowNumber}. Export the pickup range again and retry.`,
        { sourcePickupLineId, rowNumbers: [priorRow, rowNumber] }
      );
    }
    seenLineIds.set(sourcePickupLineId, rowNumber);

    const rawPickupTime = record['Pickup Time'].trim();
    const pickupTime = parsePickupTime(rawPickupTime, rowNumber);
    const submittedAt = parseSubmittedAt(record['Submitted Date/Time'], rowNumber);
    const donorCode = assertSafeReference(record['Donor Code'], rowNumber, 'Donor Code', ERROR_CODE);
    const donorName = record['Donor Name'].trim();
    if (!donorName || donorName.length > 200) {
      invalidRow(rowNumber, 'Donor Name', 'Export the pickup range again and retry the import.', ERROR_CODE);
    }

    const existing = headersByReference.get(sourcePickupReference);
    if (!existing) {
      headersByReference.set(sourcePickupReference, {
        sourcePickupId, deliveryDate: parsedDate.iso, pickupTime, rawPickupTime,
        submittedAt, donorCode, donorName,
      });
      if (pickupTime === null) {
        warnings.push({
          code: 'UNKNOWN_PICKUP_TIME',
          message: `Pickup ${sourcePickupReference} reports ${rawPickupTime}, which OFB uses when no pickup time was recorded. FEED retained the pickup date without a time.`,
          deliveryDate: parsedDate.iso,
          rowNumbers: [rowNumber],
        });
      }
    } else {
      const mismatch = (
        existing.sourcePickupId !== sourcePickupId ? 'Pickup ID' :
        existing.deliveryDate !== parsedDate.iso ? 'Date' :
        existing.rawPickupTime !== rawPickupTime ? 'Pickup Time' :
        existing.submittedAt !== submittedAt ? 'Submitted Date/Time' :
        existing.donorCode !== donorCode ? 'Donor Code' :
        existing.donorName !== donorName ? 'Donor Name' : null
      );
      if (mismatch) {
        throw conflict(
          `Pickup ${sourcePickupReference} reports more than one ${mismatch} in this export. Export the pickup range again and retry.`,
          { sourcePickupReference, field: mismatch, rowNumber }
        );
      }
    }

    const productCode = record['Product #'].trim();
    if (!/^\d{4,6}$/.test(productCode)) {
      invalidRow(rowNumber, 'Product #', 'Use the standardized OFB CSV exporter so the four-to-six-digit identifier is preserved.', ERROR_CODE);
    }
    const sourceDescription = record['Product Description'].trim();
    if (!sourceDescription) {
      invalidRow(rowNumber, 'Product Description', 'Export the pickup range again and retry.', ERROR_CODE);
    }
    if (/\b(?:DO NOT USE|DON'T USE)\b/i.test(sourceDescription)) {
      warnings.push({
        code: 'DEPRECATED_PRODUCT_CODE',
        message: `Row ${rowNumber} uses supplier product code ${productCode}, which the source description marks as deprecated. FEED retained the historical observation.`,
        deliveryDate: parsedDate.iso,
        rowNumbers: [rowNumber],
      });
    }

    const acquisitionClass = record.Category.trim() as AcquisitionClass;
    const expectedClass = expectedAcquisitionClass(productCode);
    if (!expectedClass || acquisitionClass !== expectedClass) {
      invalidRow(rowNumber, 'Category', 'The acquisition class does not match the OFB product-number family.', ERROR_CODE);
    }

    const quantityHundredths = parseHundredths(record.Qty, rowNumber, 'Qty', ERROR_CODE);
    const weightHundredths = parseHundredths(record.Weight, rowNumber, 'Weight', ERROR_CODE);
    const receivedQuantityHundredths = parseOptionalHundredths(record['Received Qty'], rowNumber, 'Received Qty');
    const receivedWeightHundredths = parseOptionalHundredths(record['Received Weight'], rowNumber, 'Received Weight');
    const receivedMatchesRequested =
      receivedQuantityHundredths === quantityHundredths &&
      receivedWeightHundredths === weightHundredths;
    if (!receivedMatchesRequested) {
      warnings.push({
        code: 'RECEIVED_VARIANCE',
        message: `Row ${rowNumber} reports received values that differ from the requested quantity or weight. FEED retained both.`,
        deliveryDate: parsedDate.iso,
        rowNumbers: [rowNumber],
      });
    }

    validateAndDiscardTemperature(record.Temperature, rowNumber);

    const donorValuePerPoundCents = parseCents(
      record['Donor Value Per Pound'], rowNumber, 'Donor Value Per Pound', ERROR_CODE
    );
    const hasDonorValuation = donorValuePerPoundCents > 0;
    if (!hasDonorValuation) {
      warnings.push({
        code: 'MISSING_DONOR_VALUATION',
        message: `Row ${rowNumber} records no donor value per pound. FEED retained the weight and excluded the row from in-kind value.`,
        deliveryDate: parsedDate.iso,
        rowNumbers: [rowNumber],
      });
    }

    return {
      sourceRowNumber: rowNumber,
      deliveryDate: parsedDate.iso,
      sourcePeriod,
      sourcePickupReference,
      sourcePickupLineId,
      productCode,
      sourceDescription,
      acquisitionClass,
      freshAllianceCategory: record['Fresh Alliance Category'].trim(),
      quantityHundredths,
      weightHundredths,
      receivedQuantityHundredths,
      receivedWeightHundredths,
      receivedMatchesRequested,
      donorValuePerPoundCents,
      hasDonorValuation,
    };
  });

  const byPickup = new Map<string, NormalizedFreshAllianceLine[]>();
  for (const line of lines) {
    const pickupLines = byPickup.get(line.sourcePickupReference) ?? [];
    pickupLines.push(line);
    byPickup.set(line.sourcePickupReference, pickupLines);
  }

  const pickups = [...byPickup.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sourcePickupReference, pickupLines]): NormalizedFreshAlliancePickup => {
      const header = headersByReference.get(sourcePickupReference)!;
      const rowNumbers = new Set(pickupLines.map((line) => line.sourceRowNumber));
      const warningCodes = [...new Set(
        warnings
          .filter((warning) => warning.rowNumbers.some((rowNumber) => rowNumbers.has(rowNumber)))
          .map((warning) => warning.code)
      )];
      const identity = {
        sourcePickupReference,
        sourcePickupId: header.sourcePickupId,
        eventKind: FRESH_ALLIANCE_EVENT_KIND,
        deliveryDate: header.deliveryDate,
        pickupTime: header.pickupTime,
        submittedAt: header.submittedAt,
        donorCode: header.donorCode,
        donorName: header.donorName,
      } as const;
      return {
        ...identity,
        snapshotHash: pickupSnapshotHash(identity, pickupLines),
        warningCodes,
        lines: pickupLines,
      };
    });

  return {
    fileHash: createHash('sha256').update(buffer).digest('hex'),
    rowCount: lines.length,
    rangeStart: pickups.reduce(
      (earliest, pickup) => pickup.deliveryDate < earliest ? pickup.deliveryDate : earliest,
      pickups[0].deliveryDate
    ),
    rangeEnd: pickups.reduce(
      (latest, pickup) => pickup.deliveryDate > latest ? pickup.deliveryDate : latest,
      pickups[0].deliveryDate
    ),
    warnings,
    pickups,
  };
}
