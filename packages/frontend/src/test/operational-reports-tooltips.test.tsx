// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  OperationalReportsWorkspace,
  buildPressureChart,
  limitSeriesLabel,
} from '@/components/operational-reports';
import type { OperationalAnalyticsResult } from '@/types/operational-reports';

// Charts and tables measure themselves with ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const result: OperationalAnalyticsResult = {
  dataAsOf: '2026-07-11T12:00:00.000Z',
  range: { startDate: '2026-04-12', endDate: '2026-07-11', timeZone: 'America/Los_Angeles' },
  calculationVersion: 'operational-analytics-v1',
  correctionWindowMinutes: 5,
  summary: {
    trackedItems: 40,
    availableNow: 32,
    unavailableNow: 8,
    limitedSupplyNow: 5,
    clearanceNow: 2,
    itemRationedNow: 12,
    categoryRationedNow: 3,
    availabilityPercentNow: 80,
    trackedAvailabilityPercent: 76.5,
    unavailableEpisodes: 14,
    medianRestorationHours: 30,
  },
  timeline: [],
  rationedLimitSeries: [],
  episodes: [
    {
      itemId: 1,
      itemName: 'Tuna',
      categoryName: 'Canned Goods',
      startedAt: '2026-07-01T10:00:00.000Z',
      endedAt: '2026-07-03T10:00:00.000Z',
      durationHours: 48,
      resolution: 'restored',
    },
    {
      itemId: 2,
      itemName: 'Rice',
      categoryName: 'Grains',
      startedAt: '2026-07-10T10:00:00.000Z',
      endedAt: null,
      durationHours: 3,
      resolution: 'open_at_range_end',
    },
  ],
  limitChanges: [],
};

vi.mock('@/services/operational-reports', () => ({
  operationalReportsService: {
    query: vi.fn(() => Promise.resolve(result)),
    downloadCardCsv: vi.fn(),
    downloadRawCsv: vi.fn(),
  },
}));

// The embedded dashboard Inventory Distribution card fetches via react-query;
// mock its data hook so the workspace renders without a QueryClientProvider.
vi.mock('@/hooks/dashboard/useInventoryChartData', () => ({
  useInventoryChartData: () => ({
    distribution: [
      { status: 'inStock', items: 30, fill: '#22c55e' },
      { status: 'outOfStock', items: 10, fill: '#ef4444' },
    ],
    totalItems: 40,
    isLoading: false,
    error: null,
  }),
}));

describe('OperationalReportsWorkspace tooltips and layout', () => {
  test('KPI labels expose plain-language explanations on focus/hover', async () => {
    render(<OperationalReportsWorkspace />);

    const label = await screen.findByText('Tracked Availability');
    fireEvent.focus(label);

    const tooltips = await screen.findAllByText(
      /Availability across the whole selected period/
    );
    expect(tooltips.length).toBeGreaterThan(0);
  });

  test('the top row pairs Inventory Distribution with the trimmed summary', async () => {
    render(<OperationalReportsWorkspace />);

    expect(await screen.findByText('Inventory Distribution')).toBeTruthy();
    expect(screen.getByText('Current stock status overview')).toBeTruthy();
    // The four "now" status counts moved into the distribution card.
    expect(screen.queryByText('Available Now')).toBeNull();
    expect(screen.queryByText('Unavailable Now')).toBeNull();
  });

  test('the correction-sampling description explains the five-minute window', async () => {
    render(<OperationalReportsWorkspace />);

    const trigger = await screen.findByText(
      /Five-minute correction sampling; raw events remain exportable/
    );
    fireEvent.focus(trigger);

    const tooltips = await screen.findAllByText(
      /reports count only the final result/
    );
    expect(tooltips.length).toBeGreaterThan(0);
  });

  test('every summary KPI has help copy', async () => {
    render(<OperationalReportsWorkspace />);

    for (const label of [
      'Tracked Availability',
      'Item Limits',
      'Category Limits',
      'Median Restoration',
    ]) {
      const element = await screen.findByText(label);
      // A KPI without help renders a plain label; help-enabled labels are
      // tooltip triggers with the cursor-help affordance.
      expect(element.className).toContain('cursor-help');
    }
  });

  test('episode table headers sort like the management tables', async () => {
    const { container } = render(<OperationalReportsWorkspace />);

    const durationHeader = await screen.findByRole('button', { name: 'Duration' });

    const rowNames = () =>
      [...container.querySelectorAll('tbody tr')]
        .map((row) => row.textContent ?? '')
        .filter((text) => /Tuna|Rice/.test(text))
        .map((text) => (text.includes('Tuna') ? 'Tuna' : 'Rice'));

    fireEvent.click(durationHeader); // ascending
    expect(rowNames()).toEqual(['Rice', 'Tuna']);

    fireEvent.click(durationHeader); // descending
    expect(rowNames()).toEqual(['Tuna', 'Rice']);
  });

  test('the pressure chart grows one labeled series per limit configuration', () => {
    const chart = buildPressureChart({
      ...result,
      rationedLimitSeries: [
        { key: '1|household', limit: 1, limitType: 'household' },
        { key: '2|person', limit: 2, limitType: 'person' },
      ],
      timeline: [
        {
          date: '2026-07-10',
          trackedItems: 3,
          available: 2,
          unavailable: 1,
          limitedSupply: 1,
          clearance: 0,
          itemRationed: 2,
          rationedByLimit: { '1|household': 1, '2|person': 1 },
          availabilityPercent: 66.7,
        },
      ],
    });

    expect(chart.config['limit_1_household']?.label).toBe('1 Per Household');
    expect(chart.config['limit_2_person']?.label).toBe('2 Per Person');
    // Base series stay alongside the adaptive ones.
    expect(chart.config['limitedSupply']?.label).toBe('Limited Supply');

    const point = chart.data[0] as Record<string, unknown>;
    expect(point['limit_1_household']).toBe(1);
    expect(point['limit_2_person']).toBe(1);
  });

  test('limit series labels read as rationing policy', () => {
    expect(limitSeriesLabel({ key: '1|household', limit: 1, limitType: 'household' })).toBe('1 Per Household');
    expect(limitSeriesLabel({ key: '3|person', limit: 3, limitType: 'person' })).toBe('3 Per Person');
  });

  test('page wrapper matches the established section layout (w-full pt-6)', async () => {
    const { container } = render(<OperationalReportsWorkspace />);
    await screen.findByText('Tracked Availability');

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('pt-6');
    expect(wrapper.className).toContain('w-full');
  });
});
