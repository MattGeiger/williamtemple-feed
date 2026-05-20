import { describe, expect, test, vi, beforeEach } from 'vitest'
import { UnifiedConfigService } from '../index'

const aiConfigMocks = vi.hoisted(() => ({
  getConfigurations: vi.fn()
}))

const systemPromptMocks = vi.hoisted(() => ({
  getSystemPrompts: vi.fn()
}))

vi.mock('../../ai-config', () => ({
  AIConfigService: class {
    getConfigurations = aiConfigMocks.getConfigurations
  }
}))

vi.mock('../../system-prompt', () => ({
  SystemPromptService: class {
    getSystemPrompts = systemPromptMocks.getSystemPrompts
  }
}))

describe('UnifiedConfigService thinking level mapping', () => {
  beforeEach(() => {
    aiConfigMocks.getConfigurations.mockReset()
    systemPromptMocks.getSystemPrompts.mockReset()
  })

  test('maps thinkingLevel from AI configuration', async () => {
    aiConfigMocks.getConfigurations.mockResolvedValue([
      {
        id: 1,
        name: 'Gemini',
        type: 'apikey',
        value: '',
        isActive: true,
        createdAt: '2025-12-01T00:00:00.000Z',
        updatedAt: '2025-12-01T00:00:00.000Z',
        serviceType: 'Google',
        modelName: 'gemini-3-flash-preview',
        model: 'gemini-3-flash-preview',
        thinkingLevel: 'low'
      }
    ])
    systemPromptMocks.getSystemPrompts.mockResolvedValue([])

    const service = new UnifiedConfigService()
    const configs = await service.getUnifiedConfigurations()

    expect(configs[0].thinkingLevel).toBe('low')
  })

  test('handles null thinkingLevel for legacy configs', async () => {
    aiConfigMocks.getConfigurations.mockResolvedValue([
      {
        id: 2,
        name: 'Gemini',
        type: 'apikey',
        value: '',
        isActive: true,
        createdAt: '2025-12-01T00:00:00.000Z',
        updatedAt: '2025-12-01T00:00:00.000Z',
        serviceType: 'Google',
        modelName: 'gemini-3-flash-preview',
        model: 'gemini-3-flash-preview',
        thinkingLevel: null
      }
    ])
    systemPromptMocks.getSystemPrompts.mockResolvedValue([])

    const service = new UnifiedConfigService()
    const configs = await service.getUnifiedConfigurations()

    expect(configs[0].thinkingLevel).toBeNull()
  })
})
