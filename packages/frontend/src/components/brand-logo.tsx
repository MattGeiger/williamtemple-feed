// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { cloneElement, type ReactNode } from 'react';

import { useBrand } from '@/contexts/BrandContext';
import { cn } from '@/lib/utils';

type BrandLogoProps = {
  alt?: string;
  className?: string;
};

/**
 * The shared logo renderer for every themed identity surface.
 *
 * CSS owns selection so this works in the complete three-state theme model:
 * an explicit `.light`, an explicit `.dark`, and an unstamped root following
 * `prefers-color-scheme`. Rendering both sources also avoids a light-logo flash
 * while JavaScript resolves the device theme.
 */
export function BrandLogo({ alt, className }: BrandLogoProps) {
  const brand = useBrand();
  const label = alt ?? `${brand.identity.organizationName} Logo`;
  const imageClassName = cn('max-w-full object-contain', className);

  /**
   * Plenty of marks are drawn in white on a transparent ground, for placing
   * over photography, and all but disappear on a light page. `dark-surface`
   * gives those their own plate — in light mode only, because in dark mode the
   * page is already the background the mark was drawn for.
   */
  const plate =
    brand.logo.presentation === 'dark-surface' ? (
      <span
        data-logo-presentation="dark-surface"
        className="inline-flex items-center justify-center rounded-xl bg-[var(--feed-logo-surface)] px-3 py-2 dark:bg-transparent dark:p-0"
      />
    ) : null;

  const wrap = (content: ReactNode) =>
    plate ? cloneElement(plate, {}, content) : content;

  if (brand.logo.lightSrc === brand.logo.darkSrc) {
    return wrap(
      <img
        src={brand.logo.lightSrc}
        alt={label}
        width={brand.logo.lightWidth}
        height={brand.logo.lightHeight}
        style={{ aspectRatio: `${brand.logo.lightWidth} / ${brand.logo.lightHeight}` }}
        className={imageClassName}
      />
    );
  }

  return wrap(
    <>
      <img
        src={brand.logo.lightSrc}
        alt={label}
        width={brand.logo.lightWidth}
        height={brand.logo.lightHeight}
        style={{ aspectRatio: `${brand.logo.lightWidth} / ${brand.logo.lightHeight}` }}
        className={cn('brand-logo-light', imageClassName)}
      />
      <img
        src={brand.logo.darkSrc}
        alt={label}
        width={brand.logo.darkWidth}
        height={brand.logo.darkHeight}
        style={{ aspectRatio: `${brand.logo.darkWidth} / ${brand.logo.darkHeight}` }}
        className={cn('brand-logo-dark', imageClassName)}
      />
    </>
  );
}
