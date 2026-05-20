// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import React from 'react'
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Brain } from "@/components/ui/icons";
import { StepWrapper } from '../shared/StepWrapper'
import { BaseStepProps } from '../shared/types'

// Thinking level mapping
const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'] as const
type ThinkingLevel = typeof THINKING_LEVELS[number]

interface ThinkingLevelStepProps extends BaseStepProps {
  data: {
    thinkingLevel?: ThinkingLevel
  }
}

export function ThinkingLevelStep({
  mode,
  data,
  onChange,
  isLoading = false,
  validation,
  onBlur
}: ThinkingLevelStepProps) {
  // Convert thinking level string to slider value (0-3)
  const thinkingLevelToValue = (level?: ThinkingLevel): number => {
    if (!level) return 3 // Default to 'high'
    return THINKING_LEVELS.indexOf(level)
  }

  // Convert slider value (0-3) to thinking level string
  const valueToThinkingLevel = (value: number): ThinkingLevel => {
    return THINKING_LEVELS[value] || 'high'
  }

  const currentValue = thinkingLevelToValue(data.thinkingLevel)
  const currentLevel = valueToThinkingLevel(currentValue)

  return (
    <StepWrapper 
      icon={Brain} 
      title="Thinking Level" 
      description="Configure model thinking"
    >
      <div className="space-y-2">
        <Label htmlFor="thinkingLevel">Thinking Level</Label>
        <div className="px-3">
          <Slider
            value={[currentValue]}
            onValueChange={([value]) => onChange({ thinkingLevel: valueToThinkingLevel(value) })}
            min={0}
            max={3}
            step={1}
            className="w-full"
            disabled={isLoading}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>minimal</span>
            <span>low</span>
            <span>medium</span>
            <span>high</span>
          </div>
          <div className="text-center text-sm font-medium mt-2">
            {currentLevel}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Lower values = faster responses, Higher values = slower responses, higher quality
        </p>
      </div>
    </StepWrapper>
  )
}
