// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

// Multi-Service AI Usage Types for Phase 2 Implementation
export type ServiceProvider = 'OpenAI' | 'Anthropic' | 'Google' | 'Azure';

export interface ServiceConfiguration {
  id: number;
  name: string;
  serviceType: ServiceProvider;
  model: string;
  isActive: boolean;
  
  // Rate Limits from AI Configuration
  tokensPerMinute: number;
  requestsPerMinute: number;
  requestsPerDay: number;
  
  // Pricing from AI Configuration
  inputCost: number;  // Cost per token
  outputCost: number; // Cost per token
  unitPrice: 'per_1k' | 'per_1m';
}

export interface ConfigurationUsageMetrics {
  // Configuration Info
  configurationId: number;
  configurationName: string;
  serviceType: ServiceProvider;
  model: string;
  isActive: boolean;
  
  // Cost configuration from AI Config (rate limits are below in the
  // structured `rateLimit`, `requestsPerMinute`, and `requestsPerDay`
  // objects). The previous flat `tokensPerMinute?`, `requestsPerMinute?`,
  // and `requestsPerDay?` declarations here duplicated those structured
  // fields and made every access through the structured form report
  // possibly-undefined (TS18048).
  inputCost?: number;
  outputCost?: number;
  
  // Usage Data
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
  
  // Real-time Rate Limits
  rateLimit: {
    current: number;        // Current TPM
    limit: number;          // TPM limit from configuration
    resetTime: string;
  };
  
  requestsPerMinute: {
    current: number;        // Current RPM
    limit: number;          // RPM limit from configuration
  };
  
  requestsPerDay: {
    current: number;        // Current RPD
    limit: number;          // RPD limit from configuration
  };
  
  // Cost Metrics
  totalCost: number;        // Total cost for this configuration
  promptTokens: number;     // Input tokens used
  completionTokens: number; // Output tokens used

  // Cumulative request count, distinct from `requestsPerDay.current` above.
  // That one is today's volume and drives the rate-limit gauges; this is the
  // all-time figure the Usage Summary reports beside all-time cost and tokens.
  totalRequests: number;
  
  // Performance Metrics
  successRate?: number | null;     // Success rate from usage records (0-1) or null if no data
  
  // Historical Data
  historicalData: {
    date: string;
    usage: number;
    cost: number;
    limit: number;
  }[];
}

// Keep legacy interface for backward compatibility
export interface ServiceUsageMetrics extends ConfigurationUsageMetrics {
  // Legacy compatibility - maps to configurationId/configurationName
  serviceType: ServiceProvider;
  configurationId: number;
  configurationName: string;
  model: string;
}

export interface MultiServiceUsageData {
  configurations: ConfigurationUsageMetrics[];
  services: ServiceUsageMetrics[]; // Legacy compatibility field
  activeConfigurationId?: number;
  activeServiceId?: number; // Legacy compatibility field
  lastUpdated: string;
  
  // Real performance metrics from UsageRecord duration tracking
  performance?: {
    averageResponseTime: number;
    responseTimeRange: {
      min: number;
      max: number;
    };
    responseTimeData: Array<{
      date: string;
      responseTime: number;
    }>;
  };
  
  // Service-specific performance metrics (new)
  performanceByService?: Record<ServiceProvider, {
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
}

// Service-specific specifications for mock data
export const SERVICE_SPECIFICATIONS: Record<ServiceProvider, {
  defaultModel: string;
  models: string[];
  defaultLimits: {
    tokensPerMinute: number;
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  defaultPricing: {
    inputCost: number;
    outputCost: number;
    unitPrice: 'per_1k' | 'per_1m';
  };
  color: string;
}> = {
  OpenAI: {
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    defaultLimits: {
      tokensPerMinute: 200000,
      requestsPerMinute: 500,
      requestsPerDay: 10000
    },
    defaultPricing: {
      inputCost: 0.150,
      outputCost: 0.600,
      unitPrice: 'per_1m'
    },
    color: 'var(--service-openai)'
  },
  Anthropic: {
    defaultModel: 'claude-3-haiku-20240307',
    models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
    defaultLimits: {
      tokensPerMinute: 100000,
      requestsPerMinute: 1000,
      requestsPerDay: 5000
    },
    defaultPricing: {
      inputCost: 0.25,
      outputCost: 1.25,
      unitPrice: 'per_1m'
    },
    color: 'var(--service-anthropic)'
  },
  Google: {
    defaultModel: 'gemini-1.5-flash',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'],
    defaultLimits: {
      tokensPerMinute: 300000,
      requestsPerMinute: 300,
      requestsPerDay: 15000
    },
    defaultPricing: {
      inputCost: 0.075,
      outputCost: 0.30,
      unitPrice: 'per_1m'
    },
    color: 'var(--service-google)'
  },
  Azure: {
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-35-turbo'],
    defaultLimits: {
      tokensPerMinute: 150000,
      requestsPerMinute: 300,
      requestsPerDay: 8000
    },
    defaultPricing: {
      inputCost: 0.165,
      outputCost: 0.660,
      unitPrice: 'per_1m'
    },
    color: 'var(--service-azure)'
  }
};

export interface ConfigurationComparisonData {
  configurationId: number;
  serviceType: ServiceProvider;
  configurationName: string;
  model: string;
  isActive: boolean;
  totalCost: number;
  tokensUsed: number;
  averageCostPerToken: number;
  averageResponseTime: number | null;
  successRate: number | null;
  operationsCount: number;
  color: string;
}

// Keep legacy interface for backward compatibility
export interface ServiceComparisonData extends ConfigurationComparisonData {
  serviceType: ServiceProvider;
  configurationName: string;
  model: string;
}

export interface CostOptimizationSuggestion {
  type: 'cost_reduction' | 'performance_improvement' | 'usage_optimization';
  title: string;
  description: string;
  potentialSavings?: number;
  fromService: ServiceProvider;
  toService: ServiceProvider;
  confidence: number;
}
