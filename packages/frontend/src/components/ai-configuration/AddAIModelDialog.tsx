import React from 'react'
import { BaseAIConfigDialog } from './shared/BaseAIConfigDialog'
import { createApiKeySteps } from './shared/stepDefinitions'
import { ApiKeyConfigData } from './shared/types'
import { getModelSpec, getServiceEndpoint } from './model-specs'

interface AddAIModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    name: string
    type: 'apikey'
    value: string
    description?: string
    modelName?: string
    model?: string
    serviceType?: 'OpenAI' | 'Anthropic' | 'Google' | 'Azure'
    endpointUrl?: string
    apiKey?: string
    inputCost?: number
    outputCost?: number
    inputTokenLimit?: number
    outputTokenLimit?: number
    dailyCostLimit?: number
    monthlyCostLimit?: number
    temperature?: number
    topP?: number
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' | null
    tokensPerMinute?: number
    requestsPerMinute?: number
    requestsPerDay?: number
    unitPrice?: 'per_1k' | 'per_1m'
  }) => Promise<boolean>
  isLoading?: boolean
}

export function AddAIModelDialog({
  open,
  onOpenChange,
  onSave,
  isLoading
}: AddAIModelDialogProps) {
  const initialData = React.useMemo<ApiKeyConfigData>(() => {
    const defaultServiceType: ApiKeyConfigData['serviceType'] = 'Google'
    const defaultModelName = 'gemini-2.5-flash-lite'
    const defaultSpec = getModelSpec(defaultModelName, defaultServiceType)

    return {
      type: 'apikey',
      serviceType: defaultServiceType,
      model: defaultSpec?.model || defaultModelName,
      modelName: defaultModelName,
      customModel: '',
      customModelName: '',
      apiKey: '',
      endpointUrl: getServiceEndpoint(defaultServiceType),
      inputCost: defaultSpec?.inputPrice,
      outputCost: defaultSpec?.outputPrice,
      unitPrice: 'per_1m',
      inputTokenLimit: defaultSpec?.inputTokenLimit,
      outputTokenLimit: defaultSpec?.outputTokenLimit,
      dailyCostLimit: undefined,
      monthlyCostLimit: undefined,
      tokensPerMinute: defaultSpec?.tokensPerMinute,
      requestsPerMinute: defaultSpec?.requestsPerMinute,
      requestsPerDay: defaultSpec?.requestsPerDay,
      name: '',
      description: '',
      value: '',
      temperature: 0.7,
      topP: 1.0,
      thinkingLevel: 'high',
      isActive: true
    }
  }, [])

  const handleSave = async (data: ApiKeyConfigData): Promise<boolean> => {
    return onSave({
      name: data.name,
      type: 'apikey',
      value: '',
      description: data.description || undefined,
      modelName: data.modelName === 'Custom' ? data.customModelName : data.modelName,
      model: data.model === 'Custom' ? data.customModel : data.model,
      serviceType: data.serviceType,
      endpointUrl: data.endpointUrl,
      apiKey: data.apiKey,
      inputCost: data.inputCost,
      outputCost: data.outputCost,
      inputTokenLimit: data.inputTokenLimit,
      outputTokenLimit: data.outputTokenLimit,
      dailyCostLimit: data.dailyCostLimit,
      monthlyCostLimit: data.monthlyCostLimit,
      temperature: data.temperature,
      topP: data.topP,
      thinkingLevel: data.thinkingLevel,
      tokensPerMinute: data.tokensPerMinute,
      requestsPerMinute: data.requestsPerMinute,
      requestsPerDay: data.requestsPerDay,
      unitPrice: data.unitPrice
    })
  }

  return (
    <BaseAIConfigDialog<ApiKeyConfigData>
      open={open}
      onOpenChange={onOpenChange}
      mode="add"
      title="AI Model Configuration"
      getSteps={() => createApiKeySteps('add')}
      initialData={initialData}
      onSave={handleSave}
      isLoading={isLoading}
    />
  )
}
