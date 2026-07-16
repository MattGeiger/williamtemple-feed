// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { navigationItems } from '@/components/layout/navigation';
import { ReportsManagementWorkspace } from '@/components/reports-management';

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
        expect.objectContaining({ title: 'Data Management', href: '/data-management' }),
        expect.objectContaining({ title: 'Reports', href: '/reports' }),
      ])
    );
  });

  test('renders a nonfunctional management placeholder with standard table controls', () => {
    render(<ReportsManagementWorkspace />);

    expect(screen.getByRole('heading', { name: 'Reports Management' })).toBeVisible();
    expect(screen.getByPlaceholderText('Filter reports...')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    expect(screen.getByText('No results found.')).toBeVisible();
    expect(screen.getByTestId('pagination-controls')).toBeVisible();
    expect(screen.queryByRole('button', { name: /generate report/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /create report/i })).toBeNull();
  });
});
