// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * TEMPORARY — A/B comparison control for the Tailwind palette evaluation.
 *
 * Stamps `data-palette="tailwind"` on the root element, which activates
 * `src/styles/tailwind-ab.css`: every colour literal in the built-in appearance
 * replaced by its nearest Tailwind v4 palette entry. Toggling off removes the
 * stamp and the hand-tuned values apply again, so the two can be compared on
 * any page without reloading.
 *
 * Works alongside the light/dark switcher rather than replacing it — the four
 * combinations (hand-tuned/Tailwind × light/dark) are all reachable.
 *
 * Delete this file, `src/styles/tailwind-ab.css`, its import in `index.css`,
 * the mount in `root-layout.tsx`, and
 * `packages/backend/scripts/generate-tailwind-ab.ts` once the comparison is
 * settled. Development-only: it renders nothing in a production build.
 */

import * as React from 'react';
import { Beaker } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'feed.paletteAb';

export function PaletteAbSwitcher() {
  const [tailwind, setTailwind] = React.useState(false);

  // Restore across navigation so a comparison survives moving between pages.
  React.useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === 'tailwind') setTailwind(true);
    } catch {
      /* private browsing — default to the hand-tuned appearance */
    }
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (tailwind) root.setAttribute('data-palette', 'tailwind');
    else root.removeAttribute('data-palette');
    try {
      sessionStorage.setItem(STORAGE_KEY, tailwind ? 'tailwind' : 'authored');
    } catch {
      /* not worth surfacing */
    }
  }, [tailwind]);

  if (!import.meta.env.DEV) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTailwind((on) => !on)}
          aria-pressed={tailwind}
          aria-label={
            tailwind
              ? 'Showing Tailwind palette. Switch back to the hand-tuned appearance.'
              : 'Showing the hand-tuned appearance. Switch to the Tailwind palette.'
          }
          className={cn(tailwind && 'text-primary')}
        >
          <Beaker className="h-4 w-4" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {tailwind ? 'Tailwind palette (A/B)' : 'Hand-tuned appearance (A/B)'}
      </TooltipContent>
    </Tooltip>
  );
}
