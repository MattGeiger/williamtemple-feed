// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ServiceLogWorkspace } from '@/components/service-log';
import {
  ServiceDateNavigator,
} from '@/components/service-log/service-date-navigator';
import {
  adjacentOperatingDate,
  dateInTimezone,
} from '@/components/service-log/service-date';
import { ServiceMetricsSettings } from '@/components/service-metrics';
import { DEFAULT_OPERATING_HOURS, DEFAULT_OPERATING_HOURS_SETTINGS } from '@/types/settings';

const serviceMocks = vi.hoisted(() => ({
  getDay: vi.fn(),
  saveDay: vi.fn(),
  listMetrics: vi.fn(),
  createMetric: vi.fn(),
  updateMetric: vi.fn(),
  seedWthDefaults: vi.fn(),
}));
const getOperatingHours = vi.hoisted(() => vi.fn());

vi.mock('@/services/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/service')>()),
  serviceApi: serviceMocks,
}));
vi.mock('@/services/settings', () => ({
  settingsService: { getOperatingHours },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    isAdministrator: true,
  }),
}));

const showSuccess = vi.fn();
vi.mock('@/hooks/message/useMessage', () => ({
  useMessage: () => ({ showSuccess }),
}));

vi.mock('@/services/error/ErrorHandlerService', () => ({
  ErrorHandlerService: { handleError: vi.fn() },
}));

const serviceDay = {
  serviceDate: '2026-08-10',
  pantryStatus: 'open' as const,
  entryState: 'draft' as const,
  dayRevision: 0,
  metrics: [
    {
      id: 1,
      metricKey: 'shopping_visits',
      definitionRevisionId: 2,
      definitionRevision: 2,
      displayName: 'Downstairs Shopping Visits',
      description: 'Households shopping in the pantry.',
      valueType: 'count' as const,
      unit: 'households' as const,
      semanticRole: 'served_household_method' as const,
      contributesToOperationalTotal: true,
      capacityTarget: 75,
      displayOrder: 10,
      observation: null,
    },
    {
      id: 2,
      metricKey: 'capacity_reached_time',
      definitionRevisionId: 3,
      definitionRevision: 1,
      displayName: 'Time Capacity Was Reached',
      description: null,
      valueType: 'time_of_day' as const,
      unit: 'marker' as const,
      semanticRole: 'capacity_marker' as const,
      contributesToOperationalTotal: false,
      capacityTarget: null,
      displayOrder: 20,
      observation: null,
    },
  ],
  operationalTotal: {
    value: null,
    recordedMetricCount: 0,
    expectedMetricCount: 1,
    complete: false,
  },
  capacityPlan: {
    planKey: 'wth_standard_pantry',
    revision: 1,
    displayName: 'WTH standard pantry capacity',
    description: null,
    timezone: 'America/Los_Angeles',
    targets: [
      { id: 1, targetKey: 'formal_households', displayName: 'Overall households', unit: 'households', targetValue: 145, metricId: null, displayOrder: 10 },
      { id: 2, targetKey: 'shopping_visits', displayName: 'Shopping visits', unit: 'households', targetValue: 75, metricId: 1, displayOrder: 20 },
    ],
  },
};

describe('native Service workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getDay.mockResolvedValue(serviceDay);
    serviceMocks.saveDay.mockResolvedValue(serviceDay);
    serviceMocks.listMetrics.mockResolvedValue([]);
    serviceMocks.seedWthDefaults.mockResolvedValue({
      metricsCreated: 7,
      metricsSkipped: 0,
      capacityPlanCreated: true,
    });
    getOperatingHours.mockResolvedValue(DEFAULT_OPERATING_HOURS_SETTINGS);
  });

  test('shows the shared visualization range and defaults the entry date to Today', async () => {
    render(<MemoryRouter><ServiceLogWorkspace /></MemoryRouter>);

    expect(screen.getByText('Date Range')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '90d' })).toHaveAttribute('data-state', 'active');
    expect(await screen.findByText('Today')).toBeInTheDocument();
    expect(serviceMocks.getDay).toHaveBeenCalledWith(
      dateInTimezone(DEFAULT_OPERATING_HOURS_SETTINGS.timezone),
    );
  });

  test('places administrator Service Metrics beneath the daily entry cards', async () => {
    render(<MemoryRouter><ServiceLogWorkspace /></MemoryRouter>);

    const dailyCard = await screen.findByText('Service Provided');
    const metrics = await screen.findByRole('region', { name: 'Service Metrics' });
    expect(
      dailyCard.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  test('preserves an explicit zero when staff save a draft', async () => {
    render(<MemoryRouter><ServiceLogWorkspace /></MemoryRouter>);

    const shopping = await screen.findByLabelText('Downstairs Shopping Visits');
    fireEvent.change(shopping, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(serviceMocks.saveDay).toHaveBeenCalled());
    expect(serviceMocks.saveDay).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        pantryStatus: 'open',
        entryState: 'draft',
        observations: expect.arrayContaining([
          expect.objectContaining({ metricId: 1, countValue: 0 }),
          expect.objectContaining({ metricId: 2, timeValue: null }),
        ]),
      }),
    );
  });

  test('offers WTH defaults only as an explicit administrator setup action', async () => {
    render(<MemoryRouter><ServiceMetricsSettings /></MemoryRouter>);
    const button = await screen.findByRole('button', { name: 'Configure WTH Defaults' });
    fireEvent.click(button);
    await waitFor(() => expect(serviceMocks.seedWthDefaults).toHaveBeenCalledTimes(1));
    expect(showSuccess).toHaveBeenCalledWith('Configured 7 WTH Service metrics');
  });

  test('insets the metric form inside the ScrollArea viewport so field shadows are not clipped', async () => {
    render(<MemoryRouter><ServiceMetricsSettings /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Metric' }));

    const dialog = await screen.findByRole('dialog');
    const viewport = dialog.querySelector('[data-radix-scroll-area-viewport]');
    expect(viewport?.parentElement).not.toHaveClass('px-2');
    expect(viewport?.querySelector('.p-4')).toBeInTheDocument();
  });
});

describe('Service Date navigation', () => {
  test('moves only across weekdays enabled in Operating Hours', () => {
    expect(adjacentOperatingDate('2026-08-11', -1, DEFAULT_OPERATING_HOURS)).toBe('2026-08-06');
    expect(adjacentOperatingDate('2026-08-11', 1, DEFAULT_OPERATING_HOURS)).toBe('2026-08-12');
  });

  test('reuses the Custom range calendar treatment and allows a special-event day', () => {
    const onChange = vi.fn();
    render(
      <ServiceDateNavigator
        value="2026-08-11"
        today="2026-08-13"
        hours={DEFAULT_OPERATING_HOURS}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Choose service date/ }));

    expect(screen.getByRole('dialog')).toHaveClass(
      'w-[262px]',
      'overflow-hidden',
      'rounded-2xl',
      'border-border/70',
      'bg-background/80',
      'backdrop-blur-[14px]',
      'backdrop-saturate-150'
    );
    expect(screen.getByRole('combobox', { name: 'Choose the Month' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Choose the Year' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', {
      name: 'Monday, August 10th, 2026',
    }));
    expect(onChange).toHaveBeenCalledWith('2026-08-10');
  });
});
