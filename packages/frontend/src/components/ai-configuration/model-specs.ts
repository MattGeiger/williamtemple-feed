// Model specifications for AI configuration forms
export interface ModelSpec {
  name: string
  model: string
  inputPrice: number
  outputPrice: number
  tokensPerMinute: number
  requestsPerMinute: number
  requestsPerDay?: number
  inputTokenLimit: number
  outputTokenLimit?: number
  // Parameter mapping for API calls
  apiParameters?: {
    maxTokensField?: 'max_tokens' | 'max_completion_tokens'
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
    modelFamily?: 'gpt-4' | 'gpt-5' | 'o-series' | 'legacy' | 'gemini-3'
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high'
    supportedThinkingLevels?: Array<'minimal' | 'low' | 'medium' | 'high'>
  }
}

// Service endpoint URLs
export const SERVICE_ENDPOINTS = {
  OpenAI: 'https://api.openai.com/v1',
  Anthropic: 'https://api.anthropic.com/v1',
  Google: 'https://generativelanguage.googleapis.com',
  Azure: '' // Custom endpoint required
} as const

export const OPENAI_MODEL_SPECS: ModelSpec[] = [
  // GPT-5 Models (Reasoning Models)
  {
    name: 'gpt-5-nano',
    model: 'gpt-5-nano-2025-08-07',
    inputPrice: 0.05,
    outputPrice: 0.40,
    tokensPerMinute: 200000,
    requestsPerMinute: 500,
    requestsPerDay: undefined,
    inputTokenLimit: 128000,
    outputTokenLimit: 128000,
    apiParameters: {
      maxTokensField: 'max_completion_tokens',
      reasoningEffort: 'minimal',
      modelFamily: 'gpt-5'
    }
  },
  {
    name: 'gpt-5-mini',
    model: 'gpt-5-mini-2025-08-07',
    inputPrice: 0.25,
    outputPrice: 2.00,
    tokensPerMinute: 200000,
    requestsPerMinute: 500,
    requestsPerDay: undefined,
    inputTokenLimit: 128000,
    outputTokenLimit: 128000,
    apiParameters: {
      maxTokensField: 'max_completion_tokens',
      reasoningEffort: 'low',
      modelFamily: 'gpt-5'
    }
  },
  {
    name: 'gpt-5',
    model: 'gpt-5-2025-08-07',
    inputPrice: 1.25,
    outputPrice: 10.00,
    tokensPerMinute: 200000,
    requestsPerMinute: 500,
    requestsPerDay: undefined,
    inputTokenLimit: 128000,
    outputTokenLimit: 128000,
    apiParameters: {
      maxTokensField: 'max_completion_tokens',
      reasoningEffort: 'low',
      modelFamily: 'gpt-5'
    }
  },
  // GPT-4.1 Models
  {
    name: 'gpt-4.1-nano',
    model: 'gpt-4.1-nano-2025-04-14',
    inputPrice: 0.10,
    outputPrice: 0.40,
    tokensPerMinute: 30000,
    requestsPerMinute: 500,
    requestsPerDay: undefined,
    inputTokenLimit: 1047576,
    outputTokenLimit: 32768,
    apiParameters: {
      maxTokensField: 'max_tokens',
      modelFamily: 'gpt-4'
    }
  },
  {
    name: 'gpt-4.1-mini',
    model: 'gpt-4.1-mini-2025-04-14',
    inputPrice: 0.40,
    outputPrice: 1.60,
    tokensPerMinute: 30000,
    requestsPerMinute: 500,
    requestsPerDay: undefined,
    inputTokenLimit: 1047576,
    outputTokenLimit: 32768,
    apiParameters: {
      maxTokensField: 'max_tokens',
      modelFamily: 'gpt-4'
    }
  },
  {
    name: 'gpt-4.1',
    model: 'gpt-4.1-2025-04-14',
    inputPrice: 2.00,
    outputPrice: 8.00,
    tokensPerMinute: 30000,
    requestsPerMinute: 500,
    requestsPerDay: undefined,
    inputTokenLimit: 1047576,
    outputTokenLimit: 32768,
    apiParameters: {
      maxTokensField: 'max_tokens',
      modelFamily: 'gpt-4'
    }
  },
  {
    name: 'gpt-4o-mini',
    model: 'gpt-4o-mini-2024-07-18',
    inputPrice: 0.15,
    outputPrice: 0.60,
    tokensPerMinute: 200000,
    requestsPerMinute: 500,
    requestsPerDay: 10000,
    inputTokenLimit: 131072,
    outputTokenLimit: 16384,
    apiParameters: {
      maxTokensField: 'max_tokens',
      modelFamily: 'gpt-4'
    }
  },
  {
    name: 'gpt-4o',
    model: 'gpt-4o-2024-05-13',
    inputPrice: 5.00,
    outputPrice: 20.00,
    tokensPerMinute: 30000,
    requestsPerMinute: 500,
    requestsPerDay: 720000,
    inputTokenLimit: 131072,
    outputTokenLimit: 16384,
    apiParameters: {
      maxTokensField: 'max_tokens',
      modelFamily: 'gpt-4'
    }
  },
  /**
   * LEGACY (scheduled to sunset): OpenAI o‑series models below are slated for retirement.
   * We are commenting them out to prevent selection while preserving their historical specs.
   *
   * Dates ("no earlier than") per Microsoft Azure AI Foundry model retirement schedule:
   *  • o3‑mini (GA 2025‑01‑31) — no earlier than **2026‑02‑01**
   *  • o3 (GA 2025‑04‑16) — no earlier than **2026‑04‑11**
   *  • o4‑mini (GA 2025‑04‑16) — no earlier than **2026‑04‑11**
   *    Source: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/model-retirements
   *
   * Additional note: GitHub changelog announced **o3‑mini** deprecation originally targeted for **2025‑07‑18**, later **postponed** with a new timeline TBA.
   *    Source: https://github.blog/changelog/2025-06-20-upcoming-deprecation-of-o1-gpt-4-5-o3-mini-and-gpt-4o/
   *
   * Context: OpenAI is consolidating toward the GPT‑5 family; prefer gpt‑5 models going forward.
   */
  /*{
    name: 'o4-mini',
    model: 'o4-mini-2025-04-16',
    inputPrice: 1.10,
    outputPrice: 4.40,
    tokensPerMinute: 100000,
    requestsPerMinute: 60,
    requestsPerDay: 1000000,
    inputTokenLimit: 200000,
    outputTokenLimit: 65536,
    apiParameters: {
      maxTokensField: 'max_tokens',
      modelFamily: 'o-series'
    }
  },*/
  /*{
    name: 'o3-mini',
    model: 'o3-mini-2025-01-31',
    inputPrice: 1.00,
    outputPrice: 4.00,
    tokensPerMinute: 100000,
    requestsPerMinute: 60,
    requestsPerDay: 1000000,
    inputTokenLimit: 200000,
    outputTokenLimit: 65536,
    apiParameters: {
      maxTokensField: 'max_tokens',
      modelFamily: 'o-series'
    }
  },*/
  /*{
    name: 'o3',
    model: 'o3-2025-04-16',
    inputPrice: 2.00,
    outputPrice: 8.00,
    tokensPerMinute: 100000,
    requestsPerMinute: 60,
    requestsPerDay: 1000000,
    inputTokenLimit: 200000,
    outputTokenLimit: 65536,
    apiParameters: {
      maxTokensField: 'max_tokens',
      modelFamily: 'o-series'
    }
  }*/
]

 // Note: There is no standalone "o4" entry here; if added in the future, treat it as deprecated/sunset.

