import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AIConfiguration } from '@prisma/client';

let OpenAITranslationService: typeof import('../OpenAITranslationService').OpenAITranslationService;
let modelSpecs: typeof import('../../model-specs');

vi.mock('../../../limits', () => ({
  limitEnforcement: {
    checkTokenUsage: vi.fn().mockResolvedValue({
      canProceed: true,
      remainingTokens: 0,
      warningLevel: null
    })
  }
}));

vi.mock('../../../token', () => ({
  estimateInputTokensAndCost: vi.fn().mockReturnValue({ tokenCount: 10, cost: 0.0001 }),
  estimateOutputTokensAndCost: vi.fn().mockReturnValue({ tokenCount: 5, cost: 0.00005 })
}));

vi.mock('../../../token/calculation', () => ({
  convertToPerTokenRate: vi.fn().mockReturnValue(0)
}));

vi.mock('../../../token/usage-tracker', () => ({
  default: {
    logApiUsage: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../../encryption', () => ({
  decryptApiKey: vi.fn().mockResolvedValue('api-key')
}));

vi.mock('../../translation-recovery', () => ({
  translationRecovery: {
    recoverStuckTranslations: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../base/AITranslationService', () => ({
  AITranslationService: class {
    protected config: any;
    protected serviceType: string;
    constructor(config: any) {
      this.config = config;
      this.serviceType = config.serviceType;
    }
    protected shouldSkipTranslation() {
      return false;
    }
    protected createSkippedTranslationResult(text: string) {
      return {
        translatedText: text,
        metrics: {
          duration: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalCost: 0
        }
      };
    }
    protected async trackSuccessfulUsage() {
      return;
    }
    protected getModel() {
      if (!this.config.model) {
        throw new Error('AI model not configured');
      }
      return this.config.model;
    }
  }
}));

vi.mock('../../prompts/PromptBuilder', () => ({
  PromptBuilder: {
    getPromptConfiguration: vi.fn().mockResolvedValue({
      systemPrompt: 'Translate to {{targetLanguage}}',
      temperature: 0.7,
      topP: 1,
      maxTokens: 100,
      isCustom: false
    })
  }
}));

vi.mock('../../prompts/TemplateEngine', () => ({
  TemplateEngine: {
    substituteVariables: vi.fn().mockReturnValue('system')
  }
}));

const buildConfig = (overrides: Partial<AIConfiguration> = {}): AIConfiguration =>
  ({
    id: 1,
    name: 'OpenAI',
    type: 'apikey',
    value: '',
    description: null,
    serviceType: 'OpenAI',
    model: 'gpt-5-2025-08-07',
    modelName: 'gpt-5',
    endpointUrl: '',
    encryptedApiKey: 'encrypted',
    inputCost: 1,
    outputCost: 2,
    unitPrice: 'per_1m',
    temperature: 0.7,
    topP: 1,
    maxTokens: 100,
    inputTokenLimit: null,
    outputTokenLimit: null,
    dailyCostLimit: null,
    monthlyCostLimit: null,
    tokensPerMinute: null,
    requestsPerMinute: null,
    requestsPerDay: null,
    thinkingLevel: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    salt: 'salt',
    ...overrides
  }) as AIConfiguration;

describe('OpenAITranslationService thinking level', () => {
  beforeEach(async () => {
    modelSpecs = await import('../../model-specs');
    OpenAITranslationService = (await import('../OpenAITranslationService')).OpenAITranslationService;
  });

  test('uses config thinking level when provided for GPT-5', () => {
    const service = new OpenAITranslationService(buildConfig()) as any;
    const result = service.checkAndOverrideParameters('gpt-5-2025-08-07', 1, 1, 'high');

    expect(result.reasoningEffort).toBe('high');
  });

  test('falls back to model default when config is null', () => {
    const service = new OpenAITranslationService(buildConfig()) as any;
    const result = service.checkAndOverrideParameters('gpt-5-nano-2025-08-07', 1, 1, null);

    expect(result.reasoningEffort).toBe('minimal');
  });

  test('falls back to low when model default is missing', () => {
    const service = new OpenAITranslationService(buildConfig()) as any;
    const getModelSpecSpy = vi.spyOn(modelSpecs, 'getModelSpecByModel');
    getModelSpecSpy.mockImplementation((model: string) => {
      if (model === 'gpt-5-custom') {
        return {
          apiParameters: {
            modelFamily: 'gpt-5'
          }
        } as any;
      }
      return undefined;
    });

    const result = service.checkAndOverrideParameters('gpt-5-custom', 1, 1, null);

    expect(result.reasoningEffort).toBe('low');
    getModelSpecSpy.mockRestore();
  });

  test('ignores thinking level for non-GPT-5 models', () => {
    const service = new OpenAITranslationService(buildConfig()) as any;
    const result = service.checkAndOverrideParameters('gpt-4o-mini-2024-07-18', 1, 1, 'low');

    expect(result.reasoningEffort).toBeUndefined();
  });

  test('includes reasoning_effort for GPT-5 API calls', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify({ translatedText: 'Hola' }) }
        }
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 }
    });
    const service = new OpenAITranslationService(
      buildConfig({ thinkingLevel: 'minimal' })
    ) as any;
    vi.spyOn(service, 'getOpenAIClient').mockResolvedValue({
      chat: { completions: { create } }
    });

    await service.translateText({ text: 'Hello', targetLanguage: 'Spanish' });

    const request = create.mock.calls[0][0];
    expect(request.reasoning_effort).toBe('minimal');
  });

  test('omits reasoning_effort for non-GPT-5 API calls', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify({ translatedText: 'Hola' }) }
        }
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 }
    });
    const service = new OpenAITranslationService(
      buildConfig({
        model: 'gpt-4o-mini-2024-07-18',
        modelName: 'gpt-4o-mini',
        thinkingLevel: 'high'
      })
    ) as any;
    vi.spyOn(service, 'getOpenAIClient').mockResolvedValue({
      chat: { completions: { create } }
    });

    await service.translateText({ text: 'Hello', targetLanguage: 'Spanish' });

    const request = create.mock.calls[0][0];
    expect(request.reasoning_effort).toBeUndefined();
  });
});
