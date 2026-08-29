// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { hexToOklch, hslToOklch } from '../brand-theme/color';
import type { BrandConfig } from './config-schema';
import { BRAND_CONFIG_SCHEMA_VERSION } from './config-schema';

/**
 * The expansion of FEED: Food Equity & Efficient Delivery. It is the product's
 * name spelled out, not agency copy, so it is fixed rather than configurable.
 */
export const FEED_TAGLINE = 'Food Equity & Efficient Delivery';

export const WTH_BRAND_CONFIG: BrandConfig = {
  schemaVersion: BRAND_CONFIG_SCHEMA_VERSION,
  identity: {
    organizationName: 'William Temple House',
    appName: 'FEED',
    tagline: 'Food Equity & Efficient Delivery',
    description: 'Food pantry management software for non-profits.',
    organizationWebsite: 'https://www.williamtemple.org/',
  },
  logo: {
    // Real dimensions. These were all declared 600x600 while the file is
    // actually 600x157, and `square` pointed at the horizontal wordmark
    // lockup — which BrandContext then set as the browser tab icon, squashing
    // a 3.8:1 lockup into a square. The square slot needs a genuinely square
    // mark.
    // Vector, and a real dark variant. The raster email lockup served both
    // themes before, so dark mode showed a logo drawn for a light background.
    // The email layout still points at the PNG separately: mail clients render
    // SVG inconsistently, so that one surface keeps a raster on purpose.
    light: { kind: 'builtin', src: '/brand/wth-logo-horizontal-light.svg', width: 800, height: 300 },
    dark: { kind: 'builtin', src: '/brand/wth-logo-horizontal-dark.svg', width: 800, height: 300 },
    // Lives in `public/` rather than `src/assets/` because Vite fingerprints
    // the latter, and this path is referenced at runtime and from email.
    square: { kind: 'builtin', src: '/brand/wth-app-mark.svg', width: 512, height: 512 },
    presentation: 'transparent',
  },
  colors: {
    accent: hexToOklch('#186090'),
    accentDark: hexToOklch('#FFE066'),
    neutral: hslToOklch({ h: 222, s: 50, l: 10 }),
    hierarchy: [
      hexToOklch('#186090'),
      hexToOklch('#2a9d8f'),
      hexToOklch('#FFE066'),
    ],
  },
  staff: {
    signInTitle: 'Sign in to FEED System',
    emailGuidance: 'Staff access — use your authorized work email',
    emailPlaceholder: 'you@williamtemple.org',
  },
  capabilities: { publicInventory: true },
  terminology: {
    pantrySingular: 'food pantry',
    pantryPlural: 'food pantries',
    clientSingular: 'client',
    clientPlural: 'clients',
    departmentName: 'Social Services',
    active: true,
  },
};

export const ST_JOHNS_BRAND_CONFIG: BrandConfig = {
  schemaVersion: BRAND_CONFIG_SCHEMA_VERSION,
  identity: {
    organizationName: 'St. Johns Food Share',
    appName: 'FEED',
    tagline: 'Food access with dignity and choice',
    description: 'Shared food pantry operations for St. Johns Food Share.',
    organizationWebsite: 'https://www.stjohnsfoodshare.org/',
  },
  // This intentionally-generic template mark proves that the UI has stopped
  // leaking WTH identity without packaging another agency's protected artwork.
  // An administrator replaces it with agency-owned files in the wizard.
  logo: {
    light: { kind: 'builtin', src: '/brand/st-johns-template-mark.svg', width: 640, height: 220 },
    dark: { kind: 'builtin', src: '/brand/st-johns-template-mark.svg', width: 640, height: 220 },
    presentation: 'transparent',
  },
  colors: {
    accent: hexToOklch('#33A478'),
    neutral: hexToOklch('#2D2D2D'),
    hierarchy: [hexToOklch('#33A478'), hexToOklch('#2D2D2D'), hexToOklch('#F6F4EE')],
  },
  staff: {
    signInTitle: 'Sign in to St. Johns Food Share',
    emailGuidance: 'Staff access — use your authorized work email',
    emailPlaceholder: 'you@stjohnsfoodshare.org',
  },
  capabilities: { publicInventory: true },
  terminology: {
    pantrySingular: 'food share',
    pantryPlural: 'food shares',
    clientSingular: 'neighbor',
    clientPlural: 'neighbors',
    departmentName: 'Food Share',
    active: true,
  },
};

export const BRAND_TEMPLATES = [
  { id: 'template-william-temple-house', payload: WTH_BRAND_CONFIG },
  { id: 'template-st-johns-food-share', payload: ST_JOHNS_BRAND_CONFIG },
] as const;
