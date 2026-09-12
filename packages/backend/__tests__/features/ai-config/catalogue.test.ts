// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Invariants the catalogue has to hold, and the measured facts it records.
 *
 * The duplicated `model-specs.ts` had no invariants at all, which is how it
 * came to offer a model that had been shut down for six months and to carry
 * an effort default the replacement model rejects (ISSUES.md #84).
 */

import { describe, expect, test } from 'vitest';

import {
  CATALOGUE,
  acceptsReasoningValue,
  entriesForProvider,
  findCatalogueEntry,
  leastCostReasoning,
  selectableEntries,
  type CatalogueEntry,
} from '../../../src/services/ai/catalogue';

describe('catalogue invariants', () => {
  test('every id is unique', () => {
    const ids = CATALOGUE.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every entry carries a price with the date it was checked', () => {
    for (const entry of CATALOGUE) {
      expect(entry.pricing.input, entry.id).toBeGreaterThan(0);
      expect(entry.pricing.output, entry.id).toBeGreaterThan(0);
      // A stale price never errors; it silently mis-projects spend limits.
      expect(entry.pricing.verifiedAt, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('every named replacement resolves to a real entry', () => {
    // A replacement pointing at nothing is worse than none: the interface
    // would tell an administrator to move to a model that does not exist.
    for (const entry of CATALOGUE) {
      const { replacement } = entry.lifecycle;
      if (!replacement) continue;
      const target = findCatalogueEntry(replacement);
      const named = target !== undefined;
      // Until the 2026 families land, a replacement may legitimately name a
      // model not yet in the catalogue — but it must never name a retired one.
      if (named) {
        expect(target!.lifecycle.status, `${entry.id} -> ${replacement}`).not.toBe('retired');
      }
    }
  });

  test('a retired model is never offered', () => {
    const retired = CATALOGUE.filter((e) => e.lifecycle.status === 'retired').map((e) => e.id);
    const offered = selectableEntries().map((e) => e.id);
    for (const id of retired) expect(offered).not.toContain(id);
    // gemini-3-pro-preview shut down 2026-03-09 and was still selectable.
    expect(retired).toContain('gemini-3-pro-preview');
  });

  test('frontier tier means an output price of $20/1M or more', () => {
    for (const entry of CATALOGUE) {
      if (entry.costTier === 'frontier') {
        expect(entry.pricing.output, entry.id).toBeGreaterThanOrEqual(20);
      } else {
        expect(entry.pricing.output, entry.id).toBeLessThan(20);
      }
    }
  });

  test('a shutdown date is a date', () => {
    for (const entry of CATALOGUE) {
      if (entry.lifecycle.shutdownDate) {
        expect(entry.lifecycle.shutdownDate, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  test('every reasoning control offers its least-cost value', () => {
    for (const entry of CATALOGUE) {
      const least = leastCostReasoning(entry);
      if (least === null) continue;
      expect(acceptsReasoningValue(entry, least), entry.id).toBe(true);
    }
  });
});

describe('the capabilities that string tests could not express', () => {
  const entry = (id: string): CatalogueEntry => {
    const found = findCatalogueEntry(id);
    if (!found) throw new Error(`missing catalogue entry: ${id}`);
    return found;
  };

  test('Claude 4.5 takes one sampling parameter and a prefill', () => {
    const haiku = entry('claude-haiku-4-5-20251001');
    expect(haiku.capabilities.sampling).toBe('temperature-or-top-p');
    expect(haiku.capabilities.prefill).toBe('allowed');
  });

  test('Claude entries carry the non-streaming ceiling the SDK needs', () => {
    // The SDK refuses a non-streaming request whose expected duration passes
    // ten minutes, and a 64K output limit sails past it.
    for (const claude of entriesForProvider('Anthropic')) {
      expect(claude.capabilities.nonStreamingOutputCeiling, claude.id).toBe(20480);
    }
  });

  test('gpt-5-nano accepts minimal effort — the value GPT-5.6 rejects', () => {
    // Measured 2026-09-11: gpt-5.6-luna answers `400 Unsupported value:
    // 'reasoning_effort' does not support 'minimal' with this model`. Two
    // models, two answers, which is why this is per-entry data and not one
    // shared union.
    const nano = entry('gpt-5-nano-2025-08-07');
    expect(acceptsReasoningValue(nano, 'minimal')).toBe(true);
    expect(leastCostReasoning(nano)).toBe('minimal');
  });

  test('OpenAI reasoning models want max_completion_tokens', () => {
    // Also measured: `max_tokens` is refused outright by GPT-5.6, which is
    // what makes the Custom path unusable there until it carries a profile.
    for (const openai of entriesForProvider('OpenAI')) {
      expect(openai.capabilities.maxTokensField, openai.id).toBe('max_completion_tokens');
    }
  });

  test('the withdrawn Gemini model records why it fails', () => {
    const withdrawn = entry('gemini-2.5-flash-lite');
    expect(withdrawn.lifecycle.status).toBe('deprecated');
    expect(withdrawn.lifecycle.replacement).toBe('gemini-3.5-flash-lite');
    expect(withdrawn.lifecycle.note).toMatch(/no longer available to new users/);
  });
});
