// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import type { ModelName } from '../config/limits';

export type { ModelName };

export type TokenRates = Record<ModelName, {
  prompt: number;
  completion: number;
}>;

export type TokenLimits = {
  MODEL_DAILY_LIMITS: Record<ModelName, number>;
  MODEL_CONTEXT_LIMITS: Record<ModelName, {
    CONTEXT_WINDOW: number;
    MAX_OUTPUT: number;
  }>;
  RATE_LIMITS: {
    RPM: number;
    RPD: number;
    TPM: number;
    WINDOW_MS: number;
  };
  COST_LIMITS: {
    MONTHLY: number;
  };
  WARNING_THRESHOLDS: {
    WARNING: number;
    ELEVATED_WARNING: number;
    FINAL_WARNING: number;
  };
};
