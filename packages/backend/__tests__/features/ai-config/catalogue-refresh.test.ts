import { expect, test } from 'vitest';
import { capabilitiesFor, findCatalogueEntry, selectableEntries } from '../../../src/services/ai/catalogue';

test('v1.8.2 offers current series only, with Google unchanged', () => {
  expect(selectableEntries().map(entry => entry.id).sort()).toEqual([
    'gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-astra',
    'claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1',
    'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.1-pro-preview',
  ].sort());
});

test.each(['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol', 'claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'])(
  '%s retains factual capabilities without being selectable', id => {
    const entry = findCatalogueEntry(id)!;
    expect(entry.lifecycle.status).toBe('active');
    expect(entry.lifecycle.offered).toBe(false);
    expect(selectableEntries().some(candidate => candidate.id === id)).toBe(false);
    expect(capabilitiesFor(entry.provider, id)).toBe(entry.capabilities);
    expect(selectableEntries().some(candidate => candidate.id === entry.lifecycle.replacement)).toBe(true);
  }
);

test('unfamiliar GPT-6 Custom models use conservative reasoning parameters', () => {
  expect(capabilitiesFor('OpenAI', 'gpt-6.9-custom')).toMatchObject({
    sampling: 'unsupported', maxTokensField: 'max_completion_tokens',
    reasoning: { kind: 'effort', leastCost: 'low' },
  });
});

test.each(['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol'])(
  '%s exposes the highest effort its live API actually accepts', id => {
    const reasoning = findCatalogueEntry(id)!.capabilities.reasoning;
    expect(reasoning.kind).toBe('effort');
    if (reasoning.kind !== 'effort') throw new Error('Expected effort control');
    expect(reasoning.values.at(-1)).toBe('xhigh');
    expect(reasoning.values).not.toContain('max');
  },
);
