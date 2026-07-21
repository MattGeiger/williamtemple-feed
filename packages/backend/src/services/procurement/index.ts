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
import { clearSupersede, reapplySupersede } from './fresh-alliance';
import {
  ACQUISITION_CLASSES,
  AcquisitionClass,
  FRESH_ALLIANCE_SOURCE,
  OFB_SOURCE,
  PROCUREMENT_SOURCES,
  ProcurementImportError,
  expectedAcquisitionClass,
  invalidRow,
  monthNames,
  parseCents,
  parseHundredths,
  parseSourceDate,
} from './parsing';

// Parsing primitives are shared with the Agency Pickups parser so the two
// cannot drift. Re-exported here because this module is the established import
// site for procurement consumers.
export {
  ACQUISITION_CLASSES,
  FRESH_ALLIANCE_SOURCE,
  OFB_SOURCE,
  PROCUREMENT_SOURCES,
  ProcurementImportError,
} from './parsing';
export type { AcquisitionClass } from './parsing';

export const OFB_IMPORT_SCHEMA_VERSION = 4;
export const PROCUREMENT_STALE_AFTER_DAYS = 30;

export const PROCUREMENT_CHANNELS = ['ofb_warehouse', 'fresh_alliance'] as const;
export const PROCUREMENT_EVENT_KINDS = [
  'ofb_warehouse_order',
  'fresh_alliance_receipt',
] as const;
export type ProcurementChannel = typeof PROCUREMENT_CHANNELS[number];
export type ProcurementEventKind = typeof PROCUREMENT_EVENT_KINDS[number];

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
  | 'PERIOD_MISMATCH'
  | 'DEPRECATED_PRODUCT_CODE';

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
  eventKind: ProcurementEventKind;
  deliveryDate: string;
  snapshotHash: string;
  legacySnapshotHash: string;
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

