import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { describe, expect, test, vi } from 'vitest';
import {
  UNIFIED_HEADERS,
  importUnifiedOfbCsv,
  parseUnifiedOfbCsv,
} from '../../../src/services/procurement/unified';
import { ProcurementImportError } from '../../../src/services/procurement/parsing';

const csv = (...rows: string[]) => Buffer.from([
  UNIFIED_HEADERS.join(','),
  ...rows,
].join('\r\n'));

// Schema Version,Record Type,Confirmed,Date,Period,Source Reference,Product #,
// Product Description,Category,Qty,Weight,Unit Price,Price Total,Service Fee,
// Grants Applied,Pickup Time,Pickup ID,Pickup Line ID,Donor Code,Donor Name,
// Fresh Alliance Category,Received Qty,Received Weight,Temperature,
// Submitted Date/Time,Donor Value Per Pound
const warehouseRow = (overrides: Partial<Record<string, string>> = {}) => {
  const f: Record<string, string> = {
    schemaVersion: '2.0',
    recordType: 'warehouse_order',
    confirmed: 'Yes',
    date: '6/1/26',
    period: '6-Jun',
    sourceRef: '804835',
    productCode: '00070',
    description: 'Bread, Bread/Buns/Rolls/Bagels -TOTE',
    category: 'DONATED',
    qty: '1.00',
    weight: '116.00',
    unitPrice: '$0.00',
    priceTotal: '$0.00',
    serviceFee: '$0.00',
    grantsApplied: '$0.00',
    ...overrides,
  };
  return [
    f.schemaVersion, f.recordType, f.confirmed, f.date, f.period, f.sourceRef,
    f.productCode, `"${f.description}"`, f.category, f.qty, f.weight,
    f.unitPrice, f.priceTotal, f.serviceFee, f.grantsApplied,
    '', '', '', '', '', '', '', '', '', '', '',
  ].join(',');
};

const pickupRow = (overrides: Partial<Record<string, string>> = {}) => {
  const f: Record<string, string> = {
    schemaVersion: '2.0',
    recordType: 'agency_pickup',
    confirmed: 'Yes',
    date: '6/2/26',
    period: '6-Jun',
    sourceRef: '1169184AGPCKUP',
    productCode: '40000',
    description: 'Bread & Bakery (Fresh Alliance)',
    category: 'DONATED',
    qty: '64.00',
    weight: '64.00',
    pickupTime: '9:00 AM',
    pickupId: '459210',
    pickupLineId: '1894248',
    donorCode: 'RTJ146',
    donorName: "Trader Joe's - Northwest",
    faCategory: 'e Retail-Wholesale',
    receivedQty: '64.00',
    receivedWeight: '64.00',
    temperature: '',
    submitted: '6/2/2026 10:05 AM',
    donorValue: '1.45',
    ...overrides,
  };
  return [
    f.schemaVersion, f.recordType, f.confirmed, f.date, f.period, f.sourceRef,
    f.productCode, `"${f.description}"`, f.category, f.qty, f.weight,
    '', '', '', '',
    f.pickupTime, f.pickupId, f.pickupLineId, f.donorCode, `"${f.donorName}"`,
    f.faCategory, f.receivedQty, f.receivedWeight, f.temperature, f.submitted, f.donorValue,
  ].join(',');
};

