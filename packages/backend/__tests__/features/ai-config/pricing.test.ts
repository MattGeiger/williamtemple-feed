import { describe, expect, test } from 'vitest';
import { priceUsage, pricingFields, pricingRates } from '../../../src/services/ai/pricing';

const haiku = { serviceType: 'Anthropic', model: 'claude-haiku-5-5', pricingSource: 'preset' };

describe('preset pricing and manual provenance', () => {
  test('Haiku charges the entire request at the correct side of its input boundary', () => {
    expect(priceUsage(haiku, 100000, 1000)).toBeCloseTo(0.0105);
    expect(priceUsage(haiku, 100001, 1000)).toBeCloseTo(0.0525005);
  });
  test('OpenAI long-context pricing uses input size, not combined input and output', () => {
    const config = { serviceType: 'OpenAI', model: 'gpt-6.1-sol', pricingSource: 'preset' };
    expect(priceUsage(config, 272000, 1000)).toBeCloseTo(0.554);
    expect(priceUsage(config, 272001, 1000)).toBeCloseTo(1.103004);
  });
  test('announced Google rate changes apply at the effective date', () => {
    const config = { serviceType: 'Google', model: 'gemini-3.8-flash', pricingSource: 'preset' };
    expect(priceUsage(config, 1000, 1000, new Date('2026-12-31T23:59:59Z'))).toBeCloseTo(0.0045);
    expect(priceUsage(config, 1000, 1000, new Date('2027-01-01T00:00:00Z'))).toBeCloseTo(0.009);
  });
  test.each([undefined, null, 'manual'])('legacy/manual provenance %s preserves rates and units', pricingSource => {
    expect(priceUsage({ ...haiku, pricingSource, inputCost: 2, outputCost: 3, unitPrice: 'per_1k' }, 100001, 1000)).toBeCloseTo(203.002);
  });
  test('model and provider must agree before managed rates apply', () => {
    expect(pricingRates({ ...haiku, serviceType: 'OpenAI', inputCost: 1, unitPrice: 'per_1m' }).input).toBe(1e-6);
  });
  test('write validation refuses unknown provenance and unmanaged custom models', () => {
    expect(() => pricingFields('auto', haiku)).toThrow();
    expect(() => pricingFields('preset', { model: 'custom', serviceType: 'OpenAI' })).toThrow(/manual pricing/);
    expect(pricingFields(undefined, haiku)).toEqual({});
    expect(pricingFields('manual', haiku)).toEqual({ pricingSource: 'manual' });
  });
  test('managed snapshots are derived on the server, not trusted from a client', () => {
    expect(pricingFields('preset', { ...haiku, inputCost: 0, outputCost: 0 })).toEqual({
      pricingSource: 'preset', inputCost: 0.1, outputCost: 0.5, unitPrice: 'per_1m',
    });
  });
});
