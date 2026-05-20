// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ThinkingLevelStep } from '@/components/ai-configuration/steps/ThinkingLevelStep'

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = MockResizeObserver as typeof ResizeObserver
}

const buildProps = (overrides: Partial<React.ComponentProps<typeof ThinkingLevelStep>> = {}) => ({
  mode: 'add' as const,
  data: {
    thinkingLevel: undefined
  },
  onChange: vi.fn(),
  isLoading: false,
  ...overrides
})

describe('ThinkingLevelStep', () => {
  test('renders slider labels and defaults to high', () => {
    render(<ThinkingLevelStep {...buildProps()} />)

    expect(screen.getByText('minimal')).toBeTruthy()
    expect(screen.getByText('low')).toBeTruthy()
    expect(screen.getByText('medium')).toBeTruthy()
    expect(screen.getAllByText('high').length).toBeGreaterThan(0)
  })

  test('shows the configured thinking level', () => {
    render(
      <ThinkingLevelStep
        {...buildProps({
          data: { thinkingLevel: 'low' }
        })}
      />
    )

    expect(screen.getByText('low', { selector: 'div' })).toBeTruthy()
  })

  test('updates thinking level on slider interaction', () => {
    const onChange = vi.fn()
    render(
      <ThinkingLevelStep
        {...buildProps({
          data: { thinkingLevel: 'low' },
          onChange
        })}
      />
    )

    const slider = screen.getByRole('slider')
    slider.focus()
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect(onChange).toHaveBeenCalled()
    expect(onChange).toHaveBeenLastCalledWith({ thinkingLevel: 'medium' })
  })
})
