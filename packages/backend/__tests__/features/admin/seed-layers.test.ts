// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { describe, expect, it } from 'vitest';

import {
  ILLUSTRATIVE_CATEGORIES,
  ILLUSTRATIVE_FOOD_ITEMS,
  REFERENCE_LANGUAGES,
  STRUCTURAL,
} from '../../../src/services/seed/layers';

/**
 * The clean slate is what a new deployment sees first, and what an established
 * pantry gets back when it resets. Its content is a decision, not an
 * implementation detail — so the decisions are pinned here rather than left to
 * whoever edits the array next.
 */

const byName = (name: string) =>
  ILLUSTRATIVE_FOOD_ITEMS.find(item => item.name === name);

describe('clean slate: illustrative layer', () => {
  it('stays small enough to read as an example', () => {
    // A large seeded inventory invites two failures: someone mistakes it for
    // real data, or someone spends their first hour deleting it.
    expect(ILLUSTRATIVE_CATEGORIES).toHaveLength(3);
    expect(ILLUSTRATIVE_FOOD_ITEMS).toHaveLength(9);
  });

  it('gives every item a category that is actually seeded', () => {
    const categories = new Set(ILLUSTRATIVE_CATEGORIES.map(c => c.name));
    for (const item of ILLUSTRATIVE_FOOD_ITEMS) {
      expect(categories, `${item.name} names ${item.categoryName}`).toContain(
        item.categoryName
      );
    }
  });

  it('leaves Produce unlimited and caps Dairy and Meat at 3', () => {
    const limits = Object.fromEntries(
      ILLUSTRATIVE_CATEGORIES.map(c => [c.name, c.limit])
    );
    // 100 is FEED's sentinel for "No Limit" (useCategoryForm.getFormattedLimit),
    // not a literal cap — writing anything else makes Produce read as capped.
    expect(limits.Produce).toBe(100);
    expect(limits.Dairy).toBe(3);
    expect(limits.Meat).toBe(3);
  });

  it('gives Dairy and Meat items a limit of 1 and Produce items none', () => {
    for (const item of ILLUSTRATIVE_FOOD_ITEMS) {
      if (item.categoryName === 'Produce') expect(item.limit).toBe(100);
      else expect(item.limit, `${item.name}`).toBe(1);
    }
  });

  it('paints exactly one status badge per category', () => {
    // The badges are independent of the numeric limit: `isLimited` is a
    // "Limited" marker on shopping lists, not a cap. Setting it on every item
    // with a limit of 1 — the mistake this test exists to catch — would make
    // six items wear it and demonstrate nothing.
    expect(byName('Carrots')?.isInStock).toBe(false);
    expect(byName('Chicken')?.isLimited).toBe(true);
    expect(byName('Yogurt')?.isClearance).toBe(true);

    expect(ILLUSTRATIVE_FOOD_ITEMS.filter(i => !i.isInStock)).toHaveLength(1);
    expect(ILLUSTRATIVE_FOOD_ITEMS.filter(i => i.isLimited)).toHaveLength(1);
    expect(ILLUSTRATIVE_FOOD_ITEMS.filter(i => i.isClearance)).toHaveLength(1);
  });

  it('describes the food accurately, because the flags teach what they mean', () => {
    expect(byName('Grapes')?.vegan).toBe(true);
    // Cheese and yogurt are vegetarian but not vegan — an example that got this
    // wrong would teach staff the wrong thing about the fields.
    expect(byName('Cheese')?.vegan).toBe(false);
    expect(byName('Cheese')?.vegetarian).toBe(true);
    expect(byName('Beef')?.vegetarian).toBe(false);
  });
});

describe('clean slate: structural and reference layers', () => {
  it('carries every supported language as available', () => {
    expect(REFERENCE_LANGUAGES.length).toBe(59);
  });

  it('enables only English', () => {
    // A fresh instance with 59 languages switched on would put 59 columns of
    // untranslated text in front of staff on day one.
    expect(STRUCTURAL.enabledLanguage).toBe('English');
    expect(REFERENCE_LANGUAGES.some(l => l.name === STRUCTURAL.enabledLanguage)).toBe(true);
  });

  it('sets a global limit, so uncapped items are still bounded', () => {
    expect(STRUCTURAL.globalLimit).toBeGreaterThan(0);
  });

  it('gives languages a stable, gap-free ordering', () => {
    const orders = REFERENCE_LANGUAGES.map(l => l.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
    expect(Math.min(...orders)).toBe(1);
    expect(Math.max(...orders)).toBe(REFERENCE_LANGUAGES.length);
  });
});
