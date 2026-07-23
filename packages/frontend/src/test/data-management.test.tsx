// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { DataManagementWorkspace } from '@/components/data-management';
import type { ProcurementImportRecord } from '@/types/procurement';

vi.mock('@/services/procurement', () => ({
  procurementService: {
    getImports: vi.fn(() => Promise.resolve([])),
    getStatus: vi.fn(() => Promise.resolve({
      hasData: true,
      latestDeliveryDate: '2026-05-01',
      daysSinceLatestDelivery: 74,
      isStale: true,
      staleAfterDays: 30,
      coverage: {
        warehouse: {
          eventCount: 2100,
          earliestDeliveryDate: '2009-01-05',
          latestDeliveryDate: '2026-05-01',
        },
        freshAlliance: {
          eventCount: 826,
          earliestDeliveryDate: '2023-06-01',
          latestDeliveryDate: '2026-04-18',
        },
      },
    })),
    rollbackImports: vi.fn(),
    restoreImports: vi.fn(),
    importOfbExport: vi.fn(),
  },
}));

describe('Data Management', () => {
  test('uses the standard management table and surfaces stale procurement data', async () => {
    render(<DataManagementWorkspace />);

    expect(screen.getByRole('heading', { name: 'Data Management' })).toBeVisible();
    expect(await screen.findByText('Procurement data may be out of date')).toBeVisible();
    expect(screen.getByPlaceholderText('Filter imports...')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Import OFB Data' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Source' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Events' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    expect(screen.getByTestId('pagination-controls')).toBeVisible();
  });
  test('reports each channel window separately without implying fault', async () => {
    render(<DataManagementWorkspace />);

    expect(await screen.findByText('OFB Warehouse')).toBeVisible();
    expect(screen.getByText('Fresh Food Alliance')).toBeVisible();

    // The windows differ because Fresh Alliance entry lags; both are stated
    // plainly rather than compared.
    expect(screen.getByText('Jan 5, 2009 – May 1, 2026')).toBeVisible();
    expect(screen.getByText('Jun 1, 2023 – Apr 18, 2026')).toBeVisible();
    expect(screen.getByText('2,100 events')).toBeVisible();
    expect(screen.getByText('826 events')).toBeVisible();

    // A coverage gap measures available data-entry time, not performance, so
    // no surface may frame it as lateness or fault. See plan D12.
    for (const forbidden of [/overdue/i, /behind/i, /incomplete/i, /missing data/i, /failed to/i]) {
      expect(document.body.textContent).not.toMatch(forbidden);
    }
  });

  test('names the sibling row a unified upload produced, and only that row', async () => {
    const record = (overrides: Partial<ProcurementImportRecord> & Pick<ProcurementImportRecord, 'id' | 'source'>): ProcurementImportRecord => ({
      status: 'active',
      schemaVersion: 1,
      rowCount: 10,
      orderCount: 2,
      warningCount: 0,
      warnings: [],
      rangeStart: '2026-06-01',
      rangeEnd: '2026-06-02',
      importedAt: '2026-07-22T20:00:00.000Z',
      rolledBackAt: null,
      restoredAt: null,
      unifiedFileHash: null,
      orders: [],
      ...overrides,
    });
    const { procurementService } = await import('@/services/procurement');
    vi.mocked(procurementService.getImports).mockResolvedValueOnce([
      record({ id: 1, source: 'ofb', unifiedFileHash: 'hash-a' }),
      record({ id: 2, source: 'ofb_pickup', unifiedFileHash: 'hash-a' }),
      // A standalone import (or one predating the column) shares no hash and
      // must not be labeled as paired with anything.
      record({ id: 3, source: 'ofb', unifiedFileHash: null }),
    ]);

    render(<DataManagementWorkspace />);

    expect(await screen.findByText('Paired with OFB Agency Pickups')).toBeVisible();
    expect(screen.getByText('Paired with OFB Completed Orders')).toBeVisible();
    expect(screen.getAllByText(/Paired with/)).toHaveLength(2);
  });
});