export const ANTHROPIC_MODEL_SPECS: ModelSpec[] = [
  /**
   * LEGACY (sunset): Claude 3.5 Haiku removed from presets in favor of the 4.5 series.
   */
  /*{
    name: 'claude-3.5-haiku',
    model: 'claude-3-5-haiku-20241022',
    inputPrice: 0.80,
    outputPrice: 4.00,
    tokensPerMinute: 10000,
    requestsPerMinute: 50,
    requestsPerDay: undefined,
    inputTokenLimit: 200000,
    outputTokenLimit: 8192
  },*/
  {
    name: 'claude-haiku-4.5',
    model: 'claude-haiku-4-5-20251001',
    inputPrice: 1.00,
    outputPrice: 5.00,
    tokensPerMinute: 10000,
    requestsPerMinute: 50,
    requestsPerDay: undefined,
    inputTokenLimit: 200000,
    outputTokenLimit: 64000
  },
  {
    name: 'claude-sonnet-4.5',
    model: 'claude-sonnet-4-5-20250929',
    inputPrice: 3.00,
    outputPrice: 15.00,
    tokensPerMinute: 8000,
    requestsPerMinute: 50,
    requestsPerDay: undefined,
    inputTokenLimit: 200000,
    outputTokenLimit: 64000
  },
  /**
   * LEGACY (sunset): Claude Sonnet 4 removed from presets in favor of the 4.5 series.
   */
  /*{
    name: 'claude-sonnet-4',
    model: 'claude-sonnet-4-20250514',
    inputPrice: 3.00,
    outputPrice: 15.00,
    tokensPerMinute: 8000,
    requestsPerMinute: 50,
    requestsPerDay: undefined,
    inputTokenLimit: 200000,
    outputTokenLimit: undefined
  },*/
  /**
   * LEGACY (sunset): Claude 3.7 Sonnet removed from presets in favor of the 4.5 series.
   */
  /*{
    name: 'claude-3.7-sonnet',
    model: 'claude-3-7-sonnet-20250219',
    inputPrice: 3.00,
    outputPrice: 15.00,
    tokensPerMinute: 8000,
    requestsPerMinute: 50,
    requestsPerDay: undefined,
    inputTokenLimit: 200000,
    outputTokenLimit: 64000
  },*/
  {
    name: 'claude-opus-4.5',
    model: 'claude-opus-4-5-20251101',
    inputPrice: 5.00,
    outputPrice: 25.00,
    tokensPerMinute: 8000,
    requestsPerMinute: 50,
    requestsPerDay: undefined,
    inputTokenLimit: 200000,
    outputTokenLimit: 64000
  },
  /**
   * LEGACY (sunset): Claude Opus 4 removed from presets in favor of the 4.5 series.
   */
  /*{
    name: 'claude-opus-4',
    model: 'claude-opus-4-20250514',
    inputPrice: 15.00,
    outputPrice: 75.00,
    tokensPerMinute: 8000,
    requestsPerMinute: 50,
    requestsPerDay: undefined,
    inputTokenLimit: 200000,
    outputTokenLimit: undefined
  }*/
]

