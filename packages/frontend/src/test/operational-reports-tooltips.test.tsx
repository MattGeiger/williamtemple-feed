// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OperationalReportsWorkspace } from '@/components/operational-reports';
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

describe('OperationalReportsWorkspace tooltips and layout', () => {
  test('KPI labels expose plain-language explanations on focus/hover', async () => {
    render(<OperationalReportsWorkspace />);

    const label = await screen.findByText('Available Now');
    fireEvent.focus(label);

    const tooltips = await screen.findAllByText(
      /Tracked items currently in stock, including items marked Limited Supply or Clearance\./
    );
    expect(tooltips.length).toBeGreaterThan(0);
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
      'Available Now',
      'Unavailable Now',
      'Limited Supply',
      'Clearance',
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

  test('page wrapper matches the established section layout (w-full pt-6)', async () => {
    const { container } = render(<OperationalReportsWorkspace />);
    await screen.findByText('Available Now');

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('pt-6');
    expect(wrapper.className).toContain('w-full');
  });
});
