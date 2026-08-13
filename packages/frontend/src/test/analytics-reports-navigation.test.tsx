// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { navigationItems } from '@/components/layout/navigation';
import { ReportsManagementWorkspace } from '@/components/reports-management';

// The page loads saved templates on mount. These assertions are about its
// structure, not the network, so the service is stubbed to an empty list.
vi.mock('@/services/analytics-reports', () => ({
  analyticsReportsService: {
    getTemplates: vi.fn().mockResolvedValue([]),
    getCards: vi.fn().mockResolvedValue([]),
    deleteTemplate: vi.fn().mockResolvedValue(undefined),
    deleteTemplates: vi.fn().mockResolvedValue({ deleted: 0 }),
    downloadReport: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Analytics and Reports information architecture', () => {
  test('places Analytics under Inventory and Reports under Information', () => {
    const inventory = navigationItems.find((item) => item.title === 'Inventory');
    const information = navigationItems.find((item) => item.title === 'Information');

    expect(inventory?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Analytics', href: '/analytics' }),
      ])
    );
    expect(inventory?.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Reports', href: '/reports' }),
      ])
    );
    expect(information?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Data', href: '/data-management' }),
        expect.objectContaining({ title: 'Reports', href: '/reports' }),
      ])
    );
  });

  test('lists saved report templates with standard table controls', async () => {
    // Was a hardcoded placeholder; it now reads saved templates. The controls
    // asserted here are the table standard's, not this page's own.
    render(<ReportsManagementWorkspace />);

    const heading = screen.getByRole('heading', { name: 'Reports Management' });
    expect(heading).toBeVisible();
    const pageIcon = heading.parentElement?.parentElement?.querySelector('svg');
    expect(pageIcon).toHaveAttribute('width', '28');
    expect(pageIcon).toHaveAttribute('height', '28');
    // Awaited: the table renders skeletons until the load settles.
    expect(await screen.findByPlaceholderText('Filter templates...')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    expect(screen.getByTestId('pagination-controls')).toBeVisible();
  });

  test('says where templates come from — they cannot be created on this page', async () => {
    render(<ReportsManagementWorkspace />);

    // Let both initial service requests settle before the test is cleaned up.
    await screen.findByPlaceholderText('Filter templates...');

    expect(screen.getByText(/Save as report template/)).toBeVisible();
    // The page once said running a template was not available. It is now, so
    // that sentence must not survive: stale reassurance is worse than none.
    expect(screen.queryByText(/not available yet/)).toBeNull();
  });
});
