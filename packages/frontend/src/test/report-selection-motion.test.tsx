// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import {
  ReportSelectionProvider,
  SelectableBlock,
  useReportSelection,
} from '@/components/reports/selection'

function SelectionHarness() {
  const { startSelecting } = useReportSelection()

  return (
    <>
      <button type="button" onClick={startSelecting}>
        Start selection
      </button>
      <SelectableBlock cardId="inventory-outlook-kpi">
        <div>Inventory outlook</div>
      </SelectableBlock>
    </>
  )
}

describe('report selection motion', () => {
  test('uses ZEV-paced staggering and stops motion after selection', () => {
    render(
      <ReportSelectionProvider>
        <SelectionHarness />
      </ReportSelectionProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start selection' }))

    const block = screen.getByRole('checkbox', {
      name: 'Select report block inventory-outlook-kpi',
    })
    expect(block).toHaveClass('report-selectable')
    expect(block.style.getPropertyValue('--report-wiggle-delay')).toBe('60ms')
    expect(block.style.getPropertyValue('--report-wiggle-duration')).toBe('895ms')

    fireEvent.click(block)

    expect(block).not.toHaveClass('report-selectable')
    expect(block).toHaveClass('report-selectable-selected')
    expect(block.style.getPropertyValue('--report-wiggle-delay')).toBe('')
    expect(block.style.getPropertyValue('--report-wiggle-duration')).toBe('')
  })
})
