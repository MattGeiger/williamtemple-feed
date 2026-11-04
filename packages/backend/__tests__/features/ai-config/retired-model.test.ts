// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { afterEach, expect, test, vi } from 'vitest';
import type { AIConfiguration } from '@prisma/client';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class {
  aIConfiguration = { findFirst: mocks.findFirst };
} }));
vi.mock('../../../src/services/ai/providers/OpenAITranslationService', () => ({
  OpenAITranslationService: class { constructor(public config: unknown) {} },
}));
vi.mock('../../../src/services/ai/providers/GoogleTranslationService', () => ({ GoogleTranslationService: class {} }));
vi.mock('../../../src/services/ai/providers/AnthropicTranslationService', () => ({ AnthropicTranslationService: class {} }));
import { AIServiceFactory } from '../../../src/services/ai/factory/AIServiceFactory';

const config = (model: string) => ({ id: 1, serviceType: 'OpenAI', model,
  updatedAt: new Date('2026-11-01T00:00:00Z') }) as AIConfiguration;

afterEach(() => { vi.useRealTimers(); AIServiceFactory.clearCache(); });

test('known retired models are refused with replacement advice before service creation', () => {
  expect(() => AIServiceFactory.createServiceFromConfiguration(config('gpt-4.1-nano-2025-04-14')))
    .toThrow(expect.objectContaining({ code: 'AI_MODEL_RETIRED', message: expect.stringContaining('Choose') }));
});

test('a cached service cannot bypass its shutdown date', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-12-10T23:59:59Z'));
  mocks.findFirst.mockResolvedValue(config('gpt-5-mini-2025-08-07'));
  await expect(AIServiceFactory.createService()).resolves.toBeDefined();
  vi.setSystemTime(new Date('2026-12-11T00:00:00Z'));
  await expect(AIServiceFactory.createService()).rejects.toMatchObject({ code: 'AI_MODEL_RETIRED' });
});

test('Custom models and callable withdrawn models still resolve', () => {
  expect(AIServiceFactory.createServiceFromConfiguration(config('gpt-6.9-custom'))).toBeDefined();
  expect(AIServiceFactory.createServiceFromConfiguration(config('gpt-5.6-luna'))).toBeDefined();
});
