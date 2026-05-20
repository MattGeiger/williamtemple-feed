// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { Router } from 'express';
import { NextFunction, Request, Response } from 'express';
import prisma from '../../../db';
import { TOKEN_LIMITS, TOKEN_RATES, MODEL_NAME, getWarningLevel } from '../../../config/limits';
import ApiUsageTracker from '../../../services/token/usage-tracker';
import { UsageRecordService } from '../../../services/usage-record';
import { DateRangeResolver } from '../../../utils/dateRangeResolver';

const router = Router();



/**
 * GET /api/projections/token-metrics
 * Returns comprehensive token usage metrics with service-specific filtering
 * Query params:
 *   - serviceProvider?: string (e.g., 'OpenAI', 'Anthropic', 'Google') - filter by AI service
 */
router.get('/token-metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceProvider } = req.query;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Get AI configuration for service-specific limits and pricing
    let activeConfig;
    if (serviceProvider) {
      activeConfig = await prisma.aIConfiguration.findFirst({
        where: {
          type: 'apikey',
          serviceType: serviceProvider as string,
          isActive: true
        }
      });
      
      if (!activeConfig) {
        return res.status(400).json({
          error: `No active configuration found for service: ${serviceProvider}`
        });
      }
    } else {
      // Get any active configuration for default limits
      activeConfig = await prisma.aIConfiguration.findFirst({
        where: {
          type: 'apikey',
          isActive: true
        }
      });
    }

    // Use UsageRecord table for consistent multi-service data
    const [dailyUsage, monthlyUsage, previousMonthlyUsage] = await Promise.all([
      serviceProvider ? 
        UsageRecordService.getServiceUsageMetrics(serviceProvider as string, startOfDay) :
        UsageRecordService.getAllServiceUsageMetrics(startOfDay),
      serviceProvider ?
        UsageRecordService.getServiceUsageMetrics(serviceProvider as string, startOfMonth) :
        UsageRecordService.getAllServiceUsageMetrics(startOfMonth),
      serviceProvider ?
        UsageRecordService.getServiceUsageMetrics(serviceProvider as string, startOfPreviousMonth, startOfMonth) :
        UsageRecordService.getAllServiceUsageMetrics(startOfPreviousMonth, startOfMonth)
    ]);

    // Get historical usage data from UsageRecord service (7 days back)
    const dateRange = DateRangeResolver.resolveTimeRange('7d');
    const historicalData = await UsageRecordService.getHistoricalUsage(serviceProvider as string | undefined, dateRange.startDate);
    const modelKey = (MODEL_NAME in TOKEN_LIMITS.MODEL_DAILY_LIMITS
      ? MODEL_NAME
      : 'gpt-4o-mini') as keyof typeof TOKEN_LIMITS.MODEL_DAILY_LIMITS;

    const dailyUsageHistory = historicalData.map(day => ({
      date: day.date,
      usage: day.totalTokens,
      limit: activeConfig?.tokensPerMinute ? activeConfig.tokensPerMinute * 1440 : TOKEN_LIMITS.MODEL_DAILY_LIMITS?.[modelKey] || 1_000_000
    }));

    // Calculate current values from UsageRecord aggregations
    const dailyTokens = Array.isArray(dailyUsage) ?
      dailyUsage.reduce((sum, service) => sum + service.totalPromptTokens + service.totalCompletionTokens, 0) :
      dailyUsage.totalPromptTokens + dailyUsage.totalCompletionTokens;
    
    const monthlyTokens = Array.isArray(monthlyUsage) ?
      monthlyUsage.reduce((sum, service) => sum + service.totalPromptTokens + service.totalCompletionTokens, 0) :
      monthlyUsage.totalPromptTokens + monthlyUsage.totalCompletionTokens;
    
    const previousMonthTokens = Array.isArray(previousMonthlyUsage) ?
      previousMonthlyUsage.reduce((sum, service) => sum + service.totalPromptTokens + service.totalCompletionTokens, 0) :
      previousMonthlyUsage.totalPromptTokens + previousMonthlyUsage.totalCompletionTokens;
      
    const monthlyCost = Array.isArray(monthlyUsage) ?
      monthlyUsage.reduce((sum, service) => sum + service.totalCost, 0) :
      monthlyUsage.totalCost;
      
    const dailyCost = Array.isArray(dailyUsage) ?
      dailyUsage.reduce((sum, service) => sum + service.totalCost, 0) :
      dailyUsage.totalCost;
    
    // Calculate growth rates
    const dailyGrowthRate = calculateGrowthRate(dailyTokens, dailyUsageHistory);
    const monthlyGrowthRate = calculateGrowthRate(monthlyTokens, previousMonthTokens);

    // Get limits from active configuration or defaults
    const tpmLimit = activeConfig?.tokensPerMinute || TOKEN_LIMITS.RATE_LIMITS.TPM;
    const dailyTokenLimit = tpmLimit * 1440; // TPM * minutes per day
    const monthlyTokenLimit = dailyTokenLimit * 30;
    
    // Get warning levels
    const dailyWarningLevel = getWarningLevel(dailyTokens, dailyTokenLimit);
    const monthlyWarningLevel = getWarningLevel(monthlyTokens, monthlyTokenLimit);

    // Get real-time rate metrics from UsageRecord table
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const currentMinuteUsage = await prisma.usageRecord.aggregate({
      where: {
        timestamp: { gte: oneMinuteAgo },
        ...(serviceProvider && { serviceProvider: serviceProvider as string })
      },
      _sum: {
        promptTokens: true,
        completionTokens: true
      },
      _count: {
        id: true
      }
    });

    const currentDayRequests = await prisma.usageRecord.count({
      where: {
        timestamp: { gte: startOfDay },
        ...(serviceProvider && { serviceProvider: serviceProvider as string })
      }
    });
    
    // Calculate token details from UsageRecord data
    const promptTokensTotal = Array.isArray(monthlyUsage) ?
      monthlyUsage.reduce((sum, service) => sum + service.totalPromptTokens, 0) :
      monthlyUsage.totalPromptTokens;
    
    const completionTokensTotal = Array.isArray(monthlyUsage) ?
      monthlyUsage.reduce((sum, service) => sum + service.totalCompletionTokens, 0) :
      monthlyUsage.totalCompletionTokens;
    
    // Format response data from real UsageRecord database
    const responseData = {
      modelName: activeConfig?.model || MODEL_NAME || 'gpt-4o-mini',
      serviceProvider: serviceProvider || 'multi-service',
      dailyTokens,
      monthlyTokens,
      dailyTokenLimit,
      monthlyTokenLimit,
      dailyTokensRemaining: Math.max(0, dailyTokenLimit - dailyTokens),
      monthlyTokensRemaining: Math.max(0, monthlyTokenLimit - monthlyTokens),
      dailyWarningLevel,
      monthlyWarningLevel,
      dailyGrowthRate,
      monthlyGrowthRate,
      dailyCost,
      monthlyCost,
      costLimit: TOKEN_LIMITS.COST_LIMITS?.MONTHLY || 2000.00,
      // Configuration-aware rate limits
      rateLimit: tpmLimit,
      currentRatePerMinute: (currentMinuteUsage._sum.promptTokens || 0) + (currentMinuteUsage._sum.completionTokens || 0),
      requestsPerMinute: currentMinuteUsage._count.id || 0,
      requestsPerDay: currentDayRequests,
      rateLimitResetTime: new Date(now.getTime() + 60000).toISOString(),
      // Token details from UsageRecord aggregations
      promptTokensTotal,
      completionTokensTotal,
      // Token rates from configuration or fallback
      tokenRates: activeConfig ? {
        prompt: activeConfig.inputCost ? (activeConfig.unitPrice === 'per_1m' ? activeConfig.inputCost / 1_000_000 : activeConfig.inputCost / 1_000) : 0.00000015,
        completion: activeConfig.outputCost ? (activeConfig.unitPrice === 'per_1m' ? activeConfig.outputCost / 1_000_000 : activeConfig.outputCost / 1_000) : 0.0000006
      } : TOKEN_RATES?.[MODEL_NAME] || { prompt: 0.00000015, completion: 0.0000006 },
      // Historical data from UsageRecord service
      historicalUsage: dailyUsageHistory
    };

    // Previously logged "Token metrics: Using real UsageRecord data" on every
    // request, which spammed the dev console at ~1 line/second because the
    // dashboard polls this endpoint constantly. Removed; the data source is
    // implicit in the response shape if debugging is needed.

    res.json({ metrics: responseData });

  } catch (error) {
    console.error('Token metrics API error:', error);
    next(error);
  }
});

/**
 * Calculate growth rate based on historical data
 */
function calculateGrowthRate(current: number, historicalData: any): number {
  if (Array.isArray(historicalData) && historicalData.length > 0) {
    // Calculate average of historical data excluding today
    const historicalAvg = historicalData
      .slice(0, -1)
      .reduce((sum, day) => sum + day.usage, 0) / (historicalData.length - 1);
    
    if (historicalAvg === 0) return 0;
    return (current - historicalAvg) / historicalAvg;
  } else if (typeof historicalData === 'number' && historicalData > 0) {
    // Compare with a single previous value
    return (current - historicalData) / historicalData;
  }
  
  return 0;
}

export default router;
