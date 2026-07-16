// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { DataManagementWorkspace } from '@/components/data-management';

vi.mock('@/services/procurement', () => ({
  procurementService: {
    getImports: vi.fn(() => Promise.resolve([])),
    getStatus: vi.fn(() => Promise.resolve({
      hasData: true,
      latestDeliveryDate: '2026-05-01',
      daysSinceLatestDelivery: 74,
      isStale: true,
      staleAfterDays: 30,
    })),
    rollbackImports: vi.fn(),
    restoreImports: vi.fn(),
    importOfb: vi.fn(),
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
    expect(screen.getByRole('columnheader', { name: 'Orders' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    expect(screen.getByTestId('pagination-controls')).toBeVisible();
  });
});
