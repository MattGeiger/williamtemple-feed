import { describe, expect, test, vi } from 'vitest';
import {
  getProcurementAnalytics,
  getProcurementDataStatus,
  OFB_HEADERS,
  parseOfbCsv,
  ProcurementImportError,
} from '../../../src/services/procurement';
import { DEFAULT_OPERATING_HOURS } from '../../../src/services/operating-hours';

const csv = (...rows: string[]) => Buffer.from([
  OFB_HEADERS.join(','),
  ...rows,
].join('\r\n'));

describe('OFB procurement import normalization', () => {
  test('preserves observed product identifiers and groups observations by source order', () => {
    const parsed = parseOfbCsv(csv(
      '6/15/26,6-Jun,806667,00070,"Bread, Buns",DONATED,1.00,206.00,$0.00,$0.00,$0.00,$0.00',
      '6/15/26,6-Jun,806667,606194,Peanut Butter,PURCH-DON,2.00,20.00,$14.15,$28.30,$0.00,$0.00',
      '6/15/26,6-Jun,806668AGPCKUP,40000,Fresh Alliance Bread,DONATED,5.00,50.00,$0.00,$0.00,$0.00,$0.00',
      '6/22/26,6-Jun,806900,8060,Rice,GOVERNMENT,1.00,195.50,$0.00,$0.00,$0.00,$0.00'
    ));

    expect(parsed.rowCount).toBe(4);
    expect(parsed.rangeStart).toBe('2026-06-15');
    expect(parsed.rangeEnd).toBe('2026-06-22');
    expect(parsed.orders).toHaveLength(3);
    expect(parsed.orders[0]).toMatchObject({ sourceOrderReference: '806667' });
    expect(parsed.orders[0].lines[0].productCode).toBe('00070');
    expect(parsed.orders[0].lines[1]).toMatchObject({
      productCode: '606194',
      procurementChannel: 'ofb_warehouse',
      quantityHundredths: 200,
      weightHundredths: 2000,
      unitPriceCents: 1415,
      sourcePriceTotalCents: 2830,
      calculatedPriceTotalCents: 2830,
      priceTotalMatches: true,
    });
    expect(parsed.orders[1].lines[0]).toMatchObject({
      productCode: '40000',
      procurementChannel: 'fresh_alliance',
      acquisitionClass: 'DONATED',
    });
    expect(parsed.orders[2].lines[0].productCode).toBe('8060');
    expect(parsed.warnings).toEqual([]);
  });

  test('imports reconcilable source anomalies with explicit warnings', () => {
    const parsed = parseOfbCsv(csv(
      '6/15/26,5-May,100,90001,Tuna,PURCHASED,14.00,140.00,$14.15,$98.10,$0.00,$0.00',
      '6/15/26,6-Jun,101,90002,Rice,PURCHASED,3.00,30.00,$30.00,$90.00,$0.00,$0.00'
    ));

    expect(parsed.orders).toHaveLength(2);
    expect(parsed.orders[0].lines[0]).toMatchObject({
      sourcePriceTotalCents: 9810,
      calculatedPriceTotalCents: 19810,
      priceTotalMatches: false,
    });
    expect(parsed.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        'PERIOD_MISMATCH',
        'PRICE_TOTAL_MISMATCH',
      ])
    );
  });

  test('rejects structural mismatches rather than guessing', () => {
    expect(() => parseOfbCsv(Buffer.from('Date,Product #\n6/15/26,00070')))
      .toThrowError(ProcurementImportError);
    expect(() => parseOfbCsv(csv(
      '6/15/26,6-Jun,806667,700,Bread,DONATED,1.00,10.00,$0.00,$0.00,$0.00,$0.00'
    ))).toThrow(/four-to-six-digit/i);
    expect(() => parseOfbCsv(csv(
      '6/15/26,6-Jun,806667,90001,Tuna,DONATED,1.00,10.00,$0.00,$0.00,$0.00,$0.00'
    ))).toThrow(/acquisition class/i);
    expect(() => parseOfbCsv(Buffer.from([0xff, 0xfe, 0xfd])))
      .toThrow(/UTF-8/i);
  });

  test('rejects one source order appearing on multiple dates in one snapshot', () => {
    expect(() => parseOfbCsv(csv(
      '6/15/26,6-Jun,806667,00070,Bread,DONATED,1.00,10.00,$0.00,$0.00,$0.00,$0.00',
      '6/22/26,6-Jun,806667,00070,Bread,DONATED,1.00,10.00,$0.00,$0.00,$0.00,$0.00'
    ))).toThrow(/multiple delivery dates/i);
  });

  test('uses a strict greater-than-30-calendar-day stale boundary', async () => {
    const findFirst = vi.fn()
      .mockResolvedValueOnce({ deliveryDate: '2026-06-14' })
      .mockResolvedValueOnce({
        id: 1,
        effectiveDate: '1970-01-01',
        timezone: 'America/Los_Angeles',
        hours: DEFAULT_OPERATING_HOURS,
        recordedAt: new Date('2026-01-01T00:00:00Z'),
      });
    const client = {
      procurementOrderRevision: { findFirst },
      operatingHoursRevision: { findFirst },
    } as never;

    const atThirtyDays = await getProcurementDataStatus(
      new Date('2026-07-15T06:00:00Z'),
      client
    );
    expect(atThirtyDays.daysSinceLatestDelivery).toBe(30);
    expect(atThirtyDays.isStale).toBe(false);

    findFirst
      .mockResolvedValueOnce({ deliveryDate: '2026-06-14' })
      .mockResolvedValueOnce({
        id: 1,
        effectiveDate: '1970-01-01',
        timezone: 'America/Los_Angeles',
        hours: DEFAULT_OPERATING_HOURS,
        recordedAt: new Date('2026-01-01T00:00:00Z'),
      });
    const atThirtyOneDays = await getProcurementDataStatus(
      new Date('2026-07-16T06:00:00Z'),
      client
    );
    expect(atThirtyOneDays.daysSinceLatestDelivery).toBe(31);
    expect(atThirtyOneDays.isStale).toBe(true);
  });

  test('keeps order, receiving-date, channel, cost, and zero-inbound semantics distinct', async () => {
    const lines = [
      {
        acquisitionClass: 'PURCHASED',
        procurementChannel: 'ofb_warehouse',
        quantityHundredths: 100,
        weightHundredths: 1000,
        calculatedPriceTotalCents: 500,
        sourcePriceTotalCents: 500,
        serviceFeeCents: 10,
        grantsAppliedCents: 100,
        priceTotalMatches: true,
        sourceDescription: 'Rice',
        product: { productCode: '90001' },
      },
      {
        acquisitionClass: 'DONATED',
        procurementChannel: 'ofb_warehouse',
        quantityHundredths: 0,
        weightHundredths: 0,
        calculatedPriceTotalCents: 0,
        sourcePriceTotalCents: 0,
        serviceFeeCents: 0,
        grantsAppliedCents: 0,
        priceTotalMatches: true,
        sourceDescription: 'Unfilled Soup',
        product: { productCode: '00070' },
      },
    ];
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ deliveryDate: '2026-01-05' }])
      .mockResolvedValueOnce([
        { sourceOrderReference: '100', deliveryDate: '2026-01-05', lines },
        {
          sourceOrderReference: '101AGPCKUP',
          deliveryDate: '2026-01-05',
          lines: [{
            acquisitionClass: 'DONATED',
            procurementChannel: 'fresh_alliance',
            quantityHundredths: 100,
            weightHundredths: 200,
            calculatedPriceTotalCents: 0,
            sourcePriceTotalCents: 0,
            serviceFeeCents: 0,
            grantsAppliedCents: 0,
            priceTotalMatches: true,
            sourceDescription: 'Fresh Alliance Bread',
            product: { productCode: '40000' },
          }],
        },
      ]);
    const client = {
      procurementOrderRevision: {
        findMany,
        findFirst: vi.fn().mockResolvedValue({ deliveryDate: '2026-01-05' }),
      },
      operatingHoursRevision: {
        findFirst: vi.fn().mockResolvedValue({
          id: 1,
          effectiveDate: '1970-01-01',
          timezone: 'America/Los_Angeles',
          hours: DEFAULT_OPERATING_HOURS,
          recordedAt: new Date('2026-01-01T00:00:00Z'),
        }),
      },
    } as never;

    const result = await getProcurementAnalytics(
      {},
      new Date('2026-01-06T20:00:00Z'),
      client
    );

    expect(result.summary).toMatchObject({
      totalWeightHundredths: 1200,
      sourceOrderCount: 2,
      receivingDateCount: 1,
      supplierProductCodes: 2,
      zeroInboundLineCount: 1,
      calculatedGrossProductChargesCents: 500,
      costAdjustmentsAttributable: true,
      serviceFeesCents: 10,
      grantsAppliedCents: 100,
      netRecordedCostCents: 410,
    });
    expect(result.channelMix).toEqual([
      { channel: 'ofb_warehouse', weightHundredths: 1000 },
      { channel: 'fresh_alliance', weightHundredths: 200 },
    ]);
    expect(result.productContinuity.map((product) => product.productCode)).toEqual([
      '90001',
      '40000',
    ]);
    expect(findMany.mock.calls[1][0].where.deliveryDate).toEqual({
      gte: '2026-01-05',
      lte: '2026-01-06',
    });

    const filteredClient = {
      procurementOrderRevision: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ deliveryDate: '2026-01-05' }])
          .mockResolvedValueOnce([
            { sourceOrderReference: '100', deliveryDate: '2026-01-05', lines: [lines[0]] },
          ]),
        findFirst: vi.fn().mockResolvedValue({ deliveryDate: '2026-01-05' }),
      },
      operatingHoursRevision: {
        findFirst: vi.fn().mockResolvedValue({
          id: 1,
          effectiveDate: '1970-01-01',
          timezone: 'America/Los_Angeles',
          hours: DEFAULT_OPERATING_HOURS,
          recordedAt: new Date('2026-01-01T00:00:00Z'),
        }),
      },
    } as never;
    const filtered = await getProcurementAnalytics(
      { channel: 'ofb_warehouse' },
      new Date('2026-01-06T20:00:00Z'),
      filteredClient
    );
    expect(filtered.summary).toMatchObject({
      calculatedGrossProductChargesCents: 500,
      costAdjustmentsAttributable: false,
      serviceFeesCents: null,
      grantsAppliedCents: null,
      netRecordedCostCents: null,
    });
  });
});
