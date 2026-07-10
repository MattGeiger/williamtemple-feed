// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { describe, test, expect } from 'vitest';
import {
  computeEventRecordFlags,
  isEffectiveTrackedChange,
  resolveStockAndQuantity,
  StockQuantityState,
  TrackedItemState,
} from '../../../src/services/food-item/stock-consistency';
import { parseLogisticsPayload } from '../../../src/utils/foodItemUtils';

/**
 * Central stock/count consistency rules (docs/reports/logistics.md §1).
 * These invariants must hold on every mutation pathway: edit form, row
 * quick actions, bulk status actions, duplicate-name recovery, deletion
 * alternatives, and Shopping List Builder inventory actions.
 */

const inStock = (qty: number | null): StockQuantityState => ({
  isInStock: true,
  isLimited: false,
  isClearance: false,
  estimatedQuantity: qty,
});

const outOfStock: StockQuantityState = {
  isInStock: false,
  isLimited: false,
  isClearance: false,
  estimatedQuantity: 0,
};

describe('resolveStockAndQuantity', () => {
  test('explicit move to Out of Stock zeroes the quantity and clears Limited/Clearance', () => {
    const result = resolveStockAndQuantity(
      { isInStock: true, isLimited: true, isClearance: true, estimatedQuantity: 40 },
      {
        statusFlags: { isInStock: false, isLimited: true, isClearance: true },
        estimatedQuantityProvided: false,
      }
    );
    expect(result).toEqual(outOfStock);
  });

  test('a zero quantity forces Out of Stock even when flags say in stock', () => {
    const result = resolveStockAndQuantity(inStock(12), {
      statusFlags: { isInStock: true, isLimited: true, isClearance: false },
      estimatedQuantity: 0,
      estimatedQuantityProvided: true,
    });
    expect(result).toEqual(outOfStock);
  });

  test('a positive quantity restores plain In Stock when previously out', () => {
    // Edit form on an out-of-stock item: user types a count but leaves the
    // Status tab untouched (form still carries the out-of-stock flags).
    const result = resolveStockAndQuantity(outOfStock, {
      statusFlags: { isInStock: false, isLimited: false, isClearance: false },
      estimatedQuantity: 25,
      estimatedQuantityProvided: true,
    });
    expect(result).toEqual(inStock(25));
  });

  test('an explicit out-of-stock transition wins over a positive quantity', () => {
    const result = resolveStockAndQuantity(inStock(10), {
      statusFlags: { isInStock: false, isLimited: false, isClearance: false },
      estimatedQuantity: 10,
      estimatedQuantityProvided: true,
    });
    expect(result).toEqual(outOfStock);
  });

  test('quick "Mark In Stock" without a count sets quantity to Unknown', () => {
    const result = resolveStockAndQuantity(outOfStock, {
      statusFlags: { isInStock: true, isLimited: false, isClearance: false },
      estimatedQuantityProvided: false,
    });
    expect(result).toEqual(inStock(null));
  });

  test('unknown quantity may coexist with in-stock status', () => {
    const result = resolveStockAndQuantity(inStock(30), {
      statusFlags: { isInStock: true, isLimited: false, isClearance: false },
      estimatedQuantity: null,
      estimatedQuantityProvided: true,
    });
    expect(result).toEqual(inStock(null));
  });

  test('a status-only change keeps the existing quantity', () => {
    const result = resolveStockAndQuantity(inStock(18), {
      statusFlags: { isInStock: true, isLimited: true, isClearance: false },
      estimatedQuantityProvided: false,
    });
    expect(result).toEqual({ ...inStock(18), isLimited: true });
  });

  test('an out-of-stock item stays out and normalized to 0 when nothing changes', () => {
    const result = resolveStockAndQuantity(
      { ...outOfStock, estimatedQuantity: null },
      { estimatedQuantityProvided: false }
    );
    expect(result).toEqual(outOfStock);
  });
});

describe('computeEventRecordFlags', () => {
  const base: TrackedItemState = {
    name: 'Tuna',
    categoryId: 3,
    isInStock: true,
    isLimited: false,
    isClearance: false,
    purchasePriceCents: 10000,
    unitsPerPurchase: 50,
    estimatedQuantity: 100,
  };

  test('no-op saves are not effective tracked changes', () => {
    const flags = computeEventRecordFlags(base, { ...base });
    expect(isEffectiveTrackedChange(flags)).toBe(false);
  });

  test('quantity, price, status, and identity dimensions are flagged independently', () => {
    expect(
      computeEventRecordFlags(base, { ...base, estimatedQuantity: 90 })
    ).toEqual({
      recordsQuantity: true,
      recordsPrice: false,
      recordsStatus: false,
      recordsIdentity: false,
    });
    expect(
      computeEventRecordFlags(base, { ...base, unitsPerPurchase: 24 })
    ).toMatchObject({ recordsPrice: true, recordsQuantity: false });
    expect(
      computeEventRecordFlags(base, { ...base, purchasePriceCents: null })
    ).toMatchObject({ recordsPrice: true });
    expect(
      computeEventRecordFlags(base, { ...base, isLimited: true })
    ).toMatchObject({ recordsStatus: true, recordsIdentity: false });
    expect(
      computeEventRecordFlags(base, { ...base, name: 'Canned Tuna' })
    ).toMatchObject({ recordsIdentity: true });
    expect(
      computeEventRecordFlags(base, { ...base, categoryId: 5 })
    ).toMatchObject({ recordsIdentity: true });
  });
});

describe('parseLogisticsPayload', () => {
  test('returns undefined when no logistics block is present', () => {
    expect(parseLogisticsPayload(undefined)).toBeUndefined();
    expect(parseLogisticsPayload(null)).toBeUndefined();
  });

  test('tracks explicit estimatedQuantity presence, including null (Unknown)', () => {
    expect(parseLogisticsPayload({})).toEqual({ estimatedQuantityProvided: false });
    expect(parseLogisticsPayload({ estimatedQuantity: null })).toEqual({
      estimatedQuantity: null,
      estimatedQuantityProvided: true,
    });
    expect(parseLogisticsPayload({ estimatedQuantity: 42 })).toEqual({
      estimatedQuantity: 42,
      estimatedQuantityProvided: true,
    });
  });

  test('accepts null (Unknown) and 0 (Donated/Free) purchase prices', () => {
    expect(parseLogisticsPayload({ purchasePriceCents: null })).toEqual({
      purchasePriceCents: null,
      estimatedQuantityProvided: false,
    });
    expect(parseLogisticsPayload({ purchasePriceCents: 0 })).toEqual({
      purchasePriceCents: 0,
      estimatedQuantityProvided: false,
    });
  });

  test('rejects fractional, negative, or non-numeric values', () => {
    expect(() => parseLogisticsPayload({ purchasePriceCents: 10.5 })).toThrow();
    expect(() => parseLogisticsPayload({ purchasePriceCents: -1 })).toThrow();
    expect(() => parseLogisticsPayload({ purchasePriceCents: '100' })).toThrow();
    expect(() => parseLogisticsPayload({ unitsPerPurchase: 0 })).toThrow();
    expect(() => parseLogisticsPayload({ unitsPerPurchase: 1.5 })).toThrow();
    expect(() => parseLogisticsPayload({ estimatedQuantity: -3 })).toThrow();
    expect(() => parseLogisticsPayload({ estimatedQuantity: 2.2 })).toThrow();
    expect(() => parseLogisticsPayload('logistics')).toThrow();
    expect(() => parseLogisticsPayload([1])).toThrow();
  });
});
