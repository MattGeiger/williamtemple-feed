// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import '../bootstrap';
import { TOKEN_RATES, TOKEN_LIMITS, MODEL_NAME } from '../config/limits';

// Force early initialization of limits and rates
// Uncomment for debugging
// console.log('Syncing configuration...', {
//   model: MODEL_NAME,
//   rates: TOKEN_RATES[MODEL_NAME],
//   limits: TOKEN_LIMITS.MODEL_DAILY_LIMITS[MODEL_NAME]
// });