function procurementChannel(sourceOrderReference: string): ProcurementChannel {
  return /AGPCKUP$/i.test(sourceOrderReference) ? 'fresh_alliance' : 'ofb_warehouse';
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

// Schema versions 1–3 derived channel from the product-code prefix. Accepting
// that historical hash prevents a semantically corrected no-op import from
// manufacturing a new revision. New revisions always store the source-based
// schema-v4 hash.
function legacyOrderSnapshotHash(lines: NormalizedOfbLine[]): string {
  return orderSnapshotHash(lines.map((line) => ({
    ...line,
    procurementChannel: /^4\d{4}$/.test(line.productCode)
      ? 'fresh_alliance'
      : 'ofb_warehouse',
  })));
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
      procurementChannel: procurementChannel(sourceOrderReference),
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
      const eventKind: ProcurementEventKind = procurementChannel(sourceOrderReference) === 'fresh_alliance'
        ? 'fresh_alliance_receipt'
        : 'ofb_warehouse_order';
      const orderRowNumbers = new Set(orderLines.map((line) => line.sourceRowNumber));
      const warningCodes = [...new Set(
        warnings
          .filter((warning) => warning.rowNumbers.some((rowNumber) => orderRowNumbers.has(rowNumber)))
          .map((warning) => warning.code)
      )];
      return {
        sourceOrderReference,
        eventKind,
        deliveryDate,
        snapshotHash: orderSnapshotHash(orderLines),
        legacySnapshotHash: legacyOrderSnapshotHash(orderLines),
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
    const changedOrders = parsed.orders.filter((order) => {
      const currentHash = currentByOrder.get(order.sourceOrderReference);
      return currentHash !== order.snapshotHash && currentHash !== order.legacySnapshotHash;
    });

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
          eventKind: order.eventKind,
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

    // A Completed Orders import re-lands AGPCKUP events that an existing Fresh
    // Alliance import already covers. Without this, those fresh revisions would
    // arrive unclaimed and Fresh Alliance weight would double again. Each
    // active Fresh Alliance import reasserts its own recorded window.
    const activeFreshAllianceImports = await tx.procurementImport.findMany({
      where: { source: FRESH_ALLIANCE_SOURCE, status: 'active' },
      select: { id: true, rangeStart: true, rangeEnd: true },
    });
    for (const freshImport of activeFreshAllianceImports) {
      await reapplySupersede(tx, freshImport.id, freshImport.rangeStart, freshImport.rangeEnd);
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
  events: { source: string; sourceOrderReference: string }[]
): Promise<void> {
  const unique = new Map(
    events.map((event) => [JSON.stringify([event.source, event.sourceOrderReference]), event])
  );
  for (const { source, sourceOrderReference } of unique.values()) {
    await tx.procurementOrderRevision.updateMany({
      where: { source, sourceOrderReference },
      data: { isCurrent: false },
    });
    const latestActive = await tx.procurementOrderRevision.findFirst({
      where: {
        source,
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
      include: { orders: { select: { source: true, sourceOrderReference: true } } },
    });
    if (imports.length === 0) return { updated: 0 };
    const now = new Date();
    await tx.procurementImport.updateMany({
      where: { id: { in: imports.map((record) => record.id) } },
      data: { status: 'rolled_back', rolledBackAt: now, rolledBackBy: actor },
    });
    // Rolling back a Fresh Alliance import releases the Completed Orders
    // events it superseded, so their observations return to analytics rather
    // than leaving a hole where the donor-attributed data used to be.
    for (const record of imports) {
      await clearSupersede(tx, record.id);
    }
    await refreshCurrentOrders(tx, imports.flatMap((record) => record.orders));
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
      include: { orders: { select: { source: true, sourceOrderReference: true } } },
    });
    if (imports.length === 0) return { updated: 0 };
    const now = new Date();
    await tx.procurementImport.updateMany({
      where: { id: { in: imports.map((record) => record.id) } },
      data: { status: 'active', restoredAt: now, restoredBy: actor },
    });
    // A restored Fresh Alliance import reclaims the window it recorded. The
    // claim is recomputed rather than remembered, and the "unclaimed only"
    // guard means an import that took over in the meantime keeps its rows.
    for (const record of imports) {
      if (record.source === FRESH_ALLIANCE_SOURCE) {
        await reapplySupersede(tx, record.id, record.rangeStart, record.rangeEnd);
      }
    }
    await refreshCurrentOrders(tx, imports.flatMap((record) => record.orders));
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
          eventKind: true,
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
      eventKind: order.eventKind,
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
  const activeCorpus = {
    source: { in: [...PROCUREMENT_SOURCES] },
    isCurrent: true,
    supersededByImportId: null,
    import: { status: 'active' as const },
  };
  const [latest, warehouseCoverage, freshAllianceCoverage, settings] = await Promise.all([
    client.procurementOrderRevision.findFirst({
      where: activeCorpus,
      orderBy: { deliveryDate: 'desc' },
      select: { deliveryDate: true },
    }),
    // Each channel is reported on its own schedule, so their windows are read
    // separately and never assumed equal. See procurement-unification-plan.md
    // (D12): this describes what FEED can currently see, not how anyone is
    // performing.
    client.procurementOrderRevision.aggregate({
      where: { ...activeCorpus, eventKind: 'ofb_warehouse_order' },
      _min: { deliveryDate: true },
      _max: { deliveryDate: true },
      _count: { _all: true },
    }),
    client.procurementOrderRevision.aggregate({
      where: { ...activeCorpus, eventKind: 'fresh_alliance_receipt' },
      _min: { deliveryDate: true },
      _max: { deliveryDate: true },
      _count: { _all: true },
    }),
    resolvedTimeZone
      ? Promise.resolve(null)
      : getOperatingHoursSettings(client as never),
  ]);
  const coverage = {
    warehouse: {
      eventCount: warehouseCoverage._count._all,
      earliestDeliveryDate: warehouseCoverage._min.deliveryDate,
      latestDeliveryDate: warehouseCoverage._max.deliveryDate,
    },
    freshAlliance: {
      eventCount: freshAllianceCoverage._count._all,
      earliestDeliveryDate: freshAllianceCoverage._min.deliveryDate,
      latestDeliveryDate: freshAllianceCoverage._max.deliveryDate,
    },
  };

  if (!latest) {
    return {
      hasData: false,
      latestDeliveryDate: null,
      daysSinceLatestDelivery: null,
      isStale: false,
      staleAfterDays: PROCUREMENT_STALE_AFTER_DAYS,
      coverage,
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
    coverage,
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
  totalWeightHundredths: number;
  firstReceivedDate: string;
  lastReceivedDate: string;
}

interface DonorObservation {
  donorCode: string;
  donorName: string;
  pickupCount: number;
  weightHundredths: number;
  receivingDates: Set<string>;
  firstReceivedDate: string;
  lastReceivedDate: string;
  valuedWeightHundredths: number;
  unvaluedWeightHundredths: number;
  recordedValueCents: number;
  categories: Map<string, { description: string; weightHundredths: number }>;
}

interface FreshAllianceCategoryObservation {
  productCode: string;
  latestDescription: string;
  receiptReferences: Set<string>;
  receiptDates: Set<string>;
  totalWeightHundredths: number;
  firstReceivedDate: string;
  lastReceivedDate: string;
}

interface PaidProductObservation {
  productCode: string;
  latestDescription: string;
  receiptDates: Set<string>;
  totalSpendCents: number;
  paidWeightHundredths: number;
  firstReceivedDate: string;
  lastReceivedDate: string;
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
  // Both OFB exports contribute. A Completed Orders Fresh Alliance event whose
  // date is covered by a Fresh Alliance import is excluded here so the
  // donor-attributed observation of the same event replaces it rather than
  // adding to it. Excluding the superseded row and including its replacement is
  // one operation; doing only half of it would move headline weight.
  const corpusWhere: Prisma.ProcurementOrderRevisionWhereInput = {
    source: { in: [...PROCUREMENT_SOURCES] },
    isCurrent: true,
    supersededByImportId: null,
    import: { status: 'active' },
  };
  const baseWhere: Prisma.ProcurementOrderRevisionWhereInput = {
    ...corpusWhere,
  };

  const [allOrderDates, settings] = await Promise.all([
    client.procurementOrderRevision.findMany({
      where: corpusWhere,
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

  const eventWeights = orders.map((order) =>
    order.lines.reduce((sum, line) => sum + line.weightHundredths, 0)
  );
  const receivingDates = new Set(orders.map((order) => order.deliveryDate));
  const orderedReceivingDates = [...receivingDates].sort();
  const receivingDateGaps = orderedReceivingDates.slice(1).map((date, index) =>
    calendarDayDifference(orderedReceivingDates[index], date)
  );
  const acquisitionWeights = new Map<AcquisitionClass, number>();
  const channelWeights = new Map<ProcurementChannel, number>();
  const monthly = new Map<string, Record<string, number>>();
  const seasonal = new Map<string, number>();
  // Keyed by year-month and channel so the seasonal view can separate OFB
  // Warehouse orders from Fresh Food Alliance receipts without a second query.
  const seasonalByChannel = new Map<string, number>();
  const products = new Map<string, ProductObservation>();
  const freshAllianceCategories = new Map<string, FreshAllianceCategoryObservation>();

  // Donor observations come only from the Agency Pickups export, which is the
  // sole source that reports partner identity. FEED never infers a donor for a
  // Completed Orders receipt, so those events contribute weight without ever
  // being attributed to a partner.
  const donors = new Map<string, DonorObservation>();
  const donorMonthly = new Map<string, number>();
  const paidProducts = new Map<string, PaidProductObservation>();
  let totalWeightHundredths = 0;
  let calculatedGrossProductChargesCents = 0;
  let sourceReportedProductChargesCents = 0;
  let serviceFeesCents = 0;
  let grantsAppliedCents = 0;
  let priceMismatchLineCount = 0;
  let zeroInboundLineCount = 0;
  const costAdjustmentsAttributable = !filters.acquisitionClass;

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
    const donorCode = order.donorCode;
    const donorObservation = donorCode
      ? donors.get(donorCode) ?? {
        donorCode,
        donorName: order.donorName ?? donorCode,
        pickupCount: 0,
        weightHundredths: 0,
        receivingDates: new Set<string>(),
        firstReceivedDate: order.deliveryDate,
        lastReceivedDate: order.deliveryDate,
        valuedWeightHundredths: 0,
        unvaluedWeightHundredths: 0,
        recordedValueCents: 0,
        categories: new Map<string, { description: string; weightHundredths: number }>(),
      }
      : null;
    if (donorCode && donorObservation) {
      donorObservation.pickupCount += 1;
      donorObservation.receivingDates.add(order.deliveryDate);
      if (order.deliveryDate < donorObservation.firstReceivedDate) {
        donorObservation.firstReceivedDate = order.deliveryDate;
      }
      if (order.deliveryDate > donorObservation.lastReceivedDate) {
        donorObservation.lastReceivedDate = order.deliveryDate;
      }
      donors.set(donorCode, donorObservation);
    }

    for (const line of order.lines) {
      const acquisitionClass = line.acquisitionClass as AcquisitionClass;
      const channel = line.procurementChannel as ProcurementChannel;
      totalWeightHundredths += line.weightHundredths;
      calculatedGrossProductChargesCents += line.calculatedPriceTotalCents;
      sourceReportedProductChargesCents += line.sourcePriceTotalCents;
      // OFB exports place event-level fees and grants on individual source
      // rows. A channel filter retains whole source events; an acquisition
      // filter may divide one event, making its adjustments unattributable.
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
      const yearMonth = `${order.deliveryDate.slice(0, 4)}-${order.deliveryDate.slice(5, 7)}`;
      seasonal.set(yearMonth, (seasonal.get(yearMonth) ?? 0) + line.weightHundredths);
      const seasonalChannelKey = `${yearMonth}|${channel}`;
      seasonalByChannel.set(
        seasonalChannelKey,
        (seasonalByChannel.get(seasonalChannelKey) ?? 0) + line.weightHundredths
      );

      if (donorObservation) {
        donorObservation.weightHundredths += line.weightHundredths;
        // Recorded in-kind value is deliberately partial: OFB leaves the rate
        // blank on a large share of historical rows. FEED sums only what the
        // source recorded and reports how much weight that covers. It never
        // imputes a rate onto unvalued weight.
        if (line.hasDonorValuation && line.donorValuePerPoundCents) {
          donorObservation.valuedWeightHundredths += line.weightHundredths;
          donorObservation.recordedValueCents += Math.round(
            line.weightHundredths * line.donorValuePerPoundCents / 100
          );
        } else {
          donorObservation.unvaluedWeightHundredths += line.weightHundredths;
        }
        const categoryCode = line.product.productCode;
        const category = donorObservation.categories.get(categoryCode)
          ?? { description: line.sourceDescription, weightHundredths: 0 };
        category.weightHundredths += line.weightHundredths;
        donorObservation.categories.set(categoryCode, category);
        const donorMonthKey = `${order.deliveryDate.slice(0, 7)}|${donorObservation.donorCode}`;
        donorMonthly.set(
          donorMonthKey,
          (donorMonthly.get(donorMonthKey) ?? 0) + line.weightHundredths
        );
      }

      // Paid-product analysis stays within exact OFB Warehouse product codes.
      // It does not infer a FEED category or claim that purchasing occurred
      // because donated supply was insufficient.
      if (channel === 'ofb_warehouse' && line.calculatedPriceTotalCents > 0) {
        const productCode = line.product.productCode;
        const existingPaidProduct = paidProducts.get(productCode);
        if (!existingPaidProduct) {
          paidProducts.set(productCode, {
            productCode,
            latestDescription: line.sourceDescription,
            receiptDates: new Set([order.deliveryDate]),
            totalSpendCents: line.calculatedPriceTotalCents,
            paidWeightHundredths: line.weightHundredths,
            firstReceivedDate: order.deliveryDate,
            lastReceivedDate: order.deliveryDate,
          });
        } else {
          existingPaidProduct.receiptDates.add(order.deliveryDate);
          existingPaidProduct.totalSpendCents += line.calculatedPriceTotalCents;
          existingPaidProduct.paidWeightHundredths += line.weightHundredths;
          if (order.deliveryDate >= existingPaidProduct.lastReceivedDate) {
            existingPaidProduct.lastReceivedDate = order.deliveryDate;
            existingPaidProduct.latestDescription = line.sourceDescription;
          }
          if (order.deliveryDate < existingPaidProduct.firstReceivedDate) {
            existingPaidProduct.firstReceivedDate = order.deliveryDate;
          }
        }
      }

      // A completed source line with zero quantity/weight is retained for
      // provenance but is not evidence that supply was received.
      if (line.weightHundredths <= 0 || line.quantityHundredths <= 0) continue;
      const productCode = line.product.productCode;
      if (channel === 'fresh_alliance') {
        const existingCategory = freshAllianceCategories.get(productCode);
        if (!existingCategory) {
          freshAllianceCategories.set(productCode, {
            productCode,
            latestDescription: line.sourceDescription,
            receiptReferences: new Set([order.sourceOrderReference]),
            receiptDates: new Set([order.deliveryDate]),
            totalWeightHundredths: line.weightHundredths,
            firstReceivedDate: order.deliveryDate,
            lastReceivedDate: order.deliveryDate,
          });
        } else {
          existingCategory.receiptReferences.add(order.sourceOrderReference);
          existingCategory.receiptDates.add(order.deliveryDate);
          existingCategory.totalWeightHundredths += line.weightHundredths;
          if (order.deliveryDate >= existingCategory.lastReceivedDate) {
            existingCategory.lastReceivedDate = order.deliveryDate;
            existingCategory.latestDescription = line.sourceDescription;
          }
          if (order.deliveryDate < existingCategory.firstReceivedDate) {
            existingCategory.firstReceivedDate = order.deliveryDate;
          }
        }
        continue;
      }
      const existing = products.get(productCode);
      if (!existing) {
        products.set(productCode, {
          productCode,
          latestDescription: line.sourceDescription,
          acquisitionClass,
          procurementChannel: channel,
          receiptDates: new Set([order.deliveryDate]),
          totalWeightHundredths: line.weightHundredths,
          firstReceivedDate: order.deliveryDate,
          lastReceivedDate: order.deliveryDate,
        });
      } else {
        existing.receiptDates.add(order.deliveryDate);
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

  const warehouseProductSummary = [...products.values()].map((product) => {
    const receiptDates = [...product.receiptDates].sort();
    const gaps = receiptDates.slice(1).map((date, index) =>
      calendarDayDifference(receiptDates[index], date)
    );
    return {
      productCode: product.productCode,
      description: product.latestDescription,
      acquisitionClass: product.acquisitionClass,
      procurementChannel: product.procurementChannel,
      receiptDateCount: product.receiptDates.size,
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
  const freshAllianceCategorySummary = [...freshAllianceCategories.values()]
    .map((category) => ({
      productCode: category.productCode,
      description: category.latestDescription,
      receiptEventCount: category.receiptReferences.size,
      receivingDateCount: category.receiptDates.size,
      totalWeightHundredths: category.totalWeightHundredths,
      firstReceivedDate: category.firstReceivedDate,
      lastReceivedDate: category.lastReceivedDate,
    }))
    .sort((left, right) =>
      right.totalWeightHundredths - left.totalWeightHundredths ||
      left.productCode.localeCompare(right.productCode)
    );
  const paidProductSummary = [...paidProducts.values()]
    .map((product) => ({
      productCode: product.productCode,
      description: product.latestDescription,
      receiptDateCount: product.receiptDates.size,
      totalSpendCents: product.totalSpendCents,
      paidWeightHundredths: product.paidWeightHundredths,
      costPerPaidPoundCents: product.paidWeightHundredths > 0
        ? Math.round(product.totalSpendCents * 100 / product.paidWeightHundredths)
        : null,
      firstReceivedDate: product.firstReceivedDate,
      lastReceivedDate: product.lastReceivedDate,
    }))
    .sort((left, right) =>
      right.totalSpendCents - left.totalSpendCents ||
      left.productCode.localeCompare(right.productCode)
    );
  const warehouseOrderCount = orders.filter(
    (order) => order.eventKind === 'ofb_warehouse_order'
  ).length;
  const freshAllianceReceiptCount = orders.filter(
    (order) => order.eventKind === 'fresh_alliance_receipt'
  ).length;

  // Donor summaries are descriptive observations of what each partner
  // delivered. FEED does not rank partners, score them, or explain why a
  // partner's volume moved.
  const donorSummary = [...donors.values()]
    .map((donor) => ({
      donorCode: donor.donorCode,
      donorName: donor.donorName,
      pickupCount: donor.pickupCount,
      receivingDateCount: donor.receivingDates.size,
      weightHundredths: donor.weightHundredths,
      averageWeightPerPickupHundredths: donor.pickupCount === 0
        ? 0
        : Math.round(donor.weightHundredths / donor.pickupCount),
      valuedWeightHundredths: donor.valuedWeightHundredths,
      unvaluedWeightHundredths: donor.unvaluedWeightHundredths,
      recordedValueCents: donor.recordedValueCents,
      firstReceivedDate: donor.firstReceivedDate,
      lastReceivedDate: donor.lastReceivedDate,
      categories: [...donor.categories.entries()]
        .map(([productCode, category]) => ({
          productCode,
          description: category.description,
          weightHundredths: category.weightHundredths,
        }))
        .sort((left, right) => right.weightHundredths - left.weightHundredths),
    }))
    .sort((left, right) => right.weightHundredths - left.weightHundredths);

  const donorWeightHundredths = donorSummary
    .reduce((total, donor) => total + donor.weightHundredths, 0);
  const donorValuedWeightHundredths = donorSummary
    .reduce((total, donor) => total + donor.valuedWeightHundredths, 0);

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
      sourceEventCount: orders.length,
      warehouseOrderCount,
      freshAllianceReceiptCount,
      receivingDateCount: receivingDates.size,
      medianReceivingGapDays: quantile(receivingDateGaps, 0.5),
      medianEventWeightHundredths: quantile(eventWeights, 0.5),
      lowerQuartileEventWeightHundredths: quantile(eventWeights, 0.25),
      upperQuartileEventWeightHundredths: quantile(eventWeights, 0.75),
      medianLinesPerEvent: quantile(orders.map((order) => order.lines.length), 0.5),
      warehouseProductCodes: products.size,
      freshAllianceCategoryCodes: freshAllianceCategorySummary.length,
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
    seasonalChannelWeight: [...seasonalByChannel.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, weightHundredths]) => {
        const [yearMonth, channel] = key.split('|');
        return {
          year: yearMonth.slice(0, 4),
          month: Number(yearMonth.slice(5, 7)),
          channel: channel as ProcurementChannel,
          weightHundredths,
        };
      }),
    warehouseProducts: warehouseProductSummary,
    paidProducts: paidProductSummary,
    freshAllianceCategories: freshAllianceCategorySummary,
    donors: donorSummary,
    donorMonthlyWeight: [...donorMonthly.entries()]
      .map(([key, weightHundredths]) => {
        const [month, donorCode] = key.split('|');
        return { month, donorCode, weightHundredths };
      })
      .sort((left, right) => left.month.localeCompare(right.month)
        || left.donorCode.localeCompare(right.donorCode)),
    donorValue: {
      // Stated with its coverage because OFB left the rate blank on a large
      // share of historical rows. Value is summed only where recorded, and the
      // uncovered weight is reported alongside it rather than imputed.
      recordedValueCents: donorSummary.reduce((total, donor) => total + donor.recordedValueCents, 0),
      valuedWeightHundredths: donorValuedWeightHundredths,
      totalWeightHundredths: donorWeightHundredths,
      unvaluedWeightHundredths: donorWeightHundredths - donorValuedWeightHundredths,
    },
  };
}
