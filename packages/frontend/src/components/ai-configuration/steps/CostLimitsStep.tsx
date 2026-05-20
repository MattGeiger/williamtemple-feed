// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import React from 'react'
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { CircleDollarSign } from "@/components/ui/icons";
import { StepWrapper } from '../shared/StepWrapper'
import { CostLimitsStepProps } from '../shared/types'
import { createCostLimitChangeHandler } from '../shared/formatting'

interface CostLimitsState {
  rawDailyCostLimit: string
  rawMonthlyCostLimit: string
  dailyCostAtLimit: boolean
  monthlyCostAtLimit: boolean
}

export function CostLimitsStep({
  mode,
  data,
  onChange,
  isLoading = false,
  validation,
  onBlur
}: CostLimitsStepProps) {
  const [state, setState] = React.useState<CostLimitsState>({
    rawDailyCostLimit: data.dailyCostLimit?.toString() || '',
    rawMonthlyCostLimit: data.monthlyCostLimit?.toString() || '',
    dailyCostAtLimit: false,
    monthlyCostAtLimit: false
  })

  const showError = (message: string) => {
    console.error(message)
  }

  const setDailyCostAtLimit = (atLimit: boolean) => {
    setState(prev => ({ ...prev, dailyCostAtLimit: atLimit }))
  }

  const setMonthlyCostAtLimit = (atLimit: boolean) => {
    setState(prev => ({ ...prev, monthlyCostAtLimit: atLimit }))
  }

  const setRawDailyCostLimit = (value: string) => {
    setState(prev => ({ ...prev, rawDailyCostLimit: value }))
  }

  const setRawMonthlyCostLimit = (value: string) => {
    setState(prev => ({ ...prev, rawMonthlyCostLimit: value }))
  }

  return (
    <StepWrapper 
      icon={CircleDollarSign} 
      title="Cost Limits" 
      description="Configure daily and monthly cost limits"
    >
      <div className="space-y-2">
        <Label htmlFor="dailyCostLimit">Daily Maximum</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="dailyCostLimit"
            type="text"
            value={state.rawDailyCostLimit}
            onChange={createCostLimitChangeHandler('dailyCostLimit', setRawDailyCostLimit, onChange, setDailyCostAtLimit, setMonthlyCostAtLimit, showError)}
            placeholder="Set maximum cost per day"
            className="pl-8"
            disabled={isLoading}
          />
        </div>
        <p className={`text-xs ${state.dailyCostAtLimit ? 'cost-limit-warning' : 'text-muted-foreground'}`}>
          Set maximum cost per day. Leave empty or 0 for unlimited.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="monthlyCostLimit">Monthly Maximum</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="monthlyCostLimit"
            type="text"
            value={state.rawMonthlyCostLimit}
            onChange={createCostLimitChangeHandler('monthlyCostLimit', setRawMonthlyCostLimit, onChange, setDailyCostAtLimit, setMonthlyCostAtLimit, showError)}
            placeholder="Set maximum cost per month"
            className="pl-8"
            disabled={isLoading}
          />
        </div>
        <p className={`text-xs ${state.monthlyCostAtLimit ? 'cost-limit-warning' : 'text-muted-foreground'}`}>
          Set maximum cost per month. Leave empty or 0 for unlimited.
        </p>
      </div>
    </StepWrapper>
  )
}
