// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AIConfiguration } from '@prisma/client';

let GoogleTranslationService: typeof import('../GoogleTranslationService').GoogleTranslationService;
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

vi.mock('../../../token/usage-tracker', () => ({
  default: {
    logApiUsage: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../../encryption', () => ({
  decryptApiKey: vi.fn().mockResolvedValue('api-key')
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
      temperature: 1,
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
    name: 'Gemini',
    type: 'apikey',
    value: '',
    description: null,
    serviceType: 'Google',
    model: 'gemini-3-flash-preview',
    modelName: 'gemini-3-flash-preview',
    endpointUrl: '',
    encryptedApiKey: 'encrypted',
    inputCost: 0.1,
    outputCost: 0.2,
    unitPrice: 'per_1m',
    temperature: 1,
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

describe('GoogleTranslationService thinking level', () => {
  beforeEach(async () => {
    modelSpecs = await import('../../model-specs');
    GoogleTranslationService = (await import('../GoogleTranslationService')).GoogleTranslationService;
    const getModelSpecSpy = vi.spyOn(modelSpecs, 'getModelSpecByModel');
    getModelSpecSpy.mockImplementation((model: string) => {
      if (model === 'gemini-3-flash-preview') {
        return {
          apiParameters: {
            modelFamily: 'gemini-3',
            thinkingLevel: 'low',
            supportedThinkingLevels: ['minimal', 'low', 'medium', 'high']
          }
        } as any;
      }
      if (model === 'gemini-3-pro-preview') {
        return {
          apiParameters: {
            modelFamily: 'gemini-3',
            thinkingLevel: 'low',
            supportedThinkingLevels: ['low', 'high']
          }
        } as any;
      }
      if (model === 'gemini-3-custom') {
        return {
          apiParameters: {
            modelFamily: 'gemini-3',
            supportedThinkingLevels: ['low', 'high']
          }
        } as any;
      }
      if (model === 'gemini-2.5-flash') {
        return {
          apiParameters: {
            modelFamily: 'gemini-2.5'
          }
        } as any;
      }
      return undefined;
    });
  });

  test('uses config thinking level when provided', () => {
    const service = new GoogleTranslationService(buildConfig()) as any;
    const result = service.checkAndOverrideParameters('gemini-3-flash-preview', 1, 1, 'low');

    expect(result.thinkingLevel).toBe('low');
  });

  test('falls back to model default when config is null', () => {
    const service = new GoogleTranslationService(buildConfig()) as any;
    const result = service.checkAndOverrideParameters('gemini-3-flash-preview', 1, 1, null);

    expect(result.thinkingLevel).toBe('low');
  });

  test('falls back to low when no model default is provided', () => {
    const service = new GoogleTranslationService(buildConfig()) as any;
    const result = service.checkAndOverrideParameters('gemini-3-custom', 1, 1, null);

    expect(result.thinkingLevel).toBe('low');
  });

  test('accepts all thinking levels for Gemini 3 Flash', () => {
    const service = new GoogleTranslationService(buildConfig()) as any;
    const result = service.checkAndOverrideParameters('gemini-3-flash-preview', 1, 1, 'minimal');

    expect(result.thinkingLevel).toBe('minimal');
    expect(result.warnings).toHaveLength(0);
  });

  test('warns and falls back for unsupported Gemini 3 Pro levels', () => {
    const service = new GoogleTranslationService(buildConfig({ model: 'gemini-3-pro-preview' })) as any;
    const result = service.checkAndOverrideParameters('gemini-3-pro-preview', 1, 1, 'medium');

    expect(result.thinkingLevel).toBe('low');
    expect(result.warnings[0]).toContain('medium');
    expect(result.warnings[0]).toContain('low');
  });

  test('ignores thinking level for non-Gemini 3 models', () => {
    const service = new GoogleTranslationService(buildConfig({ model: 'gemini-2.5-flash' })) as any;
    const result = service.checkAndOverrideParameters('gemini-2.5-flash', 1, 1, 'low');

    expect(result.thinkingLevel).toBeUndefined();
  });

  test('includes thinkingConfig for Gemini 3 requests', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({ translatedText: 'Hola' })
    });
    const service = new GoogleTranslationService(buildConfig({ thinkingLevel: 'minimal' })) as any;
    vi.spyOn(service, 'getGoogleClient').mockResolvedValue({
      models: { generateContent }
    });

    await service.translateText({ text: 'Hello', targetLanguage: 'Spanish' });

    const request = generateContent.mock.calls[0][0];
    expect(request.config.thinkingConfig).toEqual({ thinking_level: 'minimal' });
  });

  test('omits thinkingConfig for non-Gemini 3 models', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({ translatedText: 'Hola' })
    });
    const service = new GoogleTranslationService(
      buildConfig({ model: 'gemini-2.5-flash', thinkingLevel: 'low' })
    ) as any;
    vi.spyOn(service, 'getGoogleClient').mockResolvedValue({
      models: { generateContent }
    });

    await service.translateText({ text: 'Hello', targetLanguage: 'Spanish' });

    const request = generateContent.mock.calls[0][0];
    expect(request.config.thinkingConfig).toBeUndefined();
  });
});
