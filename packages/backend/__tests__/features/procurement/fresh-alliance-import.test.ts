import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';
import {
  FRESH_ALLIANCE_HEADERS,
  parseFreshAllianceCsv,
} from '../../../src/services/procurement/fresh-alliance';
import { ProcurementImportError } from '../../../src/services/procurement';

const csv = (...rows: string[]) => Buffer.from([
  FRESH_ALLIANCE_HEADERS.join(','),
  ...rows,
].join('\r\n'));

// Date,Period,Pickup Time,Pickup ID,Pickup Reference,Pickup Line ID,Donor Code,
// Donor Name,Product #,Product Description,Category,Fresh Alliance Category,Qty,
// Weight,Received Qty,Received Weight,Temperature,Submitted Date/Time,
// Donor Value Per Pound
const row = (overrides: Partial<Record<string, string>> = {}) => {
  const fields: Record<string, string> = {
    date: '1/6/26',
    period: '1-Jan',
    pickupTime: '9:00 AM',
    pickupId: '445624',
    pickupReference: '1155954AGPCKUP',
    pickupLineId: '1847707',
    donorCode: 'RTJ146',
    donorName: "Trader Joe's - Northwest",
    productCode: '40000',
    description: 'Bread & Bakery (Fresh Alliance)',
    category: 'DONATED',
    faCategory: 'e Retail-Wholesale',
    qty: '20.00',
    weight: '20.00',
    receivedQty: '20.00',
    receivedWeight: '20.00',
    temperature: '',
    submitted: '1/6/2026 2:33 PM',
    donorValue: '1.45',
    ...overrides,
  };
  return [
    fields.date, fields.period, fields.pickupTime, fields.pickupId,
    fields.pickupReference, fields.pickupLineId, fields.donorCode,
    `"${fields.donorName}"`, fields.productCode, `"${fields.description}"`,
    fields.category, fields.faCategory, fields.qty, fields.weight,
    fields.receivedQty, fields.receivedWeight, fields.temperature,
    fields.submitted, fields.donorValue,
  ].join(',');
};

