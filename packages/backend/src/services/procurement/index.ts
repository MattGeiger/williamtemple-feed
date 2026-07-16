// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import prisma from '../../db';
import {
  AnalyticsRangePreset,
  isValidLocalDate,
  localDateOf,
  resolveRange,
} from '../inventory-analytics/timezone';
import { getOperatingHoursSettings } from '../operating-hours';

export const OFB_SOURCE = 'ofb';
export const OFB_IMPORT_SCHEMA_VERSION = 2;
export const PROCUREMENT_STALE_AFTER_DAYS = 30;

export const PROCUREMENT_CHANNELS = ['ofb_warehouse', 'fresh_alliance'] as const;
export const ACQUISITION_CLASSES = ['DONATED', 'PURCH-DON', 'GOVERNMENT', 'PURCHASED'] as const;
export type ProcurementChannel = typeof PROCUREMENT_CHANNELS[number];
export type AcquisitionClass = typeof ACQUISITION_CLASSES[number];

export const OFB_HEADERS = [
  'Date',
  'Period',
  'Order #',
  'Product #',
  'Product Description',
  'Category',
  'Qty',
  'Weight',
  'Unit Price',
  'Price Total',
  'Service Fee',
  'Grants Applied',
] as const;

export type ProcurementWarningCode =
  | 'PRICE_TOTAL_MISMATCH'
  | 'PERIOD_MISMATCH';

export interface ProcurementWarning {
  code: ProcurementWarningCode;
  message: string;
  deliveryDate: string;
  rowNumbers: number[];
}

export interface NormalizedOfbLine {
  sourceRowNumber: number;
  deliveryDate: string;
  sourcePeriod: string;
  sourceOrderReference: string;
  productCode: string;
  sourceDescription: string;
  acquisitionClass: AcquisitionClass;
  procurementChannel: ProcurementChannel;
  quantityHundredths: number;
  weightHundredths: number;
  unitPriceCents: number;
  sourcePriceTotalCents: number;
  calculatedPriceTotalCents: number;
  priceTotalMatches: boolean;
  serviceFeeCents: number;
  grantsAppliedCents: number;
}

export interface NormalizedOfbOrder {
  sourceOrderReference: string;
  deliveryDate: string;
  snapshotHash: string;
  warningCodes: ProcurementWarningCode[];
  lines: NormalizedOfbLine[];
}

export interface ParsedOfbImport {
  fileHash: string;
  rowCount: number;
  rangeStart: string;
  rangeEnd: string;
  warnings: ProcurementWarning[];
  orders: NormalizedOfbOrder[];
}

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

function expectedAcquisitionClass(productCode: string): AcquisitionClass | null {
  if (/^4\d{4}$/.test(productCode)) return 'DONATED';
  return acquisitionClassByPrefix[productCode[0]] ?? null;
}

function procurementChannel(productCode: string): ProcurementChannel {
  return /^4\d{4}$/.test(productCode) ? 'fresh_alliance' : 'ofb_warehouse';
}

const monthNames = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function invalidRow(rowNumber: number, field: string, instruction: string): never {
  throw new ProcurementImportError(
    `Row ${rowNumber} has an invalid ${field}. ${instruction}`,
    'INVALID_OFB_CSV',
    400,
    { rowNumber, field }
  );
}

function parseSourceDate(value: string, rowNumber: number): { iso: string; month: number } {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(value.trim());
  if (!match) invalidRow(rowNumber, 'Date', 'Export the order again and retry the import.');
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
    invalidRow(rowNumber, 'Date', 'Export the order again and retry the import.');
  }
  return { iso: candidate.toISOString().slice(0, 10), month };
}

function parseHundredths(value: string, rowNumber: number, field: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) invalidRow(rowNumber, field, 'Use the standardized OFB CSV exporter.');
  const amount = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) {
    invalidRow(rowNumber, field, 'The value is too large to import safely.');
  }
  return amount;
}

