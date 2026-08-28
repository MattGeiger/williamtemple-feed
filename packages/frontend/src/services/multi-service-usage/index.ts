// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { BaseApiService } from '@/services/base';
import { 
  MultiServiceUsageData, 
  ConfigurationUsageMetrics,
  ServiceUsageMetrics, 
  ServiceProvider,
  SERVICE_SPECIFICATIONS 
} from '@/types/multi-service-usage';
import config from '@/config/config';

interface BackendMultiServiceResponse {
  metrics: {
    serviceProvider: string;
    configurationCount: number;
    dailyTokens: number;
    monthlyTokens: number;
    monthlyCost: number;
    dailyTokenLimit: number;
    monthlyTokenLimit: number;
    tpmLimit: number;
    rpmLimit: number;
    rpdLimit: number;
    dailyTokensRemaining: number;
    monthlyTokensRemaining: number;
    dailyWarningLevel: string;
    monthlyWarningLevel: string;
    currentRatePerMinute: number;
    requestsPerMinute: number;
    requestsPerDay: number;
    overallSuccessRate: number;
    configurations: Array<{
      id: number;
      name: string;
      serviceType: string;
      model: string;
      tokensPerMinute?: number;
      requestsPerMinute?: number;
      requestsPerDay?: number;
      inputCost?: number;
      outputCost?: number;
      isActive: boolean;
      dailyUsage: {
        promptTokens: number;
        completionTokens: number;
        totalCost: number;
        requestCount: number;
        successRate: number;
      };
      monthlyUsage: {
        promptTokens: number;
        completionTokens: number;
        totalCost: number;
        requestCount: number;
        successRate: number;
      };
      allTimeUsage: {
        promptTokens: number;
        completionTokens: number;
        totalCost: number;
        requestCount: number;
        successRate: number;
      };
    }>;
    historicalUsage: Array<{
      date: string;
      totalTokens: number;
      totalCost: number;
      services: Record<string, { tokens: number; cost: number }>;
    }>;
    // Performance metrics from UsageRecord duration tracking
    averageResponseTime: number;
    responseTimeRange: {
      min: number;
      max: number;
    };
    responseTimeData: Array<{
      date: string;
      responseTime: number;
    }>;
    // Service-specific performance metrics (new)
    performanceByService?: Record<string, {
      averageResponseTime: number;
      responseTimeRange: {
        min: number;
        max: number;
      };
      responseTimeData: Array<{
        date: string;
        responseTime: number;
      }>;
    }>;
  };
}

/**
 * Service for multi-service AI usage tracking with real backend integration
 * Replaces Phase 2 mock data with actual UsageRecord aggregations
 */
export class MultiServiceUsageService extends BaseApiService {
  constructor() {
    super('/api/projections');
  }

