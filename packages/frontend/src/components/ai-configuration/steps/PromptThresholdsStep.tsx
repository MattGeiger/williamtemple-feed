import React from 'react'
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Sliders } from "@/components/ui/icons";
import { StepWrapper } from '../shared/StepWrapper'
import { PromptThresholdsStepProps } from '../shared/types'

export function PromptThresholdsStep({
  data,
  onChange,
  isLoading = false
}: PromptThresholdsStepProps) {
  return (
    <StepWrapper 
      icon={Sliders} 
      title="Threshold Parameters" 
      description="Configure confidence thresholds for automatic formatting decisions"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="skipTranslationThreshold">Skip Translation Threshold</Label>
          <div className="px-3">
            <Slider
              value={[data.skipTranslationThreshold]}
              onValueChange={([value]) => onChange({ skipTranslationThreshold: value })}
              min={0.1}
              max={1.0}
              step={0.1}
              className="w-full"
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0.1 (Lenient)</span>
              <span className="font-medium">{data.skipTranslationThreshold}</span>
              <span>1.0 (Strict)</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Confidence level required to automatically skip translation. Higher values = more strict criteria.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="includeEnglishThreshold">Include English Threshold</Label>
          <div className="px-3">
            <Slider
              value={[data.includeEnglishThreshold]}
              onValueChange={([value]) => onChange({ includeEnglishThreshold: value })}
              min={0.1}
              max={1.0}
              step={0.1}
              className="w-full"
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0.1 (Lenient)</span>
              <span className="font-medium">{data.includeEnglishThreshold}</span>
              <span>1.0 (Strict)</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Confidence level required to automatically include original English. Higher values = more strict criteria.
          </p>
        </div>
      </div>
    </StepWrapper>
  )
}
