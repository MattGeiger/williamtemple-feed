// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { useState } from 'react';
import {
  FoodItemLogistics,
  DEFAULT_LOGISTICS,
} from '@/types/food-item';
import {
  formatCentsAsCurrencyText,
  parseCurrencyToCents,
} from '@/lib/formatting/currency';

/**
 * Logistics tab state for the food-item form (docs/reports/logistics.md).
 *
 * All three fields are kept as raw input text so typing stays natural;
 * parsing to integers happens at submit via {@link getLogisticsPayload}.
 * Blank price/quantity mean Unknown; only the edit form ever submits
 * logistics, so quick status actions keep their no-count semantics.
 */

interface LogisticsFormState {
  priceText: string;
  unitsText: string;
  quantityText: string;
}

const toInitialState = (initial?: FoodItemLogistics): LogisticsFormState => {
  const source = initial ?? DEFAULT_LOGISTICS;
  return {
    priceText:
      source.purchasePriceCents === null
        ? ''
        : formatCentsAsCurrencyText(source.purchasePriceCents),
    unitsText: String(source.unitsPerPurchase),
    quantityText:
      source.estimatedQuantity === null ? '' : String(source.estimatedQuantity),
  };
};

// Allow "", "12", "12.", "12.3", "12.34" while typing.
const PRICE_TYPING_PATTERN = /^\d{0,13}(\.\d{0,2})?$/;
const WHOLE_NUMBER_PATTERN = /^\d*$/;

export function useLogisticsForm(initialLogistics?: FoodItemLogistics) {
  const [state, setState] = useState<LogisticsFormState>(() =>
    toInitialState(initialLogistics)
  );

  const handlePriceChange = (value: string) => {
    const cleaned = value.replace(/^\$\s*/, '');
    if (PRICE_TYPING_PATTERN.test(cleaned)) {
      setState((prev) => ({ ...prev, priceText: cleaned }));
    }
  };

  const handleUnitsChange = (value: string) => {
    if (WHOLE_NUMBER_PATTERN.test(value) && value.length <= 6) {
      setState((prev) => ({ ...prev, unitsText: value }));
    }
  };

  const handleQuantityChange = (value: string) => {
    if (WHOLE_NUMBER_PATTERN.test(value) && value.length <= 9) {
      setState((prev) => ({ ...prev, quantityText: value }));
    }
  };

  const resetLogistics = () => setState(toInitialState());

  const validateLogistics = (): string | null => {
    if (parseCurrencyToCents(state.priceText) === undefined) {
      return 'Enter the purchase price as dollars and cents, like 4.99, or leave it blank for Unknown.';
    }
    const units = state.unitsText.trim();
    if (units === '' || parseInt(units, 10) < 1) {
      return 'Units per purchase must be a whole number of at least 1.';
    }
    return null;
  };

  /** Parsed integers for the API. Call only after validateLogistics passes. */
  const getLogisticsPayload = (): FoodItemLogistics => {
    const cents = parseCurrencyToCents(state.priceText);
    const quantity = state.quantityText.trim();
    return {
      purchasePriceCents: cents === undefined ? null : cents,
      unitsPerPurchase: Math.max(1, parseInt(state.unitsText, 10) || 1),
      estimatedQuantity: quantity === '' ? null : parseInt(quantity, 10),
    };
  };

  return {
    priceText: state.priceText,
    unitsText: state.unitsText,
    quantityText: state.quantityText,
    handlePriceChange,
    handleUnitsChange,
    handleQuantityChange,
    resetLogistics,
    validateLogistics,
    getLogisticsPayload,
  };
}
