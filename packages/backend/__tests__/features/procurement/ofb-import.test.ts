import { describe, expect, test, vi } from 'vitest';
import {
  getProcurementAnalytics,
  getProcurementDataStatus,
  importOfbCsv,
  OFB_HEADERS,
  parseOfbCsv,
  ProcurementImportError,
} from '../../../src/services/procurement';
import { DEFAULT_OPERATING_HOURS } from '../../../src/services/operating-hours';

const csv = (...rows: string[]) => Buffer.from([
  OFB_HEADERS.join(','),
  ...rows,
].join('\r\n'));

const emptyCoverage = () => ({
  _min: { deliveryDate: null },
  _max: { deliveryDate: null },
  _count: { _all: 0 },
});

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
    expect(parsed.orders[0]).toMatchObject({
      sourceOrderReference: '806667',
      eventKind: 'ofb_warehouse_order',
    });
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
    expect(parsed.orders[1]).toMatchObject({ eventKind: 'fresh_alliance_receipt' });
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

  test('retains deprecated supplier codes with a calm provenance warning', () => {
    const parsed = parseOfbCsv(csv(
      `5/22/23,5-May,679748,41040,"[DON'T USE] Dairy, Milk ( Case )",DONATED,14.00,252.00,$0.00,$0.00,$0.00,$0.00`
    ));

    expect(parsed.orders[0]).toMatchObject({
      sourceOrderReference: '679748',
      eventKind: 'ofb_warehouse_order',
    });
    expect(parsed.orders[0].lines[0]).toMatchObject({
      productCode: '41040',
      procurementChannel: 'ofb_warehouse',
      weightHundredths: 25200,
    });
    expect(parsed.warnings).toEqual([
      expect.objectContaining({
        code: 'DEPRECATED_PRODUCT_CODE',
        rowNumbers: [2],
      }),
    ]);
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

  test('uses the source reference—not product-code prefix—to classify the event and every line', () => {
    const parsed = parseOfbCsv(csv(
      '6/15/26,6-Jun,806667,00070,Bread,DONATED,1.00,10.00,$0.00,$0.00,$0.00,$0.00',
      '6/15/26,6-Jun,806667,40000,Fresh Alliance Bread,DONATED,5.00,50.00,$0.00,$0.00,$0.00,$0.00'
    ));
    expect(parsed.orders[0]).toMatchObject({
      sourceOrderReference: '806667',
      eventKind: 'ofb_warehouse_order',
    });
    expect(parsed.orders[0].lines.map((line) => line.procurementChannel)).toEqual([
      'ofb_warehouse',
      'ofb_warehouse',
    ]);
    expect(parsed.orders[0].legacySnapshotHash).not.toBe(parsed.orders[0].snapshotHash);
  });

  test('accepts a matching pre-correction snapshot hash as a duplicate', async () => {
    const buffer = csv(
      '6/15/26,6-Jun,806667,00070,Bread,DONATED,1.00,10.00,$0.00,$0.00,$0.00,$0.00',
      '6/15/26,6-Jun,806667,40000,Fresh Alliance Bread,DONATED,5.00,50.00,$0.00,$0.00,$0.00,$0.00'
    );
    const parsed = parseOfbCsv(buffer);
    const tx = {
      procurementOrderRevision: {
        findMany: vi.fn().mockResolvedValue([{
          sourceOrderReference: '806667',
          snapshotHash: parsed.orders[0].legacySnapshotHash,
        }]),
      },
    };
    const client = {
      $transaction: vi.fn(async (operation: (value: typeof tx) => unknown) => operation(tx)),
    } as never;

    await expect(importOfbCsv(buffer, undefined, client)).resolves.toMatchObject({
      outcome: 'duplicate',
      orderCount: 0,
      skippedOrderCount: 1,
    });
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
      procurementOrderRevision: { findFirst, aggregate: vi.fn(async () => emptyCoverage()) },
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
        {
          sourceOrderReference: '100',
          eventKind: 'ofb_warehouse_order',
          deliveryDate: '2026-01-05',
          lines,
        },
        {
          sourceOrderReference: '101AGPCKUP',
          eventKind: 'fresh_alliance_receipt',
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
        aggregate: vi.fn(async () => emptyCoverage()),
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
      sourceEventCount: 2,
      warehouseOrderCount: 1,
      freshAllianceReceiptCount: 1,
      receivingDateCount: 1,
      medianReceivingGapDays: null,
      warehouseProductCodes: 1,
      freshAllianceCategoryCodes: 1,
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
    // Seasonal weight keeps channels apart in addition to the combined series,
    // so Seasonal Inbound Weight can offer a per-channel breakdown without a
    // second query.
    expect(result.seasonalWeight).toEqual([
      { year: '2026', month: 1, weightHundredths: 1200 },
    ]);
    // Sorted by the composite key "year-month|channel", so fresh_alliance
    // sorts before ofb_warehouse within the same month.
    expect(result.seasonalChannelWeight).toEqual([
      { year: '2026', month: 1, channel: 'fresh_alliance', weightHundredths: 200 },
      { year: '2026', month: 1, channel: 'ofb_warehouse', weightHundredths: 1000 },
    ]);
    expect(result.warehouseProducts.map((product) => product.productCode)).toEqual([
      '90001',
    ]);
    expect(result.paidProducts).toEqual([
      expect.objectContaining({
        productCode: '90001',
        description: 'Rice',
        receiptDateCount: 1,
        totalSpendCents: 500,
        paidWeightHundredths: 1000,
        costPerPaidPoundCents: 50,
      }),
    ]);
    expect(result.warehouseProducts[0]).toMatchObject({
      receiptDateCount: 1,
      totalWeightHundredths: 1000,
      averageWeightPerReceiptHundredths: 1000,
    });
    expect(result.freshAllianceCategories).toEqual([
      expect.objectContaining({
        productCode: '40000',
        receiptEventCount: 1,
        receivingDateCount: 1,
        totalWeightHundredths: 200,
      }),
    ]);
    expect(findMany.mock.calls[1][0].where.deliveryDate).toEqual({
      gte: '2026-01-05',
      lte: '2026-01-06',
    });

    const filteredFindMany = vi.fn()
      .mockResolvedValueOnce([
        { deliveryDate: '2025-12-01' },
        { deliveryDate: '2026-01-05' },
      ])
      .mockResolvedValueOnce([
        {
          sourceOrderReference: '100',
          eventKind: 'ofb_warehouse_order',
          deliveryDate: '2026-01-05',
          lines: [lines[0]],
        },
      ]);
    const filteredClient = {
      procurementOrderRevision: {
        findMany: filteredFindMany,
        findFirst: vi.fn().mockResolvedValue({ deliveryDate: '2026-01-05' }),
        aggregate: vi.fn(async () => emptyCoverage()),
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
      costAdjustmentsAttributable: true,
      serviceFeesCents: 10,
      grantsAppliedCents: 100,
      netRecordedCostCents: 410,
    });
    expect(filtered.warehouseProducts[0]).toMatchObject({
      receiptDateCount: 1,
      totalWeightHundredths: 1000,
    });
    expect(filteredFindMany.mock.calls[1][0]).toMatchObject({
      where: {
        lines: { some: { procurementChannel: 'ofb_warehouse' } },
      },
      include: {
        lines: { where: { procurementChannel: 'ofb_warehouse' } },
      },
    });
  });
});
