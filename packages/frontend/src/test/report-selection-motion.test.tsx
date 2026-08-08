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
  wiggleTiltDeg,
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

/**
 * Wide blocks tilt less.
 *
 * A rotation about the centre throws the far corner further the wider the
 * element is, so a fixed angle makes a full-width table sway several times as
 * far as a half-width card. Tables used to be held still to avoid that, which
 * read as "this one isn't selectable"; scaling the angle keeps one affordance
 * for everything.
 */
describe('wiggle amplitude', () => {
  test('holds the visible sweep roughly constant across block widths', () => {
    // What is actually held steady is corner displacement, ~ width × sin(tilt).
    const sweep = (width: number) =>
      width * Math.sin((wiggleTiltDeg(width) * Math.PI) / 180)

    expect(sweep(1120) / sweep(560)).toBeLessThan(1.15)
  })

  test('a wide table tilts less than a narrow card', () => {
    expect(wiggleTiltDeg(1200)).toBeLessThan(wiggleTiltDeg(400))
  })

  test('never damps below a perceptible tilt, however wide the block', () => {
    expect(wiggleTiltDeg(6000)).toBeGreaterThanOrEqual(0.5)
  })

  test('never exceeds the original amplitude on a narrow block', () => {
    // Without the ceiling a narrow card would tilt further than the design
    // ever called for, which looks like a glitch rather than an invitation.
    expect(wiggleTiltDeg(120)).toBe(1.6)
  })

  test('falls back to the base tilt before the block has been measured', () => {
    // ResizeObserver has not fired on the first paint, and jsdom reports 0.
    expect(wiggleTiltDeg(0)).toBe(1.6)
    expect(wiggleTiltDeg(Number.NaN)).toBe(1.6)
  })
})
