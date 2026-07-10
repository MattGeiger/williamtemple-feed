// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { Prisma } from '@prisma/client';

export function validateMinLength(text: string, minLength: number): boolean {
  return text.trim().length >= minLength;
}

export interface StatusFlags {
  isInStock: boolean;
  isLimited: boolean;
  isClearance: boolean;
}

export interface DietaryFlags {
  vegan: boolean;
  vegetarian: boolean;
  glutenFree: boolean;
  organic: boolean;
  halal: boolean;
  kosher: boolean;
  readyToEat: boolean;
}

// Logistics request payload (docs/reports/logistics.md §1). All values are
// already-parsed integers: the client converts the currency string to
// cents (never float math). null price = Unknown, 0 = Donated/Free.
export interface LogisticsPayload {
  purchasePriceCents?: number | null;
  unitsPerPurchase?: number;
  estimatedQuantity?: number | null;
}

export interface FoodItemBase {
  name: string;
  limit?: number;
  limitType?: 'person' | 'household';
  categoryId: number;
  statusFlags?: StatusFlags;
  dietaryFlags?: DietaryFlags;
  logistics?: LogisticsPayload;
}

/**
 * Validates the optional logistics block and normalizes it into the shape
 * the mutation service consumes, capturing whether estimatedQuantity was
 * explicitly provided (a quick status action omits it; the edit form sends
 * it, possibly as null = Unknown).
 */
export const parseLogisticsPayload = (
  logistics: unknown
):
  | {
      purchasePriceCents?: number | null;
      unitsPerPurchase?: number;
      estimatedQuantity?: number | null;
      estimatedQuantityProvided: boolean;
    }
  | undefined => {
  if (logistics === undefined || logistics === null) return undefined;
  if (typeof logistics !== 'object' || Array.isArray(logistics)) {
    const error = new Error('Invalid logistics payload') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  const source = logistics as Record<string, unknown>;
  const errors: string[] = [];
  const result: {
    purchasePriceCents?: number | null;
    unitsPerPurchase?: number;
    estimatedQuantity?: number | null;
    estimatedQuantityProvided: boolean;
  } = { estimatedQuantityProvided: false };

  if ('purchasePriceCents' in source) {
    const value = source.purchasePriceCents;
    if (value === null) {
      result.purchasePriceCents = null;
    } else if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
      result.purchasePriceCents = value;
    } else {
      errors.push('Purchase price must be a nonnegative whole number of cents or null');
    }
  }

  if ('unitsPerPurchase' in source) {
    const value = source.unitsPerPurchase;
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1) {
      result.unitsPerPurchase = value;
    } else {
      errors.push('Units per purchase must be a whole number of at least 1');
    }
  }

  if ('estimatedQuantity' in source) {
    result.estimatedQuantityProvided = true;
    const value = source.estimatedQuantity;
    if (value === null) {
      result.estimatedQuantity = null;
    } else if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
      result.estimatedQuantity = value;
    } else {
      errors.push('Estimated quantity must be a nonnegative whole number or null');
    }
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(', ')) as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  return result;
};

export const validateFoodItem = (data: any): void => {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.length < 3 || data.name.length > 36) {
    errors.push('Name must be between 3 and 36 characters');
  }

  if (data.limit !== undefined) {
    if (typeof data.limit !== 'number' || data.limit < 1 || data.limit > 100) {
      errors.push('Limit must be a number between 1 and 100');
    }
  }
  
  if (data.limitType !== undefined && !['person', 'household'].includes(data.limitType)) {
    errors.push('Limit type must be either "person" or "household"');
  }

  if (!data.categoryId || typeof data.categoryId !== 'number' || data.categoryId < 1) {
    errors.push('Valid category ID is required');
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(', ')) as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
};

export const transformFoodItem = (item: any) => ({
  id: item.id,
  name: item.name,
  nameSearch: item.nameSearch,
  limit: item.limit,
  limitType: item.limitType,
  categoryId: item.categoryId,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  logistics: {
    purchasePriceCents: item.purchasePriceCents ?? null,
    unitsPerPurchase: item.unitsPerPurchase ?? 1,
    estimatedQuantity: item.estimatedQuantity ?? null,
  },
  statusFlags: {
    isInStock: item.isInStock,
    isLimited: item.isLimited,
    isClearance: item.isClearance,
  },
  dietaryFlags: {
    vegan: item.vegan,
    vegetarian: item.vegetarian,
    glutenFree: item.glutenFree,
    organic: item.organic,
    halal: item.halal,
    kosher: item.kosher,
    readyToEat: item.readyToEat,
  }
});

export const validateIds = (ids: any): number[] => {
  if (!Array.isArray(ids) || ids.length === 0) {
    const error = new Error('Invalid food item IDs') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  return ids.map(id => {
    const numId = Number(id);
    if (isNaN(numId) || numId < 1) {
      const error = new Error('Invalid food item ID') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }
    return numId;
  });
};

export const handlePrismaError = (error: any): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') { // Unique constraint violation
      const friendlyError = new Error('A food item with this name already exists') as Error & { statusCode?: number };
      friendlyError.statusCode = 400;
      throw friendlyError;
    }
  }
  throw error;
};