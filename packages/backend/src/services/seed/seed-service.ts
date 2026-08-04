// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import type { PrismaClient } from '@prisma/client';

import {
  ILLUSTRATIVE_CATEGORIES,
  ILLUSTRATIVE_FOOD_ITEMS,
  REFERENCE_LANGUAGES,
  STRUCTURAL,
} from './layers';

/**
 * Populate a database with a clean slate.
 *
 * Takes a client rather than importing the singleton, because the clean-slate
 * action runs this against a *scratch* database that is not live yet — the same
 * build-and-swap sequence restore uses. Writing to the live client would defeat
 * the entire mechanism.
 *
 * Idempotent by `nameSearch` / `name`, so running it twice is a no-op rather
 * than a duplicate set.
 */

export interface SeedOptions {
  /**
   * Include the illustrative layer — example categories, items, and the
   * builder template that binds to them.
   *
   * Default true: a first-run instance is the case where the choice matters
   * most, and example data is easy to clear once someone has their feet wet
   * (Delete is a bulk action). An established pantry resetting its own instance
   * wants false — it knows its categories, and seeded ones are work to remove.
   */
  withExamples?: boolean;
}

export interface SeedSummary {
  languages: number;
  enabledLanguages: number;
  categories: number;
  foodItems: number;
  globalLimit: number;
}

const normalize = (name: string) => name.trim().replace(/\s+/g, ' ');

export class SeedService {
  static async apply(
    prisma: PrismaClient,
    options: SeedOptions = {}
  ): Promise<SeedSummary> {
    const withExamples = options.withExamples ?? true;

    // --- Structural: what makes FEED work rather than merely be empty. ---
    // The column is `value`, not `limit` — the singleton row is id 1.
    await prisma.globalLimit.upsert({
      where: { id: 1 },
      update: { value: STRUCTURAL.globalLimit },
      create: { id: 1, value: STRUCTURAL.globalLimit },
    });

    // --- Reference: facts, not choices. Available, not enabled. ---
    for (const language of REFERENCE_LANGUAGES) {
      const isEnabled = language.name === STRUCTURAL.enabledLanguage;
      await prisma.language.upsert({
        where: { name: language.name },
        update: { sortOrder: language.sortOrder },
        // Only English arrives enabled. Enabling the rest is an agency
        // decision, and 59 columns of untranslated text on day one is not a
        // helpful starting point.
        create: {
          name: language.name,
          sortOrder: language.sortOrder,
          isEnabled,
        },
      });
    }

    let categories = 0;
    let foodItems = 0;

    // --- Illustrative: opinions about a pantry that may not be this one. ---
    if (withExamples) {
      const categoryIds = new Map<string, number>();

      for (const category of ILLUSTRATIVE_CATEGORIES) {
        const name = normalize(category.name);
        const nameSearch = name.toLowerCase();
        const created = await prisma.category.upsert({
          where: { nameSearch },
          update: {
            limit: category.limit,
            limitType: category.limitType,
            icon: category.icon,
          },
          create: {
            name,
            nameSearch,
            limit: category.limit,
            limitType: category.limitType,
            icon: category.icon,
          },
        });
        categoryIds.set(category.name, created.id);
        categories += 1;
      }

      for (const item of ILLUSTRATIVE_FOOD_ITEMS) {
        const categoryId = categoryIds.get(item.categoryName);
        if (!categoryId) {
          throw new Error(
            `Seed item "${item.name}" names category "${item.categoryName}", which is not seeded.`
          );
        }

        const name = normalize(item.name);
        const nameSearch = name.toLowerCase();
        const fields = {
          limit: item.limit,
          isLimited: item.isLimited,
          isInStock: item.isInStock,
          isClearance: item.isClearance,
          categoryId,
          vegan: item.vegan,
          vegetarian: item.vegetarian,
          glutenFree: item.glutenFree,
          organic: item.organic,
          halal: item.halal,
          kosher: item.kosher,
          readyToEat: item.readyToEat,
        };

        await prisma.foodItem.upsert({
          where: { nameSearch },
          update: fields,
          create: { name, nameSearch, ...fields },
        });
        foodItems += 1;
      }
    }

    const enabledLanguages = await prisma.language.count({ where: { isEnabled: true } });

    return {
      languages: REFERENCE_LANGUAGES.length,
      enabledLanguages,
      categories,
      foodItems,
      globalLimit: STRUCTURAL.globalLimit,
    };
  }
}
