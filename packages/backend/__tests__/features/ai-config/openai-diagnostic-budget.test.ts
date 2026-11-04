// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ configs: vi.fn() }));
vi.mock('../../../src/db', () => ({ default: { aIConfiguration: { findMany: mocks.configs } } }));
import { diagnosticOptions, diagnosticReservation, main } from '../../../scripts/diagnose-openai-entitlement';

test.each(['NaN', 'Infinity', '-1', '0', 'bad'])('rejects invalid ceiling %s', value => {
  expect(() => diagnosticOptions(['--bill', '--ceiling', value])).toThrow();
});
test('requires a bounded sample and makes plan-only the default', () => {
  expect(diagnosticOptions([])).toEqual({ bill: false, ceiling: 0.25, rounds: 3 });
  expect(() => diagnosticOptions(['--rounds', '4'])).toThrow();
  expect(() => diagnosticOptions(['--rounds', '1.5'])).toThrow();
  expect(() => diagnosticOptions(['--ceiling'])).toThrow();
});
test('reserves the higher of manual and current rates', () => {
  const preset = { model: 'gpt-6-astra', serviceType: 'OpenAI', pricingSource: 'preset' };
  expect(diagnosticReservation(preset)).toBeCloseTo(0.0356);
  expect(diagnosticReservation({ ...preset, pricingSource: 'manual', inputCost: 20, outputCost: 100, unitPrice: 'per_1m' }))
    .toBeCloseTo(0.0712);
});
test('refuses an over-budget run before any credential is read or call sent', async () => {
  mocks.configs.mockResolvedValue(['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-astra'].map(model => ({
    id: 1, model, serviceType: 'OpenAI', pricingSource: 'preset', encryptedApiKey: 'fake', salt: 'fake',
  })));
  await expect(main(['--bill', '--ceiling', '0.00001'])).rejects.toThrow(/reservations exceed/);
});
