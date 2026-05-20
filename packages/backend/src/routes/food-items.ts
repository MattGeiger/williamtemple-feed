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
import {
  validateFoodItem,
  transformFoodItem,
  validateIds,
  handlePrismaError,
  StatusFlags,
  DietaryFlags
} from '../utils/foodItemUtils';

import { translationAuditor } from '../services/translation-auditor';
import { translationTriggerService } from '../services/translation-trigger';

const router = Router();

interface BulkUpdateRequest {
  ids: number[];
  updates: {
    name?: string;
    limit?: number;
    limitType?: 'person' | 'household';
    categoryId?: number;
    statusFlags?: StatusFlags;
    dietaryFlags?: DietaryFlags;
  };
}

// GET inventory distribution with separate aggregations
router.get('/distribution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Run separate count queries for each status flag
    const inStockCount = await prisma.foodItem.count({
      where: { isInStock: true }
    });
    const limitedCount = await prisma.foodItem.count({
      where: { isLimited: true }
    });
    const clearanceCount = await prisma.foodItem.count({
      where: { isClearance: true }
    });
    // Count all items that are not in stock
    const outOfStockCount = await prisma.foodItem.count({
      where: { isInStock: false }
    });

    // Build the distribution array using the separate counts.
    const distribution = [
      {
        status: 'inStock',
        items: inStockCount,
        fill: 'var(--color-inStock)'
      },
      {
        status: 'limited',
        items: limitedCount,
        fill: 'var(--color-limited)'
      },
      {
        status: 'clearance',
        items: clearanceCount,
        fill: 'var(--color-clearance)'
      },
      {
        status: 'outOfStock',
        items: outOfStockCount,
        fill: 'var(--color-outOfStock)' // Ensure you define --color-outOfStock in your CSS.
      }
    ];

    // Get a distinct total count of food items so each is counted once.
    const totalItems = await prisma.foodItem.count();

    res.json({ distribution, totalItems });
  } catch (error) {
    next(error);
  }
});

// GET all food items
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.foodItem.findMany({
      orderBy: { name: 'asc' }
    });
    const foodItems = items.map(transformFoodItem);
    res.json({ foodItems });
  } catch (error) {
    next(error);
  }
});

// GET single food item
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const item = await prisma.foodItem.findUnique({
      where: { id: Number(id) }
    });
    if (!item) {
      const error = new Error('Food item not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }
    const foodItem = transformFoodItem(item);
    res.json({ foodItem });
  } catch (error) {
    next(error);
  }
});

// Bulk update food items
router.put('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, updates } = req.body as BulkUpdateRequest;
    // Deduplicate IDs before validation
    const uniqueIds = [...new Set(ids)];
    const validIds = validateIds(uniqueIds);
    // Validate updates
    if (!updates || typeof updates !== 'object') {
      const error = new Error('Invalid updates') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }
    try {
      const updatedItems = await prisma.$transaction(async (tx) => {
        // Verify all items exist
        const existingItems = await tx.foodItem.findMany({
          where: { id: { in: validIds } }
        });
        if (existingItems.length !== validIds.length) {
          const error = new Error('One or more food items not found') as Error & { statusCode?: number };
          error.statusCode = 404;
          throw error;
        }
        // Verify category if provided
        if (updates.categoryId) {
          const category = await tx.category.findUnique({
            where: { id: updates.categoryId }
          });
          if (!category) {
            const error = new Error('Category not found') as Error & { statusCode?: number };
            error.statusCode = 404;
            throw error;
          }
        }
        // Prepare update data
        const updateData: any = {};
        if (updates.name) {
          if (typeof updates.name !== 'string' || updates.name.length < 3 || updates.name.length > 36) {
            const error = new Error('Name must be between 3 and 36 characters') as Error & { statusCode?: number };
            error.statusCode = 400;
            throw error;
          }
          updateData.name = updates.name.trim().replace(/\\s+/g, ' ');
          updateData.nameSearch = updateData.name.toLowerCase();
        }
        if (updates.limit) {
          if (typeof updates.limit !== 'number' || updates.limit < 1 || updates.limit > 100) {
            const error = new Error('Limit must be a number between 1 and 100') as Error & { statusCode?: number };
            error.statusCode = 400;
            throw error;
          }
          updateData.limit = updates.limit;
        }
        
        if (updates.limitType) {
          if (!['person', 'household'].includes(updates.limitType)) {
            const error = new Error('Limit type must be either "person" or "household"') as Error & { statusCode?: number };
            error.statusCode = 400;
            throw error;
          }
          updateData.limitType = updates.limitType;
        }
        if (updates.categoryId) {
          updateData.categoryId = updates.categoryId;
        }
        if (updates.statusFlags) {
          updateData.isInStock = updates.statusFlags.isInStock ?? true;
          updateData.isLimited = updates.statusFlags.isLimited ?? false;
          updateData.isClearance = updates.statusFlags.isClearance ?? false;
        }
        if (updates.dietaryFlags) {
          updateData.vegan = updates.dietaryFlags.vegan ?? false;
          updateData.vegetarian = updates.dietaryFlags.vegetarian ?? false;
          updateData.glutenFree = updates.dietaryFlags.glutenFree ?? false;
          updateData.organic = updates.dietaryFlags.organic ?? false;
          updateData.halal = updates.dietaryFlags.halal ?? false;
          updateData.kosher = updates.dietaryFlags.kosher ?? false;
          updateData.readyToEat = updates.dietaryFlags.readyToEat ?? false;
        }
        // Update all items
        const updatePromises = validIds.map(id =>
          tx.foodItem.update({
            where: { id },
            data: updateData
          })
        );
        const updatedItems = await Promise.all(updatePromises);
        return updatedItems.map(transformFoodItem);
      });
      res.json({ foodItems: updatedItems });
    } catch (error) {
      handlePrismaError(error);
    }
  } catch (error) {
    next(error);
  }
});