describe('Fresh Alliance pickup import normalization', () => {
  test('normalizes donor identity and groups observations by pickup reference', () => {
    const parsed = parseFreshAllianceCsv(csv(
      row(),
      row({ pickupLineId: '1847708', productCode: '41000', description: 'Produce (Fresh Alliance)', qty: '391.00', weight: '391.00', receivedQty: '391.00', receivedWeight: '391.00' }),
      row({ date: '1/13/26', pickupReference: '1156880AGPCKUP', pickupId: '445700', pickupLineId: '1847900', donorCode: 'RAZ100', donorName: 'Amazon - NW Industrial (Prime Now)', submitted: '1/13/2026 1:12 PM' })
    ));

    expect(parsed.rowCount).toBe(3);
    expect(parsed.pickups).toHaveLength(2);
    expect(parsed.rangeStart).toBe('2026-01-06');
    expect(parsed.rangeEnd).toBe('2026-01-13');
    expect(parsed.warnings).toEqual([]);

    expect(parsed.pickups[0]).toMatchObject({
      sourcePickupReference: '1155954AGPCKUP',
      sourcePickupId: '445624',
      eventKind: 'fresh_alliance_receipt',
      deliveryDate: '2026-01-06',
      pickupTime: '09:00',
      submittedAt: '2026-01-06T14:33',
      donorCode: 'RTJ146',
      donorName: "Trader Joe's - Northwest",
    });
    expect(parsed.pickups[0].lines).toHaveLength(2);
    expect(parsed.pickups[0].lines[0]).toMatchObject({
      productCode: '40000',
      acquisitionClass: 'DONATED',
      freshAllianceCategory: 'e Retail-Wholesale',
      quantityHundredths: 2000,
      weightHundredths: 2000,
      receivedQuantityHundredths: 2000,
      receivedWeightHundredths: 2000,
      receivedMatchesRequested: true,
      donorValuePerPoundCents: 145,
      hasDonorValuation: true,
    });
    expect(parsed.pickups[1]).toMatchObject({
      donorName: 'Amazon - NW Industrial (Prime Now)',
      pickupTime: '09:00',
    });
  });

  test('classifies every event as a Fresh Alliance receipt regardless of reference suffix', () => {
    // The export itself is the channel classifier. Reference suffixes and
    // product-code prefixes are never consulted.
    const parsed = parseFreshAllianceCsv(csv(row({ pickupReference: '9001234' })));
    expect(parsed.pickups[0].eventKind).toBe('fresh_alliance_receipt');
    expect(parsed.pickups[0].sourcePickupReference).toBe('9001234');
  });

  test('treats the 12:00 AM placeholder as an unknown pickup time', () => {
    const parsed = parseFreshAllianceCsv(csv(row({ pickupTime: '12:00 AM' })));
    expect(parsed.pickups[0].pickupTime).toBeNull();
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]).toMatchObject({ code: 'UNKNOWN_PICKUP_TIME', deliveryDate: '2026-01-06' });
    expect(parsed.pickups[0].warningCodes).toContain('UNKNOWN_PICKUP_TIME');
  });

  test('keeps midday and midnight conversions distinct', () => {
    expect(parseFreshAllianceCsv(csv(row({ pickupTime: '12:30 AM' }))).pickups[0].pickupTime).toBe('00:30');
    expect(parseFreshAllianceCsv(csv(row({ pickupTime: '12:00 PM' }))).pickups[0].pickupTime).toBe('12:00');
    expect(parseFreshAllianceCsv(csv(row({ pickupTime: '1:05 PM' }))).pickups[0].pickupTime).toBe('13:05');
  });

  test('records a missing donor valuation without discarding the weight', () => {
    const parsed = parseFreshAllianceCsv(csv(row({ donorValue: '0.00' })));
    expect(parsed.pickups[0].lines[0]).toMatchObject({
      weightHundredths: 2000,
      donorValuePerPoundCents: 0,
      hasDonorValuation: false,
    });
    expect(parsed.warnings[0].code).toBe('MISSING_DONOR_VALUATION');
  });

  test('retains both requested and received values when they disagree', () => {
    const parsed = parseFreshAllianceCsv(csv(row({ receivedWeight: '18.00' })));
    expect(parsed.pickups[0].lines[0]).toMatchObject({
      weightHundredths: 2000,
      receivedWeightHundredths: 1800,
      receivedMatchesRequested: false,
    });
    expect(parsed.warnings[0].code).toBe('RECEIVED_VARIANCE');
  });

  test('accepts a blank received value as an absence rather than a malformed row', () => {
    const parsed = parseFreshAllianceCsv(csv(row({ receivedQty: '', receivedWeight: '' })));
    expect(parsed.pickups[0].lines[0]).toMatchObject({
      receivedQuantityHundredths: null,
      receivedWeightHundredths: null,
      receivedMatchesRequested: false,
    });
  });

  test('validates temperature when present but never persists it', () => {
    const parsed = parseFreshAllianceCsv(csv(row({ temperature: '38.5' })));
    expect(parsed.pickups[0].lines[0]).not.toHaveProperty('temperature');
    expect(parsed.warnings).toEqual([]);
    expect(() => parseFreshAllianceCsv(csv(row({ temperature: 'cold' }))))
      .toThrowError(ProcurementImportError);
  });

  test('produces a stable snapshot hash that ignores source row order', () => {
    const a = row({ pickupLineId: '1', productCode: '40000' });
    const b = row({ pickupLineId: '2', productCode: '41000', description: 'Produce (Fresh Alliance)' });
    const forward = parseFreshAllianceCsv(csv(a, b)).pickups[0].snapshotHash;
    const reversed = parseFreshAllianceCsv(csv(b, a)).pickups[0].snapshotHash;
    expect(forward).toBe(reversed);
  });

  test('changes the snapshot hash when the donor changes', () => {
    const base = parseFreshAllianceCsv(csv(row())).pickups[0].snapshotHash;
    const moved = parseFreshAllianceCsv(csv(row({ donorCode: 'RFM360', donorName: 'Fred Meyer - Stadium' })))
      .pickups[0].snapshotHash;
    expect(moved).not.toBe(base);
  });

  test('rejects structural mismatches rather than guessing', () => {
    expect(() => parseFreshAllianceCsv(Buffer.from('Date,Period,Order #\r\n1/6/26,1-Jan,1')))
      .toThrowError(ProcurementImportError);
    expect(() => parseFreshAllianceCsv(Buffer.from(''))).toThrowError(ProcurementImportError);
    expect(() => parseFreshAllianceCsv(csv(row({ productCode: '400' })))).toThrowError(ProcurementImportError);
    expect(() => parseFreshAllianceCsv(csv(row({ category: 'PURCHASED' })))).toThrowError(ProcurementImportError);
    expect(() => parseFreshAllianceCsv(csv(row({ donorName: '' })))).toThrowError(ProcurementImportError);
  });

  test('rejects a duplicate pickup line ID', () => {
    expect(() => parseFreshAllianceCsv(csv(row(), row({ productCode: '41000' }))))
      .toThrowError(/Pickup line 1847707 appears on rows 2 and 3/);
  });

  test('rejects one pickup reference reporting two donors or two dates', () => {
    expect(() => parseFreshAllianceCsv(csv(
      row(),
      row({ pickupLineId: '1847708', donorCode: 'RFM360', donorName: 'Fred Meyer - Stadium' })
    ))).toThrowError(/reports more than one Donor Code/);

    expect(() => parseFreshAllianceCsv(csv(
      row(),
      row({ pickupLineId: '1847708', date: '1/7/26' })
    ))).toThrowError(/reports more than one Date/);
  });
});

