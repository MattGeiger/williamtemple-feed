// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { NextFunction, Request, Response, Router } from 'express';
import prisma from '../db';
import { version } from '../../package.json';

const router = Router();

type PublicInventoryFoodItem = {
  id: number;
  name: string;
  limit: number;
  limitType: string;
  statusTags: {
    inStock: true;
    limited: boolean;
    clearance: boolean;
  };
  dietaryFlags: {
    vegan: boolean;
    vegetarian: boolean;
    glutenFree: boolean;
    organic: boolean;
    halal: boolean;
    kosher: boolean;
    readyToEat: boolean;
  };
  updatedAt: string;
};

type PublicInventoryCategory = {
  id: number;
  name: string;
  icon: string | null;
  limit: number;
  limitType: string;
  itemCount: number;
  items: PublicInventoryFoodItem[];
};

function setPublicInventoryHeaders(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.type('application/json');
}

router.use((_req: Request, res: Response, next: NextFunction) => {
  setPublicInventoryHeaders(res);
  next();
});

router.options('/inventory.json', (_req: Request, res: Response) => {
  res.status(204).end();
});

router.get('/inventory.json', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        foodItems: {
          where: { isInStock: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const publicCategories: PublicInventoryCategory[] = categories
      .filter((category) => category.foodItems.length > 0)
      .map((category) => {
        const items = category.foodItems.map((item): PublicInventoryFoodItem => ({
          id: item.id,
          name: item.name,
          limit: item.limit,
          limitType: item.limitType,
          statusTags: {
            inStock: true,
            limited: item.isLimited,
            clearance: item.isClearance,
          },
          dietaryFlags: {
            vegan: item.vegan,
            vegetarian: item.vegetarian,
            glutenFree: item.glutenFree,
            organic: item.organic,
            halal: item.halal,
            kosher: item.kosher,
            readyToEat: item.readyToEat,
          },
          updatedAt: item.updatedAt.toISOString(),
        }));

        return {
          id: category.id,
          name: category.name,
          icon: category.icon,
          limit: category.limit,
          limitType: category.limitType,
          itemCount: items.length,
          items,
        };
      });

    res.json({
      generatedAt: new Date().toISOString(),
      version,
      categories: publicCategories,
      totals: {
        categories: publicCategories.length,
        foodItems: publicCategories.reduce((sum, category) => sum + category.itemCount, 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
