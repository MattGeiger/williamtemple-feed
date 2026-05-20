import { Router } from 'express';
import { NextFunction, Request, Response } from 'express';
import { UsageRecordService } from '../../../services/usage-record';
import prisma from '../../../db';
import { DateRangeResolver } from '../../../utils/dateRangeResolver';

const router = Router();



/**
 * GET /api/projections/multi-service-metrics
 * Returns multi-service usage metrics with configuration-aware limits
 */
router.get('/multi-service-metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceProvider, timeRange, timezone } = req.query;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Extract user timezone for timezone-aware aggregation
    const userTimezone = timezone as string | undefined;
    
    // Convert timeRange to appropriate date range with timezone awareness
    const dateRange = DateRangeResolver.resolveTimeRange(timeRange as string, undefined, userTimezone);
    const historicalStartDate = dateRange.startDate;
    const historicalEndDate = dateRange.endDate;

    // Get all AI configurations (both active and inactive)
    const allConfigs = await prisma.aIConfiguration.findMany({
      where: {
        type: 'apikey'
      }
    });

    if (!allConfigs.length) {
      return res.status(400).json({
        error: 'No AI configurations found. Please configure AI settings.'
      });
    }

    // If specific service requested, filter to that service
  const targetConfigs = serviceProvider 
      ? allConfigs.filter(c => c.serviceType === serviceProvider)
      : allConfigs;

    if (!targetConfigs.length) {
      return res.status(400).json({
        error: `No configuration found for service: ${serviceProvider}`
      });
    }

    // Get unique service types from target configurations
    const uniqueServices = [...new Set(
      targetConfigs
        .map(config => config.serviceType)
        .filter((service): service is string => typeof service === 'string' && service.length > 0)
    )];

    // Get metrics for all configurations or specific service configurations
    const [dailyMetrics, monthlyMetrics, allConfigMetrics, historicalData] = await Promise.all([
      // Daily usage by configuration
      UsageRecordService.getAllConfigurationUsageMetrics(startOfDay),
      
      // Monthly usage by configuration
      UsageRecordService.getAllConfigurationUsageMetrics(startOfMonth),
      
      // All configuration breakdown
      UsageRecordService.getAllConfigurationUsageMetrics(),
      
      // Historical usage data with timezone-aware date range filtering
      UsageRecordService.getHistoricalUsage(serviceProvider as string | undefined, historicalStartDate, historicalEndDate, userTimezone)
    ]);

    // Get service-specific performance metrics with timezone-aware date ranges
    const servicePerformancePromises = uniqueServices.map(async (service) => {
      const metrics = await UsageRecordService.getPerformanceMetrics(service, historicalStartDate, historicalEndDate, userTimezone);
      return {
        serviceProvider: service,
        ...metrics
      };
    });

    const servicePerformanceMetrics = await Promise.all(servicePerformancePromises);

    // Create performance lookup map
    const performanceByService = new Map(servicePerformanceMetrics.map(metric => [
      metric.serviceProvider, 
      {
        averageResponseTime: metric.averageResponseTime,
        responseTimeRange: metric.responseTimeRange,
        responseTimeData: metric.responseTimeData
      }
    ]));

    // Calculate overall aggregated performance metrics for backward compatibility with timezone-aware date ranges
    const allServiceTypes = serviceProvider ? [serviceProvider] : uniqueServices;
    const aggregatedPerformanceMetrics = await UsageRecordService.getPerformanceMetrics(
      serviceProvider as string | undefined, 
      historicalStartDate,
      historicalEndDate,
      userTimezone
    );

    // Calculate real-time rate metrics from UsageRecord table (filter by target configurations)
    const targetConfigIds = targetConfigs.map(c => c.id);
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const currentMinuteUsage = await prisma.usageRecord.aggregate({
      where: {
        timestamp: { gte: oneMinuteAgo },
        aiConfigurationId: { in: targetConfigIds }
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
        aiConfigurationId: { in: targetConfigIds }
      }
    });

    // For single service, use that config; for multi-service, use first config as default
    const primaryConfig = targetConfigs[0];

    // Calculate current usage values across target configurations
    const targetConfigIdSet = new Set(targetConfigIds);
    
    const dailyConfigMetrics = dailyMetrics.filter(config => targetConfigIdSet.has(config.aiConfigurationId));
    const monthlyConfigMetrics = monthlyMetrics.filter(config => targetConfigIdSet.has(config.aiConfigurationId));
    
    const dailyTotal = dailyConfigMetrics.reduce((sum, config) => sum + config.totalPromptTokens + config.totalCompletionTokens, 0);
    const monthlyTotal = monthlyConfigMetrics.reduce((sum, config) => sum + config.totalPromptTokens + config.totalCompletionTokens, 0);
    const monthlyCost = monthlyConfigMetrics.reduce((sum, config) => sum + config.totalCost, 0);

    // Use configuration limits or defaults
    const tpmLimit = primaryConfig.tokensPerMinute || 200000;
    const rpmLimit = primaryConfig.requestsPerMinute || 500;
    const rpdLimit = primaryConfig.requestsPerDay || 10000;
    const dailyTokenLimit = tpmLimit * 1440; // TPM * minutes per day
    const monthlyTokenLimit = dailyTokenLimit * 30;

    // Warning level calculation
    const getWarningLevel = (current: number, limit: number) => {
      const usage = current / limit;
      if (usage >= 0.9) return 'critical';
      if (usage >= 0.75) return 'elevated';
      if (usage >= 0.5) return 'warning';
      return 'normal';
    };

    // Map usage data to configurations
    const configurationsWithUsage = targetConfigs.map(config => {
      const dailyUsage = dailyConfigMetrics.find(d => d.aiConfigurationId === config.id);
      const monthlyUsage = monthlyConfigMetrics.find(m => m.aiConfigurationId === config.id);
      const allTimeUsage = allConfigMetrics.find(a => a.aiConfigurationId === config.id);
      
      return {
        id: config.id,
        name: config.name,
        serviceType: config.serviceType,
        model: config.model,
        tokensPerMinute: config.tokensPerMinute,
        requestsPerMinute: config.requestsPerMinute,
        requestsPerDay: config.requestsPerDay,
        inputCost: config.inputCost,
        outputCost: config.outputCost,
        isActive: config.isActive,
        
        // Usage metrics
        dailyUsage: {
          promptTokens: dailyUsage?.totalPromptTokens || 0,
          completionTokens: dailyUsage?.totalCompletionTokens || 0,
          totalCost: dailyUsage?.totalCost || 0,
          requestCount: dailyUsage?.requestCount || 0,
          successRate: dailyUsage ? (dailyUsage.successRate ?? null) : null
        },
        monthlyUsage: {
          promptTokens: monthlyUsage?.totalPromptTokens || 0,
          completionTokens: monthlyUsage?.totalCompletionTokens || 0,
          totalCost: monthlyUsage?.totalCost || 0,
          requestCount: monthlyUsage?.requestCount || 0,
          successRate: monthlyUsage ? (monthlyUsage.successRate ?? null) : null
        },
        allTimeUsage: {
          promptTokens: allTimeUsage?.totalPromptTokens || 0,
          completionTokens: allTimeUsage?.totalCompletionTokens || 0,
          totalCost: allTimeUsage?.totalCost || 0,
          requestCount: allTimeUsage?.requestCount || 0,
          successRate: allTimeUsage ? (allTimeUsage.successRate ?? null) : null
        }
      };
    });

    const responseData = {
      // Service information
      serviceProvider: serviceProvider || 'multi-configuration',
      configurationCount: targetConfigs.length,
      
      // Current usage aggregated
      dailyTokens: dailyTotal,
      monthlyTokens: monthlyTotal,
      monthlyCost,
      
      // Configuration-aware limits (using primary config as reference)
      dailyTokenLimit,
      monthlyTokenLimit,
      tpmLimit,
      rpmLimit,
      rpdLimit,
      
      // Remaining capacity
      dailyTokensRemaining: Math.max(0, dailyTokenLimit - dailyTotal),
      monthlyTokensRemaining: Math.max(0, monthlyTokenLimit - monthlyTotal),
      
      // Warning levels
      dailyWarningLevel: getWarningLevel(dailyTotal, dailyTokenLimit),
      monthlyWarningLevel: getWarningLevel(monthlyTotal, monthlyTokenLimit),
      
      // Real-time metrics from UsageRecord table
      currentRatePerMinute: (currentMinuteUsage._sum.promptTokens || 0) + (currentMinuteUsage._sum.completionTokens || 0),
      requestsPerMinute: currentMinuteUsage._count.id || 0,
      requestsPerDay: currentDayRequests,
      
      // Configuration details with individual usage metrics
      configurations: configurationsWithUsage,
      
      // Overall success rate calculation across all target configurations
      overallSuccessRate: targetConfigIds.length > 0
        ? allConfigMetrics
            .filter(config => targetConfigIdSet.has(config.aiConfigurationId))
            .reduce((totalSuccessful, config) => 
              totalSuccessful + (config.successRate * config.requestCount), 0) /
          Math.max(1, allConfigMetrics
            .filter(config => targetConfigIdSet.has(config.aiConfigurationId))
            .reduce((totalRequests, config) => totalRequests + config.requestCount, 0))
        : 0,
      
      // Historical data
      historicalUsage: historicalData,
      
      // Aggregated performance metrics (backward compatibility)
      averageResponseTime: aggregatedPerformanceMetrics.averageResponseTime,
      responseTimeRange: aggregatedPerformanceMetrics.responseTimeRange,
      responseTimeData: aggregatedPerformanceMetrics.responseTimeData,
      
      // Service-specific performance metrics (new)
      performanceByService: Object.fromEntries(performanceByService)
    };

    res.json({ metrics: responseData });
  } catch (error) {
    next(error);
  }
});

export default router;
