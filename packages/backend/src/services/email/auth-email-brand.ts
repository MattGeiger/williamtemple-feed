// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { assetUrl, printBrand } from '../brand-config';

export type EmailBrand = {
  organizationName: string;
  appName: string;
  tagline: string;
  organizationWebsite: string;
  logoUrl: string;
  colors: {
    blue: string; blueTint: string; gold: string; ink: string;
    body: string; muted: string; hairline: string; page: string; card: string;
  };
};

const absoluteUrl = (path: string) => {
  if (/^https?:\/\//.test(path)) return path;
  const base = process.env.APP_URL || 'https://feed.williamtemple.app';
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
};

/** Resolve email-safe light-scope literals from the same active brand input. */
export const resolveEmailBrand = async (): Promise<EmailBrand> => {
  const resolved = await printBrand();
  const { config, colors } = resolved;
  return {
    organizationName: config.identity.organizationName,
    appName: config.identity.appName,
    tagline: config.identity.tagline,
    organizationWebsite: config.identity.organizationWebsite,
    logoUrl: absoluteUrl(assetUrl(config.logo.light)),
    colors: {
      blue: colors.primary,
      blueTint: colors.muted,
      gold: colors.accent,
      ink: colors.foreground,
      body: colors.foreground,
      muted: colors['muted-foreground'],
      hairline: colors.border,
      page: colors.background,
      card: colors.card,
    },
  };
};

