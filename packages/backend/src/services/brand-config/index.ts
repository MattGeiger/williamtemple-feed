// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as crypto from 'crypto';
import prisma from '../../db';
import { deriveTheme, type BrandInput } from '../brand-theme/derive';
import { serializeHslTriplets, serializeOklch, serializePrintHex } from '../brand-theme/serialize';
import { brandAlignedCarbonOrder, seriesColor } from '../brand-theme/charts';
import { oklchToHex } from '../brand-theme/color';
import { snapCandidates } from '../brand-theme/snap';
import { BRAND_TOKENS } from '../brand-theme/tokens';
import { parseBrandConfig, type BrandAssetReference, type BrandConfig } from './config-schema';
import { BRAND_TEMPLATES, WTH_BRAND_CONFIG } from './presets';

export type ResolvedBrand = {
  source: 'configured' | 'compiled-default';
  configId: string | null;
  config: BrandConfig;
  warning: string | null;
};

const brandInputFor = (config: BrandConfig): BrandInput => ({
  accent: config.colors.accent,
  accentDark: config.colors.accentDark,
  neutral: config.colors.neutral,
  hierarchy: config.colors.hierarchy,
  accentFamily: config.colors.accentFamily,
  accentDarkFamily: config.colors.accentDarkFamily,
  neutralFamily: config.colors.neutralFamily,
});

export const assetUrl = (reference: BrandAssetReference): string =>
  reference.kind === 'database'
    ? `/api/brand/assets/${encodeURIComponent(reference.id)}`
    : reference.src;

/** Collect database asset references from the schema-whitelisted payload. */
export const brandAssetIds = (payload: unknown): Set<string> => {
  const ids = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (record.kind === 'database' && typeof record.id === 'string') ids.add(record.id);
      Object.values(record).forEach(visit);
      return;
    }
    value.forEach(visit);
  };
  visit(payload);
  return ids;
};

export const ensureBrandTemplates = async (): Promise<void> => {
  for (const template of BRAND_TEMPLATES) {
    await prisma.brandConfiguration.upsert({
      where: { id: template.id },
      create: { id: template.id, payload: template.payload, isTemplate: true },
      update: { payload: template.payload, isTemplate: true, isActive: false },
    });
  }
};

/**
 * Turn a storage failure into something a person can act on.
 *
 * The raw error must never reach the interface. Prisma embeds the failing
 * invocation, a source excerpt, and absolute server file paths in `.message`;
 * rendering that in Settings is unkind (it reads as a crash the reader caused)
 * and it discloses the server's directory layout to every signed-in user. The
 * one case worth naming specifically is the missing table, because it has a
 * precise remedy and is what an un-migrated deployment actually hits.
 */
const storageWarning = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : '';
  if (/does not exist in the current database|no such table/i.test(raw)) {
    return 'Appearance storage has not been set up on this deployment yet, so FEED is using its built-in look. An administrator can finish setup by running the pending database migrations.';
  }
  return 'FEED could not read the saved appearance, so it is using its built-in look. Try again in a moment; if it keeps happening, check that the database is reachable.';
};

export const resolveBrand = async (): Promise<ResolvedBrand> => {
  try {
    const row = await prisma.brandConfiguration.findFirst({ where: { isActive: true } });
    if (!row) return { source: 'compiled-default', configId: null, config: WTH_BRAND_CONFIG, warning: null };
    const parsed = parseBrandConfig(row.payload);
    if (!parsed.ok) {
      // The field path goes to the log, not the interface. Names like
      // `schemaVersion` are internal concepts an operator never sets, so
      // quoting one is precision without actionability — it tells the reader
      // their appearance is broken in a language they cannot act in.
      console.error('[Brand] Active configuration rejected:', parsed.errors.join('; '));
      return {
        source: 'compiled-default', configId: null, config: WTH_BRAND_CONFIG,
        warning:
          'The saved appearance could not be applied because one of its settings is no longer valid, so FEED is using its built-in look. Open that appearance in Settings, review it, and save it again.',
      };
    }
    // Derive during resolution so a bad family override fails closed before it
    // can reach a stylesheet or React identity surface.
    deriveTheme(brandInputFor(parsed.config));
    return { source: 'configured', configId: row.id, config: parsed.config, warning: null };
  } catch (error) {
    return {
      source: 'compiled-default', configId: null, config: WTH_BRAND_CONFIG,
      warning: storageWarning(error),
    };
  }
};

export const publicBrandPayload = async () => {
  const resolved = await resolveBrand();
  const theme = deriveTheme(brandInputFor(resolved.config));
  return {
    source: resolved.source,
    configId: resolved.configId,
    warning: resolved.warning,
    identity: resolved.config.identity,
    logo: {
      lightSrc: assetUrl(resolved.config.logo.light),
      darkSrc: assetUrl(resolved.config.logo.dark),
      squareSrc: resolved.config.logo.squareDerivatives?.size192
        ? assetUrl(resolved.config.logo.squareDerivatives.size192)
        : resolved.config.logo.square ? assetUrl(resolved.config.logo.square) : null,
      lightWidth: resolved.config.logo.light.width,
      lightHeight: resolved.config.logo.light.height,
      darkWidth: resolved.config.logo.dark.width,
      darkHeight: resolved.config.logo.dark.height,
    },
    staff: resolved.config.staff,
    capabilities: resolved.config.capabilities,
    terminology: resolved.config.terminology ?? WTH_BRAND_CONFIG.terminology,
    chartOrder: brandAlignedCarbonOrder(theme.story?.primary?.h ?? resolved.config.colors.accent.h),
  };
};

