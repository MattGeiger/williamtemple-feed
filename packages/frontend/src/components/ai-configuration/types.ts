export interface AIConfiguration {
  id: number
  name: string
  type: 'prompt' | 'model' | 'apikey'
  value: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  // API Key specific fields
  modelName?: string
  model?: string
  serviceType?: 'OpenAI' | 'Anthropic' | 'Google' | 'Azure'
  endpointUrl?: string
  apiKey?: string
  inputCost?: number | null
  outputCost?: number | null
  unitPrice?: string
  temperature?: number
  topP?: number
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' | null
  maxTokens?: number
  inputTokenLimit?: number | null
  outputTokenLimit?: number | null
  dailyCostLimit?: number | null
  monthlyCostLimit?: number | null
  tokensPerMinute?: number | null
  requestsPerMinute?: number | null
  requestsPerDay?: number | null
}

export interface BulkOperationResult {
  success: number
  failed: number
  errors: string[]
  changed?: number
  skipped?: number
}

export type AIConfigurationType = 'prompt' | 'apikey'

export interface StatusMessage {
  type: 'success' | 'error' | 'info'
  message: string
}
