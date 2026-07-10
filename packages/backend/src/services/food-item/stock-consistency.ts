// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Central stock/count consistency rules (docs/reports/logistics.md §1).
 *
 * Every pathway that can change a food item's status flags or estimated
 * quantity — edit form, row quick actions, bulk status actions,
 * duplicate-name recovery, deletion alternatives, Shopping List Builder
 * inventory actions — must resolve the final state through
 * {@link resolveStockAndQuantity} so the invariants hold everywhere:
 *
 * - Out of stock or an explicit quantity of 0 forces quantity 0, clears
 *   Limited/Clearance, and sets Out of Stock.
 * - A positive quantity restores plain In Stock when the item was
 *   previously out (unless the same request explicitly marks it out —
 *   the explicit out-of-stock transition wins).
 * - Unknown quantity (null) may coexist with an in-stock status.
 * - Quick "Mark In Stock" actions without a count set quantity to null
 *   (Unknown), never a fabricated number.
 */

export interface StatusFlagsState {
  isInStock: boolean;
  isLimited: boolean;
  isClearance: boolean;
}

export interface StockQuantityState extends StatusFlagsState {
  estimatedQuantity: number | null;
}

export interface StockQuantityRequest {
  /** Requested status flags; omitted fields inherit the current value. */
  statusFlags?: Partial<StatusFlagsState>;
  /** Requested quantity. Only meaningful when `estimatedQuantityProvided`. */
  estimatedQuantity?: number | null;
  /**
   * True when the caller explicitly supplied a quantity (including null =
   * Unknown). Quick status actions never provide one; the full edit form
   * always does.
   */
  estimatedQuantityProvided: boolean;
}

const OUT_OF_STOCK_STATE: StockQuantityState = {
  isInStock: false,
  isLimited: false,
  isClearance: false,
  estimatedQuantity: 0,
};

export function resolveStockAndQuantity(
  current: StockQuantityState,
  request: StockQuantityRequest
): StockQuantityState {
  const flags = {
    isInStock: request.statusFlags?.isInStock ?? current.isInStock,
    isLimited: request.statusFlags?.isLimited ?? current.isLimited,
    isClearance: request.statusFlags?.isClearance ?? current.isClearance,
  };
  const qtyProvided = request.estimatedQuantityProvided;
  const requestedQuantity = qtyProvided
    ? request.estimatedQuantity ?? null
    : current.estimatedQuantity;

  const wasOut = !current.isInStock;
  const outTransition = !flags.isInStock && !wasOut;
  const zeroQuantity = qtyProvided && requestedQuantity === 0;

  // An explicit move to Out of Stock, or a zero count, always wins.
  if (outTransition || zeroQuantity) {
    return { ...OUT_OF_STOCK_STATE };
  }

  if (!flags.isInStock && wasOut) {
    // Still out by inheritance: a positive count restores plain In Stock;
    // otherwise the item stays out with its quantity normalized to 0.
    if (qtyProvided && requestedQuantity !== null && requestedQuantity > 0) {
      return {
        isInStock: true,
        isLimited: false,
        isClearance: false,
        estimatedQuantity: requestedQuantity,
      };
    }
    return { ...OUT_OF_STOCK_STATE };
  }

  // In stock (kept or restored). A quick "Mark In Stock" without a count
  // means the on-hand quantity is Unknown, not the stale 0.
  let estimatedQuantity = requestedQuantity;
  if (wasOut && !qtyProvided) {
    estimatedQuantity = null;
  }

  return {
    isInStock: true,
    isLimited: flags.isLimited,
    isClearance: flags.isClearance,
    estimatedQuantity,
  };
}

/** Snapshot of the ledger-tracked fields of a food item. */
export interface TrackedItemState extends StockQuantityState {
  name: string;
  categoryId: number;
  purchasePriceCents: number | null;
  unitsPerPurchase: number;
}

export interface EventRecordFlags {
  recordsQuantity: boolean;
  recordsPrice: boolean;
  recordsStatus: boolean;
  recordsIdentity: boolean;
}

/**
 * Which ledger dimensions an update actually changed. An `updated` event is
 * only written when at least one flag is true — no-op saves must not create
 * ledger noise.
 */
export function computeEventRecordFlags(
  before: TrackedItemState,
  after: TrackedItemState
): EventRecordFlags {
  return {
    recordsQuantity: before.estimatedQuantity !== after.estimatedQuantity,
    recordsPrice:
      before.purchasePriceCents !== after.purchasePriceCents ||
      before.unitsPerPurchase !== after.unitsPerPurchase,
    recordsStatus:
      before.isInStock !== after.isInStock ||
      before.isLimited !== after.isLimited ||
      before.isClearance !== after.isClearance,
    recordsIdentity:
      before.name !== after.name || before.categoryId !== after.categoryId,
  };
}

export function isEffectiveTrackedChange(flags: EventRecordFlags): boolean {
  return (
    flags.recordsQuantity ||
    flags.recordsPrice ||
    flags.recordsStatus ||
    flags.recordsIdentity
  );
}
