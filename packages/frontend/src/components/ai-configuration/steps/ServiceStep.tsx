// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import React from 'react'
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bot } from "@/components/ui/icons";
import { StepWrapper } from '../shared/StepWrapper'
import { ServiceStepProps } from '../shared/types'
import {
  OPENAI_MODEL_SPECS,
  ANTHROPIC_MODEL_SPECS,
  GOOGLE_MODEL_SPECS,
  OPENAI_MODEL_NAMES,
  OPENAI_MODELS,
  ANTHROPIC_MODEL_NAMES,
  ANTHROPIC_MODELS,
  GOOGLE_MODEL_NAMES,
  GOOGLE_MODELS,
  getModelSpec,
  getServiceEndpoint
} from '../model-specs'

export function ServiceStep({
  mode,
  data,
  onChange,
  isLoading = false,
  validation,
  onBlur
}: ServiceStepProps) {
  const applyModelSpecs = (modelName: string, model: string, serviceType: 'OpenAI' | 'Anthropic' | 'Google' ) => {
    if (modelName === 'Custom' || model === 'Custom') return
    
    const spec = getModelSpec(modelName, serviceType)
    if (spec) {
      return {
        inputCost: spec.inputPrice,
        outputCost: spec.outputPrice,
        unitPrice: 'per_1m' as const,
        inputTokenLimit: spec.inputTokenLimit,
        outputTokenLimit: spec.outputTokenLimit,
        tokensPerMinute: spec.tokensPerMinute,
        requestsPerMinute: spec.requestsPerMinute,
        requestsPerDay: spec.requestsPerDay
      }
    }
    return {}
  }

  const handleServiceTypeChange = (value: 'OpenAI' | 'Anthropic' | 'Google') => {
    // Reset model selections when service type changes
    const newData: any = {
      serviceType: value,
      modelName: '',
      model: '',
      customModelName: '',
      customModel: '',
      endpointUrl: getServiceEndpoint(value)
    }
    
    // Set default model for each service if available
    switch (value) {
      case 'OpenAI':
        if (OPENAI_MODEL_SPECS.length > 0) {
          newData.modelName = OPENAI_MODEL_SPECS[0].name
          newData.model = OPENAI_MODEL_SPECS[0].model
          // Apply model specs
          Object.assign(newData, applyModelSpecs(OPENAI_MODEL_SPECS[0].name, OPENAI_MODEL_SPECS[0].model, value))
        }
        break
      case 'Anthropic':
        if (ANTHROPIC_MODEL_SPECS.length > 0) {
          newData.modelName = ANTHROPIC_MODEL_SPECS[0].name
          newData.model = ANTHROPIC_MODEL_SPECS[0].model
          // Apply model specs
          Object.assign(newData, applyModelSpecs(ANTHROPIC_MODEL_SPECS[0].name, ANTHROPIC_MODEL_SPECS[0].model, value))
        }
        break
      case 'Google':
        if (GOOGLE_MODEL_SPECS.length > 0) {
          newData.modelName = GOOGLE_MODEL_SPECS[0].name
          newData.model = GOOGLE_MODEL_SPECS[0].model
          // Apply model specs
          Object.assign(newData, applyModelSpecs(GOOGLE_MODEL_SPECS[0].name, GOOGLE_MODEL_SPECS[0].model, value))
        }
        break
    }
    
    onChange(newData)
  }

  const handleModelNameChange = (value: string) => {
    const newData: any = { modelName: value }
    
    // Auto-fill model when model name is selected
    if (value !== 'Custom') {
      const spec = getModelSpec(value, data.serviceType)
      if (spec) {
        newData.model = spec.model
        // Apply model specs
        Object.assign(newData, applyModelSpecs(value, spec.model, data.serviceType))
      }
    }
    
    onChange(newData)
  }

  const handleModelChange = (value: string) => {
    const newData: any = { model: value }
    
    // Auto-fill model name when model is selected  
    if (value !== 'Custom') {
      let spec
      switch (data.serviceType) {
        case 'OpenAI':
          spec = OPENAI_MODEL_SPECS.find(s => s.model === value)
          break
        case 'Anthropic':
          spec = ANTHROPIC_MODEL_SPECS.find(s => s.model === value)
          break
        case 'Google':
          spec = GOOGLE_MODEL_SPECS.find(s => s.model === value)
          break
      }
      
      if (spec) {
        newData.modelName = spec.name
        // Apply model specs
        Object.assign(newData, applyModelSpecs(spec.name, value, data.serviceType))
      }
    }
    
    onChange(newData)
  }

  return (
    <StepWrapper 
      icon={Bot} 
      title="Service Configuration" 
      description="Configure the AI service and model settings"
    >
      <div className="space-y-2">
        <Label htmlFor="serviceType">Service Type</Label>
        {mode === 'edit' ? (
          <>
            <Input
              value={data.serviceType}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Service type cannot be changed when editing
            </p>
          </>
        ) : (
          <Select 
            value={data.serviceType} 
            onValueChange={handleServiceTypeChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Anthropic">Anthropic</SelectItem>
              <SelectItem value="Google">Google (Default)</SelectItem>
              <SelectItem value="OpenAI">OpenAI</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="modelName">Model Name</Label>
        {data.serviceType === 'OpenAI' ? (
          <>
            <Select 
              value={data.modelName} 
              onValueChange={handleModelNameChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model name" />
              </SelectTrigger>
              <SelectContent>
                {OPENAI_MODEL_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.modelName === 'Custom' && (
              <Input
                value={data.customModelName}
                onChange={(e) => onChange({ customModelName: e.target.value })}
                onBlur={() => onBlur?.('customModelName')}
                placeholder="Enter custom model name"
                disabled={isLoading}
                className={`mt-2 ${validation?.showValidation && validation?.errors?.modelName ? 'border-destructive' : ''}`}
              />
            )}
          </>
        ) : data.serviceType === 'Anthropic' ? (
          <>
            <Select 
              value={data.modelName} 
              onValueChange={handleModelNameChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model name" />
              </SelectTrigger>
              <SelectContent>
                {ANTHROPIC_MODEL_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.modelName === 'Custom' && (
              <Input
                value={data.customModelName}
                onChange={(e) => onChange({ customModelName: e.target.value })}
                onBlur={() => onBlur?.('customModelName')}
                placeholder="Enter custom model name"
                disabled={isLoading}
                className={`mt-2 ${validation?.showValidation && validation?.errors?.modelName ? 'border-destructive' : ''}`}
              />
            )}
          </>
        ) : data.serviceType === 'Google' ? (
          <>
            <Select 
              value={data.modelName} 
              onValueChange={handleModelNameChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model name" />
              </SelectTrigger>
              <SelectContent>
                {GOOGLE_MODEL_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.modelName === 'Custom' && (
              <Input
                value={data.customModelName}
                onChange={(e) => onChange({ customModelName: e.target.value })}
                onBlur={() => onBlur?.('customModelName')}
                placeholder="Enter custom model name"
                disabled={isLoading}
                className={`mt-2 ${validation?.showValidation && validation?.errors?.modelName ? 'border-destructive' : ''}`}
              />
            )}
          </>
        ) : (
          <Input
            value={data.modelName}
            onChange={(e) => onChange({ modelName: e.target.value })}
            onBlur={() => onBlur?.('modelName')}
            placeholder="Display name for model"
            disabled={isLoading}
            className={`${validation?.showValidation && validation?.errors?.modelName ? 'border-destructive' : ''}`}
          />
        )}
        <p className="text-xs text-muted-foreground">
          Human-readable name for identification
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        {data.serviceType === 'OpenAI' ? (
          <>
            <Select 
              value={data.model} 
              onValueChange={handleModelChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {OPENAI_MODELS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.model === 'Custom' && (
              <Input
                value={data.customModel}
                onChange={(e) => onChange({ customModel: e.target.value })}
                onBlur={() => onBlur?.('customModel', 'model')}
                placeholder="Enter custom model identifier"
                disabled={isLoading}
                className={`mt-2 ${validation?.showValidation && validation?.errors?.model ? 'border-destructive' : ''}`}
              />
            )}
          </>
        ) : data.serviceType === 'Anthropic' ? (
          <>
            <Select 
              value={data.model} 
              onValueChange={handleModelChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {ANTHROPIC_MODELS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.model === 'Custom' && (
              <Input
                value={data.customModel}
                onChange={(e) => onChange({ customModel: e.target.value })}
                onBlur={() => onBlur?.('customModel', 'model')}
                placeholder="Enter custom model identifier"
                disabled={isLoading}
                className={`mt-2 ${validation?.showValidation && validation?.errors?.model ? 'border-destructive' : ''}`}
              />
            )}
          </>
        ) : data.serviceType === 'Google' ? (
          <>
            <Select 
              value={data.model} 
              onValueChange={handleModelChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {GOOGLE_MODELS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.model === 'Custom' && (
              <Input
                value={data.customModel}
                onChange={(e) => onChange({ customModel: e.target.value })}
                onBlur={() => onBlur?.('customModel', 'model')}
                placeholder="Enter custom model identifier"
                disabled={isLoading}
                className={`mt-2 ${validation?.showValidation && validation?.errors?.model ? 'border-destructive' : ''}`}
              />
            )}
          </>
        ) : (
          <Input
            value={data.model}
            onChange={(e) => onChange({ model: e.target.value })}
            onBlur={() => onBlur?.('model', 'model')}
            placeholder="Enter model identifier"
            disabled={isLoading}
            className={`${validation?.showValidation && validation?.errors?.model ? 'border-destructive' : ''}`}
          />
        )}
        <p className="text-xs text-muted-foreground">
          Exact model identifier as provided by the AI service
        </p>
      </div>
    </StepWrapper>
  )
}
