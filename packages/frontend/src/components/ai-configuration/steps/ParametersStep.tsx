import React from 'react'
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { SlidersVerticalIcon } from "@/components/animate-ui/icons/sliders-vertical"
import { StepWrapper } from '../shared/StepWrapper'
import { ParametersStepProps } from '../shared/types'

export function ParametersStep({
  mode,
  data,
  onChange,
  isLoading = false,
  validation,
  onBlur
}: ParametersStepProps) {
  return (
    <StepWrapper
      icon={SlidersVerticalIcon as React.ComponentType<{ className?: string; size?: number }>}
      title="AI Parameters"
      description="Configure AI behavior and response characteristics"
    >
      <div className="space-y-2">
        <Label htmlFor="temperature">Temperature (Creativity)</Label>
        <div className="px-3">
          <Slider
            value={[data.temperature || 0.7]}
            onValueChange={([value]) => onChange({ temperature: value })}
            min={0}
            max={2}
            step={0.1}
            className="w-full"
            disabled={isLoading}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0.0 (Focused)</span>
            <span className="font-medium">{data.temperature || 0.7}</span>
            <span>2.0 (Creative)</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Lower values = more focused and deterministic, Higher values = more creative and random
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="topP">Top-p (Response Diversity)</Label>
        <div className="px-3">
          <Slider
            value={[data.topP || 1.0]}
            onValueChange={([value]) => onChange({ topP: value })}
            min={0}
            max={1}
            step={0.1}
            className="w-full"
            disabled={isLoading}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0.0 (Narrow)</span>
            <span className="font-medium">{data.topP || 1.0}</span>
            <span>1.0 (Full)</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Lower values = narrower vocabulary selection, Higher values = full vocabulary range
        </p>
      </div>
    </StepWrapper>
  )
}