// The authoritative corpus is the agency's real supply data and is gitignored,
// so this block runs for developers who hold the export and skips elsewhere.
// Expected values come from docs/data-management/fresh-alliance-coverage-verification.md.
const corpusPath = path.resolve(
  process.cwd(),
  '../../docs/reports/RealData/FreshFoodData/OFB_Fresh_Alliance_Pickups_2009-01-01_to_2026-07-20.csv'
);

describe.skipIf(!existsSync(corpusPath))('Fresh Alliance authoritative corpus', () => {
  test('normalizes the complete pickup history without structural failure', () => {
    const parsed = parseFreshAllianceCsv(readFileSync(corpusPath));

    expect(parsed.rowCount).toBe(3933);
    expect(parsed.pickups).toHaveLength(826);
    expect(parsed.rangeStart).toBe('2023-06-01');
    expect(parsed.rangeEnd).toBe('2026-06-30');

    const lines = parsed.pickups.flatMap((pickup) => pickup.lines);
    expect(lines).toHaveLength(3933);

    // 569,969 lb, matching the verified parity figure against the AGPCKUP subset.
    const weight = lines.reduce((total, line) => total + line.weightHundredths, 0);
    const received = lines.reduce((total, line) => total + (line.receivedWeightHundredths ?? 0), 0);
    expect(weight).toBe(56996900);
    expect(received).toBe(56996900);

    // Received equals requested on every historical row.
    expect(lines.filter((line) => !line.receivedMatchesRequested)).toHaveLength(0);

    // 29% of poundage carries no recorded valuation; it must survive as weight.
    expect(lines.filter((line) => !line.hasDonorValuation)).toHaveLength(1108);

    expect(parsed.pickups.filter((pickup) => pickup.pickupTime === null)).toHaveLength(62);

    const donors = new Set(parsed.pickups.map((pickup) => pickup.donorCode));
    expect(donors.size).toBe(7);

    const codes = new Set(parsed.warnings.map((warning) => warning.code));
    expect([...codes].sort()).toEqual(['MISSING_DONOR_VALUATION', 'UNKNOWN_PICKUP_TIME']);
  });
});