  /**
   * Get multi-service usage data with real backend aggregation and timezone awareness
   */
  async getUsageMetrics(serviceProvider?: ServiceProvider, timeRange?: string): Promise<MultiServiceUsageData> {
    try {
      const params = new URLSearchParams();
      if (serviceProvider) {
        params.append('serviceProvider', serviceProvider);
      }
      if (timeRange) {
        params.append('timeRange', timeRange);
      }
      
      // Detect and pass user's timezone for backend aggregation
      try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (userTimezone) {
          params.append('timezone', userTimezone);
        }
      } catch (error) {
        console.warn('Could not detect user timezone, using UTC:', error);
        // Continue without timezone parameter - backend will default to UTC
      }
      
      const queryString = params.toString();
      const response = await this.get<BackendMultiServiceResponse>(`/multi-service-metrics${queryString ? `?${queryString}` : ''}`);
      
      return this.mapBackendResponseToFrontend(response);
    } catch (error) {
      console.error('Failed to fetch multi-service usage metrics:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Maps backend response to frontend interface
   */
  private mapBackendResponseToFrontend(response: BackendMultiServiceResponse): MultiServiceUsageData {
    const { metrics } = response;
    
    // Check if we have any configurations
    if (!metrics.configurations || metrics.configurations.length === 0) {
      return {
        configurations: [],
        services: [], // Backward compatibility
        activeConfigurationId: undefined,
        activeServiceId: undefined, // Backward compatibility
        lastUpdated: new Date().toISOString(),
        
        // Include performance metrics even when no configurations exist
        performance: {
          averageResponseTime: metrics.averageResponseTime || 0,
          responseTimeRange: {
            min: metrics.responseTimeRange?.min || 0,
            max: metrics.responseTimeRange?.max || 0
          },
          responseTimeData: metrics.responseTimeData || []
        },
        
        // Include service-specific performance data
        performanceByService: metrics.performanceByService || {}
      };
    }
    
    // Build configuration metrics from backend data
    const configurations = metrics.configurations.map(config => {
      // Get service specifications for defaults
      const specs = SERVICE_SPECIFICATIONS[config.serviceType as ServiceProvider];
      
      // Use configuration limits or defaults from specifications
      const tpmLimit = config.tokensPerMinute || specs?.defaultLimits.tokensPerMinute || 200000;
      const rpmLimit = config.requestsPerMinute || specs?.defaultLimits.requestsPerMinute || 500;
      const rpdLimit = config.requestsPerDay || specs?.defaultLimits.requestsPerDay || 10000;
      
      const dailyTokenLimit = tpmLimit * 1440; // TPM * minutes per day
      const monthlyTokenLimit = dailyTokenLimit * 30;
      
      // Get daily usage from backend
      const dailyTokens = config.dailyUsage.promptTokens + config.dailyUsage.completionTokens;
      const monthlyTokens = config.monthlyUsage.promptTokens + config.monthlyUsage.completionTokens;
      
      // Calculate proportional current usage for rate metrics
      const configShare = metrics.configurationCount > 1 ? 
        (dailyTokens / Math.max(metrics.dailyTokens, 1)) : 1;

      return {
        configurationId: config.id,
        configurationName: config.name,
        serviceType: config.serviceType as ServiceProvider,
        model: config.model || specs?.defaultModel || 'unknown',
        isActive: config.isActive,
        
        // Configuration limits
        tokensPerMinute: config.tokensPerMinute,
        inputCost: config.inputCost,
        outputCost: config.outputCost,
        
        dailyUsage: {
          current: dailyTokens,
          limit: dailyTokenLimit,
          remaining: Math.max(0, dailyTokenLimit - dailyTokens),
          warningLevel: this.mapWarningLevel(metrics.dailyWarningLevel)
        },
        
        monthlyUsage: {
          current: monthlyTokens,
          limit: monthlyTokenLimit,
          remaining: Math.max(0, monthlyTokenLimit - monthlyTokens),
          warningLevel: this.mapWarningLevel(metrics.monthlyWarningLevel)
        },
        
        rateLimit: {
          current: Math.floor(metrics.currentRatePerMinute * configShare),
          limit: tpmLimit,
          resetTime: new Date(Date.now() + 60000).toLocaleTimeString()
        },
        
        requestsPerMinute: {
          current: Math.floor(metrics.requestsPerMinute * configShare),
          limit: rpmLimit
        },
        
        requestsPerDay: {
          // Daily request volume; fall back to 0 if not available
          current: config.dailyUsage.requestCount || 0,
          limit: rpdLimit
        },
        
        totalCost: config.allTimeUsage.totalCost,
        promptTokens: config.allTimeUsage.promptTokens,
        completionTokens: config.allTimeUsage.completionTokens,
        totalRequests: config.allTimeUsage.requestCount || 0,
        successRate: config.allTimeUsage.successRate,
        
        historicalData: this.buildHistoricalData(metrics.historicalUsage, config.serviceType)
      };
    });

    return {
      configurations,
      services: configurations, // Backward compatibility - same data structure
      activeConfigurationId: metrics.configurations.find(c => c.isActive)?.id,
      activeServiceId: metrics.configurations.find(c => c.isActive)?.id, // Backward compatibility
      lastUpdated: new Date().toISOString(),
      
      // Real performance metrics from UsageRecord duration tracking
      performance: {
        averageResponseTime: metrics.averageResponseTime || 0,
        responseTimeRange: {
          min: metrics.responseTimeRange?.min || 0,
          max: metrics.responseTimeRange?.max || 0
        },
        responseTimeData: metrics.responseTimeData || []
      },
      
      // Service-specific performance metrics (new)
      performanceByService: metrics.performanceByService || {}
    };
  }

  /**
   * Maps backend warning levels to frontend format
   */
  private mapWarningLevel(level: string | null): 'normal' | 'warning' | 'elevated' | 'critical' | null {
    if (!level) return 'normal';
    
    switch (level.toLowerCase()) {
      case 'critical': return 'critical';
      case 'elevated': return 'elevated';
      case 'warning': return 'warning';
      default: return 'normal';
    }
  }

  /**
   * Builds historical data for a specific service
   */
  private buildHistoricalData(
    historicalUsage: BackendMultiServiceResponse['metrics']['historicalUsage'] | undefined,
    serviceType: string
  ): Array<{ date: string; usage: number; cost: number; limit: number }> {
    if (!historicalUsage || historicalUsage.length === 0) {
      return [];
    }
    
    const specs = SERVICE_SPECIFICATIONS[serviceType as ServiceProvider];
    const dailyLimit = (specs?.defaultLimits.tokensPerMinute || 200000) * 1440;

    return historicalUsage.map(day => {
      const serviceData = day.services?.[serviceType] || { tokens: 0, cost: 0 };
      
      return {
        date: day.date,
        usage: serviceData.tokens,
        cost: serviceData.cost,
        limit: dailyLimit
      };
    });
  }
}

// Create singleton instance
export const multiServiceUsageService = new MultiServiceUsageService();

export default multiServiceUsageService;
