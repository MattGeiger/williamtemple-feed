// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { PrismaClient, type AIConfiguration } from '@prisma/client';
import {
  TOKEN_LIMITS,
  OPTIMIZATION_THRESHOLDS,
  getWarningLevel,
  wouldExceedLimit,
  calculateRemainingTokens
} from '../../config/limits';
import { alertService } from '../alerts';
import { convertToPerTokenRate } from '../token/calculation';

const prisma = new PrismaClient();

interface TokenUsageCheck {
  canProceed: boolean;
  remainingTokens: number;
  warningLevel: keyof typeof TOKEN_LIMITS.WARNING_THRESHOLDS | null;
  reason?: string;
}

interface UsagePeriod {
  dailyTokens: number;
  monthlyTokens: number;
  dailyCost: number;
  monthlyCost: number;
}

export class LimitEnforcementService {
  private static instance: LimitEnforcementService;
  private readonly SYSTEM_PROMPT_TOKENS = 61;

  /**
   * Configurations already reported as having an unenforceable cost limit.
   *
   * This check sits before every translation, and `createAlert` writes a row
   * and emits an event, so alerting per request would bury the alert list
   * during a bulk import. Once per configuration per process is enough to be
   * seen, and resets on restart — which for a service redeployed on every
   * release is a reasonable cadence to be reminded.
   */
  private readonly unmeteredWarned = new Set<number>();

  private constructor() {}

  public static getInstance(): LimitEnforcementService {
    if (!LimitEnforcementService.instance) {
      LimitEnforcementService.instance = new LimitEnforcementService();
    }
    return LimitEnforcementService.instance;
  }

  async checkTokenUsage(
    estimatedTokens: number,
    config: AIConfiguration
  ): Promise<TokenUsageCheck> {
    if (!config.model || !config.id) {
      throw new Error('Model configuration required for limit enforcement.');
    }

    const usage = await this.getCurrentUsage(config.id);
    
    const dailyTokenLimit = this.getDailyTokenLimit(config);
    const monthlyTokenLimit = dailyTokenLimit !== null ? dailyTokenLimit * 30 : null;
    const dailyCostLimit = config.dailyCostLimit && config.dailyCostLimit > 0
      ? config.dailyCostLimit
      : null;
    const monthlyCostLimit = config.monthlyCostLimit && config.monthlyCostLimit > 0
      ? config.monthlyCostLimit
      : null;
    
    // Check daily token limit
    if (dailyTokenLimit !== null && wouldExceedLimit(usage.dailyTokens, estimatedTokens, dailyTokenLimit)) {
      return {
        canProceed: false,
        remainingTokens: calculateRemainingTokens(usage.dailyTokens, dailyTokenLimit),
        warningLevel: 'FINAL_WARNING',
        reason: 'Daily token limit would be exceeded'
      };
    }

    // Check monthly token limit
    if (monthlyTokenLimit !== null && wouldExceedLimit(usage.monthlyTokens, estimatedTokens, monthlyTokenLimit)) {
      return {
        canProceed: false,
        remainingTokens: calculateRemainingTokens(usage.monthlyTokens, monthlyTokenLimit),
        warningLevel: 'FINAL_WARNING',
        reason: 'Monthly token limit would be exceeded'
      };
    }

    // A cost limit with no price behind it cannot fire. `estimatedCost` is
    // zero, `usage.dailyCost` sums a `totalCost` written at the same zero
    // rate, and both comparisons below reduce to `0 + 0 > limit` on every
    // request — so the limit reads as protection while stopping nothing
    // (defect 6, ISSUES.md #84).
    //
    // The API now refuses to save this pair, but rows saved before it did,
    // and restore-from-backup and the scripts directory write configurations
    // without passing through the route at all. Translation is allowed to
    // continue: this is a configuration defect, and halting the pantry's
    // translations over it would be a worse outcome than spend that is
    // uncapped but now visible.
    if (dailyCostLimit !== null || monthlyCostLimit !== null) {
      const inputRate = convertToPerTokenRate(config.inputCost || 0, config.unitPrice);
      const outputRate = convertToPerTokenRate(config.outputCost || 0, config.unitPrice);

      if (inputRate === 0 && outputRate === 0 && !this.unmeteredWarned.has(config.id)) {
        this.unmeteredWarned.add(config.id);
        await alertService.createAlert(
          'critical',
          `"${config.name}" has a cost limit but no input or output rate, so FEED cannot `
          + 'measure what it spends and the limit will never stop a translation. '
          + 'Open it and set the rates for this model.'
        );
      }
    }

    const estimatedCost = await this.calculateCost(estimatedTokens, config);
    if (dailyCostLimit !== null && wouldExceedLimit(usage.dailyCost, estimatedCost, dailyCostLimit)) {
      return {
        canProceed: false,
        remainingTokens: await this.calculateRemainingTokens(usage.dailyCost, dailyCostLimit, config),
        warningLevel: 'FINAL_WARNING',
        reason: 'Daily cost limit would be exceeded'
      };
    }

    if (monthlyCostLimit !== null && wouldExceedLimit(usage.monthlyCost, estimatedCost, monthlyCostLimit)) {
      return {
        canProceed: false,
        remainingTokens: await this.calculateRemainingTokens(usage.monthlyCost, monthlyCostLimit, config),
        warningLevel: 'FINAL_WARNING',
        reason: 'Monthly cost limit would be exceeded'
      };
    }

    const warningLevel = dailyTokenLimit !== null
      ? getWarningLevel(usage.dailyTokens + estimatedTokens, dailyTokenLimit)
      : null;
    
    if (warningLevel && dailyTokenLimit !== null) {
      const percentUsed = ((usage.dailyTokens + estimatedTokens) / dailyTokenLimit) * 100;
      await alertService.createAlert(warningLevel === 'FINAL_WARNING' ? 'critical' : 'warning',
        `Approaching daily token limit for ${config.model}: ${percentUsed.toFixed(1)}% used`);
    }

    return {
      canProceed: true,
      remainingTokens: dailyTokenLimit !== null
        ? calculateRemainingTokens(usage.dailyTokens + estimatedTokens, dailyTokenLimit)
        : 0,
      warningLevel
    };
  }

