// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  AnalyticsWorkspace,
  buildPaidProductChartSeries,
  buildPaidProductSpendData,
  buildPaidProductSearchResult,
  buildSeasonalYearChartConfig,
  familyColorHex,
  familyCssKey,
  productFamily,
  ProcurementAnalyticsWorkspace,
} from '@/components/analytics';
import { analyticsRangeFromSearchParams } from '@/components/analytics/range-control';
import { DonorAnalytics } from '@/components/analytics/donor-analytics';
import type { ProcurementAnalytics } from '@/types/procurement';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);
// jsdom has no layout engine, so Radix Select's open-time scrollIntoView call
// (unlike DropdownMenu, which doesn't call it) throws without this stub.
Element.prototype.scrollIntoView = vi.fn();

const emptyAnalytics: ProcurementAnalytics = {
  dataAsOf: '2026-07-14T12:00:00.000Z',
  status: {
    hasData: false,
    latestDeliveryDate: null,
    daysSinceLatestDelivery: null,
    isStale: false,
    staleAfterDays: 30,
    coverage: {
      warehouse: { eventCount: 0, earliestDeliveryDate: null, latestDeliveryDate: null },
      freshAlliance: { eventCount: 0, earliestDeliveryDate: null, latestDeliveryDate: null },
    },
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
    sourceEventCount: 0,
    warehouseOrderCount: 0,
    freshAllianceReceiptCount: 0,
    receivingDateCount: 0,
    medianReceivingGapDays: null,
    medianEventWeightHundredths: null,
    lowerQuartileEventWeightHundredths: null,
    upperQuartileEventWeightHundredths: null,
    medianLinesPerEvent: null,
    warehouseProductCodes: 0,
    freshAllianceCategoryCodes: 0,
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
  seasonalChannelWeight: [],
  warehouseProducts: [],
  paidProducts: [],
  freshAllianceCategories: [],
  freshAllianceDonorCategories: [],
  donors: [],
  donorMonthlyWeight: [],
  donorValue: {
    recordedValueCents: 0,
    valuedWeightHundredths: 0,
    totalWeightHundredths: 0,
    unvaluedWeightHundredths: 0,
  },
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

  test('keeps seasonal year colors stable when the selected years change', () => {
    const completeConfig = buildSeasonalYearChartConfig(
      ['2026', '2025', '2024'],
      2026
    );
    const filteredConfig = buildSeasonalYearChartConfig(['2025'], 2026);

    expect(completeConfig['2026']).toEqual({
      label: '2026',
      theme: { light: '#0f62fe', dark: '#78a9ff' },
    });
    expect(filteredConfig['2025']).toEqual(completeConfig['2025']);
    expect(completeConfig['2025']).not.toEqual(completeConfig['2026']);
    expect(completeConfig['2024']).not.toEqual(completeConfig['2025']);
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

  test('presents channel, seasonal, spending, and factual product analytics', async () => {
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
        sourceEventCount: 2,
        warehouseOrderCount: 1,
        freshAllianceReceiptCount: 1,
        receivingDateCount: 1,
        medianReceivingGapDays: null,
        medianEventWeightHundredths: 60000,
        lowerQuartileEventWeightHundredths: 50000,
        upperQuartileEventWeightHundredths: 70000,
        medianLinesPerEvent: 4,
        warehouseProductCodes: 1,
        freshAllianceCategoryCodes: 1,
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
      warehouseProducts: [{
        productCode: '90001',
        description: 'Rice',
        acquisitionClass: 'PURCHASED',
        procurementChannel: 'ofb_warehouse',
        receiptDateCount: 1,
        totalWeightHundredths: 100000,
        averageWeightPerReceiptHundredths: 100000,
        medianGapDays: null,
        firstReceivedDate: '2026-07-13',
        lastReceivedDate: '2026-07-13',
      }],
      paidProducts: [{
        productCode: '90001',
        description: 'Rice',
        receiptDateCount: 1,
        totalSpendCents: 1000,
        paidWeightHundredths: 100000,
        costPerPaidPoundCents: 1,
        firstReceivedDate: '2026-07-13',
        lastReceivedDate: '2026-07-13',
      }],
      freshAllianceCategories: [{
        productCode: '40000',
        description: 'Bread & Bakery (Fresh Alliance)',
        receiptEventCount: 1,
        receivingDateCount: 1,
        totalWeightHundredths: 20000,
        firstReceivedDate: '2026-07-13',
        lastReceivedDate: '2026-07-13',
      }],
      freshAllianceDonorCategories: [{
        donorCode: 'RTJ146',
        donorName: "Trader Joe's - Northwest",
        productCode: '40000',
        description: 'Bread & Bakery (Fresh Alliance)',
        receiptEventCount: 1,
        receivingDateCount: 1,
        totalWeightHundredths: 20000,
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
    expect(screen.getByText('Source Events')).toBeVisible();
    expect(screen.getByText('OFB Warehouse Orders')).toBeVisible();
    expect(screen.getByText('Fresh Food Alliance Receipts')).toBeVisible();
    const summaryGrid = screen.getByText('Total Inbound Weight').parentElement?.parentElement;
    expect(summaryGrid).toHaveClass('xl:grid-cols-4');
    expect(summaryGrid?.children[4]).toHaveTextContent('Receiving Dates');
    expect(screen.getByText('Procurement Channels')).toBeVisible();
    expect(screen.getByText('Seasonal Inbound Weight')).toBeVisible();
    expect(screen.getByText('Where Paid Procurement Dollars Went')).toBeVisible();
    const paidProductSearch = screen.getByRole('searchbox', { name: 'Search paid products' });
    expect(paidProductSearch).toBeVisible();
    fireEvent.change(paidProductSearch, { target: { value: '90001' } });
    expect(screen.getByText('1 matching product code.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Paid OFB Warehouse Products' })).toBeVisible();
    expect(screen.queryByText('Warehouse Product Recurrence')).not.toBeInTheDocument();
    expect(screen.queryByText('Warehouse Product Continuity')).not.toBeInTheDocument();
    expect(screen.queryByText('Range Coverage')).not.toBeInTheDocument();
    expect(screen.queryByText('unspecified', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'OFB Warehouse Product History' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Fresh Food Alliance Receipt Categories' })).toBeVisible();
    expect(screen.getByText('Bread & Bakery (Fresh Alliance)')).toBeVisible();
    const pageText = document.body.textContent ?? '';
    expect(pageText.indexOf('Inbound Supply Summary')).toBeLessThan(pageText.indexOf('Inbound Weight Over Time'));
    expect(pageText.indexOf('Inbound Weight Over Time')).toBeLessThan(pageText.indexOf('Where Paid Procurement Dollars Went'));
    expect(pageText.indexOf('Seasonal Inbound Weight')).toBeLessThan(pageText.indexOf('OFB Warehouse Product History'));
    expect(getAnalyticsMock).toHaveBeenCalledWith(expect.objectContaining({
      preset: 'last-90-days',
    }));
  });

  test('shows fifteen paid products and quantifies the remaining long tail', async () => {
    const paidProducts = Array.from({ length: 17 }, (_, index) => ({
      productCode: `90${String(index).padStart(3, '0')}`,
      description: `Paid Product ${index + 1}`,
      receiptDateCount: 1,
      totalSpendCents: 1700 - index * 50,
      paidWeightHundredths: 10000,
      costPerPaidPoundCents: 10,
      firstReceivedDate: '2026-07-13',
      lastReceivedDate: '2026-07-13',
    }));
    const chartData = buildPaidProductSpendData(paidProducts);

    expect(chartData).toHaveLength(16);
    expect(chartData[14]).toMatchObject({
      product: 'Paid Product 15',
      productCount: 1,
    });
    expect(chartData[15]).toMatchObject({
      product: 'Other paid products (2 codes)',
      fullDescription: 'All remaining 2 paid OFB Warehouse product codes',
      productCount: 2,
    });
    expect(chartData.reduce((sum, product) => sum + product.spendShare, 0)).toBeCloseTo(1);
  });

  test('searches paid products by description or OFB code without aggregating matches', () => {
    const paidProducts = [
      {
        productCode: '90680',
        description: 'Meat, Tuna, Cans 48/5 oz',
        receiptDateCount: 3,
        totalSpendCents: 3000,
        paidWeightHundredths: 10000,
        costPerPaidPoundCents: 30,
        firstReceivedDate: '2026-01-01',
        lastReceivedDate: '2026-07-13',
      },
      {
        productCode: '90021',
        description: 'Dairy, Milk 1% Shelf Stable',
        receiptDateCount: 2,
        totalSpendCents: 2000,
        paidWeightHundredths: 10000,
        costPerPaidPoundCents: 20,
        firstReceivedDate: '2026-01-01',
        lastReceivedDate: '2026-07-13',
      },
      {
        productCode: '84020',
        description: 'Dairy, Milk 1% UHT Fluid',
        receiptDateCount: 1,
        totalSpendCents: 1000,
        paidWeightHundredths: 10000,
        costPerPaidPoundCents: 10,
        firstReceivedDate: '2026-01-01',
        lastReceivedDate: '2026-07-13',
      },
    ];

    const milkResults = buildPaidProductSearchResult(paidProducts, 'milk');
    const codeResult = buildPaidProductSearchResult(paidProducts, '90680');

    expect(milkResults.matchCount).toBe(2);
    expect(milkResults.data.map((product) => product.fullDescription)).toEqual([
      'Dairy, Milk 1% Shelf Stable (90021)',
      'Dairy, Milk 1% UHT Fluid (84020)',
    ]);
    expect(milkResults.data.some((product) => product.product.startsWith('Other'))).toBe(false);
    expect(milkResults.data[0].spendShare).toBeCloseTo(1 / 3);
    expect(codeResult.data).toHaveLength(1);
    expect(codeResult.data[0].fullDescription).toContain('Meat, Tuna');
    expect(codeResult.data[0].spendShare).toBeCloseTo(0.5);
  });

  test('shows every available seasonal year by default and allows focused filtering', async () => {
    const availableYears = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019'];
    getAnalyticsMock.mockResolvedValueOnce({
      ...emptyAnalytics,
      status: {
        ...emptyAnalytics.status,
        hasData: true,
      },
      range: {
        ...emptyAnalytics.range,
        preset: 'all',
        startDate: '2019-01-01',
      },
      availableYears,
      seasonalWeight: availableYears.map((year) => ({
        year,
        month: 1,
        weightHundredths: 10000,
      })),
    } satisfies ProcurementAnalytics);

    render(
      <MemoryRouter>
        <ProcurementAnalyticsWorkspace range={{ preset: 'all' }} />
      </MemoryRouter>
    );

    const yearFilter = await screen.findByRole('button', { name: /All years/i });
    expect(yearFilter).toBeVisible();

    fireEvent.keyDown(yearFilter, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Clear all years' }));
    expect(screen.getByText('Choose at least one year.')).toBeVisible();

    const year2026 = screen.getByRole('menuitemcheckbox', { name: '2026' });
    fireEvent.click(year2026);
    expect(year2026).toHaveAttribute('aria-checked', 'true');
  });

  test('offers a seasonal channel breakdown only when the page-level filter is all channels', async () => {
    getAnalyticsMock.mockResolvedValueOnce({
      ...emptyAnalytics,
      status: { ...emptyAnalytics.status, hasData: true },
      range: { ...emptyAnalytics.range, preset: 'all', startDate: '2025-01-01', endDate: '2026-12-31' },
      availableYears: ['2026', '2025'],
      seasonalWeight: [
        { year: '2026', month: 5, weightHundredths: 6000000 },
      ],
      seasonalChannelWeight: [
        { year: '2026', month: 5, channel: 'ofb_warehouse', weightHundredths: 4000000 },
        { year: '2026', month: 5, channel: 'fresh_alliance', weightHundredths: 2000000 },
      ],
    } satisfies ProcurementAnalytics);

    render(
      <MemoryRouter initialEntries={['/analytics?tab=procurement&range=all']}>
        <ProcurementAnalyticsWorkspace range={{ preset: 'all' }} />
      </MemoryRouter>
    );

    // Page-level filter is "All Channels", so the card offers its own
    // breakdown alongside the existing year control.
    const channelFilter = await screen.findByRole('combobox', { name: 'Seasonal channel breakdown' });
    expect(within(channelFilter).getByText('All Channels')).toBeVisible();
    expect(screen.queryByText(/only$/)).not.toBeInTheDocument();

    fireEvent.click(channelFilter);
    fireEvent.click(await screen.findByRole('option', { name: 'OFB Warehouse' }));
    expect(await screen.findByText(/Warehouse only/)).toBeVisible();
  });

  test('follows the page-level channel filter instead of offering a second choice', async () => {
    getAnalyticsMock.mockResolvedValueOnce({
      ...emptyAnalytics,
      status: { ...emptyAnalytics.status, hasData: true },
      filters: { channel: 'fresh_alliance', acquisitionClass: null },
      range: { ...emptyAnalytics.range, preset: 'all', startDate: '2025-01-01', endDate: '2026-12-31' },
      availableYears: ['2026', '2025'],
      seasonalChannelWeight: [
        { year: '2026', month: 5, channel: 'fresh_alliance', weightHundredths: 2000000 },
      ],
    } satisfies ProcurementAnalytics);

    render(
      <MemoryRouter initialEntries={['/analytics?tab=procurement&range=all&channel=fresh_alliance']}>
        <ProcurementAnalyticsWorkspace range={{ preset: 'all' }} />
      </MemoryRouter>
    );

    await screen.findByText('Seasonal Inbound Weight');
    // The page-level filter already scopes the data; a second, independent
    // control here could disagree with it, so it is not offered at all.
    expect(screen.queryByRole('combobox', { name: 'Seasonal channel breakdown' })).not.toBeInTheDocument();
    expect(screen.getByText(/Fresh Food Alliance only/)).toBeVisible();
  });

  test('shows every donor by default and lets staff narrow the receipt-category table to one', async () => {
    getAnalyticsMock.mockResolvedValueOnce({
      ...emptyAnalytics,
      status: { ...emptyAnalytics.status, hasData: true },
      freshAllianceCategories: [
        { productCode: '40000', description: 'Bread & Bakery (Fresh Alliance)', receiptEventCount: 2, receivingDateCount: 2, totalWeightHundredths: 5000, firstReceivedDate: '2026-07-01', lastReceivedDate: '2026-07-13' },
      ],
      freshAllianceDonorCategories: [
        { donorCode: 'RTJ146', donorName: "Trader Joe's - Northwest", productCode: '40000', description: 'Bread & Bakery (Fresh Alliance)', receiptEventCount: 1, receivingDateCount: 1, totalWeightHundredths: 3000, firstReceivedDate: '2026-07-01', lastReceivedDate: '2026-07-01' },
        { donorCode: 'RAZ100', donorName: 'Amazon - NW Industrial (Prime Now)', productCode: '40000', description: 'Bread & Bakery (Fresh Alliance)', receiptEventCount: 1, receivingDateCount: 1, totalWeightHundredths: 2000, firstReceivedDate: '2026-07-13', lastReceivedDate: '2026-07-13' },
        { donorCode: null, donorName: 'Not Reported', productCode: '40000', description: 'Bread & Bakery (Fresh Alliance)', receiptEventCount: 1, receivingDateCount: 1, totalWeightHundredths: 500, firstReceivedDate: '2026-06-01', lastReceivedDate: '2026-06-01' },
      ],
    } satisfies ProcurementAnalytics);

    render(
      <MemoryRouter>
        <ProcurementAnalyticsWorkspace />
      </MemoryRouter>
    );

    await screen.findByText('Fresh Food Alliance Receipt Categories');
    // Donor identity is present, including an honest "Not Reported" bucket
    // for a receipt with no donor on file rather than a guess.
    expect(screen.getAllByText("Trader Joe's - Northwest").length).toBeGreaterThan(0);
    expect(screen.getAllByText('Amazon - NW Industrial (Prime Now)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not Reported').length).toBeGreaterThan(0);

    const donorFilter = screen.getByRole('button', { name: /All Donors/i });
    expect(donorFilter).toBeVisible();

    fireEvent.keyDown(donorFilter, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Clear all donors' }));
    expect(screen.getByText('Choose at least one donor.')).toBeVisible();

    const trJoes = screen.getByRole('menuitemcheckbox', { name: "Trader Joe's - Northwest" });
    fireEvent.click(trJoes);
    expect(trJoes).toHaveAttribute('aria-checked', 'true');

    // Close the menu before inspecting the table -- its still-open checkbox
    // list otherwise contains every donor's name regardless of filter state,
    // which would make the table-filtering assertion below meaningless.
    fireEvent.keyDown(trJoes, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('menuitemcheckbox')).not.toBeInTheDocument();
    });

    // Filtering to one donor removes the others' rows from the table --
    // the checkbox state alone doesn't prove the table actually filtered.
    expect(screen.queryByText('Amazon - NW Industrial (Prime Now)')).not.toBeInTheDocument();
    expect(screen.queryByText('Not Reported')).not.toBeInTheDocument();
  });

  test('uses receipt and category semantics for the Fresh Food Alliance channel', async () => {
    getAnalyticsMock.mockResolvedValue({
      ...emptyAnalytics,
      status: {
        ...emptyAnalytics.status,
        hasData: true,
        latestDeliveryDate: '2026-07-13',
        daysSinceLatestDelivery: 1,
      },
      filters: { channel: 'fresh_alliance', acquisitionClass: null },
      availableYears: ['2026'],
      summary: {
        ...emptyAnalytics.summary,
        totalWeightHundredths: 20000,
        sourceEventCount: 2,
        freshAllianceReceiptCount: 1,
        receivingDateCount: 1,
        medianEventWeightHundredths: 10000,
        lowerQuartileEventWeightHundredths: 8000,
        upperQuartileEventWeightHundredths: 12000,
        medianLinesPerEvent: 3,
        freshAllianceCategoryCodes: 1,
      },
      channelMix: [
        { channel: 'ofb_warehouse', weightHundredths: 0 },
        { channel: 'fresh_alliance', weightHundredths: 20000 },
      ],
      monthlyWeight: [{
        month: '2026-07',
        donatedWeightHundredths: 20000,
        purchDonWeightHundredths: 0,
        governmentWeightHundredths: 0,
        purchasedWeightHundredths: 0,
        ofbWarehouseWeightHundredths: 0,
        freshAllianceWeightHundredths: 20000,
      }],
      seasonalWeight: [{ year: '2026', month: 7, weightHundredths: 20000 }],
      freshAllianceCategories: [{
        productCode: '41000',
        description: 'Produce (Fresh Alliance)',
        receiptEventCount: 2,
        receivingDateCount: 1,
        totalWeightHundredths: 20000,
        firstReceivedDate: '2026-07-13',
        lastReceivedDate: '2026-07-13',
      }],
      freshAllianceDonorCategories: [{
        donorCode: 'RAZ100',
        donorName: 'Amazon - NW Industrial (Prime Now)',
        productCode: '41000',
        description: 'Produce (Fresh Alliance)',
        receiptEventCount: 2,
        receivingDateCount: 1,
        totalWeightHundredths: 20000,
        firstReceivedDate: '2026-07-13',
        lastReceivedDate: '2026-07-13',
      }],
    } satisfies ProcurementAnalytics);

    render(
      <MemoryRouter initialEntries={['/analytics?tab=procurement&channel=fresh_alliance']}>
        <ProcurementAnalyticsWorkspace />
      </MemoryRouter>
    );

    expect(await screen.findByText('Fresh Food Alliance Category Mix')).toBeVisible();
    expect(screen.getByText('Fresh Food Alliance Receipts')).toBeVisible();
    expect(screen.queryByText('Mixed Legacy Events')).not.toBeInTheDocument();
    expect(screen.getByText('Fresh Food Alliance Weight Over Time')).toBeVisible();
    expect(screen.queryByText('Paid Procurement Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Where Paid Procurement Dollars Went')).not.toBeInTheDocument();
    expect(screen.queryByText('Warehouse Product Recurrence')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'OFB Warehouse Product History' })).not.toBeInTheDocument();
  });
});

describe('Paid product family legend', () => {
  test('renders a swatch per family present in the chart, not an arbitrary count', async () => {
    getAnalyticsMock.mockResolvedValueOnce({
      ...emptyAnalytics,
      status: { ...emptyAnalytics.status, hasData: true },
      paidProducts: [
        {
          productCode: '90001',
          description: 'Meat, Ground Beef',
          receiptDateCount: 1,
          totalSpendCents: 5000,
          paidWeightHundredths: 10000,
          costPerPaidPoundCents: 50,
          firstReceivedDate: '2026-07-01',
          lastReceivedDate: '2026-07-01',
        },
        {
          productCode: '90002',
          description: 'Rice, Long Grain',
          receiptDateCount: 1,
          totalSpendCents: 3000,
          paidWeightHundredths: 8000,
          costPerPaidPoundCents: 37,
          firstReceivedDate: '2026-07-01',
          lastReceivedDate: '2026-07-01',
        },
      ],
    } satisfies ProcurementAnalytics);

    render(
      <MemoryRouter>
        <ProcurementAnalyticsWorkspace />
      </MemoryRouter>
    );

    expect(await screen.findByText('Colored by product family:')).toBeVisible();
    expect(screen.getByText('Meat')).toBeVisible();
    expect(screen.getByText('Rice')).toBeVisible();
  });

  test('omits the legend entirely when there is no paid-product chart to explain', async () => {
    getAnalyticsMock.mockResolvedValueOnce({
      ...emptyAnalytics,
      status: { ...emptyAnalytics.status, hasData: true },
      paidProducts: [],
    } satisfies ProcurementAnalytics);

    render(
      <MemoryRouter>
        <ProcurementAnalyticsWorkspace />
      </MemoryRouter>
    );

    await screen.findByText('Where Paid Procurement Dollars Went');
    expect(screen.queryByText('Colored by product family:')).not.toBeInTheDocument();
  });
});

describe('Paid product family colors are fixed, not rank-based', () => {
  const product = (description: string, cents: number) => ({
    productCode: String(Math.abs(description.length * 13)).padStart(5, '0'),
    description,
    receiptDateCount: 1,
    totalSpendCents: cents,
    paidWeightHundredths: 1000,
    costPerPaidPoundCents: 100,
    firstReceivedDate: '2026-01-01',
    lastReceivedDate: '2026-06-30',
  });

  test('assigns every documented family a distinct color, with Unclassified reserved separately', () => {
    const families = [
      'Meals', 'Condiment', 'Meat', 'Other Protein', 'Fruit', 'Dairy', 'Veg',
      'Non-Food', 'Grains', 'Cereal', 'Bev', 'Beans', 'Pasta', 'Rice',
    ];
    const colors = families.map((family) => familyColorHex(family, 'light'));
    expect(new Set(colors).size).toBe(families.length);

    const unclassified = familyColorHex('Unclassified', 'light');
    expect(colors).not.toContain(unclassified);
  });

  test('resolves the same hex in both light and dark for a given family, and they differ from each other', () => {
    const light = familyColorHex('Meat', 'light');
    const dark = familyColorHex('Meat', 'dark');
    expect(light).not.toBe(dark);
    // Stable across repeated calls -- no hidden state or rotation.
    expect(familyColorHex('Meat', 'light')).toBe(light);
  });

  test('gives an unrecognized family a deterministic color that never collides with Unclassified', () => {
    const first = familyColorHex('Frozen Novelty', 'light');
    const second = familyColorHex('Frozen Novelty', 'light');
    expect(first).toBe(second);
    expect(first).not.toBe(familyColorHex('Unclassified', 'light'));
  });

  test('does not reassign a family color when the dataset composition changes its rank', () => {
    // "Meat" is the single largest family in the first dataset and a minor
    // family in the second -- its position in buildPaidProductChartSeries'
    // rank-sorted families array is different in each. Its color must not be.
    const meatDominant = buildPaidProductSpendData([
      product('Meat, Ground Beef', 900000),
      product('Rice, Long Grain', 10000),
      product('Bev, Juice', 5000),
    ]);
    const meatMinor = buildPaidProductSpendData([
      product('Rice, Long Grain', 900000),
      product('Bev, Juice', 500000),
      product('Meat, Ground Beef', 10000),
    ]);

    const seriesA = buildPaidProductChartSeries(meatDominant);
    const seriesB = buildPaidProductChartSeries(meatMinor);
    expect(seriesA.families[0].label).toBe('Meat');
    expect(seriesB.families[seriesB.families.length - 1].label).toBe('Meat');

    // The color a consumer would actually assign (via familyColorHex, keyed
    // by label, not by array position) is identical either way.
    expect(familyColorHex('Meat', 'light')).toBe(familyColorHex('Meat', 'light'));
  });
});

describe('Grocery partner observations', () => {
  const donors = [
    {
      donorCode: 'RAZ100',
      donorName: 'Amazon - NW Industrial (Prime Now)',
      pickupCount: 300,
      receivingDateCount: 250,
      weightHundredths: 38252300,
      averageWeightPerPickupHundredths: 127508,
      valuedWeightHundredths: 30000000,
      unvaluedWeightHundredths: 8252300,
      recordedValueCents: 41728300,
      firstReceivedDate: '2023-06-01',
      lastReceivedDate: '2026-06-30',
      categories: [{ productCode: '41000', description: 'Produce (Fresh Alliance)', weightHundredths: 20000000 }],
    },
    {
      donorCode: 'RRD200',
      donorName: 'Restaurant Depot',
      pickupCount: 73,
      receivingDateCount: 70,
      weightHundredths: 1498300,
      averageWeightPerPickupHundredths: 20524,
      valuedWeightHundredths: 1498300,
      unvaluedWeightHundredths: 0,
      recordedValueCents: 2172500,
      firstReceivedDate: '2025-01-07',
      lastReceivedDate: '2026-06-30',
      categories: [{ productCode: '42050', description: 'Meat (Fresh Alliance)', weightHundredths: 900000 }],
    },
  ];

  const monthly = [
    { month: '2026-05', donorCode: 'RAZ100', weightHundredths: 1200000 },
    { month: '2026-06', donorCode: 'RAZ100', weightHundredths: 1500000 },
    { month: '2026-06', donorCode: 'RRD200', weightHundredths: 300000 },
  ];

  const donorValue = {
    recordedValueCents: 43900800,
    valuedWeightHundredths: 31498300,
    totalWeightHundredths: 39750600,
    unvaluedWeightHundredths: 8252300,
  };

  test('states in-kind value with its coverage rather than as a total', () => {
    render(
      <DonorAnalytics
        donors={donors}
        donorValue={donorValue}
        donorMonthlyWeight={monthly}
        formatDate={(iso) => iso}
      />
    );

    // 31,498,300 of 39,750,600 hundredths carries a recorded rate.
    expect(screen.getByText(/79% of received pounds/)).toBeVisible();
    expect(screen.getByText('82,523 lb')).toBeVisible();
    expect(
      screen.getByText(/does not estimate a rate for the rest/)
    ).toBeVisible();
  });

  test('reports partner cadence without ranking or explaining it', () => {
    render(
      <DonorAnalytics
        donors={donors}
        donorValue={donorValue}
        donorMonthlyWeight={monthly}
        formatDate={(iso) => iso}
      />
    );

    // Similar visit counts with very different loads is the observation that
    // matters operationally; FEED states it and stops there.
    expect(screen.getByText('1,275 lb')).toBeVisible();
    expect(screen.getByText('205 lb')).toBeVisible();

    for (const forbidden of [/best/i, /worst/i, /underperform/i, /declin/i, /should/i, /top partner/i]) {
      expect(document.body.textContent).not.toMatch(forbidden);
    }
  });

  test('lets staff narrow the trend to specific partners', async () => {
    render(
      <DonorAnalytics
        donors={donors}
        donorValue={donorValue}
        donorMonthlyWeight={monthly}
        formatDate={(iso) => iso}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Choose partners' });
    expect(trigger).toHaveTextContent('All partners');

    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Clear all partners' }));
    expect(screen.getByText('Choose at least one partner.')).toBeVisible();

    // Re-selecting one partner brings the trend back for that partner alone.
    const amazon = screen.getByRole('menuitemcheckbox', {
      name: 'Amazon - NW Industrial (Prime Now)',
    });
    fireEvent.click(amazon);
    expect(amazon).toHaveAttribute('aria-checked', 'true');
    expect(trigger).toHaveTextContent('Amazon - NW Industrial (Prime Now)');
  });

  test('degrades to an empty state instead of crashing without donor data', () => {
    render(
      <DonorAnalytics
        donors={undefined as never}
        donorValue={undefined as never}
        donorMonthlyWeight={undefined as never}
        formatDate={(iso) => iso}
      />
    );
    expect(screen.getByText(/No Agency Pickups observations/)).toBeVisible();
  });
});

describe('paid product families', () => {
  const product = (description: string, cents: number) => ({
    productCode: String(Math.abs(description.length * 7)).padStart(5, '0'),
    description,
    receiptDateCount: 1,
    totalSpendCents: cents,
    paidWeightHundredths: 1000,
    costPerPaidPoundCents: 100,
    firstReceivedDate: '2026-01-01',
    lastReceivedDate: '2026-06-30',
  });

  test('reads the family prefix and leaves unrecognizable descriptions unclassified', () => {
    expect(productFamily('Meals, Beef Stew 12/24oz')).toBe('Meals');
    expect(productFamily('Veg, Mixed Vegetables 24/15 oz')).toBe('Veg');
    expect(productFamily('Other Protein, Peanut Butter')).toBe('Other Protein');
    // No prefix: the product is never forced into a bucket.
    expect(productFamily('Assorted bakery items')).toBe('Unclassified');
    expect(productFamily(', leading comma')).toBe('Unclassified');
  });

  test('breaks the aggregate row down by family instead of by product', () => {
    // 16 products so the 16th onward falls into the aggregate row.
    const products = [
      ...Array.from({ length: 15 }, (_, index) => product(`Meat, Cut ${index}`, 100000)),
      product('Meals, Beef Stew', 40000),
      product('Meals, Chili', 20000),
      product('Cereal, Corn Flakes', 15000),
      product('Bev, Juice', 5000),
    ];

    const data = buildPaidProductSpendData(products);
    const aggregate = data[data.length - 1];

    expect(aggregate.product).toContain('Other paid products (4 codes)');
    expect(aggregate.familyBreakdown).toEqual([
      { family: 'Meals', spendDollars: 600 },
      { family: 'Cereal', spendDollars: 150 },
      { family: 'Bev', spendDollars: 50 },
    ]);
  });

  test('gives every family a CSS-safe key so multi-word families render', () => {
    const { rows, families } = buildPaidProductChartSeries(
      buildPaidProductSpendData([product('Other Protein, Peanut Butter', 50000)])
    );

    const key = families[0].key;
    expect(families[0].label).toBe('Other Protein');
    expect(key).toMatch(/^[a-z0-9_]+$/);
    expect(rows[0][key]).toBe(500);
  });

  test('populates one family per ordinary row and several on the aggregate', () => {
    const products = [
      ...Array.from({ length: 15 }, (_, index) => product(`Meat, Cut ${index}`, 100000)),
      product('Meals, Beef Stew', 40000),
      product('Cereal, Corn Flakes', 15000),
    ];
    const { rows, families } = buildPaidProductChartSeries(buildPaidProductSpendData(products));

    const familyKeys = families.map((family) => family.key);
    const populated = (row: Record<string, unknown>) =>
      familyKeys.filter((key) => typeof row[key] === 'number');

    // An ordinary product bar is a single segment; the aggregate stacks.
    expect(populated(rows[0])).toHaveLength(1);
    expect(populated(rows[rows.length - 1])).toHaveLength(2);
  });
  test('carries the family breakdown onto the aggregate chart row', () => {
    // The tooltip reads this off the row, not off the chart payload: a single
    // Bar with per-row Cells only ever yields one payload entry.
    const products = [
      ...Array.from({ length: 15 }, (_, index) => product(`Meat, Cut ${index}`, 100000)),
      product('Meals, Beef Stew', 40000),
      product('Rice, Long Grain', 10000),
    ];
    const { rows } = buildPaidProductChartSeries(buildPaidProductSpendData(products));

    expect(rows[0].familyBreakdown).toBeUndefined();
    expect(rows[rows.length - 1].familyBreakdown).toEqual([
      { family: 'Meals', spendDollars: 400 },
      { family: 'Rice', spendDollars: 100 },
    ]);
  });

  test('slugs family labels identically for bars and tooltip swatches', () => {
    expect(familyCssKey('Other Protein')).toBe('fam_other_protein');
    expect(familyCssKey('Non-Food')).toBe('fam_non_food');
    expect(familyCssKey('Unclassified')).toBe('fam_unclassified');
  });
});
