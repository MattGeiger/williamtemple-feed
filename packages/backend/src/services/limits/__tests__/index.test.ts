// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { AIConfiguration } from '@prisma/client';

const mockPrisma = vi.hoisted(() => ({
  usageRecord: {
    aggregate: vi.fn()
  },
  aIConfiguration: {
    findFirst: vi.fn()
  }
}));

vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');
  return {
    ...actual,
    PrismaClient: vi.fn(() => mockPrisma)
  };
});

vi.mock('../../alerts', () => ({
  alertService: {
    createAlert: vi.fn()
  }
}));

import { LimitEnforcementService } from '../index';

const createConfig = (overrides: Partial<AIConfiguration> = {}): AIConfiguration => {
  return {
    id: 1,
    model: 'gpt-4o-mini',
    inputCost: 0.15,
    outputCost: 0.6,
    unitPrice: 'per_1m',
    requestsPerDay: 10000,
    dailyCostLimit: null,
    monthlyCostLimit: null,
    ...overrides
  } as AIConfiguration;
};

const setUsage = (daily: { promptTokens: number; completionTokens: number; totalCost: number }, monthly: {
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}) => {
  mockPrisma.usageRecord.aggregate
    .mockResolvedValueOnce({
      _sum: {
        promptTokens: daily.promptTokens,
        completionTokens: daily.completionTokens,
        totalCost: daily.totalCost
      }
    })
    .mockResolvedValueOnce({
      _sum: {
        promptTokens: monthly.promptTokens,
        completionTokens: monthly.completionTokens,
        totalCost: monthly.totalCost
      }
    });
};