export const GOOGLE_MODEL_SPECS: ModelSpec[] = [
  {
    name: 'gemini-2.5-flash-lite',
    model: 'gemini-2.5-flash-lite',
    inputPrice: 0.10,
    outputPrice: 0.40,
    tokensPerMinute: 4000000,
    requestsPerMinute: 2000,
    requestsPerDay: undefined,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536
  },
  {
    name: 'gemini-2.5-flash',
    model: 'gemini-2.5-flash',
    inputPrice: 0.30,
    outputPrice: 2.50,
    tokensPerMinute: 4000000,
    requestsPerMinute: 2000,
    requestsPerDay: undefined,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536
  },
  {
    name: 'gemini-2.5-pro',
    model: 'gemini-2.5-pro',
    inputPrice: 1.25,
    outputPrice: 10.00,
    tokensPerMinute: 8000000,
    requestsPerMinute: 2000,
    requestsPerDay: undefined,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536
  },
  // Gemini 3 preview models (subject to change)
  {
    name: 'gemini-3-flash-preview',
    model: 'gemini-3-flash-preview',
    inputPrice: 0.50,
    outputPrice: 3.00,
    tokensPerMinute: 4000000,
    requestsPerMinute: 2000,
    requestsPerDay: undefined,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    apiParameters: {
      modelFamily: 'gemini-3',
      thinkingLevel: 'low',
      supportedThinkingLevels: ['minimal', 'low', 'medium', 'high']
    }
  },
  {
    name: 'gemini-3-pro-preview',
    model: 'gemini-3-pro-preview',
    inputPrice: 2.00,
    outputPrice: 12.00,
    tokensPerMinute: 8000000,
    requestsPerMinute: 2000,
    requestsPerDay: undefined,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    apiParameters: {
      modelFamily: 'gemini-3',
      thinkingLevel: 'low',
      supportedThinkingLevels: ['low', 'high']
    }
  }
]

