// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import 'dotenv/config';
import OpenAI from 'openai';
import prisma from '../src/db';
import { decryptApiKey } from '../src/services/encryption';
import { selectableEntries } from '../src/services/ai/catalogue';
import { credentialTag, ENTITLEMENT_OUTPUT_CAP, probeOpenAIEntitlement, type EntitlementTrace } from '../src/services/ai/openai-entitlement';
import { priceUsage, pricingRates } from '../src/services/ai/pricing';
import { OpenAITranslationService } from '../src/services/ai/providers/OpenAITranslationService';

export function diagnosticOptions(args: string[]) {
  const numberOption = (name: string, fallback: number) => {
    const at = args.indexOf(name);
    const value = at < 0 ? fallback : Number(args[at + 1]);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} requires a positive finite number.`);
    return value;
  };
  const ceiling = numberOption('--ceiling', 0.25);
  const rounds = numberOption('--rounds', 3);
  if (!Number.isInteger(rounds) || rounds > 3) throw new Error('--rounds must be an integer from 1 to 3.');
  return { bill: args.includes('--bill'), ceiling, rounds };
}

/** Reserve the more conservative of saved and maintained prices, including billed failures. */
export function diagnosticReservation(config: Parameters<typeof priceUsage>[0]): number {
  const saved = pricingRates(config, 1000);
  const preset = pricingRates({ ...config, pricingSource: 'preset' }, 1000);
  const estimate = 1000 * Math.max(saved.input, preset.input)
    + ENTITLEMENT_OUTPUT_CAP * Math.max(saved.output, preset.output);
  if (!Number.isFinite(estimate) || estimate <= 0) throw new Error('Cannot reserve an unpriced request.');
  return estimate;
}

export async function main(args = process.argv.slice(2)) {
  const options = diagnosticOptions(args);
  const ids = selectableEntries().filter(entry => entry.provider === 'OpenAI').map(entry => entry.id);
  const configs = await prisma.aIConfiguration.findMany({
    where: { type: 'apikey', serviceType: 'OpenAI', deletedAt: null, model: { in: ids } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
  });
  const selected = ids.map(id => configs.find(config => config.model === id && config.encryptedApiKey && config.salt));
  if (selected.some(config => !config)) throw new Error('Each offered OpenAI model needs a saved credential-bearing configuration.');
  const projected = selected.reduce((sum, config) => sum + diagnosticReservation(config!) * 2 * options.rounds, 0);
  console.log(JSON.stringify({ event: 'plan', rounds: options.rounds, calls: selected.length * 2 * options.rounds,
    projectedUsd: projected, ceilingUsd: options.ceiling, outputCap: ENTITLEMENT_OUTPUT_CAP,
    inputReservationTokens: 1000, note: 'Input is a conservative estimate, not an enforced token cap. No configurations are written.' }));
  if (!options.bill) return;
  if (projected > options.ceiling) throw new Error('Planned reservations exceed the approved ceiling; no requests sent.');

  let reserved = 0;
  let observed = 0;
  let missingUsage = false;
  let failures = 0;
  const onTrace = (trace: EntitlementTrace) => {
    console.log(JSON.stringify({ event: 'probe', ...trace }));
    if (typeof trace.costUsd === 'number' && Number.isFinite(trace.costUsd)) observed += trace.costUsd;
    // An HTTP response without usage may still be billed. Stop rather than
    // interpreting it as free. Permission denials have no completion to bill.
    else if (trace.status === undefined || (trace.status >= 200 && trace.status < 300) || trace.status >= 500) missingUsage = true;
    if (!trace.ok) failures++;
  };
  const reserve = (cost: number) => {
    if (missingUsage || Math.max(reserved, observed) + cost > options.ceiling)
      throw new Error('Stopped: missing usage or next reservation would exceed the approved ceiling.');
    reserved = Math.max(reserved, observed) + cost;
  };
  try {
    for (let round = 1; round <= options.rounds; round++) {
      console.log(JSON.stringify({ event: 'round', round, at: new Date().toISOString() }));
      for (const config of selected) {
        const saved = config!;
        const apiKey = await decryptApiKey(saved.encryptedApiKey!, saved.salt!);
        const direct = new OpenAI({ apiKey, maxRetries: 0 });
        if (direct.baseURL !== 'https://api.openai.com/v1' || direct.project || direct.organization)
          throw new Error('Unexpected OpenAI endpoint or environment scope override; inspect before comparing.');
        const cost = diagnosticReservation(saved);
        // Alternate order to avoid attributing a timing effect to the lane.
        for (const lane of round % 2 ? ['save', 'direct'] as const : ['direct', 'save'] as const) {
          reserve(cost);
          if (lane === 'save') await new OpenAITranslationService(saved).verifyEntitlement({ onTrace });
          else await probeOpenAIEntitlement(direct, saved, { lane, credentialTag: credentialTag(apiKey), onTrace });
        }
      }
      if (round < options.rounds) await new Promise(resolve => setTimeout(resolve, 15_000));
    }
    if (failures) process.exitCode = 1;
  } finally {
    console.log(JSON.stringify({ event: 'summary', failures, reservedUsd: reserved, observedUsd: observed, missingUsage }));
  }
}

if (require.main === module) main().catch(() => {
  // Never print an SDK exception or a decrypted credential from this CLI.
  console.error('Diagnostic stopped. Review the safe plan/probe/summary records; no configurations were changed.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
