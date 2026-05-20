// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

// @vitest-environment jsdom
import React from 'react'
import { describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CostLimitsStep } from '@/components/ai-configuration/steps/CostLimitsStep'
import type { ApiKeyConfigData } from '@/components/ai-configuration/shared/types'

const buildBaseData = (overrides?: Partial<ApiKeyConfigData>): ApiKeyConfigData => ({
  type: 'apikey',
  serviceType: 'Google',
  model: 'gemini-2.5-flash-lite',
  modelName: 'gemini-2.5-flash-lite',
  customModel: '',
  customModelName: '',
  apiKey: '',
  endpointUrl: '',
  inputCost: undefined,
  outputCost: undefined,
  unitPrice: 'per_1m',
  inputTokenLimit: undefined,
  outputTokenLimit: undefined,
  dailyCostLimit: undefined,
  monthlyCostLimit: undefined,
  tokensPerMinute: undefined,
  requestsPerMinute: undefined,
  requestsPerDay: undefined,
  value: '',
  name: '',
  description: '',
  temperature: 0.7,
  topP: 1.0,
  ...overrides
})

describe('CostLimitsStep', () => {
  test('renders empty fields when values are undefined', () => {
    const onChange = vi.fn()
    render(
      <CostLimitsStep
        mode="add"
        data={buildBaseData()}
        onChange={onChange}
      />
    )

    expect((screen.getByLabelText('Daily Maximum') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Monthly Maximum') as HTMLInputElement).value).toBe('')
  })

  test('renders empty fields when values are null', () => {
    const onChange = vi.fn()
    render(
      <CostLimitsStep
        mode="edit"
        data={buildBaseData({ dailyCostLimit: null, monthlyCostLimit: null })}
        onChange={onChange}
      />
    )

    expect((screen.getByLabelText('Daily Maximum') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Monthly Maximum') as HTMLInputElement).value).toBe('')
  })

  test('renders numeric values from data', () => {
    const onChange = vi.fn()
    render(
      <CostLimitsStep
        mode="edit"
        data={buildBaseData({ dailyCostLimit: 100, monthlyCostLimit: 2500 })}
        onChange={onChange}
      />
    )

    expect((screen.getByLabelText('Daily Maximum') as HTMLInputElement).value).toBe('100')
    expect((screen.getByLabelText('Monthly Maximum') as HTMLInputElement).value).toBe('2500')
  })

  test('clearing a value sends null', () => {
    const onChange = vi.fn()
    render(
      <CostLimitsStep
        mode="edit"
        data={buildBaseData({ dailyCostLimit: 100 })}
        onChange={onChange}
      />
    )

    fireEvent.change(screen.getByLabelText('Daily Maximum'), { target: { value: '' } })

    expect(onChange).toHaveBeenLastCalledWith({ dailyCostLimit: null })
  })

  test('entering 0 sends null', () => {
    const onChange = vi.fn()
    render(
      <CostLimitsStep
        mode="edit"
        data={buildBaseData({ monthlyCostLimit: 200 })}
        onChange={onChange}
      />
    )

    fireEvent.change(screen.getByLabelText('Monthly Maximum'), { target: { value: '0' } })

    expect(onChange).toHaveBeenLastCalledWith({ monthlyCostLimit: null })
  })
})
