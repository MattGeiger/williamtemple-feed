// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { findCatalogueEntry } from './catalogue';

export interface PricingConfiguration {
  model?: string | null;
  serviceType?: string | null;
  pricingSource?: string | null;
  inputCost?: number | null;
  outputCost?: number | null;
  unitPrice?: string | null;
}

/** Resolve rates at request time. Missing provenance means legacy/manual,
 * never permission to overwrite an administrator's saved rates. */
export function pricingRates(config: PricingConfiguration, inputTokens = 0, at = new Date()) {
  const entry = findCatalogueEntry(config.model);
  if (config.pricingSource === 'preset' && entry && entry.provider === config.serviceType) {
    const price = entry.pricing;
    let input = price.input;
    let output = price.output;
    if (price.scheduled && at.toISOString().slice(0, 10) >= price.scheduled.effectiveOn) {
      ({ input, output } = price.scheduled);
    }
    if (price.longContext && inputTokens > price.longContext.above) {
      ({ input, output } = price.longContext);
    }
    return { input: input / 1e6, output: output / 1e6 };
  }
  const divisor = config.unitPrice === 'per_1m' ? 1e6 : 1000;
  return { input: (config.inputCost ?? 0) / divisor, output: (config.outputCost ?? 0) / divisor };
}

export function priceUsage(config: PricingConfiguration, inputTokens: number, outputTokens: number, at = new Date()) {
  const rates = pricingRates(config, inputTokens, at);
  return inputTokens * rates.input + outputTokens * rates.output;
}

/** Validate provenance at the write boundary; never infer managed pricing
 * from a legacy row's coincidentally matching numeric rates. */
export function pricingFields(source: unknown, config: PricingConfiguration) {
  if (source === undefined) return {};
  if (source !== 'preset' && source !== 'manual') {
    throw Object.assign(new Error('Choose a model preset or enter manual pricing before saving.'), { statusCode: 400 });
  }
  if (source === 'manual') return { pricingSource: source };
  const entry = findCatalogueEntry(config.model);
  if (!entry || entry.provider !== config.serviceType) {
    throw Object.assign(new Error('This custom model needs manual pricing. Enter its input and output rates before saving.'), { statusCode: 400 });
  }
  const rates = pricingRates({ ...config, pricingSource: 'preset' });
  return { pricingSource: source, inputCost: rates.input * 1e6, outputCost: rates.output * 1e6, unitPrice: 'per_1m' };
}
