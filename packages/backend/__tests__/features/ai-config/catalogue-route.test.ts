// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * `GET /api/ai-config/models` — the server-authoritative catalogue the
 * dialogs will read instead of a second copy of `model-specs.ts`.
 *
 * The first test here earns its place: Express matches routes in declaration
 * order, and `/:id` sits a few lines below `/models`. Declared the other way
 * round, this endpoint returns `400 Invalid configuration ID` — a failure
 * that reads as a broken client rather than a mis-ordered router, and one no
 * unit test of the catalogue module could catch.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockPrisma = vi.hoisted(() => ({
  aIConfiguration: { findMany: vi.fn(), findUnique: vi.fn() },
  systemPrompt: { findMany: vi.fn() },
}));
vi.mock('../../../src/db', () => ({ default: mockPrisma }));
vi.mock('../../../src/services/encryption', () => ({
  encryptApiKey: vi.fn(),
  decryptApiKey: vi.fn(),
}));

const buildApp = async () => {
  const app = express();
  app.use(express.json());
  const { default: router } = await import('../../../src/routes/ai-config');
  app.use('/api/ai-config', router);
  const { errorHandler } = await import('../../../src/middleware/error-handler');
  app.use(errorHandler);
  return app;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/ai-config/models', () => {
  test('is not swallowed by the /:id route declared below it', async () => {
    const response = await request(await buildApp()).get('/api/ai-config/models');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('models');
    // The failure this guards against.
    expect(JSON.stringify(response.body)).not.toContain('Invalid configuration ID');
    // And it must not have reached the database on the way.
    expect(mockPrisma.aIConfiguration.findUnique).not.toHaveBeenCalled();
  });

  test('serves entries with the lifecycle and capability facts the UI needs', async () => {
    const response = await request(await buildApp()).get('/api/ai-config/models');
    const haiku = response.body.models.find(
      (m: any) => m.id === 'claude-haiku-4-5-20251001'
    );

    expect(haiku).toBeDefined();
    expect(haiku.pricing).toMatchObject({ input: 1, output: 5 });
    expect(haiku.pricing.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(haiku.capabilities.sampling).toBe('temperature-or-top-p');
    expect(haiku.capabilities.prefill).toBe('allowed');
    expect(haiku.lifecycle.status).toBe('active');
  });

  test('omits retired models, so nothing shut down can be chosen', async () => {
    const response = await request(await buildApp()).get('/api/ai-config/models');
    const ids = response.body.models.map((m: any) => m.id);

    // Shut down 2026-03-09, and selectable in the interface until now.
    expect(ids).not.toContain('gemini-3-pro-preview');
  });

  test('carries the service endpoints the dialog pre-fills', async () => {
    const response = await request(await buildApp()).get('/api/ai-config/models');

    expect(response.body.endpoints).toMatchObject({
      OpenAI: 'https://api.openai.com/v1',
      Anthropic: 'https://api.anthropic.com/v1',
      Google: 'https://generativelanguage.googleapis.com',
    });
  });

  test('a withdrawn model still appears, and says what to move to', async () => {
    // It has to remain choosable-and-warned rather than vanish: saved
    // configurations point at it, and the interface needs to explain them.
    const response = await request(await buildApp()).get('/api/ai-config/models');
    const withdrawn = response.body.models.find((m: any) => m.id === 'gemini-2.5-flash-lite');

    expect(withdrawn.lifecycle.status).toBe('deprecated');
    expect(withdrawn.lifecycle.replacement).toBe('gemini-3.5-flash-lite');
    expect(withdrawn.lifecycle.note).toMatch(/no longer available to new users/);
  });
});
