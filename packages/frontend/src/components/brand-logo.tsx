// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

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

  if (brand.logo.lightSrc === brand.logo.darkSrc) {
    return (
      <img
        src={brand.logo.lightSrc}
        alt={label}
        width={brand.logo.lightWidth}
        height={brand.logo.lightHeight}
        className={imageClassName}
      />
    );
  }

  return (
    <>
      <img
        src={brand.logo.lightSrc}
        alt={label}
        width={brand.logo.lightWidth}
        height={brand.logo.lightHeight}
        className={cn('brand-logo-light', imageClassName)}
      />
      <img
        src={brand.logo.darkSrc}
        alt={label}
        width={brand.logo.darkWidth}
        height={brand.logo.darkHeight}
        className={cn('brand-logo-dark', imageClassName)}
      />
    </>
  );
}
