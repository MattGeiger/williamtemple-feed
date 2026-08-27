// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  brandConfiguration: { findFirst: vi.fn() },
  brandAsset: { findUnique: vi.fn() },
}));

vi.mock('../../../src/db', () => ({ default: mockPrisma }));

import brandRouter from '../../../src/routes/brand';
import {
  previewBrandConfiguration,
  publicBrandPayload,
} from '../../../src/services/brand-config';
import {
  ST_JOHNS_BRAND_CONFIG,
  WTH_BRAND_CONFIG,
} from '../../../src/services/brand-config/presets';
import { parseBrandConfig } from '../../../src/services/brand-config/config-schema';

describe('organization brand configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.brandConfiguration.findFirst.mockResolvedValue(null);
  });

  it('ships two complete brand-swap proof configurations', () => {
    expect(parseBrandConfig(WTH_BRAND_CONFIG).ok).toBe(true);
    expect(parseBrandConfig(ST_JOHNS_BRAND_CONFIG).ok).toBe(true);
    expect(ST_JOHNS_BRAND_CONFIG.logo.light).not.toEqual(WTH_BRAND_CONFIG.logo.light);
    expect(ST_JOHNS_BRAND_CONFIG.identity.organizationName).not.toBe(
      WTH_BRAND_CONFIG.identity.organizationName
    );
  });

  it('derives both scopes, unique family alternates, and chart colors without persisting tokens', () => {
    const preview = previewBrandConfiguration(ST_JOHNS_BRAND_CONFIG);
    expect(Object.keys(preview.tokens.light).length).toBeGreaterThan(20);
    expect(Object.keys(preview.tokens.dark)).toEqual(Object.keys(preview.tokens.light));
    expect(new Set(preview.alternates.map((item) => item.family)).size).toBe(3);
    expect(preview.chartColors.light).toHaveLength(5);
    expect(ST_JOHNS_BRAND_CONFIG).not.toHaveProperty('tokens');
  });

  it('fails closed to the compiled identity when the active row is invalid', async () => {
    mockPrisma.brandConfiguration.findFirst.mockResolvedValue({
      id: 'broken', payload: { schemaVersion: 999 }, isActive: true,
    });
    const brand = await publicBrandPayload();
    expect(brand.source).toBe('compiled-default');
    expect(brand.identity.organizationName).toBe('William Temple House');
    // ASK, not a word match: say what happened, name the remedy, and never
    // expose the raw validator or Prisma text (which carries absolute server
    // paths and a source excerpt).
    expect(brand.warning).toMatch(/could not be applied/i);
    expect(brand.warning).toMatch(/built-in look/i);
    expect(brand.warning).not.toMatch(/prisma|invocation|schemaVersion|\/Users\//i);
  });

  it('delivers a cache-revalidated stylesheet before authentication', async () => {
    const app = express();
    app.use('/api/brand', brandRouter);
    const first = await request(app).get('/api/brand/theme.css').expect(200);
    expect(first.headers['content-type']).toMatch(/text\/css/);
    // With no saved configuration the sheet is deliberately empty so the
    // hand-tuned `index.css` theme applies untouched. Emitting derived tokens
    // here would override an identity that was tuned by eye with one that only
    // approximates it.
    expect(first.text).toContain('compiled-default');
    expect(first.text).not.toMatch(/--primary:/);
    const second = await request(app)
      .get('/api/brand/theme.css')
      .set('If-None-Match', first.headers.etag)
      .expect(304);
    expect(second.text).toBe('');
  });

  it('never offers protected counting nouns as configurable terminology', () => {
    const keys = Object.keys(WTH_BRAND_CONFIG.terminology ?? {});
    expect(keys).not.toEqual(expect.arrayContaining(['household', 'visit', 'personServed']));
  });
});
