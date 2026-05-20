// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { AIConfiguration, PrismaClient } from '@prisma/client';
import { AITranslationService } from '../base/AITranslationService';
import { OpenAITranslationService } from '../providers/OpenAITranslationService';
import { GoogleTranslationService } from '../providers/GoogleTranslationService';
import { AnthropicTranslationService } from '../providers/AnthropicTranslationService';

const prisma = new PrismaClient();

export class AIServiceFactory {
  private static serviceInstances = new Map<string, AITranslationService>();

  /**
   * Creates or returns cached AI service instance based on configuration
   */
  static async createService(serviceType?: string): Promise<AITranslationService> {
    let config: AIConfiguration | null;

    if (serviceType) {
      // Get specific service type
      config = await prisma.aIConfiguration.findFirst({
        where: {
          type: 'apikey',
          serviceType,
          isActive: true,
          deletedAt: null  // Ensure we don't use deleted configurations
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });
    } else {
      // Get any active service (default behavior)
      config = await prisma.aIConfiguration.findFirst({
        where: {
          type: 'apikey',
          isActive: true,
          deletedAt: null  // Ensure we don't use deleted configurations
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });
    }

    if (!config) {
      throw new Error('AI configuration required. Please configure AI settings in Tools → AI Configuration.');
    }

    // Use service type as cache key
    const cacheKey = `${config.serviceType}_${config.id}`;

    // Return cached instance if available and configuration hasn't changed
    if (this.serviceInstances.has(cacheKey)) {
      const cachedService = this.serviceInstances.get(cacheKey)!;
      // Simple check if config changed (compare updatedAt)
      if (cachedService['config']?.updatedAt?.getTime() === config.updatedAt.getTime()) {
        return cachedService;
      } else {
        // Configuration has been updated - remove stale cached instance
        console.log(`Configuration updated for ${config.serviceType}, invalidating cached service instance`);
        this.serviceInstances.delete(cacheKey);
      }
    }

    // Create new service instance
    let service: AITranslationService;

    switch (config.serviceType) {
      case 'OpenAI':
        service = new OpenAITranslationService(config);
        break;
      case 'Anthropic':
        service = new AnthropicTranslationService(config);
        break;
      case 'Google':
        service = new GoogleTranslationService(config);
        break;
      case 'Azure':
        throw new Error('Azure OpenAI service not yet implemented');
      default:
        throw new Error(`Unsupported AI service type: ${config.serviceType}`);
    }

    // Cache the service instance
    this.serviceInstances.set(cacheKey, service);

    return service;
  }

  /**
   * Creates service instance for OpenAI specifically
   */
  static async createOpenAIService(): Promise<AITranslationService> {
    return this.createService('OpenAI');
  }

  /**
   * Clears service cache (useful for testing or configuration changes)
   */
  static clearCache(): void {
    this.serviceInstances.clear();
  }

  /**
   * Gets all supported service types
   */
  static getSupportedServiceTypes(): string[] {
    return ['OpenAI', 'Google', 'Anthropic']; // Add 'Azure' as implemented
  }
}
