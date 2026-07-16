// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  AnalyticsWorkspace,
  ProcurementAnalyticsWorkspace,
} from '@/components/analytics';
import { analyticsRangeFromSearchParams } from '@/components/analytics/range-control';
import type { ProcurementAnalytics } from '@/types/procurement';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const emptyAnalytics: ProcurementAnalytics = {
  dataAsOf: '2026-07-14T12:00:00.000Z',
  status: {
    hasData: false,
    latestDeliveryDate: null,
    daysSinceLatestDelivery: null,
    isStale: false,
    staleAfterDays: 30,
  },
  range: {
    preset: 'last-90-days',
    startDate: '2026-04-16',
    endDate: '2026-07-14',
    timeZone: 'America/Los_Angeles',
  },
  filters: {
    channel: null,
    acquisitionClass: null,
  },
  availableYears: [],
  summary: {
    totalWeightHundredths: 0,
    sourceOrderCount: 0,
    receivingDateCount: 0,
    medianOrderWeightHundredths: null,
    lowerQuartileOrderWeightHundredths: null,
    upperQuartileOrderWeightHundredths: null,
    medianLinesPerOrder: null,
    supplierProductCodes: 0,
    productsReceivedOnce: 0,
    productsReceivedTenOrMore: 0,
    zeroInboundLineCount: 0,
    calculatedGrossProductChargesCents: 0,
    sourceReportedProductChargesCents: 0,
    costAdjustmentsAttributable: true,
    serviceFeesCents: 0,
    grantsAppliedCents: 0,
    netRecordedCostCents: 0,
    priceMismatchLineCount: 0,
  },
  acquisitionMix: [],
  channelMix: [],
  monthlyWeight: [],
  seasonalWeight: [],
  recurrenceDistribution: [],
  productContinuity: [],
};

const { getAnalyticsMock } = vi.hoisted(() => ({ getAnalyticsMock: vi.fn() }));

vi.mock('@/services/procurement', () => ({
  procurementService: {
    getAnalytics: getAnalyticsMock,
  },
}));

vi.mock('@/services/operational-reports', () => ({
  operationalReportsService: {
    query: vi.fn(() => new Promise(() => {})),
    downloadCardCsv: vi.fn(),
    downloadRawCsv: vi.fn(),
  },
}));

describe('Analytics dataset separation', () => {
  beforeEach(() => {
    getAnalyticsMock.mockReset();
    getAnalyticsMock.mockResolvedValue(emptyAnalytics);
  });

  test('keeps Operations and Procurement in distinct tabs', () => {
    render(
      <MemoryRouter>
        <AnalyticsWorkspace />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Operations' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Procurement' })).toBeVisible();
  });

  test('restores shared date and procurement filters from the URL', async () => {
    render(
      <MemoryRouter initialEntries={['/analytics?tab=procurement&range=30d&channel=fresh_alliance']}>
        <AnalyticsWorkspace />
      </MemoryRouter>
    );

    expect(screen.getByRole('tab', { name: '30d' })).toHaveAttribute('data-state', 'active');
    await waitFor(() => expect(getAnalyticsMock).toHaveBeenCalledWith(expect.objectContaining({
      preset: 'last-30-days',
      channel: 'fresh_alliance',
    })));
  });

  test('accepts complete custom URL ranges and rejects incomplete ones', () => {
    expect(analyticsRangeFromSearchParams(new URLSearchParams(
      'range=custom&from=2026-05-01&to=2026-07-15'
    ))).toEqual({
      preset: 'custom',
      startDate: '2026-05-01',
      endDate: '2026-07-15',
    });
    expect(analyticsRangeFromSearchParams(new URLSearchParams(
      'range=custom&from=2026-05-01'
    ))).toEqual({ preset: 'last-90-days' });
  });

  test('provides a Data Management action when procurement is empty', async () => {
    render(
      <MemoryRouter>
        <ProcurementAnalyticsWorkspace />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'No procurement data yet' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Manage Procurement Data' })).toBeVisible();
  });

  test('presents order-level, channel, seasonal, pattern, and continuity analytics', async () => {
    getAnalyticsMock.mockResolvedValueOnce({
      ...emptyAnalytics,
      status: {
        ...emptyAnalytics.status,
        hasData: true,
        latestDeliveryDate: '2026-07-13',
        daysSinceLatestDelivery: 1,
      },
      availableYears: ['2026', '2025'],
      summary: {
        ...emptyAnalytics.summary,
        totalWeightHundredths: 120000,
        sourceOrderCount: 2,
        receivingDateCount: 1,
        medianOrderWeightHundredths: 60000,
        lowerQuartileOrderWeightHundredths: 50000,
        upperQuartileOrderWeightHundredths: 70000,
        medianLinesPerOrder: 4,
        supplierProductCodes: 1,
        productsReceivedOnce: 1,
        calculatedGrossProductChargesCents: 1000,
        grantsAppliedCents: 200,
        netRecordedCostCents: 800,
      },
      acquisitionMix: [
        { acquisitionClass: 'DONATED', weightHundredths: 120000 },
        { acquisitionClass: 'PURCH-DON', weightHundredths: 0 },
        { acquisitionClass: 'GOVERNMENT', weightHundredths: 0 },
        { acquisitionClass: 'PURCHASED', weightHundredths: 0 },
      ],
      channelMix: [
        { channel: 'ofb_warehouse', weightHundredths: 100000 },
        { channel: 'fresh_alliance', weightHundredths: 20000 },
      ],
      monthlyWeight: [{
        month: '2026-07',
        donatedWeightHundredths: 120000,
        purchDonWeightHundredths: 0,
        governmentWeightHundredths: 0,
        purchasedWeightHundredths: 0,
        ofbWarehouseWeightHundredths: 100000,
        freshAllianceWeightHundredths: 20000,
      }],
      seasonalWeight: [{ year: '2026', month: 7, weightHundredths: 120000 }],
      recurrenceDistribution: [{ label: 'One receipt date', productCount: 1 }],
      productContinuity: [{
        productCode: '40000',
        description: 'Fresh Alliance Bread',
        acquisitionClass: 'DONATED',
        procurementChannel: 'fresh_alliance',
        receiptDateCount: 1,
        activeMonthCount: 1,
        observedMonthSpan: 1,
        activeMonthShare: 1,
        receiptsPerActiveMonth: 1,
        totalWeightHundredths: 20000,
        averageWeightPerReceiptHundredths: 20000,
        medianGapDays: null,
        firstReceivedDate: '2026-07-13',
        lastReceivedDate: '2026-07-13',
      }],
    } satisfies ProcurementAnalytics);

    render(
      <MemoryRouter>
        <ProcurementAnalyticsWorkspace />
      </MemoryRouter>
    );

    expect(await screen.findByText('Inbound Supply Summary')).toBeVisible();
    expect(screen.getByText('Source Orders')).toBeVisible();
    expect(screen.getByText('Procurement Channels')).toBeVisible();
    expect(screen.getByText('Seasonal Inbound Weight')).toBeVisible();
    expect(screen.getByText('Procurement Pattern Matrix')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Product Continuity' })).toBeVisible();
    expect(screen.getByText('Fresh Alliance Bread')).toBeVisible();
    expect(getAnalyticsMock).toHaveBeenCalledWith(expect.objectContaining({
      preset: 'last-90-days',
    }));
  });
});
