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

export interface FoodItemBase {
  name: string;
  limit?: number;
  limitType?: 'person' | 'household';
  categoryId: number;
  statusFlags?: StatusFlags;
  dietaryFlags?: DietaryFlags;
}

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