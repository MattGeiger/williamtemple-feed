// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { Router } from 'express';
import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db';
import { encryptApiKey } from '../services/encryption';
import { encoding_for_model } from 'tiktoken';

const router = Router();

interface BulkUpdateRequest {
  ids: number[];
  updates: {
    name?: string;
    isActive?: boolean;
  };
}

interface BulkDeleteResult {
  success: {
    count: number;
    names: string[];
  };
  failure: {
    count: number;
    configurations: Array<{
      name: string;
      reason: string;
    }>;
  };
}

// Validate configuration IDs
const validateIds = (ids: any): number[] => {
  console.log('Validating AI Config IDs:', {
    type: typeof ids,
    isArray: Array.isArray(ids),
    value: ids
  });
  
  if (!Array.isArray(ids)) {
    console.log('Invalid input: not an array');
    const error = new Error('Invalid configuration IDs: expected an array') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  if (ids.length === 0) {
    console.log('Invalid input: empty array');
    const error = new Error('Invalid configuration IDs: no IDs provided') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  try {
    const validIds = ids.map((id, index) => {
      console.log(`Processing AI Config ID[${index}]:`, {
        type: typeof id,
        raw: id,
        asNumber: Number(id)
      });
      
      const numId = Number(id);
      if (isNaN(numId) || numId < 1) {
        throw new Error(`Invalid configuration ID at position ${index}: ${id}`);
      }
      return numId;
    });

    console.log('Validated AI Config IDs:', validIds);
    return validIds;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid configuration ID format';
    const formattedError = new Error(message) as Error & { statusCode?: number };
    formattedError.statusCode = 400;
    throw formattedError;
  }
};

// Validate configuration type
const validateType = (type: string): boolean => {
  if (!type || !['prompt', 'apikey'].includes(type)) {
    const error = new Error('Type must be either "prompt" or "apikey"') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  return true;
};

// Validate configuration name
const validateName = (name: string): string => {
  if (typeof name !== 'string' || name.length < 3 || name.length > 100) {
    const error = new Error('Name must be between 3 and 100 characters') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  return name.trim().replace(/\s+/g, ' ');
};

// Validate prompt value
const validatePromptValue = (value: string): boolean => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1783) {
    const error = new Error('Prompt value must be between 1 and 1783 characters') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  return true;
};

// Validate API key format
const validateApiKeyFormat = (apiKey: string): boolean => {
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    const error = new Error('API key is required') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  return true;
};

// Validate service type
const validateServiceType = (serviceType?: string): boolean => {
  if (serviceType && !['OpenAI', 'Anthropic', 'Google', 'Azure'].includes(serviceType)) {
    const error = new Error('Service type must be one of: OpenAI, Anthropic, Google, Azure') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  return true;
};

const VALID_THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'] as const;

const validateThinkingLevel = (
  thinkingLevel: unknown
): (typeof VALID_THINKING_LEVELS)[number] | null => {
  if (thinkingLevel === null || thinkingLevel === '') {
    return null;
  }

  if (typeof thinkingLevel !== 'string' || !VALID_THINKING_LEVELS.includes(thinkingLevel as any)) {
    const error = new Error('Thinking level must be one of: minimal, low, medium, high') as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }

  return thinkingLevel as (typeof VALID_THINKING_LEVELS)[number];
};

// GET all configurations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configurations = await prisma.aIConfiguration.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });
    res.json({ configurations });
  } catch (error) {
    next(error);
  }
});

// GET single configuration
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const configId = Number(id);
    
    if (isNaN(configId) || configId < 1) {
      const error = new Error('Invalid configuration ID') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const configuration = await prisma.aIConfiguration.findUnique({
      where: { 
        id: configId,
        deletedAt: null
      }
    });

    if (!configuration) {
      const error = new Error('Configuration not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    res.json({ configuration });
  } catch (error) {
    next(error);
  }
});

// Create new configuration
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      name, 
      type, 
      value, 
      description,
      serviceType,
      model,
      modelName,
      endpointUrl,
      apiKey,
      inputCost,
      outputCost,
      unitPrice,
      temperature,
      topP,
      thinkingLevel,
      maxTokens,
      inputTokenLimit,
      outputTokenLimit,
      dailyCostLimit,
      monthlyCostLimit,
      tokensPerMinute,
      requestsPerMinute,
      requestsPerDay
    } = req.body;

    // Validate required fields
    validateType(type);
    const normalizedName = validateName(name);

    // Type-specific validation
    if (type === 'prompt') {
      validatePromptValue(value);
    } else if (type === 'apikey') {
      validateApiKeyFormat(apiKey);
      validateServiceType(serviceType);
    }

    try {
      const configuration = await prisma.$transaction(async (tx) => {
        const createData: any = {
          name: normalizedName,
          type,
          value: value || '',
          description: description || undefined,
          isActive: true
        };

        // Add apikey-specific fields
        if (type === 'apikey') {
          createData.serviceType = serviceType;
          createData.model = model || undefined;
          createData.modelName = modelName || undefined;
          createData.endpointUrl = endpointUrl || undefined;
          
          // Encrypt API key with salt
          const { encrypted, salt } = await encryptApiKey(apiKey);
          createData.encryptedApiKey = encrypted;
          createData.salt = salt;
          
          createData.inputCost = inputCost;
          createData.outputCost = outputCost;
          createData.unitPrice = unitPrice;
          createData.temperature = temperature || 0.7;
          createData.topP = topP || 1.0;
          if (thinkingLevel !== undefined) {
            createData.thinkingLevel = validateThinkingLevel(thinkingLevel);
          }
          createData.inputTokenLimit = inputTokenLimit;
          createData.outputTokenLimit = outputTokenLimit;
          createData.maxTokens = outputTokenLimit ?? maxTokens;
          if (dailyCostLimit !== undefined) {
            createData.dailyCostLimit = dailyCostLimit > 0 ? dailyCostLimit : null;
          }
          if (monthlyCostLimit !== undefined) {
            createData.monthlyCostLimit = monthlyCostLimit > 0 ? monthlyCostLimit : null;
          }
          createData.tokensPerMinute = tokensPerMinute;
          createData.requestsPerMinute = requestsPerMinute;
          createData.requestsPerDay = requestsPerDay;
        }

        return await tx.aIConfiguration.create({
          data: createData
        });
      });

      res.status(201).json({ configuration });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {  // Unique constraint violation
          const friendlyError = new Error('A configuration with this name already exists') as Error & { statusCode?: number };
          friendlyError.statusCode = 400;
          throw friendlyError;
        }
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Update configuration
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    const configId = Number(id);
    if (isNaN(configId)) {
      const error = new Error('Invalid configuration ID') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    // Check if configuration exists and is not deleted
    const existing = await prisma.aIConfiguration.findUnique({
      where: { 
        id: configId,
        deletedAt: null
      }
    });

    if (!existing) {
      const error = new Error('Configuration not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate only the fields being updated
    const updateData: any = {};

    // Basic fields that can always be updated
    if (updateFields.name !== undefined) {
      updateData.name = validateName(updateFields.name);
    }

    if (updateFields.description !== undefined) {
      updateData.description = updateFields.description || undefined;
    }

    if (updateFields.isActive !== undefined) {
      updateData.isActive = Boolean(updateFields.isActive);
    }

    // Type-specific validation and updates
    if (existing.type === 'prompt') {
      if (updateFields.value !== undefined) {
        validatePromptValue(updateFields.value);
        updateData.value = updateFields.value;
      }
    } else if (existing.type === 'apikey') {
      // Update model fields if provided
      if (updateFields.modelName !== undefined) {
        updateData.modelName = updateFields.modelName || undefined;
      }
      if (updateFields.model !== undefined) {
        updateData.model = updateFields.model || undefined;
      }
      if (updateFields.serviceType !== undefined) {
        validateServiceType(updateFields.serviceType);
        updateData.serviceType = updateFields.serviceType;
      }
      if (updateFields.endpointUrl !== undefined) {
        updateData.endpointUrl = updateFields.endpointUrl || undefined;
      }

      // Only update API key if a new one is provided
      if (updateFields.apiKey !== undefined) {
        validateApiKeyFormat(updateFields.apiKey);
        const { encrypted, salt } = await encryptApiKey(updateFields.apiKey);
        updateData.encryptedApiKey = encrypted;
        updateData.salt = salt;
      }

      // Update cost and limit fields if provided
      if (updateFields.inputCost !== undefined) {
        updateData.inputCost = updateFields.inputCost;
      }
      if (updateFields.outputCost !== undefined) {
        updateData.outputCost = updateFields.outputCost;
      }
      if (updateFields.unitPrice !== undefined) {
        updateData.unitPrice = updateFields.unitPrice;
      }
      if (updateFields.thinkingLevel !== undefined) {
        updateData.thinkingLevel = validateThinkingLevel(updateFields.thinkingLevel);
      }
      if (updateFields.inputTokenLimit !== undefined) {
        updateData.inputTokenLimit = updateFields.inputTokenLimit;
      }
      if (updateFields.outputTokenLimit !== undefined) {
        updateData.outputTokenLimit = updateFields.outputTokenLimit;
        updateData.maxTokens = updateFields.outputTokenLimit;
      }
      if (updateFields.dailyCostLimit !== undefined) {
        updateData.dailyCostLimit = updateFields.dailyCostLimit > 0 ? updateFields.dailyCostLimit : null;
      }
      if (updateFields.monthlyCostLimit !== undefined) {
        updateData.monthlyCostLimit = updateFields.monthlyCostLimit > 0 ? updateFields.monthlyCostLimit : null;
      }
      if (updateFields.tokensPerMinute !== undefined) {
        updateData.tokensPerMinute = updateFields.tokensPerMinute;
      }
      if (updateFields.requestsPerMinute !== undefined) {
        updateData.requestsPerMinute = updateFields.requestsPerMinute;
      }
      if (updateFields.requestsPerDay !== undefined) {
        updateData.requestsPerDay = updateFields.requestsPerDay;
      }
    }

    // Update performance parameters if provided
    if (updateFields.temperature !== undefined) {
      updateData.temperature = updateFields.temperature;
    }
    if (updateFields.topP !== undefined) {
      updateData.topP = updateFields.topP;
    }
    if (updateFields.maxTokens !== undefined) {
      updateData.maxTokens = updateFields.maxTokens;
      if (updateFields.outputTokenLimit === undefined) {
        updateData.outputTokenLimit = updateFields.maxTokens;
      }
    }

    try {
      const configuration = await prisma.$transaction(async (tx) => {
        return await tx.aIConfiguration.update({
          where: { id: configId },
          data: updateData
        });
      });

      res.json({ configuration });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {  // Unique constraint violation
          const friendlyError = new Error('A configuration with this name already exists') as Error & { statusCode?: number };
          friendlyError.statusCode = 400;
          throw friendlyError;
        }
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Bulk update configurations
router.put('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Bulk update AI config request body:', req.body);
    const { ids, updates } = req.body as BulkUpdateRequest;
    const validIds = validateIds(ids);

    // Validate updates
    if (!updates || typeof updates !== 'object') {
      const error = new Error('Invalid updates') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    try {
      const updatedConfigurations = await prisma.$transaction(async (tx) => {
        // Verify all configurations exist and are not deleted
        const existingConfigurations = await tx.aIConfiguration.findMany({
          where: { 
            id: { in: validIds },
            deletedAt: null
          }
        });

        if (existingConfigurations.length !== validIds.length) {
          const error = new Error('One or more configurations not found') as Error & { statusCode?: number };
          error.statusCode = 404;
          throw error;
        }

        // Prepare update data
        const updateData: any = {};

        if (updates.name) {
          updateData.name = validateName(updates.name);
        }

        if (updates.isActive !== undefined) {
          updateData.isActive = Boolean(updates.isActive);
        }

        // Update all configurations
        const updatePromises = validIds.map(id =>
          tx.aIConfiguration.update({
            where: { 
              id,
              deletedAt: null
            },
            data: updateData
          })
        );

        return await Promise.all(updatePromises);
      });

      res.json({ configurations: updatedConfigurations });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {  // Unique constraint violation
          const friendlyError = new Error('A configuration with this name already exists') as Error & { statusCode?: number };
          friendlyError.statusCode = 400;
          throw friendlyError;
        }
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Bulk delete configurations
router.delete('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  console.log('Hit AI config bulk delete endpoint');
  try {
    console.log('Bulk delete AI config request:', {
      body: req.body,
      headers: req.headers
    });
    
    const { ids } = req.body;
    console.log('Raw AI config IDs from request:', ids);
    
    const validIds = validateIds(ids);
    console.log('Validated AI config IDs:', validIds);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Verify all configurations exist and are not already deleted
        const existingConfigurations = await tx.aIConfiguration.findMany({
          where: { 
            id: { in: validIds },
            deletedAt: null
          }
        });

        if (existingConfigurations.length !== validIds.length) {
          const error = new Error('One or more configurations not found') as Error & { statusCode?: number };
          error.statusCode = 404;
          throw error;
        }

        // Soft delete configurations by setting deletedAt timestamp
        const configurationsToDelete = existingConfigurations;
        
        console.log('Soft deleting AI configurations:', configurationsToDelete.map(c => c.id));
        
        // Soft delete configurations
        if (configurationsToDelete.length > 0) {
          await tx.aIConfiguration.updateMany({
            where: { id: { in: configurationsToDelete.map(c => c.id) } },
            data: { deletedAt: new Date() }
          });
        }

        // Prepare result
        const result: BulkDeleteResult = {
          success: {
            count: configurationsToDelete.length,
            names: configurationsToDelete.map(c => c.name)
          },
          failure: {
            count: 0,
            configurations: []
          }
        };

        return result;
      });

      // All successful, send a 200 OK
      res.status(200).json({
        message: `Successfully deleted ${result.success.count} ${result.success.count === 1 ? 'configuration' : 'configurations'}: ${result.success.names.join(', ')}.`,
        result
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error('Prisma error:', error);
        throw error;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Token estimation endpoint
router.post('/estimate-tokens', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, targetLanguage = 'Custom' } = req.body;

    if (!text || typeof text !== 'string') {
      const error = new Error('Text is required for token estimation') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    // Get active AI configuration
    const config = await prisma.aIConfiguration.findFirst({
      where: {
        type: 'apikey',
        isActive: true,
        deletedAt: null
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (!config) {
      const error = new Error('AI configuration required. Please configure AI settings in the Tools → AI Configuration section.') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    // Use configured model or fallback
    const modelForEncoding = config.model?.startsWith('gpt-') ? 'gpt-4o-mini' : 'gpt-4o-mini';
    
    try {
      const encoder = encoding_for_model(modelForEncoding);
      
      // System prompt token calculation
      const systemPrompt = `You are a translation service for a nonprofit food pantry. Translate to ${targetLanguage} using the closest natural equivalent. Your response must be a valid JSON string containing only a "translatedText" field.`;
      const systemTokenCount = encoder.encode(systemPrompt).length;
      
      // User text token calculation
      const userTokenCount = encoder.encode(text).length;
      
      // Input calculations (system prompt + user text)
      const totalInputTokens = systemTokenCount + userTokenCount;
      const inputCost = totalInputTokens * (config.inputCost || 0);
      
      // Output estimation (1.5x user text)
      const estimatedOutputTokens = Math.ceil(userTokenCount * 1.5);
      const outputCost = estimatedOutputTokens * (config.outputCost || 0);
      
      encoder.free();
      
      res.json({
        inputMetrics: {
          tokenCount: totalInputTokens,
          cost: inputCost
        },
        outputMetrics: {
          tokenCount: estimatedOutputTokens,
          cost: outputCost
        },
        totalCost: inputCost + outputCost,
        model: config.model || 'Unknown'
      });
    } catch (encodingError) {
      console.error('Token encoding error:', encodingError);
      
      // Fallback estimation without tiktoken
      const roughInputTokens = Math.ceil(text.length / 4) + 50; // ~4 chars per token + system prompt
      const roughOutputTokens = Math.ceil((text.length / 4) * 1.5);
      
      const inputCost = roughInputTokens * (config.inputCost || 0);
      const outputCost = roughOutputTokens * (config.outputCost || 0);
      
      res.json({
        inputMetrics: {
          tokenCount: roughInputTokens,
          cost: inputCost
        },
        outputMetrics: {
          tokenCount: roughOutputTokens,
          cost: outputCost
        },
        totalCost: inputCost + outputCost,
        model: config.model || 'Unknown',
        warning: 'Token estimation using fallback method'
      });
    }
  } catch (error) {
    next(error);
  }
});

// Delete single configuration
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const configId = Number(id);
    
    if (isNaN(configId)) {
      const error = new Error('Invalid configuration ID') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    await prisma.$transaction(async (tx) => {
      const configuration = await tx.aIConfiguration.findUnique({
        where: { 
          id: configId,
          deletedAt: null
        }
      });

      if (!configuration) {
        const error = new Error('Configuration not found') as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      }

      await tx.aIConfiguration.update({
        where: { id: configId },
        data: { deletedAt: new Date() }
      });
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