// Helper arrays
export const OPENAI_MODEL_NAMES = OPENAI_MODEL_SPECS.map(spec => spec.name).concat(['Custom'])
export const OPENAI_MODELS = OPENAI_MODEL_SPECS.map(spec => spec.model).concat(['Custom'])

export const ANTHROPIC_MODEL_NAMES = ANTHROPIC_MODEL_SPECS.map(spec => spec.name).concat(['Custom'])
export const ANTHROPIC_MODELS = ANTHROPIC_MODEL_SPECS.map(spec => spec.model).concat(['Custom'])

export const GOOGLE_MODEL_NAMES = GOOGLE_MODEL_SPECS.map(spec => spec.name).concat(['Custom'])
export const GOOGLE_MODELS = GOOGLE_MODEL_SPECS.map(spec => spec.model).concat(['Custom'])

// Get model spec by name and service
export function getModelSpec(modelName: string, serviceType: 'OpenAI' | 'Anthropic' | 'Google' | 'Azure'): ModelSpec | undefined {
  switch (serviceType) {
    case 'OpenAI':
      return OPENAI_MODEL_SPECS.find(spec => spec.name === modelName)
    case 'Anthropic':
      return ANTHROPIC_MODEL_SPECS.find(spec => spec.name === modelName)
    case 'Google':
      return GOOGLE_MODEL_SPECS.find(spec => spec.name === modelName)
    default:
      return undefined
  }
}

// Get model names for service
export function getModelNames(serviceType: 'OpenAI' | 'Anthropic' | 'Google' | 'Azure'): string[] {
  switch (serviceType) {
    case 'OpenAI':
      return OPENAI_MODEL_NAMES
    case 'Anthropic':
      return ANTHROPIC_MODEL_NAMES
    case 'Google':
      return GOOGLE_MODEL_NAMES
    default:
      return ['Custom']
  }
}

// Get models for service
export function getModels(serviceType: 'OpenAI' | 'Anthropic' | 'Google' | 'Azure'): string[] {
  switch (serviceType) {
    case 'OpenAI':
      return OPENAI_MODELS
    case 'Anthropic':
      return ANTHROPIC_MODELS
    case 'Google':
      return GOOGLE_MODELS
    default:
      return ['Custom']
  }
}

// Get default endpoint URL for service
export function getServiceEndpoint(serviceType: 'OpenAI' | 'Anthropic' | 'Google' | 'Azure'): string {
  return SERVICE_ENDPOINTS[serviceType] || ''
}

// Get model spec by model string (for backend usage)
export function getModelSpecByModel(model: string): ModelSpec | undefined {
  // Search across all service specs
  const allSpecs = [
    ...OPENAI_MODEL_SPECS,
    ...ANTHROPIC_MODEL_SPECS,
    ...GOOGLE_MODEL_SPECS
  ]
  return allSpecs.find(spec => spec.model === model)
}