  private async getCurrentUsage(configId: number): Promise<UsagePeriod> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [dailyUsage, monthlyUsage] = await Promise.all([
      prisma.usageRecord.aggregate({
        where: {
          aiConfigurationId: configId,
          timestamp: { gte: startOfDay },
          success: true
        },
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalCost: true
        }
      }),
      prisma.usageRecord.aggregate({
        where: {
          aiConfigurationId: configId,
          timestamp: { gte: startOfMonth },
          success: true
        },
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalCost: true
        }
      })
    ]);

    return {
      dailyTokens: (dailyUsage._sum.promptTokens || 0) + (dailyUsage._sum.completionTokens || 0),
      monthlyTokens: (monthlyUsage._sum.promptTokens || 0) + (monthlyUsage._sum.completionTokens || 0),
      dailyCost: dailyUsage._sum.totalCost || 0,
      monthlyCost: monthlyUsage._sum.totalCost || 0
    };
  }

  private async calculateCost(tokens: number, config: AIConfiguration): Promise<number> {
    const promptCost = convertToPerTokenRate(config?.inputCost || 0, config?.unitPrice);
    const completionCost = convertToPerTokenRate(config?.outputCost || 0, config?.unitPrice);
    
    // For translation service:
    // - Fixed system prompt (61 tokens)
    // - Short input texts
    // - Similar length output
    const promptTokens = this.SYSTEM_PROMPT_TOKENS + (tokens * 0.5);  // System prompt + input
    const completionTokens = tokens * 0.5;     // Output typically matches input length
    return (promptTokens * promptCost) + (completionTokens * completionCost);
  }

  private getDailyTokenLimit(config: AIConfiguration): number | null {
    if (config.tokensPerMinute && config.tokensPerMinute > 0) {
      return config.tokensPerMinute * 60 * 24;
    }

    const modelKey = this.getTokenLimitModelKey(config.model);
    if (modelKey) {
      return TOKEN_LIMITS.MODEL_DAILY_LIMITS?.[modelKey] ?? null;
    }

    return null;
  }

  private getTokenLimitModelKey(
    model?: string | null
  ): keyof typeof TOKEN_LIMITS.MODEL_DAILY_LIMITS | null {
    if (!model) {
      return null;
    }

    if (model.startsWith('gpt-4o-mini')) {
      return 'gpt-4o-mini';
    }
    if (model.startsWith('gpt-4')) {
      return 'gpt-4';
    }
    if (model.startsWith('gpt-3.5')) {
      return 'gpt-3.5-turbo';
    }

    return null;
  }

  private async calculateRemainingTokens(
    currentCost: number,
    costLimit: number,
    config: AIConfiguration
  ): Promise<number> {
    const promptCost = convertToPerTokenRate(config?.inputCost || 0, config?.unitPrice);
    const completionCost = convertToPerTokenRate(config?.outputCost || 0, config?.unitPrice);
    const avgRate = (promptCost + completionCost) / 2;
    
    if (avgRate === 0) return 0;
    
    const remainingCost = costLimit - currentCost;
    return Math.floor(remainingCost / avgRate);
  }

  // Use configured model
  async suggestModelOptimization(): Promise<string> {
    const config = await prisma.aIConfiguration.findFirst({
      where: { isActive: true, type: 'apikey' },
      orderBy: { updatedAt: 'desc' }
    });
    
    return config?.model || 'gpt-4o-mini';
  }
}

export const limitEnforcement = LimitEnforcementService.getInstance();