describe('Unified export normalization', () => {
  test('splits warehouse and agency pickup rows into their own normalized shapes', () => {
    const parsed = parseUnifiedOfbCsv(csv(warehouseRow(), pickupRow()));

    expect(parsed.rowCount).toBe(2);
    expect(parsed.rangeStart).toBe('2026-06-01');
    expect(parsed.rangeEnd).toBe('2026-06-02');

    expect(parsed.warehouse?.orders).toHaveLength(1);
    expect(parsed.warehouse?.orders[0]).toMatchObject({
      sourceOrderReference: '804835',
      eventKind: 'ofb_warehouse_order',
    });

    expect(parsed.freshAlliance?.pickups).toHaveLength(1);
    expect(parsed.freshAlliance?.pickups[0]).toMatchObject({
      sourcePickupReference: '1169184AGPCKUP',
      donorName: "Trader Joe's - Northwest",
      isConfirmed: true,
    });
  });

  test('marks an unconfirmed agency_pickup row isConfirmed: false', () => {
    const parsed = parseUnifiedOfbCsv(csv(pickupRow({
      confirmed: 'No', sourceRef: '1172093AGPCKUP', receivedQty: '0.00', receivedWeight: '0.00',
    })));

    expect(parsed.freshAlliance?.pickups[0]).toMatchObject({
      sourcePickupReference: '1172093AGPCKUP',
      isConfirmed: false,
    });
    // Requested weight stays real and meaningful regardless of confirmation
    // status; only received is zero, because nothing has been reviewed yet.
    expect(parsed.freshAlliance?.pickups[0].lines[0]).toMatchObject({
      weightHundredths: 6400,
      receivedWeightHundredths: 0,
    });
  });

  test('leaves warehouse absent when the file has no warehouse_order rows', () => {
    const parsed = parseUnifiedOfbCsv(csv(pickupRow()));
    expect(parsed.warehouse).toBeNull();
    expect(parsed.freshAlliance?.pickups).toHaveLength(1);
  });

  test('leaves fresh alliance absent when the file has no agency_pickup rows', () => {
    const parsed = parseUnifiedOfbCsv(csv(warehouseRow()));
    expect(parsed.freshAlliance).toBeNull();
    expect(parsed.warehouse?.orders).toHaveLength(1);
  });

  test('rejects a schema version this build does not understand', () => {
    expect(() => parseUnifiedOfbCsv(csv(warehouseRow({ schemaVersion: '3.0' }))))
      .toThrowError(/schema version "3\.0"/);
  });

  test('rejects an unrecognized Record Type', () => {
    expect(() => parseUnifiedOfbCsv(csv(warehouseRow({ recordType: 'something_else' }))))
      .toThrowError(ProcurementImportError);
  });

  test('rejects a Confirmed value that is not exactly Yes or No', () => {
    expect(() => parseUnifiedOfbCsv(csv(pickupRow({ confirmed: 'true' }))))
      .toThrowError(ProcurementImportError);
  });

  // D13: Warehouse only ever exports Completed data. A warehouse_order row
  // marked unconfirmed means this file does not match what the exporter is
  // supposed to produce -- it must fail loudly, not import a Warehouse
  // "pending" observation FEED has decided never to hold.
  test('rejects a warehouse_order row marked unconfirmed', () => {
    expect(() => parseUnifiedOfbCsv(csv(warehouseRow({ confirmed: 'No' }))))
      .toThrowError(/Warehouse order marked unconfirmed/);
  });

  test('rejects a file that does not match the unified header', () => {
    expect(() => parseUnifiedOfbCsv(Buffer.from('Date,Period,Order #\r\n1/6/26,1-Jan,1')))
      .toThrowError(ProcurementImportError);
  });

  test('rejects an empty file', () => {
    expect(() => parseUnifiedOfbCsv(Buffer.from(''))).toThrowError(ProcurementImportError);
  });

  test('translates a structural error row number back to the original unified file', () => {
    // Row 2 is a warehouse row (ignored for this check); row 3 is the pickup
    // row with the bad product code, which the reconstructed pickup-only
    // sub-CSV would see as its own row 2 -- the translation must undo that.
    expect(() => parseUnifiedOfbCsv(csv(
      warehouseRow(),
      pickupRow({ productCode: 'bad' })
    ))).toThrowError(/Row 3 has an invalid Product #/);
  });

  test('translates warning row numbers back to the original unified file, not the reconstructed sub-CSV', () => {
    // The pickup row with the missing donor valuation is row 3 of the
    // original file (row 1 is the header, row 2 is the warehouse row ahead
    // of it) but only row 2 of the reconstructed pickup-only sub-CSV.
    const parsed = parseUnifiedOfbCsv(csv(
      warehouseRow(),
      pickupRow({ donorValue: '0.00' })
    ));
    expect(parsed.freshAlliance?.warnings[0]).toMatchObject({
      code: 'MISSING_DONOR_VALUATION',
      rowNumbers: [3],
    });
  });
});

describe('Unified export persistence', () => {
  const makeTx = (overrides: Record<string, unknown> = {}) => ({
    procurementOrderRevision: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: 55 }),
    },
    procurementImport: {
      create: vi.fn().mockResolvedValue({ id: 7 }),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    procurementProduct: { upsert: vi.fn().mockResolvedValue({ id: 3 }) },
    procurementLine: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    ...overrides,
  });
  const asClient = (tx: ReturnType<typeof makeTx>) => ({
    $transaction: vi.fn(async (operation: (value: typeof tx) => unknown) => operation(tx)),
  } as never);

  test('persists both channels from one unified file and reports a combined outcome', async () => {
    const tx = makeTx();
    const result = await importUnifiedOfbCsv(csv(warehouseRow(), pickupRow()), 'staff@example.org', asClient(tx));

    expect(result.outcome).toBe('imported');
    expect(result.warehouse).toMatchObject({ outcome: 'imported', orderCount: 1 });
    expect(result.freshAlliance).toMatchObject({ outcome: 'imported', pickupCount: 1 });
    // Both halves persisted through the existing, unchanged import paths.
    expect(tx.procurementImport.create).toHaveBeenCalledTimes(2);
  });

  test('persists a pending pickup with isConfirmed: false', async () => {
    const tx = makeTx();
    await importUnifiedOfbCsv(csv(pickupRow({
      confirmed: 'No', sourceRef: '1172093AGPCKUP', receivedQty: '0.00', receivedWeight: '0.00',
    })), undefined, asClient(tx));

    expect(tx.procurementOrderRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceOrderReference: '1172093AGPCKUP',
          isConfirmed: false,
        }),
      })
    );
  });

  test('reports duplicate only when every present channel was already current', async () => {
    const warehouseHash = parseUnifiedOfbCsv(csv(warehouseRow())).warehouse!.orders[0].snapshotHash;
    const tx = makeTx({
      procurementOrderRevision: {
        findMany: vi.fn().mockResolvedValue([{ sourceOrderReference: '804835', snapshotHash: warehouseHash }]),
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    });

    const result = await importUnifiedOfbCsv(csv(warehouseRow()), undefined, asClient(tx));
    expect(result.outcome).toBe('duplicate');
    expect(result.warehouse).toMatchObject({ outcome: 'duplicate' });
    expect(tx.procurementImport.create).not.toHaveBeenCalled();
  });
});

