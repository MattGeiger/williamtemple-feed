// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * TEMPORARY — the single dev-only entry point for the Tailwind palette work.
 *
 * Everything the evaluation needs hangs off this module: the generated A/B
 * stylesheet, the candidate data, and both header controls. `RootLayout` reaches
 * it through a lazy import guarded by `import.meta.env.DEV`, which Vite folds to
 * `false` in a production build, so the whole subtree — including the ~8 KB
 * stylesheet and the 288-entry candidate JSON — is dropped from the bundle
 * rather than merely hidden at runtime.
 *
 * A plain `if (!import.meta.env.DEV) return null` inside each component was not
 * enough: it hides the interface while the imports still ship.
 *
 * Delete this file, palette-ab-switcher.tsx, palette-calibration.tsx,
 * src/styles/tailwind-ab*.{css,json}, the lazy mount in root-layout.tsx, and
 * packages/backend/scripts/generate-tailwind-ab.ts together.
 */

import '@/styles/tailwind-ab.css';

import { PaletteAbSwitcher } from '@/components/palette-ab-switcher';
import { PaletteCalibration } from '@/components/palette-calibration';

export default function PaletteDevTools() {
  return (
    <>
      <PaletteCalibration />
      <PaletteAbSwitcher />
    </>
  );
}