// Bulk delete food items
router.delete('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    const validIds = validateIds(ids);
    try {
      // Verify all items exist and get their names for translation cleanup
      const existingItems = await prisma.foodItem.findMany({
        where: { id: { in: validIds } }
      });
      
      if (existingItems.length !== validIds.length) {
        const error = new Error('One or more food items not found') as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      }
      
      // Store the names for translation cleanup
      const itemNames = existingItems.map(item => item.name);
      
      // Delete all items
      await prisma.foodItem.deleteMany({
        where: { id: { in: validIds } }
      });
      
      // Return success response immediately
      res.status(204).end();
      
      // Clean up translations asynchronously after the response is sent
      prisma.translation.deleteMany({
        where: {
          originalText: { in: itemNames },
          type: 'FoodItem'
        }
      }).catch(err => console.error('Error deleting translations after bulk food item deletion:', err));
      
    } catch (error) {
      handlePrismaError(error);
    }
  } catch (error) {
    next(error);
  }
});

// Create new food item
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const foodItemData = req.body;
    validateFoodItem(foodItemData);
    try {
      // Only create the food item in the transaction - separate from translations
      const newItem = await prisma.$transaction(async (tx) => {
        // Verify category exists
        const category = await tx.category.findUnique({
          where: { id: foodItemData.categoryId }
        });
        if (!category) {
          const error = new Error('Category not found') as Error & { statusCode?: number };
          error.statusCode = 404;
          throw error;
        }
        // Prepare data
        const data = {
          name: foodItemData.name.trim().replace(/\\s+/g, ' '),
          nameSearch: foodItemData.name.trim().toLowerCase(),
          limit: foodItemData.limit || 10,
          limitType: foodItemData.limitType || 'person',
          categoryId: foodItemData.categoryId,
          isInStock: foodItemData.statusFlags?.isInStock ?? true,
          isLimited: foodItemData.statusFlags?.isLimited ?? false,
          isClearance: foodItemData.statusFlags?.isClearance ?? false,
          vegan: foodItemData.dietaryFlags?.vegan ?? false,
          vegetarian: foodItemData.dietaryFlags?.vegetarian ?? false,
          glutenFree: foodItemData.dietaryFlags?.glutenFree ?? false,
          organic: foodItemData.dietaryFlags?.organic ?? false,
          halal: foodItemData.dietaryFlags?.halal ?? false,
          kosher: foodItemData.dietaryFlags?.kosher ?? false,
          readyToEat: foodItemData.dietaryFlags?.readyToEat ?? false
        };
        // Just create the food item and return immediately
        const item = await tx.foodItem.create({ data });
        return transformFoodItem(item);
      });
      
      // Return success response immediately
      res.status(201).json({ foodItem: newItem });
      
      // After response is sent, queue translations asynchronously
      // This won't block the response or cause transaction timeouts
      translationTriggerService.queueContentTranslation(newItem.id, 'FoodItem', 'name', newItem.name)
        .catch(err => console.error('Error queueing translations after food item creation:', err));
      
    } catch (error) {
      // Duplicate name (unique constraint on nameSearch). Look up the
      // existing item and return it alongside the error so the client can
      // offer a one-click "Mark In Stock" shortcut. This addresses a very
      // common staff workflow: re-entering an item that already exists but
      // is hidden from their inventory view by an "in stock" filter.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await prisma.foodItem.findUnique({
          where: { nameSearch: String(foodItemData?.name ?? '').trim().toLowerCase() },
        });
        return res.status(400).json({
          error: {
            message: 'A food item with this name already exists. Please choose a different name.',
            code: 'DUPLICATE_FOOD_ITEM_NAME',
            existingItem: existing ? transformFoodItem(existing) : null,
          },
        });
      }
      handlePrismaError(error);
    }
  } catch (error) {
    next(error);
  }
});