// The authoritative sample is a real export pulled from production Primarius
// data and is gitignored, so this block runs for developers who hold the file
// and skips elsewhere. Expected values independently computed from the raw
// CSV, not from the parser under test.
const samplePath = path.resolve(
  process.cwd(),
  '../../docs/reports/RealData/UnifiedData/OFB_Export_2026-06-01_to_2026-07-22.csv'
);

describe.skipIf(!existsSync(samplePath))('Unified export real sample', () => {
  test('splits and normalizes the full unified export without structural failure', () => {
    const parsed = parseUnifiedOfbCsv(readFileSync(samplePath));

    expect(parsed.rowCount).toBe(535);
    expect(parsed.rangeStart).toBe('2026-06-01');
    expect(parsed.rangeEnd).toBe('2026-07-21');

    expect(parsed.warehouse?.rowCount).toBe(365);
    expect(parsed.warehouse?.orders).toHaveLength(8);
    const warehouseWeight = parsed.warehouse!.orders
      .flatMap((order) => order.lines)
      .reduce((sum, line) => sum + line.weightHundredths, 0);
    expect(warehouseWeight).toBe(4954445);

    expect(parsed.freshAlliance?.rowCount).toBe(170);
    expect(parsed.freshAlliance?.pickups).toHaveLength(43);
    const pickupWeight = parsed.freshAlliance!.pickups
      .flatMap((pickup) => pickup.lines)
      .reduce((sum, line) => sum + line.weightHundredths, 0);
    expect(pickupWeight).toBe(1917300);

    const confirmed = parsed.freshAlliance!.pickups.filter((pickup) => pickup.isConfirmed);
    const pending = parsed.freshAlliance!.pickups.filter((pickup) => !pickup.isConfirmed);
    expect(confirmed).toHaveLength(29);
    expect(pending).toHaveLength(14);

    const confirmedWeight = confirmed.flatMap((pickup) => pickup.lines)
      .reduce((sum, line) => sum + line.weightHundredths, 0);
    const pendingWeight = pending.flatMap((pickup) => pickup.lines)
      .reduce((sum, line) => sum + line.weightHundredths, 0);
    expect(confirmedWeight).toBe(1387800);
    expect(pendingWeight).toBe(529500);

    // Every pending pickup's received weight is 0 -- nothing has been
    // reviewed yet -- while requested weight stays populated and real.
    for (const pickup of pending) {
      for (const line of pickup.lines) {
        expect(line.receivedWeightHundredths).toBe(0);
        expect(line.weightHundredths).toBeGreaterThan(0);
      }
    }

    // No pickup reference is double-counted across the confirmed/pending
    // split -- the extension's same-run race guard resolves in favor of
    // Completed, so a reference must appear in exactly one group.
    const confirmedRefs = new Set(confirmed.map((pickup) => pickup.sourcePickupReference));
    const pendingRefs = new Set(pending.map((pickup) => pickup.sourcePickupReference));
    const overlap = [...confirmedRefs].filter((ref) => pendingRefs.has(ref));
    expect(overlap).toEqual([]);

    // No AGPCKUP-suffixed reference appears among warehouse orders -- the
    // entire reason the unified format exists.
    const warehouseAgpckup = parsed.warehouse!.orders
      .filter((order) => order.sourceOrderReference.endsWith('AGPCKUP'));
    expect(warehouseAgpckup).toEqual([]);
  });
});