describe('LimitEnforcementService cost limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.usageRecord.aggregate.mockResolvedValue({
      _sum: { promptTokens: 0, completionTokens: 0, totalCost: 0 }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('throws when model configuration is missing', async () => {
    const service = LimitEnforcementService.getInstance();
    await expect(service.checkTokenUsage(10, { id: undefined } as AIConfiguration)).rejects.toThrow(
      'Model configuration required for limit enforcement.'
    );
  });

  test('allows usage when daily and monthly cost limits are null', async () => {
    setUsage(
      { promptTokens: 0, completionTokens: 0, totalCost: 500 },
      { promptTokens: 0, completionTokens: 0, totalCost: 1000 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(100, createConfig());

    expect(result.canProceed).toBe(true);
  });

  test('treats zero cost limits as unlimited', async () => {
    setUsage(
      { promptTokens: 0, completionTokens: 0, totalCost: 500 },
      { promptTokens: 0, completionTokens: 0, totalCost: 1000 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(
      100,
      createConfig({ dailyCostLimit: 0, monthlyCostLimit: 0 })
    );

    expect(result.canProceed).toBe(true);
  });

  test('allows usage when estimated cost stays within limits', async () => {
    setUsage(
      { promptTokens: 0, completionTokens: 0, totalCost: 0.5 },
      { promptTokens: 0, completionTokens: 0, totalCost: 0.5 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(
      39,
      createConfig({
        inputCost: 1,
        outputCost: 1,
        unitPrice: 'per_1k',
        dailyCostLimit: 1,
        monthlyCostLimit: 1
      })
    );

    expect(result.canProceed).toBe(true);
  });

  test('blocks when daily cost limit would be exceeded', async () => {
    setUsage(
      { promptTokens: 0, completionTokens: 0, totalCost: 0.9 },
      { promptTokens: 0, completionTokens: 0, totalCost: 0.9 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(
      1000,
      createConfig({
        inputCost: 1,
        outputCost: 1,
        unitPrice: 'per_1k',
        dailyCostLimit: 1,
        monthlyCostLimit: 10
      })
    );

    expect(result.canProceed).toBe(false);
    expect(result.reason).toBe('Daily cost limit would be exceeded');
  });

  test('allows usage that reaches the daily cost limit exactly', async () => {
    setUsage(
      { promptTokens: 0, completionTokens: 0, totalCost: 0.9 },
      { promptTokens: 0, completionTokens: 0, totalCost: 0.9 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(
      39,
      createConfig({
        inputCost: 1,
        outputCost: 1,
        unitPrice: 'per_1k',
        dailyCostLimit: 1,
        monthlyCostLimit: 1
      })
    );

    expect(result.canProceed).toBe(true);
  });

  test('blocks when monthly cost limit would be exceeded', async () => {
    setUsage(
      { promptTokens: 0, completionTokens: 0, totalCost: 0.2 },
      { promptTokens: 0, completionTokens: 0, totalCost: 0.9 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(
      1000,
      createConfig({
        inputCost: 1,
        outputCost: 1,
        unitPrice: 'per_1k',
        dailyCostLimit: 10,
        monthlyCostLimit: 1
      })
    );

    expect(result.canProceed).toBe(false);
    expect(result.reason).toBe('Monthly cost limit would be exceeded');
  });

  test('evaluates limits independently per configuration', async () => {
    setUsage(
      { promptTokens: 0, completionTokens: 0, totalCost: 0.9 },
      { promptTokens: 0, completionTokens: 0, totalCost: 0.9 }
    );
    setUsage(
      { promptTokens: 0, completionTokens: 0, totalCost: 0.1 },
      { promptTokens: 0, completionTokens: 0, totalCost: 0.1 }
    );

    const service = LimitEnforcementService.getInstance();

    const blocked = await service.checkTokenUsage(
      139,
      createConfig({
        id: 1,
        inputCost: 1,
        outputCost: 1,
        unitPrice: 'per_1k',
        dailyCostLimit: 1,
        monthlyCostLimit: 1
      })
    );

    const allowed = await service.checkTokenUsage(
      39,
      createConfig({
        id: 2,
        inputCost: 1,
        outputCost: 1,
        unitPrice: 'per_1k',
        dailyCostLimit: 1,
        monthlyCostLimit: 1
      })
    );

    expect(blocked.canProceed).toBe(false);
    expect(blocked.reason).toBe('Daily cost limit would be exceeded');
    expect(allowed.canProceed).toBe(true);

    const [dailyCallA, monthlyCallA, dailyCallB, monthlyCallB] =
      mockPrisma.usageRecord.aggregate.mock.calls.map((call) => call[0]);

    expect(dailyCallA.where.aiConfigurationId).toBe(1);
    expect(monthlyCallA.where.aiConfigurationId).toBe(1);
    expect(dailyCallB.where.aiConfigurationId).toBe(2);
    expect(monthlyCallB.where.aiConfigurationId).toBe(2);
  });

  test('uses precise per-1m rates when evaluating cost limits', async () => {
    const tokens = 1000;
    const inputCost = 0.05;
    const outputCost = 0.15;
    const expectedCost =
      ((61 + tokens * 0.5) * (inputCost / 1_000_000)) +
      ((tokens * 0.5) * (outputCost / 1_000_000));

    setUsage(
      { promptTokens: 0, completionTokens: 0, totalCost: 0 },
      { promptTokens: 0, completionTokens: 0, totalCost: 0 }
    );

    const service = LimitEnforcementService.getInstance();
    const blocked = await service.checkTokenUsage(
      tokens,
      createConfig({
        inputCost,
        outputCost,
        unitPrice: 'per_1m',
        dailyCostLimit: expectedCost - 0.000001,
        monthlyCostLimit: 10
      })
    );

    setUsage(
      { promptTokens: 0, completionTokens: 0, totalCost: 0 },
      { promptTokens: 0, completionTokens: 0, totalCost: 0 }
    );

    const allowed = await service.checkTokenUsage(
      tokens,
      createConfig({
        inputCost,
        outputCost,
        unitPrice: 'per_1m',
        dailyCostLimit: expectedCost + 0.000001,
        monthlyCostLimit: 10
      })
    );

    expect(blocked.canProceed).toBe(false);
    expect(blocked.reason).toBe('Daily cost limit would be exceeded');
    expect(allowed.canProceed).toBe(true);
  });

  test('prioritizes token limits before cost limits', async () => {
    setUsage(
      { promptTokens: 700, completionTokens: 739, totalCost: 0 },
      { promptTokens: 700, completionTokens: 739, totalCost: 0 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(
      2,
      createConfig({
        tokensPerMinute: 1,
        dailyCostLimit: 0.0001,
        monthlyCostLimit: 0.0001
      })
    );

    expect(result.canProceed).toBe(false);
    expect(result.reason).toBe('Daily token limit would be exceeded');
  });

  test('counts prompt and completion tokens when enforcing daily limit', async () => {
    setUsage(
      { promptTokens: 700, completionTokens: 730, totalCost: 0 },
      { promptTokens: 0, completionTokens: 0, totalCost: 0 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(
      15,
      createConfig({ tokensPerMinute: 1 })
    );

    expect(result.canProceed).toBe(false);
    expect(result.reason).toBe('Daily token limit would be exceeded');
  });

  test('derives daily token limits from tokens per minute', async () => {
    setUsage(
      { promptTokens: 2000, completionTokens: 0, totalCost: 0 },
      { promptTokens: 2000, completionTokens: 0, totalCost: 0 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(
      1000,
      createConfig({ tokensPerMinute: 2 })
    );

    expect(result.canProceed).toBe(false);
    expect(result.reason).toBe('Daily token limit would be exceeded');
  });

  test('uses tokens per minute instead of requests per day for token limits', async () => {
    setUsage(
      { promptTokens: 100, completionTokens: 0, totalCost: 0 },
      { promptTokens: 100, completionTokens: 0, totalCost: 0 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(
      100,
      createConfig({ tokensPerMinute: 100, requestsPerDay: 10 })
    );

    expect(result.canProceed).toBe(true);
  });

  test('falls back to model daily limits when tokens per minute is missing', async () => {
    setUsage(
      { promptTokens: 999_999, completionTokens: 0, totalCost: 0 },
      { promptTokens: 999_999, completionTokens: 0, totalCost: 0 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(
      2,
      createConfig({ tokensPerMinute: null, model: 'gpt-4o-mini' })
    );

    expect(result.canProceed).toBe(false);
    expect(result.reason).toBe('Daily token limit would be exceeded');
  });

  test('skips token limit when no tokens-per-minute and model has no defaults', async () => {
    setUsage(
      { promptTokens: 2_000_000, completionTokens: 0, totalCost: 0 },
      { promptTokens: 2_000_000, completionTokens: 0, totalCost: 0 }
    );

    const service = LimitEnforcementService.getInstance();
    const result = await service.checkTokenUsage(
      500_000,
      createConfig({
        tokensPerMinute: null,
        model: 'gpt-5-mini-2025-08-07',
        dailyCostLimit: null,
        monthlyCostLimit: null
      })
    );

    expect(result.canProceed).toBe(true);
  });

  test('queries usage records with daily and monthly boundaries', async () => {
    vi.useFakeTimers();
    const now = new Date('2025-12-28T12:34:56.000Z');
    vi.setSystemTime(now);

    setUsage(
      { promptTokens: 0, completionTokens: 0, totalCost: 0 },
      { promptTokens: 0, completionTokens: 0, totalCost: 0 }
    );

    const service = LimitEnforcementService.getInstance();
    await service.checkTokenUsage(10, createConfig({ id: 42 }));

    const [dailyCall, monthlyCall] = mockPrisma.usageRecord.aggregate.mock.calls.map((call) => call[0]);
    const expectedStartOfDay = new Date(now);
    expectedStartOfDay.setHours(0, 0, 0, 0);
    const expectedStartOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    expect(dailyCall.where.aiConfigurationId).toBe(42);
    expect(dailyCall.where.success).toBe(true);
    expect(dailyCall.where.timestamp.gte.getTime()).toBe(expectedStartOfDay.getTime());

    expect(monthlyCall.where.aiConfigurationId).toBe(42);
    expect(monthlyCall.where.success).toBe(true);
    expect(monthlyCall.where.timestamp.gte.getTime()).toBe(expectedStartOfMonth.getTime());
  });
});
