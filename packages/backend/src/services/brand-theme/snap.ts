// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Snapping a brand colour onto the Tailwind v4 palette.
 *
 * FEED does not reproduce an agency's colour exactly and derive from it. It
 * snaps to the nearest palette entry, because brand alignment is reconstructing
 * a colour *story* rather than matching a hex value, and because a finite
 * palette makes the whole configurable space provable rather than merely
 * validated (see `validate.ts`). Measured against four real brand colours, hue
 * lands within three degrees. Rationale and measurements:
 * docs/roadmap/v1.7-white-label-plan.md.
 *
 * Two constraints the measurements exposed:
 *
 *  1. **Snapping is role-aware, and neutral snapping weights chroma.** Tailwind
 *     4.3 ships nine neutral families, four of them lightly tinted. St. Johns
 *     Food Share's dead-neutral charcoal (chroma 0.000) lands on `olive-800` —
 *     a warm green cast across every surface — and splitting the pools is *not*
 *     enough to prevent it, because `olive-800` is genuinely the nearest neutral
 *     by unweighted distance. Amplifying the chromatic axes is what fixes it:
 *     at the shipped weight a source with no tint resolves to a family with no
 *     tint, while FEED's genuinely blue surfaces still resolve to `slate`.
 *
 *  2. **The family is chosen once, the stop per token.** Snapping each token
 *     independently scatters a theme across families — card in `slate`, muted in
 *     `mauve`, popover in `zinc` — which destroys the internal coherence of the
 *     ramp that is the entire reason to use Tailwind. `chooseFamily` picks one
 *     family for a whole role by best aggregate fit.
 */

import { perceptualDistance, type Oklch } from './color';
import { TAILWIND_PALETTE, isNeutralFamily, type TailwindEntry } from './palettes';

export type SnapRole = 'chromatic' | 'neutral';

/**
 * How much the chromatic axes count when snapping a neutral.
 *
 * Swept against the two cases that matter: St. Johns' achromatic charcoal, which
 * must not acquire a tint, and FEED's blue-leaning surfaces, which must keep
 * theirs. Unweighted puts the charcoal on `olive-800` (chroma 0.016); 2 reaches
 * `zinc-800` (0.006); 3 reaches `neutral-800` (0.000), and FEED still resolves
 * to `slate` at every value tried. 3 is the first weight where "no tint in"
 * reliably means "no tint out".
 */
export const CHROMA_WEIGHT = 3;

const weightFor = (role: SnapRole) => (role === 'neutral' ? CHROMA_WEIGHT : 1);

export type SnapCandidate = {
  entry: TailwindEntry;
  distance: number;
};

const poolFor = (role: SnapRole): readonly TailwindEntry[] =>
  TAILWIND_PALETTE.filter((entry) =>
    role === 'neutral' ? isNeutralFamily(entry.family) : !isNeutralFamily(entry.family)
  );

/**
 * Nearest palette entries to `target`, closest first.
 *
 * The wizard shows the top few rather than silently applying the winner: the
 * maths does not respect a colour's name, and St. Johns Food Share's teal snaps
 * to `emerald-600` with `teal-600` as runner-up. An operator should get to say
 * which of those is their brand.
 */
export const snapCandidates = (
  target: Oklch,
  role: SnapRole,
  limit = 3
): SnapCandidate[] =>
  poolFor(role)
    .map((entry) => ({
      entry,
      distance: perceptualDistance(
        target,
        { l: entry.l, c: entry.c, h: entry.h },
        weightFor(role)
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

/** The single nearest palette entry to `target` within its role's pool. */
export const snap = (target: Oklch, role: SnapRole): SnapCandidate => {
  const [best] = snapCandidates(target, role, 1);
  if (!best) throw new Error(`No Tailwind entries available for the ${role} pool.`);
  return best;
};

export type FamilyChoice = {
  family: string;
  /** Mean perceptual distance across every target this family had to serve. */
  averageDistance: number;
};

/**
 * Choose one family to serve a whole role.
 *
 * Scored by mean distance across every colour the role must express, so the
 * winner is the ramp that fits the set rather than the ramp that happens to nail
 * one member of it. With FEED's seven surface tokens this selects `slate`,
 * which is the blue-tinted neutral and matches surfaces authored at hue 211–222.
 */
export const chooseFamily = (
  targets: readonly Oklch[],
  role: SnapRole
): FamilyChoice => {
  if (targets.length === 0) {
    throw new Error('chooseFamily requires at least one target colour.');
  }

  const families = [...new Set(poolFor(role).map((entry) => entry.family))];
  const scored = families
    .map((family) => {
      const ramp = TAILWIND_PALETTE.filter((entry) => entry.family === family);
      const total = targets.reduce((sum, target) => {
        const nearest = ramp.reduce(
          (best, entry) =>
            Math.min(
              best,
              perceptualDistance(
                target,
                { l: entry.l, c: entry.c, h: entry.h },
                weightFor(role)
              )
            ),
          Number.POSITIVE_INFINITY
        );
        return sum + nearest;
      }, 0);
      return { family, averageDistance: total / targets.length };
    })
    .sort((a, b) => a.averageDistance - b.averageDistance);

  return scored[0];
};

/** The entry at a given family and stop. Throws if the pairing does not exist. */
export const paletteEntry = (family: string, stop: number): TailwindEntry => {
  const entry = TAILWIND_PALETTE.find(
    (candidate) => candidate.family === family && candidate.stop === stop
  );
  if (!entry) throw new Error(`No Tailwind entry for ${family}-${stop}.`);
  return entry;
};

export const entryToOklch = (entry: TailwindEntry): Oklch => ({
  l: entry.l,
  c: entry.c,
  h: entry.h,
});
