// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { AIConfiguration } from '@prisma/client';
import { UsageRecordService, UsageMetrics } from '../../usage-record';

// Translation context types
export type TranslationContext = 'food' | 'custom' | 'document';

// Core interfaces extracted from current OpenAI implementation
export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  instructions?: string;
  context?: TranslationContext;
}

export interface TranslationResult {
  translatedText: string;
  metrics: {
    duration: number;
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  };
  warnings?: string[];  // Optional warnings for model-specific constraints
}

export interface ClassificationRequest {
  segments: Array<{
    id: string;
    text: string;
  }>;
}

export interface ClassificationResult {
  classifications: Array<{
    id: string;
    a: number;  // Skip Translation confidence
    b: number;  // Include English confidence
  }>;
  metrics: {
    duration: number;
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  };
  warnings?: string[];  // Optional warnings for model-specific constraints
}

export interface BatchTranslationRequest {
  texts: Array<{
    id: string;
    text: string;
    instructions?: string;
  }>;
  targetLanguage: string;
  context?: TranslationContext;
}

export interface BatchTranslationResult {
  translations: Array<{
    id: string;
    originalText: string;
    translatedText: string;
  }>;
  metrics: {
    duration: number;
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  };
  warnings?: string[];  // Optional warnings for model-specific constraints
}

export interface ServiceCapabilities {
  supportsLanguages: string[];
  maxTokensPerRequest: number;
  supportsBatchOperations: boolean;
  supportsClassification: boolean;
}

export interface ServiceLimits {
  tokensPerMinute: number;
  requestsPerMinute: number;
  requestsPerDay: number;
  inputCost: number;
  outputCost: number;
}

/**
 * Abstract base class for AI translation services
 * Defines the common interface that all AI service providers must implement
 */
export abstract class AITranslationService {
  protected config: AIConfiguration;
  protected serviceType: string;

  constructor(config: AIConfiguration) {
    if (!config.serviceType) {
      throw new Error('AI configuration is missing serviceType');
    }
    this.config = config;
    this.serviceType = config.serviceType;
  }

  // Core translation operations
  abstract translateText(request: TranslationRequest): Promise<TranslationResult>;
  abstract translateTextBatch(request: BatchTranslationRequest): Promise<BatchTranslationResult>;
  
  // Classification operations
  abstract classifySegments(request: ClassificationRequest): Promise<ClassificationResult>;
  abstract classifySegmentsBatch(request: ClassificationRequest): Promise<ClassificationResult>;

  // Service configuration and validation
  abstract validateApiKey(): Promise<boolean>;
  abstract getServiceCapabilities(): ServiceCapabilities;
  abstract getServiceLimits(): ServiceLimits;
  
  // Language support
  abstract getSupportedLanguages(): string[];
  abstract isLanguageSupported(language: string): boolean;
  
  // Utility methods that can be overridden
  protected normalizeLanguage(language: string): string {
    return language.trim();
  }
  
  protected shouldSkipTranslation(text: string, targetLanguage: string): boolean {
    // Skip English-to-English translations
    if (targetLanguage.toLowerCase() === 'en' || 
        targetLanguage.toLowerCase() === 'eng' ||
        targetLanguage.toLowerCase() === 'english') {
      return true;
    }
    
    // Skip text with no letters
    if (/^[^a-zA-Z]*$/.test(text)) {
      return true;
    }
    
    return false;
  }
  
  protected createSkippedTranslationResult(text: string): TranslationResult {
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
  
  // Configuration access
  protected getModel(): string {
    if (!this.config.model) {
      throw new Error(`AI model not configured for ${this.serviceType} service`);
    }
    return this.config.model;
  }
  
  protected async getApiKey(): Promise<string> {
    throw new Error('API key access must be implemented by concrete service classes');
  }
  
  // Usage tracking
  protected async trackUsage(
    operationType: 'translation' | 'classification' | 'batch',
    metrics: UsageMetrics,
    modelUsed: string,
    options?: {
      translationId?: number;
      documentId?: number;
      language?: string;
    }
  ): Promise<void> {
    try {
      await UsageRecordService.createUsageRecord(
        this.config.id,
        this.config,
        operationType,
        metrics,
        modelUsed,
        options
      );
    } catch (error) {
      console.error('Failed to track usage:', error);
      // Don't throw - usage tracking should not break operations
    }
  }

  // Helper method to track successful operations
  protected async trackSuccessfulUsage(
    operationType: 'translation' | 'classification' | 'batch',
    metrics: { promptTokens: number; completionTokens: number; totalCost: number; duration?: number },
    modelUsed: string,
    options?: { translationId?: number; documentId?: number; language?: string }
  ): Promise<void> {
    return this.trackUsage(operationType, { ...metrics, success: true }, modelUsed, options);
  }

  // Helper method to track failed operations
  protected async trackFailedUsage(
    operationType: 'translation' | 'classification' | 'batch',
    metrics: { promptTokens: number; completionTokens: number; totalCost: number; duration?: number },
    modelUsed: string,
    options?: { translationId?: number; documentId?: number; language?: string }
  ): Promise<void> {
    return this.trackUsage(operationType, { ...metrics, success: false }, modelUsed, options);
  }

  // Common error handling
  protected handleServiceError(error: any, operation: string): never {
    if (error.message) {
      // Check for our custom retry error message
      if (error.message.includes('Failed to retry translation for')) {
        throw error; // Re-throw the original, user-friendly error
      }
      throw new Error(`${this.serviceType} ${operation} error: ${error.message}`);
    }
    throw new Error(`${this.serviceType} ${operation} failed with unexpected error`);
  }
}
