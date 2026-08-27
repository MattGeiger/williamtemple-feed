// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Brand-aligning the chart palette without touching its accessibility.
 *
 * FEED's categorical series come from IBM Carbon: ten families, every grade
 * already verified at 4.5:1 against the card surface. Generating colours
 * alongside that would undermine it, so brand alignment only changes *which*
 * accessible colour appears first.
 *
 * **Rotate, do not re-sort.** `CARBON_CATEGORICAL_ORDER` in the frontend is a
 * deliberate hue-hopping sequence — each family sits far from its neighbours on
 * the colour wheel so adjacent series stay distinguishable, including under
 * colour-vision deficiency. Re-sorting by distance to the brand hue clusters
 * similar hues together and destroys exactly that property. Rotating the list
 * so the brand-nearest family leads preserves every adjacent pair except the one
 * at the wrap point, so the guarantee survives by construction rather than by a
 * separately-enforced separation floor.
 */

import { hexToOklch, hueDifference } from './color';
import { CARBON_CATEGORICAL_ORDER, CARBON_PALETTE } from './palettes';

/**
 * Families whose colour carries meaning rather than identity. Where red means
 * danger and green means success, meaning outranks ordering — these keep their
 * semantic role and are never promoted into the categorical lead by a brand that
 * happens to sit near them.
 */
export const STATUS_PINNED_FAMILIES = ['red', 'green', 'yellow'] as const;

const familyHue = (family: string): number => {
  const entry = CARBON_PALETTE.find((candidate) => candidate.family === family);
  if (!entry) throw new Error(`Unknown Carbon family "${family}".`);
  return hexToOklch(entry.primary.light).h;
};

/**
 * The categorical order, rotated so the family nearest `brandHue` leads.
 *
 * Status-pinned families are excluded from *leading* but keep their position in
 * the sequence, so a red-branded agency does not turn its danger colour into the
 * first categorical series.
 */
export const brandAlignedCarbonOrder = (brandHue: number): string[] => {
  const order = [...CARBON_CATEGORICAL_ORDER];

  const leadCandidates = order
    .map((family, index) => ({ family, index }))
    .filter(
      ({ family }) => !(STATUS_PINNED_FAMILIES as readonly string[]).includes(family)
    );

  if (leadCandidates.length === 0) return order;

  const lead = leadCandidates.reduce((best, candidate) => {
    const bestDelta = Math.abs(hueDifference(brandHue, familyHue(best.family)));
    const delta = Math.abs(hueDifference(brandHue, familyHue(candidate.family)));
    return delta < bestDelta ? candidate : best;
  });

  return [...order.slice(lead.index), ...order.slice(0, lead.index)];
};

/** Resolve a brand-aligned series colour by index, wrapping past the tenth. */
export const seriesColor = (
  brandHue: number,
  index: number,
  scheme: 'light' | 'dark' = 'light',
  grade: 'primary' | 'secondary' = 'primary'
): string => {
  const order = brandAlignedCarbonOrder(brandHue);
  const family = order[index % order.length];
  const entry = CARBON_PALETTE.find((candidate) => candidate.family === family);
  if (!entry) throw new Error(`Unknown Carbon family "${family}".`);
  return entry[grade][scheme];
};
