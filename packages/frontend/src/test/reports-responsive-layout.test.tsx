// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { ReportsWorkspace } from '@/components/reports'

vi.mock('@/contexts/CategoryContext', () => ({
  useCategoryContext: () => ({
    categories: [{ id: 1, name: 'Canned Goods' }],
  }),
}))

const { query } = vi.hoisted(() => ({ query: vi.fn(async () => ({
  tab: 'inventory-outlook',
  result: {
    kpis: {
      totalItems: 0,
      inStockItems: 0,
      outOfStockItems: 0,
      availabilityPercent: null,
      itemsWithKnownQuantity: 0,
      itemsWithComputableCover: 0,
      medianDaysOfCover: null,
      projectedStockoutsWithinHorizon: 0,
      horizonDays: 30,
    },
    daysOfCoverBands: [],
    stockoutTimeline: [],
    items: [],
    dataAsOf: '2026-07-10T12:00:00.000Z',
  },
})) }))

vi.mock('@/services/reports', () => ({
  reportsService: {
    query,
    downloadCardCsv: vi.fn(),
  },
}))

describe('Reports phone-width layout contract', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })

  test('uses wrapping controls and multi-row tabs without fixed phone widths', async () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <ReportsWorkspace />
      </MemoryRouter>
    )

    await waitFor(() => expect(query).toHaveBeenCalled())

    const tabList = screen.getByRole('tablist')
    expect(tabList).toHaveClass('h-auto', 'grid-cols-2')
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('min-w-0', 'whitespace-normal')
    }

    expect(screen.getByLabelText('Item or Category')).toHaveClass('w-full')
    expect(screen.getByRole('button', { name: 'Generate Report' })).toBeVisible()
  })
})