// Update food item
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (isNaN(numId) || numId < 1) {
      const error = new Error('Invalid food item ID') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }
    const { keepTranslations, ...updateData } = req.body;
    try {
      // First get the existing item to check for name changes
      const existingItem = await prisma.foodItem.findUnique({
        where: { id: numId }
      });
      
      if (!existingItem) {
        const error = new Error('Food item not found') as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      }
      
      // Store original name for translation handling
      const originalName = existingItem.name;
      let nameChanged = false;
      let newName = originalName;
      
      // Now update the food item in a separate transaction (without translations)
      const updatedItem = await prisma.$transaction(async (tx) => {
        // Verify category if provided
        if (updateData.categoryId) {
          const category = await tx.category.findUnique({
            where: { id: updateData.categoryId }
          });
          if (!category) {
            const error = new Error('Category not found') as Error & { statusCode?: number };
            error.statusCode = 404;
            throw error;
          }
        }
        
        // Prepare update data
        const data: any = {};
        if (updateData.name) {
          if (typeof updateData.name !== 'string' || updateData.name.length < 3 || updateData.name.length > 36) {
            const error = new Error('Name must be between 3 and 36 characters') as Error & { statusCode?: number };
            error.statusCode = 400;
            throw error;
          }
          data.name = updateData.name.trim().replace(/\\s+/g, ' ');
          data.nameSearch = data.name.toLowerCase();
          
          // Check if name changed
          if (data.name !== originalName) {
            nameChanged = true;
            newName = data.name;
          }
        }
        
        if (updateData.limit) {
          if (typeof updateData.limit !== 'number' || updateData.limit < 1 || updateData.limit > 100) {
            const error = new Error('Limit must be a number between 1 and 100') as Error & { statusCode?: number };
            error.statusCode = 400;
            throw error;
          }
          data.limit = updateData.limit;
        }
        
        if (updateData.limitType) {
          if (!['person', 'household'].includes(updateData.limitType)) {
            const error = new Error('Limit type must be either "person" or "household"') as Error & { statusCode?: number };
            error.statusCode = 400;
            throw error;
          }
          data.limitType = updateData.limitType;
        }
        
        if (updateData.categoryId) {
          data.categoryId = updateData.categoryId;
        }
        
        if (updateData.statusFlags) {
          data.isInStock = updateData.statusFlags.isInStock ?? existingItem.isInStock;
          data.isLimited = updateData.statusFlags.isLimited ?? existingItem.isLimited;
          data.isClearance = updateData.statusFlags.isClearance ?? existingItem.isClearance;
        }
        
        if (updateData.dietaryFlags) {
          data.vegan = updateData.dietaryFlags.vegan ?? existingItem.vegan;
          data.vegetarian = updateData.dietaryFlags.vegetarian ?? existingItem.vegetarian;
          data.glutenFree = updateData.dietaryFlags.glutenFree ?? existingItem.glutenFree;
          data.organic = updateData.dietaryFlags.organic ?? existingItem.organic;
          data.halal = updateData.dietaryFlags.halal ?? existingItem.halal;
          data.kosher = updateData.dietaryFlags.kosher ?? existingItem.kosher;
          data.readyToEat = updateData.dietaryFlags.readyToEat ?? existingItem.readyToEat;
        }
        
        // Update the food item
        const updated = await tx.foodItem.update({
          where: { id: numId },
          data
        });
        
        return transformFoodItem(updated);
      });
      
      // Return success response immediately
      res.json({ foodItem: updatedItem });
      
      // If name changed, handle translations asynchronously
      if (nameChanged) {
        // Handle keepTranslations logic directly
        if (!keepTranslations) {
          // Delete old translations asynchronously
          prisma.translation.deleteMany({
            where: {
              originalText: originalName,
              type: 'FoodItem'
            }
          }).catch(err => console.error('Error deleting old translations:', err));
        }
        
        // Queue new translations
        translationTriggerService.queueContentTranslation(numId, 'FoodItem', 'name', newName)
          .catch(err => console.error('Error queueing translations after food item update:', err));
      }
    } catch (error) {
      handlePrismaError(error);
    }
  } catch (error) {
    next(error);
  }
});

// Delete food item
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (isNaN(numId) || numId < 1) {
      const error = new Error('Invalid food item ID') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }
    try {
      // First, get the item to verify it exists and to get the name for translation cleanup
      const existingItem = await prisma.foodItem.findUnique({
        where: { id: numId }
      });
      
      if (!existingItem) {
        const error = new Error('Food item not found') as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      }
      
      // Delete the food item in a simpler transaction
      await prisma.foodItem.delete({
        where: { id: numId }
      });
      
      // Return success response immediately
      res.status(204).end();
      
      // Clean up translations asynchronously after the response is sent
      prisma.translation.deleteMany({
        where: {
          originalText: existingItem.name,
          type: 'FoodItem'
        }
      }).catch(err => console.error('Error deleting translations after food item deletion:', err));
      
    } catch (error) {
      handlePrismaError(error);
    }
  } catch (error) {
    next(error);
  }
});

export default router;