function parseCents(value: string, rowNumber: number, field: string): number {
  const match = /^\$?(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/.exec(value.trim());
  if (!match) invalidRow(rowNumber, field, 'Use the standardized OFB CSV exporter.');
  const amount = Number(match[1].replace(/,/g, '')) * 100 + Number(match[2]);
  if (!Number.isSafeInteger(amount)) {
    invalidRow(rowNumber, field, 'The value is too large to import safely.');
  }
  return amount;
}

function headerMismatch(actual: string[]): ProcurementImportError {
  return new ProcurementImportError(
    'This file does not match the standardized OFB export. Export the order again and retry the import.',
    'INVALID_OFB_HEADERS',
    400,
    { expected: OFB_HEADERS, actual }
  );
}

function orderSnapshotHash(lines: NormalizedOfbLine[]): string {
  const canonical = lines
    .map(({ sourceRowNumber: _row, ...line }) => line)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function parseOfbCsv(buffer: Buffer): ParsedOfbImport {
  if (buffer.length === 0) {
    throw new ProcurementImportError(
      'The selected CSV is empty. Export the OFB order again and retry.',
      'EMPTY_OFB_CSV'
    );
  }
  if (buffer.toString('utf8').includes('\uFFFD')) {
    throw new ProcurementImportError(
      'FEED could not read this file as UTF-8. Export the OFB order again and retry.',
      'INVALID_OFB_ENCODING'
    );
  }

  let records: Record<string, string>[];
  try {
    records = parse(buffer, {
      bom: true,
      columns: (headers: string[]) => {
        if (
          headers.length !== OFB_HEADERS.length ||
          headers.some((header, index) => header !== OFB_HEADERS[index])
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
      'FEED could not read this CSV. Export the OFB order again and retry.',
      'MALFORMED_OFB_CSV',
      400,
      error instanceof Error ? error.message : undefined
    );
  }

  if (records.length === 0) {
    throw new ProcurementImportError(
      'The selected CSV contains no order lines. Choose an OFB export with order data.',
      'EMPTY_OFB_CSV'
    );
  }

  const warnings: ProcurementWarning[] = [];
  const lines: NormalizedOfbLine[] = records.map((record, index) => {
    const rowNumber = index + 2;
    const parsedDate = parseSourceDate(record.Date, rowNumber);
    const sourcePeriod = record.Period.trim();
    const expectedPeriod = `${parsedDate.month}-${monthNames[parsedDate.month]}`;
    if (sourcePeriod !== expectedPeriod) {
      warnings.push({
        code: 'PERIOD_MISMATCH',
        message: `Row ${rowNumber} uses period ${sourcePeriod}; the delivery date belongs to ${expectedPeriod}.`,
        deliveryDate: parsedDate.iso,
        rowNumbers: [rowNumber],
      });
    }

    const sourceOrderReference = record['Order #'].trim();
    if (
      sourceOrderReference.length === 0 ||
      sourceOrderReference.length > 64 ||
      /[\u0000-\u001F\u007F]/.test(sourceOrderReference)
    ) {
      invalidRow(rowNumber, 'Order #', 'Export the order again and retry the import.');
    }
    const productCode = record['Product #'].trim();
    if (!/^\d{4,6}$/.test(productCode)) {
      invalidRow(rowNumber, 'Product #', 'Use the standardized OFB CSV exporter so the four-to-six-digit identifier is preserved.');
    }
    const sourceDescription = record['Product Description'].trim();
    if (!sourceDescription) invalidRow(rowNumber, 'Product Description', 'Export the order again and retry.');
    const acquisitionClass = record.Category.trim() as AcquisitionClass;
    const expectedClass = expectedAcquisitionClass(productCode);
    if (!expectedClass || acquisitionClass !== expectedClass) {
      invalidRow(rowNumber, 'Category', 'The acquisition class does not match the OFB product-number family.');
    }

    const quantityHundredths = parseHundredths(record.Qty, rowNumber, 'Qty');
    const weightHundredths = parseHundredths(record.Weight, rowNumber, 'Weight');
    const unitPriceCents = parseCents(record['Unit Price'], rowNumber, 'Unit Price');
    const sourcePriceTotalCents = parseCents(record['Price Total'], rowNumber, 'Price Total');
    const calculatedPriceTotalCents = Math.round(
      quantityHundredths * unitPriceCents / 100
    );
    const priceTotalMatches = sourcePriceTotalCents === calculatedPriceTotalCents;
    if (!priceTotalMatches) {
      warnings.push({
        code: 'PRICE_TOTAL_MISMATCH',
        message: `Row ${rowNumber} reports a different Price Total than Qty × Unit Price. FEED retained both values.`,
        deliveryDate: parsedDate.iso,
        rowNumbers: [rowNumber],
      });
    }

    return {
      sourceRowNumber: rowNumber,
      deliveryDate: parsedDate.iso,
      sourcePeriod,
      sourceOrderReference,
      productCode,
      sourceDescription,
      acquisitionClass,
      procurementChannel: procurementChannel(productCode),
      quantityHundredths,
      weightHundredths,
      unitPriceCents,
      sourcePriceTotalCents,
      calculatedPriceTotalCents,
      priceTotalMatches,
      serviceFeeCents: parseCents(record['Service Fee'], rowNumber, 'Service Fee'),
      grantsAppliedCents: parseCents(record['Grants Applied'], rowNumber, 'Grants Applied'),
    };
  });

  const datesByOrderReference = new Map<string, Set<string>>();
  for (const line of lines) {
    const dates = datesByOrderReference.get(line.sourceOrderReference) ?? new Set<string>();
    dates.add(line.deliveryDate);
    datesByOrderReference.set(line.sourceOrderReference, dates);
  }
  const conflictingOrder = [...datesByOrderReference].find(([, dates]) => dates.size > 1);
  if (conflictingOrder) {
    const [sourceOrderReference, dates] = conflictingOrder;
    throw new ProcurementImportError(
      `Order ${sourceOrderReference} appears on multiple delivery dates in this export. Export the range again and retry.`,
      'OFB_ORDER_DATE_CONFLICT',
      400,
      { sourceOrderReference, deliveryDates: [...dates].sort() }
    );
  }

  const byOrder = new Map<string, NormalizedOfbLine[]>();
  for (const line of lines) {
    const orderLines = byOrder.get(line.sourceOrderReference) ?? [];
    orderLines.push(line);
    byOrder.set(line.sourceOrderReference, orderLines);
  }

  const orders = [...byOrder.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sourceOrderReference, orderLines]): NormalizedOfbOrder => {
      const deliveryDate = orderLines[0].deliveryDate;
      const orderRowNumbers = new Set(orderLines.map((line) => line.sourceRowNumber));
      const warningCodes = [...new Set(
        warnings
          .filter((warning) => warning.rowNumbers.some((rowNumber) => orderRowNumbers.has(rowNumber)))
          .map((warning) => warning.code)
      )];
      return {
        sourceOrderReference,
        deliveryDate,
        snapshotHash: orderSnapshotHash(orderLines),
        warningCodes,
        lines: orderLines,
      };
    });

  return {
    fileHash: createHash('sha256').update(buffer).digest('hex'),
    rowCount: lines.length,
    rangeStart: orders.reduce((earliest, order) => order.deliveryDate < earliest ? order.deliveryDate : earliest, orders[0].deliveryDate),
    rangeEnd: orders.reduce((latest, order) => order.deliveryDate > latest ? order.deliveryDate : latest, orders[0].deliveryDate),
    warnings,
    orders,
  };
}

type TransactionClient = Prisma.TransactionClient;

export interface ProcurementImportResult {
  outcome: 'imported' | 'duplicate';
  importId: number | null;
  rowCount: number;
  orderCount: number;
  skippedOrderCount: number;
  warningCount: number;
  rangeStart: string;
  rangeEnd: string;
  warnings: ProcurementWarning[];
}

export async function importOfbCsv(
  buffer: Buffer,
  importedBy?: string,
  client = prisma
): Promise<ProcurementImportResult> {
  const parsed = parseOfbCsv(buffer);

  return client.$transaction(async (tx: TransactionClient) => {
    const currentSnapshots = await tx.procurementOrderRevision.findMany({
      where: {
        source: OFB_SOURCE,
        sourceOrderReference: { in: parsed.orders.map((order) => order.sourceOrderReference) },
        isCurrent: true,
        import: { status: 'active' },
      },
      select: { sourceOrderReference: true, snapshotHash: true },
    });
    const currentByOrder = new Map(
      currentSnapshots.map((snapshot) => [snapshot.sourceOrderReference, snapshot.snapshotHash])
    );
    const changedOrders = parsed.orders.filter(
      (order) => currentByOrder.get(order.sourceOrderReference) !== order.snapshotHash
    );

    if (changedOrders.length === 0) {
      return {
        outcome: 'duplicate' as const,
        importId: null,
        rowCount: parsed.rowCount,
        orderCount: 0,
        skippedOrderCount: parsed.orders.length,
        warningCount: parsed.warnings.length,
        rangeStart: parsed.rangeStart,
        rangeEnd: parsed.rangeEnd,
        warnings: parsed.warnings,
      };
    }

    const importRecord = await tx.procurementImport.create({
      data: {
        source: OFB_SOURCE,
        fileHash: parsed.fileHash,
        schemaVersion: OFB_IMPORT_SCHEMA_VERSION,
        status: 'active',
        rowCount: parsed.rowCount,
        orderCount: changedOrders.length,
        warningCount: parsed.warnings.length,
        warnings: parsed.warnings as unknown as Prisma.InputJsonValue,
        rangeStart: parsed.rangeStart,
        rangeEnd: parsed.rangeEnd,
        importedBy,
      },
    });

    const productIds = new Map<string, number>();
    const products = new Map<string, string>();
    for (const order of changedOrders) {
      for (const line of order.lines) {
        products.set(line.productCode, line.acquisitionClass);
      }
    }
    for (const [productCode, acquisitionClass] of products) {
      const product = await tx.procurementProduct.upsert({
        where: { source_productCode: { source: OFB_SOURCE, productCode } },
        create: { source: OFB_SOURCE, productCode, acquisitionClass },
        update: { acquisitionClass },
        select: { id: true },
      });
      productIds.set(productCode, product.id);
    }

    for (const order of changedOrders) {
      const previous = await tx.procurementOrderRevision.findFirst({
        where: { source: OFB_SOURCE, sourceOrderReference: order.sourceOrderReference },
        orderBy: { revision: 'desc' },
        select: { revision: true },
      });
      await tx.procurementOrderRevision.updateMany({
        where: { source: OFB_SOURCE, sourceOrderReference: order.sourceOrderReference, isCurrent: true },
        data: { isCurrent: false },
      });
      const revision = await tx.procurementOrderRevision.create({
        data: {
          importId: importRecord.id,
          source: OFB_SOURCE,
          sourceOrderReference: order.sourceOrderReference,
          deliveryDate: order.deliveryDate,
          revision: (previous?.revision ?? 0) + 1,
          snapshotHash: order.snapshotHash,
          warningCodes: order.warningCodes,
          isCurrent: true,
        },
      });
      await tx.procurementLine.createMany({
        data: order.lines.map((line) => ({
          orderRevisionId: revision.id,
          productId: productIds.get(line.productCode)!,
          sourceRowNumber: line.sourceRowNumber,
          sourceOrderReference: line.sourceOrderReference,
          sourcePeriod: line.sourcePeriod,
          sourceDescription: line.sourceDescription,
          acquisitionClass: line.acquisitionClass,
          procurementChannel: line.procurementChannel,
          quantityHundredths: line.quantityHundredths,
          weightHundredths: line.weightHundredths,
          unitPriceCents: line.unitPriceCents,
          sourcePriceTotalCents: line.sourcePriceTotalCents,
          calculatedPriceTotalCents: line.calculatedPriceTotalCents,
          priceTotalMatches: line.priceTotalMatches,
          serviceFeeCents: line.serviceFeeCents,
          grantsAppliedCents: line.grantsAppliedCents,
        })),
      });
    }

    return {
      outcome: 'imported' as const,
      importId: importRecord.id,
      rowCount: parsed.rowCount,
      orderCount: changedOrders.length,
      skippedOrderCount: parsed.orders.length - changedOrders.length,
      warningCount: parsed.warnings.length,
      rangeStart: parsed.rangeStart,
      rangeEnd: parsed.rangeEnd,
      warnings: parsed.warnings,
    };
  });
}

async function refreshCurrentOrders(
  tx: TransactionClient,
  sourceOrderReferences: string[]
): Promise<void> {
  for (const sourceOrderReference of [...new Set(sourceOrderReferences)]) {
    await tx.procurementOrderRevision.updateMany({
      where: { source: OFB_SOURCE, sourceOrderReference },
      data: { isCurrent: false },
    });
    const latestActive = await tx.procurementOrderRevision.findFirst({
      where: {
        source: OFB_SOURCE,
        sourceOrderReference,
        import: { status: 'active' },
      },
      orderBy: { revision: 'desc' },
      select: { id: true },
    });
    if (latestActive) {
      await tx.procurementOrderRevision.update({
        where: { id: latestActive.id },
        data: { isCurrent: true },
      });
    }
  }
}

export async function rollbackProcurementImports(
  ids: number[],
  actor?: string,
  client = prisma
): Promise<{ updated: number }> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return { updated: 0 };
  return client.$transaction(async (tx: TransactionClient) => {
    const imports = await tx.procurementImport.findMany({
      where: { id: { in: uniqueIds }, status: 'active' },
      include: { orders: { select: { sourceOrderReference: true } } },
    });
    if (imports.length === 0) return { updated: 0 };
    const now = new Date();
    await tx.procurementImport.updateMany({
      where: { id: { in: imports.map((record) => record.id) } },
      data: { status: 'rolled_back', rolledBackAt: now, rolledBackBy: actor },
    });
    await refreshCurrentOrders(
      tx,
      imports.flatMap((record) => record.orders.map((order) => order.sourceOrderReference))
    );
    return { updated: imports.length };
  });
}

export async function restoreProcurementImports(
  ids: number[],
  actor?: string,
  client = prisma
): Promise<{ updated: number }> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return { updated: 0 };
  return client.$transaction(async (tx: TransactionClient) => {
    const imports = await tx.procurementImport.findMany({
      where: { id: { in: uniqueIds }, status: 'rolled_back' },
      include: { orders: { select: { sourceOrderReference: true } } },
    });
    if (imports.length === 0) return { updated: 0 };
    const now = new Date();
    await tx.procurementImport.updateMany({
      where: { id: { in: imports.map((record) => record.id) } },
      data: { status: 'active', restoredAt: now, restoredBy: actor },
    });
    await refreshCurrentOrders(
      tx,
      imports.flatMap((record) => record.orders.map((order) => order.sourceOrderReference))
    );
    return { updated: imports.length };
  });
}

export async function listProcurementImports(client = prisma) {
  const records = await client.procurementImport.findMany({
    orderBy: [{ importedAt: 'desc' }, { id: 'desc' }],
    include: {
      orders: {
        select: {
          id: true,
          sourceOrderReference: true,
          deliveryDate: true,
          revision: true,
          warningCodes: true,
          isCurrent: true,
          _count: { select: { lines: true } },
        },
        orderBy: { deliveryDate: 'asc' },
      },
    },
  });
  return records.map((record) => ({
    id: record.id,
    source: record.source,
    status: record.status,
    schemaVersion: record.schemaVersion,
    rowCount: record.rowCount,
    orderCount: record.orderCount,
    warningCount: record.warningCount,
    warnings: record.warnings,
    rangeStart: record.rangeStart,
    rangeEnd: record.rangeEnd,
    importedAt: record.importedAt.toISOString(),
    rolledBackAt: record.rolledBackAt?.toISOString() ?? null,
    restoredAt: record.restoredAt?.toISOString() ?? null,
    orders: record.orders.map((order) => ({
      id: order.id,
      sourceOrderReference: order.sourceOrderReference,
      deliveryDate: order.deliveryDate,
      revision: order.revision,
      warningCodes: order.warningCodes,
      isCurrent: order.isCurrent,
      lineCount: order._count.lines,
    })),
  }));
}

function calendarDayDifference(earlier: string, later: string): number {
  const start = Date.parse(`${earlier}T00:00:00.000Z`);
  const end = Date.parse(`${later}T00:00:00.000Z`);
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export async function getProcurementDataStatus(
  now = new Date(),
  client = prisma,
  resolvedTimeZone?: string
) {
  const [latest, settings] = await Promise.all([
    client.procurementOrderRevision.findFirst({
      where: { source: OFB_SOURCE, isCurrent: true, import: { status: 'active' } },
      orderBy: { deliveryDate: 'desc' },
      select: { deliveryDate: true },
    }),
    resolvedTimeZone
      ? Promise.resolve(null)
      : getOperatingHoursSettings(client as never),
  ]);
  if (!latest) {
    return {
      hasData: false,
      latestDeliveryDate: null,
      daysSinceLatestDelivery: null,
      isStale: false,
      staleAfterDays: PROCUREMENT_STALE_AFTER_DAYS,
    };
  }
  const today = localDateOf(now, resolvedTimeZone ?? settings!.timezone);
  const daysSinceLatestDelivery = calendarDayDifference(latest.deliveryDate, today);
  return {
    hasData: true,
    latestDeliveryDate: latest.deliveryDate,
    daysSinceLatestDelivery,
    isStale: daysSinceLatestDelivery > PROCUREMENT_STALE_AFTER_DAYS,
    staleAfterDays: PROCUREMENT_STALE_AFTER_DAYS,
  };
}

function quantile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, sorted.length - 1);
  const fraction = position - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

export interface ProcurementAnalyticsFilters {
  preset?: AnalyticsRangePreset;
  startDate?: string;
  endDate?: string;
  channel?: ProcurementChannel;
  acquisitionClass?: AcquisitionClass;
}

interface ProductObservation {
  productCode: string;
  latestDescription: string;
  acquisitionClass: AcquisitionClass;
  procurementChannel: ProcurementChannel;
  receiptDates: Set<string>;
  activeMonths: Set<string>;
  totalWeightHundredths: number;
  firstReceivedDate: string;
  lastReceivedDate: string;
}

function monthSpanInclusive(firstMonth: string, lastMonth: string): number {
  const [firstYear, first] = firstMonth.split('-').map(Number);
  const [lastYear, last] = lastMonth.split('-').map(Number);
  return (lastYear - firstYear) * 12 + last - first + 1;
}

export async function getProcurementAnalytics(
  filters: ProcurementAnalyticsFilters = {},
  now = new Date(),
  client = prisma
) {
  const lineWhere: Prisma.ProcurementLineWhereInput = {
    ...(filters.channel ? { procurementChannel: filters.channel } : {}),
    ...(filters.acquisitionClass ? { acquisitionClass: filters.acquisitionClass } : {}),
  };
  const baseWhere: Prisma.ProcurementOrderRevisionWhereInput = {
    source: OFB_SOURCE,
    isCurrent: true,
    import: { status: 'active' },
  };

  const [allOrderDates, settings] = await Promise.all([
    client.procurementOrderRevision.findMany({
      where: baseWhere,
      select: { deliveryDate: true },
    }),
    getOperatingHoursSettings(client as never),
  ]);
  const preset = filters.preset ?? 'all';
  const custom = preset === 'custom' && filters.startDate && filters.endDate
    ? { startDate: filters.startDate, endDate: filters.endDate }
    : undefined;
  if (preset === 'custom' && (
    !custom || !isValidLocalDate(custom.startDate) || !isValidLocalDate(custom.endDate)
  )) {
    throw new ProcurementImportError(
      'Choose valid start and end dates for the custom analytics range.',
      'INVALID_PROCUREMENT_RANGE'
    );
  }
  if (custom && custom.endDate > localDateOf(now, settings.timezone)) {
    throw new ProcurementImportError(
      'Choose an end date that is not in the future.',
      'INVALID_PROCUREMENT_RANGE'
    );
  }
  const earliestDeliveryDate = allOrderDates.reduce<string | undefined>(
    (earliest, order) => !earliest || order.deliveryDate < earliest
      ? order.deliveryDate
      : earliest,
    undefined
  );
  const range = resolveRange(
    preset,
    settings.timezone,
    now,
    custom,
    earliestDeliveryDate
  );

  const [orders, status] = await Promise.all([
    client.procurementOrderRevision.findMany({
      where: {
        ...baseWhere,
        deliveryDate: { gte: range.startDate, lte: range.endDate },
        lines: { some: lineWhere },
      },
      orderBy: [{ deliveryDate: 'asc' }, { sourceOrderReference: 'asc' }],
      include: {
        lines: {
          where: lineWhere,
          include: { product: { select: { productCode: true } } },
        },
      },
    }),
    getProcurementDataStatus(now, client, settings.timezone),
  ]);

  const orderWeights = orders.map((order) =>
    order.lines.reduce((sum, line) => sum + line.weightHundredths, 0)
  );
  const receivingDates = new Set(orders.map((order) => order.deliveryDate));
  const acquisitionWeights = new Map<AcquisitionClass, number>();
  const channelWeights = new Map<ProcurementChannel, number>();
  const monthly = new Map<string, Record<string, number>>();
  const seasonal = new Map<string, number>();
  const products = new Map<string, ProductObservation>();
  let totalWeightHundredths = 0;
  let calculatedGrossProductChargesCents = 0;
  let sourceReportedProductChargesCents = 0;
  let serviceFeesCents = 0;
  let grantsAppliedCents = 0;
  let priceMismatchLineCount = 0;
  let zeroInboundLineCount = 0;
  const costAdjustmentsAttributable = !filters.channel && !filters.acquisitionClass;

  for (const order of orders) {
    const month = order.deliveryDate.slice(0, 7);
    const monthValues = monthly.get(month) ?? {
      donatedWeightHundredths: 0,
      purchDonWeightHundredths: 0,
      governmentWeightHundredths: 0,
      purchasedWeightHundredths: 0,
      ofbWarehouseWeightHundredths: 0,
      freshAllianceWeightHundredths: 0,
    };
    for (const line of order.lines) {
      const acquisitionClass = line.acquisitionClass as AcquisitionClass;
      const channel = line.procurementChannel as ProcurementChannel;
      totalWeightHundredths += line.weightHundredths;
      calculatedGrossProductChargesCents += line.calculatedPriceTotalCents;
      sourceReportedProductChargesCents += line.sourcePriceTotalCents;
      // OFB exports place order-level fees and grants on individual source
      // rows. They can be totaled for whole orders, but a channel or
      // acquisition-class filter must not imply that the adjustment belongs
      // to the product row on which the exporter happened to place it.
      if (costAdjustmentsAttributable) {
        serviceFeesCents += line.serviceFeeCents;
        grantsAppliedCents += line.grantsAppliedCents;
      }
      if (!line.priceTotalMatches) priceMismatchLineCount += 1;
      if (line.weightHundredths === 0 || line.quantityHundredths === 0) {
        zeroInboundLineCount += 1;
      }
      acquisitionWeights.set(
        acquisitionClass,
        (acquisitionWeights.get(acquisitionClass) ?? 0) + line.weightHundredths
      );
      channelWeights.set(channel, (channelWeights.get(channel) ?? 0) + line.weightHundredths);
      const acquisitionKey = acquisitionClass === 'DONATED'
        ? 'donatedWeightHundredths'
        : acquisitionClass === 'PURCH-DON'
          ? 'purchDonWeightHundredths'
          : acquisitionClass === 'GOVERNMENT'
            ? 'governmentWeightHundredths'
            : 'purchasedWeightHundredths';
      const channelKey = channel === 'fresh_alliance'
        ? 'freshAllianceWeightHundredths'
        : 'ofbWarehouseWeightHundredths';
      monthValues[acquisitionKey] += line.weightHundredths;
      monthValues[channelKey] += line.weightHundredths;
      seasonal.set(
        `${order.deliveryDate.slice(0, 4)}-${order.deliveryDate.slice(5, 7)}`,
        (seasonal.get(`${order.deliveryDate.slice(0, 4)}-${order.deliveryDate.slice(5, 7)}`) ?? 0) + line.weightHundredths
      );

      // A completed source line with zero quantity/weight is retained for
      // provenance but is not evidence that supply was received.
      if (line.weightHundredths <= 0 || line.quantityHundredths <= 0) continue;
      const productCode = line.product.productCode;
      const existing = products.get(productCode);
      if (!existing) {
        products.set(productCode, {
          productCode,
          latestDescription: line.sourceDescription,
          acquisitionClass,
          procurementChannel: channel,
          receiptDates: new Set([order.deliveryDate]),
          activeMonths: new Set([month]),
          totalWeightHundredths: line.weightHundredths,
          firstReceivedDate: order.deliveryDate,
          lastReceivedDate: order.deliveryDate,
        });
      } else {
        existing.receiptDates.add(order.deliveryDate);
        existing.activeMonths.add(month);
        existing.totalWeightHundredths += line.weightHundredths;
        if (order.deliveryDate >= existing.lastReceivedDate) {
          existing.lastReceivedDate = order.deliveryDate;
          existing.latestDescription = line.sourceDescription;
        }
        if (order.deliveryDate < existing.firstReceivedDate) {
          existing.firstReceivedDate = order.deliveryDate;
        }
      }
    }
    monthly.set(month, monthValues);
  }

  const continuity = [...products.values()].map((product) => {
    const receiptDates = [...product.receiptDates].sort();
    const gaps = receiptDates.slice(1).map((date, index) =>
      calendarDayDifference(receiptDates[index], date)
    );
    const firstMonth = product.firstReceivedDate.slice(0, 7);
    const lastMonth = product.lastReceivedDate.slice(0, 7);
    const observedMonthSpan = monthSpanInclusive(firstMonth, lastMonth);
    return {
      productCode: product.productCode,
      description: product.latestDescription,
      acquisitionClass: product.acquisitionClass,
      procurementChannel: product.procurementChannel,
      receiptDateCount: product.receiptDates.size,
      activeMonthCount: product.activeMonths.size,
      observedMonthSpan,
      activeMonthShare: product.activeMonths.size / observedMonthSpan,
      receiptsPerActiveMonth: product.receiptDates.size / product.activeMonths.size,
      totalWeightHundredths: product.totalWeightHundredths,
      averageWeightPerReceiptHundredths: Math.round(
        product.totalWeightHundredths / product.receiptDates.size
      ),
      medianGapDays: quantile(gaps, 0.5),
      firstReceivedDate: product.firstReceivedDate,
      lastReceivedDate: product.lastReceivedDate,
    };
  }).sort((left, right) =>
    right.receiptDateCount - left.receiptDateCount ||
    right.totalWeightHundredths - left.totalWeightHundredths ||
    left.productCode.localeCompare(right.productCode)
  );
  const frequencies = continuity.map((product) => product.receiptDateCount);

  return {
    dataAsOf: now.toISOString(),
    status,
    range: {
      preset,
      startDate: range.startDate,
      endDate: range.endDate,
      timeZone: range.timeZone,
    },
    filters: {
      channel: filters.channel ?? null,
      acquisitionClass: filters.acquisitionClass ?? null,
    },
    availableYears: [...new Set(orders.map((order) => order.deliveryDate.slice(0, 4)))]
      .sort((left, right) => right.localeCompare(left)),
    summary: {
      totalWeightHundredths,
      sourceOrderCount: orders.length,
      receivingDateCount: receivingDates.size,
      medianOrderWeightHundredths: quantile(orderWeights, 0.5),
      lowerQuartileOrderWeightHundredths: quantile(orderWeights, 0.25),
      upperQuartileOrderWeightHundredths: quantile(orderWeights, 0.75),
      medianLinesPerOrder: quantile(orders.map((order) => order.lines.length), 0.5),
      supplierProductCodes: products.size,
      productsReceivedOnce: frequencies.filter((frequency) => frequency === 1).length,
      productsReceivedTenOrMore: frequencies.filter((frequency) => frequency >= 10).length,
      zeroInboundLineCount,
      calculatedGrossProductChargesCents,
      sourceReportedProductChargesCents,
      costAdjustmentsAttributable,
      serviceFeesCents: costAdjustmentsAttributable ? serviceFeesCents : null,
      grantsAppliedCents: costAdjustmentsAttributable ? grantsAppliedCents : null,
      netRecordedCostCents: costAdjustmentsAttributable
        ? calculatedGrossProductChargesCents + serviceFeesCents - grantsAppliedCents
        : null,
      priceMismatchLineCount,
    },
    acquisitionMix: ACQUISITION_CLASSES.map((acquisitionClass) => ({
      acquisitionClass,
      weightHundredths: acquisitionWeights.get(acquisitionClass) ?? 0,
    })),
    channelMix: PROCUREMENT_CHANNELS.map((channel) => ({
      channel,
      weightHundredths: channelWeights.get(channel) ?? 0,
    })),
    monthlyWeight: [...monthly.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, values]) => ({ month, ...values })),
    seasonalWeight: [...seasonal.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([yearMonth, weightHundredths]) => ({
        year: yearMonth.slice(0, 4),
        month: Number(yearMonth.slice(5, 7)),
        weightHundredths,
      })),
    recurrenceDistribution: [
      { label: 'One receipt date', productCount: frequencies.filter((value) => value === 1).length },
      { label: '2–4 receipt dates', productCount: frequencies.filter((value) => value >= 2 && value <= 4).length },
      { label: '5–9 receipt dates', productCount: frequencies.filter((value) => value >= 5 && value <= 9).length },
      { label: '10+ receipt dates', productCount: frequencies.filter((value) => value >= 10).length },
    ],
    productContinuity: continuity,
  };
}