export const themeCss = async (format: 'hsl' | 'oklch' = 'oklch') => {
  const resolved = await resolveBrand();

  // With no saved configuration the stylesheet is deliberately empty, so
  // `index.css` supplies the theme unchanged.
  //
  // William Temple House's identity was hand-tuned over many releases and
  // derivation only approximates it — the Phase 0 fidelity gate passes with
  // eight documented divergences, and in review those added up to "technically
  // fine, tastefully worse" (dark mode in particular moved off true black onto
  // slate-950). Derivation exists to get a *new* agency close from a logo, not
  // to relitigate an identity someone already tuned by eye. Emitting nothing
  // here means the compiled default costs zero fidelity, while any saved
  // configuration still fully displaces it.
  if (resolved.source === 'compiled-default') {
    const body = '/* FEED runtime brand: compiled-default (hand-tuned; see index.css) */\n';
    return { body, etag: `"${crypto.createHash('sha256').update(body).digest('hex')}"`, resolved };
  }

  const theme = deriveTheme(brandInputFor(resolved.config));
  const css = format === 'oklch' ? serializeOklch(theme.tokens) : serializeHslTriplets(theme.tokens);
  const body = `/* FEED runtime brand: ${resolved.configId} */\n${css}`;
  return { body, etag: `"${crypto.createHash('sha256').update(body).digest('hex')}"`, resolved };
};

export const printBrand = async () => {
  const resolved = await resolveBrand();
  const theme = deriveTheme(brandInputFor(resolved.config));
  const accentHue = theme.story?.primary?.h ?? resolved.config.colors.accent.h;
  return {
    ...resolved,
    colors: serializePrintHex(theme.tokens),
    chartColors: Array.from({ length: 7 }, (_, index) => seriesColor(accentHue, index, 'light')),
  };
};

/** Preview the exact server derivation without persisting a wizard draft. */
export const previewBrandConfiguration = (payload: unknown) => {
  const parsed = parseBrandConfig(payload);
  if (!parsed.ok) {
    throw Object.assign(new Error(`Complete the required appearance fields to preview it: ${parsed.errors[0]}`), {
      statusCode: 400, code: 'INVALID_BRAND_CONFIGURATION', details: parsed.errors,
    });
  }
  const input = brandInputFor(parsed.config);
  const theme = deriveTheme(input);
  const accentSource = theme.story?.primary ?? parsed.config.colors.accent;
  const seen = new Set<string>();
  const alternates = snapCandidates(accentSource, 'chromatic', 200)
    .filter(({ entry }) => {
      if (seen.has(entry.family)) return false;
      seen.add(entry.family);
      return true;
    })
    .slice(0, 3)
    .map(({ entry, distance }) => ({
      family: entry.family,
      stop: entry.stop,
      distance,
      color: oklchToHex(entry),
    }));
  const tokens = Object.fromEntries(
    (['light', 'dark'] as const).map((scope) => [
      scope,
      Object.fromEntries(BRAND_TOKENS.map((token) => [token, oklchToHex(theme.tokens[scope][token])])),
    ])
  );
  return {
    families: {
      accent: theme.accentFamily,
      darkAccent: theme.accentDarkFamily,
      secondary: theme.accentSecondaryFamily,
      neutral: theme.neutralFamily,
      mudEscapedFrom: theme.mudEscapedFrom,
    },
    alternates,
    tokens,
    chartOrder: brandAlignedCarbonOrder(accentSource.h),
    chartColors: {
      light: Array.from({ length: 5 }, (_, index) => seriesColor(accentSource.h, index, 'light')),
      dark: Array.from({ length: 5 }, (_, index) => seriesColor(accentSource.h, index, 'dark')),
    },
  };
};

export const saveBrandConfiguration = async (
  id: string,
  payload: unknown,
  activate: boolean,
) => {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id) || id.startsWith('template-')) {
    throw Object.assign(new Error('Use 2–64 lowercase letters, numbers, and dashes for the configuration name.'), { statusCode: 400 });
  }
  const parsed = parseBrandConfig(payload);
  if (!parsed.ok) {
    throw Object.assign(new Error(`The appearance is incomplete: ${parsed.errors[0]}`), {
      statusCode: 400, code: 'INVALID_BRAND_CONFIGURATION', details: parsed.errors,
    });
  }
  deriveTheme(brandInputFor(parsed.config));
  return prisma.$transaction(async (tx) => {
    if (activate) await tx.brandConfiguration.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return tx.brandConfiguration.upsert({
      where: { id },
      create: { id, payload: parsed.config, isActive: activate, isTemplate: false },
      // "Save draft" must not mutate the live appearance just because the
      // edited row happened to be active when the wizard opened.
      update: { payload: parsed.config, isActive: activate, isTemplate: false },
    });
  });
};

export const activateBrandConfiguration = async (id: string) => prisma.$transaction(async (tx) => {
  const target = await tx.brandConfiguration.findUnique({ where: { id } });
  if (!target || target.isTemplate) throw Object.assign(new Error('Choose a saved appearance configuration to activate.'), { statusCode: 404 });
  const parsed = parseBrandConfig(target.payload);
  if (!parsed.ok) throw Object.assign(new Error('That saved appearance is invalid. Edit it before activating.'), { statusCode: 400 });
  await tx.brandConfiguration.updateMany({ where: { isActive: true }, data: { isActive: false } });
  return tx.brandConfiguration.update({ where: { id }, data: { isActive: true } });
});

export const deactivateBrandConfiguration = async () =>
  prisma.brandConfiguration.updateMany({ where: { isActive: true }, data: { isActive: false } });

export { parseBrandConfig } from './config-schema';
export type { BrandConfig, BrandAssetReference } from './config-schema';
export { BRAND_TEMPLATES, WTH_BRAND_CONFIG, ST_JOHNS_BRAND_CONFIG } from './presets';
