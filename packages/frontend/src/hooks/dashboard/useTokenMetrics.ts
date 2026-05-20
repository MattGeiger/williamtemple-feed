import { useQuery } from '@tanstack/react-query';
import { BaseApiService } from '@/services/base';
import config from '@/config/config';
import { useMessage } from '@/hooks/message/useMessage';
import { queryKeys } from '@/lib/react-query';
import { systemStatusService } from '@/services/system';

// Define types for token metrics
export interface TokenMetricsData {
  dailyUsage: {
    current: number;
    limit: number;
    remaining: number;
    warningLevel: 'normal' | 'warning' | 'elevated' | 'critical' | null;
  };
  monthlyUsage: {
    current: number;
    limit: number;
    remaining: number;
    warningLevel: 'normal' | 'warning' | 'elevated' | 'critical' | null;
  };
  modelUsage: {
    name: string;
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  }[];
  rateLimit: {
    current: number;
    limit: number; // TPM (Tokens per Minute)
    resetTime: string;
  };
  requestsPerMinute: number;  // New field for actual RPM
  requestsPerDay: number;     // New field for actual RPD
  historicalData: {
    date: string;
    usage: number;
    limit: number;
  }[];
}

// OpenAI rate limits and pricing constants
const OPENAI_LIMITS = {
  TPM: 200000,          // Tokens per minute: 200,000
  RPM: 500,             // Requests per minute: 500
  RPD: 10000,           // Requests per day: 10,000
  CONTEXT_WINDOW: 128000, // Context window: 128,000 tokens
  MAX_OUTPUT: 16384,    // Max output: 16,384 tokens
  MONTHLY_COST_LIMIT: 100.00 // $100 per month
};

// Token metrics service
class TokenMetricsService extends BaseApiService {
  constructor() {
    super(config.api.endpoints.projections.base);
  }

  async getTokenMetrics(serviceProvider?: string): Promise<TokenMetricsData> {
    try {
      // Fetch token metrics from the API with optional service filtering
      const endpoint = serviceProvider ? `/token-metrics?serviceProvider=${serviceProvider}` : '/token-metrics';
      const response = await this.get<any>(endpoint);
      
      if (!response || !response.metrics) {
        throw new Error('Invalid token metrics response');
      }
      
      const metrics = response.metrics;
      
      // Map API response to our interface with corrected limits
      return {
        dailyUsage: {
          current: metrics.dailyTokens || 0,
          limit: metrics.dailyTokenLimit || (OPENAI_LIMITS.TPM * 1440), // TPM * minutes per day
          remaining: metrics.dailyTokensRemaining || 0,
          warningLevel: this.mapWarningLevel(metrics.dailyWarningLevel)
        },
        monthlyUsage: {
          current: metrics.monthlyTokens || 0,
          limit: metrics.monthlyTokenLimit || (OPENAI_LIMITS.TPM * 1440 * 30), // Daily limit * 30 days
          remaining: metrics.monthlyTokensRemaining || 0,
          warningLevel: this.mapWarningLevel(metrics.monthlyWarningLevel)
        },
        modelUsage: [
          {
            name: metrics.modelName || 'gpt-4o-mini',
            promptTokens: metrics.promptTokensTotal || 0,
            completionTokens: metrics.completionTokensTotal || 0,
            totalCost: metrics.monthlyCost || 0
          }
        ],
        rateLimit: {
          current: metrics.currentRatePerMinute || 0,
          limit: OPENAI_LIMITS.TPM, // Correct TPM limit
          resetTime: metrics.rateLimitResetTime ? new Date(metrics.rateLimitResetTime).toLocaleTimeString() : 
            new Date(Date.now() + 60000).toLocaleTimeString() // Default to next minute
        },
        // Use actual requests per minute/day directly from the API
        // Check if they exist in the response and provide fallbacks
        requestsPerMinute: metrics.requestsPerMinute !== undefined ? metrics.requestsPerMinute : 0,
        requestsPerDay: metrics.requestsPerDay !== undefined ? metrics.requestsPerDay : 0,
        historicalData: metrics.historicalUsage || this.getSampleHistoricalData()
      };
    } catch (error) {
      console.error('Failed to fetch token metrics:', error);
      throw error;
    }
  }

  private mapWarningLevel(level: string | null): 'normal' | 'warning' | 'elevated' | 'critical' | null {
    if (!level) return 'normal';
    
    switch (level) {
      case 'FINAL_WARNING': return 'critical';
      case 'ELEVATED_WARNING': return 'elevated';
      case 'WARNING': return 'warning';
      default: return 'normal';
    }
  }

  private getSampleHistoricalData() {
    // Return sample data for display purposes until API provides real data
    const today = new Date();
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        usage: Math.floor(Math.random() * 800000) + 200000, // Random between 200K-1M
        limit: OPENAI_LIMITS.TPM * 1440 // Daily limit
      });
    }
    
    return data;
  }
}

// Create singleton instance
const tokenMetricsService = new TokenMetricsService();

// Hook for fetching token metrics with service-specific filtering and startup condition handling
export function useTokenMetrics(refreshInterval = 60000, serviceProvider?: string) {
  const { showError } = useMessage();

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: queryKeys.dashboard.tokenMetrics(serviceProvider),
    queryFn: async () => {
      try {
        return await tokenMetricsService.getTokenMetrics(serviceProvider);
      } catch (err) {
        console.error('Error fetching token metrics:', err);
        
        // Check if this is a startup condition before showing error
        try {
          const startupStatus = await systemStatusService.getStartupStatus();
          if (startupStatus.isStartupCondition) {
            // Return null data for startup condition - no error shown
            return null;
          }
        } catch (statusError) {
          console.error('Failed to check startup status:', statusError);
          // If we can't check startup status, proceed with error handling
        }
        
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token metrics';
        showError('Failed to load token usage metrics');
        throw new Error(errorMessage);
      }
    },
    // React Query 5 Native Refetch Pattern
    refetchOnMount: 'always',
    staleTime: 0, // Force fresh data on dashboard load
    gcTime: 5 * 60 * 1000, // Maintain cache for navigation
    refetchInterval: refreshInterval,
    refetchOnWindowFocus: true,
  });

  return {
    data: data || null,
    isLoading,
    error: error as Error | null,
    refresh: async () => {
      await refetch();
    }
  };
}
