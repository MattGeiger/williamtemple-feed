import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MultiServiceUsageData, ServiceProvider, ConfigurationUsageMetrics } from '@/types/multi-service-usage';
import { multiServiceUsageService } from '@/services/multi-service-usage';
import { useMessage } from '@/hooks/message/useMessage';
import { queryKeys } from '@/lib/react-query';
import { systemStatusService } from '@/services/system';

interface UseMultiServiceUsageResult {
  data: MultiServiceUsageData | null;
  selectedService: ServiceProvider | 'all';
  isLoading: boolean;
  error: Error | null;
  setSelectedService: (service: ServiceProvider | 'all') => void;
  refresh: () => Promise<void>;
}

/**
 * Hook for multi-service AI usage tracking
 * Phase 3 implementation with real UsageRecord aggregation from backend
 */
export function useMultiServiceUsage(timeRange = '7d', refreshInterval = 60000): UseMultiServiceUsageResult {
  const [selectedService, setSelectedService] = useState<ServiceProvider | 'all'>('all');
  const { showError } = useMessage();

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: queryKeys.dashboard.multiServiceUsage(
      selectedService === 'all' ? undefined : selectedService,
      timeRange
    ),
    queryFn: async () => {
      try {
        // Phase 3: Use real backend API with UsageRecord aggregation
        return await multiServiceUsageService.getUsageMetrics(
          selectedService === 'all' ? undefined : selectedService,
          timeRange
        );
      } catch (err) {
        console.error('Error fetching multi-service usage data:', err);
        
        // Check if this is a startup condition before showing error
        try {
          const startupStatus = await systemStatusService.getStartupStatus();
          if (startupStatus.isStartupCondition) {
            // Return empty data structure for startup condition - no error shown
            return {
              configurations: [],
              services: [],
              activeConfigurationId: undefined,
              activeServiceId: undefined,
              lastUpdated: new Date().toISOString(),
              performance: {
                averageResponseTime: 0,
                responseTimeRange: { min: 0, max: 0 },
                responseTimeData: []
              },
              performanceByService: {}
            };
          }
        } catch (statusError) {
          console.error('Failed to check startup status:', statusError);
          // If we can't check startup status, proceed with error handling
        }
        
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch usage data';
        showError('Failed to load multi-service usage metrics');
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
    selectedService,
    isLoading,
    error: error as Error | null,
    setSelectedService,
    refresh: async () => {
      await refetch();
    }
  };
}

/**
 * Get filtered usage data based on selected service
 * Prioritizes active configurations when multiple exist for same service
 */
export function getFilteredUsageData(
  data: MultiServiceUsageData | null,
  selectedService: ServiceProvider | 'all'
): ConfigurationUsageMetrics[] {
  if (!data) return [];
  
  if (selectedService === 'all') {
    return data.configurations;
  }
  
  const filteredConfigs = data.configurations.filter(config => config.serviceType === selectedService);
  
  // If multiple configurations for same service, prioritize active ones
  const activeConfigs = filteredConfigs.filter(config => config.isActive);
  if (activeConfigs.length > 0) {
    return activeConfigs;
  }
  
  // If no active configs, return all configs for the service
  return filteredConfigs;
}

/**
 * Get aggregated metrics across all configurations
 */
export function getAggregatedMetrics(data: MultiServiceUsageData | null) {
  if (!data || data.configurations.length === 0) {
    return {
      totalCost: 0,
      totalTokens: 0,
      totalRequests: 0,
      averageSuccessRate: 0,
      configurationsActive: 0,
      servicesActive: 0 // Legacy compatibility
    };
  }

  const totalCost = data.configurations.reduce((sum, config) => sum + config.totalCost, 0);
  const totalTokens = data.configurations.reduce((sum, config) => 
    sum + config.promptTokens + config.completionTokens, 0);
  const totalRequests = data.configurations.reduce((sum, config) => 
    sum + config.requestsPerDay.current, 0);
  
  // Calculate weighted average success rate from configuration data
  const averageSuccessRate = totalRequests > 0 
    ? data.configurations.reduce((weightedSum, config) => {
        // Use the success rate from backend data (defaults to 98.5% if not available)
        const configSuccessRate = config.successRate ?? 0.985;
        return weightedSum + (configSuccessRate * config.requestsPerDay.current);
      }, 0) / totalRequests
    : 0.985; // Default fallback

  const configurationsActive = data.configurations.filter(config => config.isActive).length;

  return {
    totalCost,
    totalTokens,
    totalRequests,
    averageSuccessRate,
    configurationsActive,
    servicesActive: configurationsActive // Legacy compatibility
  };
}
