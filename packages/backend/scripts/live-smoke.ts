// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * The live smoke sweep: seven requests per model, against real providers.
 *
 * This is test layer 6 from `docs/ai-config/model-catalogue-refresh-2026-09.md`
 * — the one layer that costs money, and the only one that can prove a model
 * contract rather than FEED's handling of a fixture. It is opt-in, never run
 * in CI, and refuses to spend anything without `--bill`.
 *
 * ## Why it exists rather than driving FEED's own interface
 *
 * All three translation call sites ask `AIServiceFactory.createService()` with
 * no argument, which resolves one configuration — `findFirst({ type:'apikey',
 * isActive:true, deletedAt:null }, orderBy:{ updatedAt:'desc' })` — across
 * every provider. Activating a model therefore does not make it reachable,
 * and several models cannot be exercised through the interface at all
 * (ISSUES.md #84). This script calls `createServiceFromConfiguration`, which
 * builds an uncached service for exactly the row you name.
 *
 * ## What it leaves behind
 *
 * Real spend, recorded. Every provider service extends `AITranslationService`,
 * whose `trackUsage` writes a `UsageRecord` against `config.id`, so a request
 * from this script is accounted exactly like one from a route and shows up in
 * the usage dashboard under that configuration. That is deliberate: a sweep
 * whose cost vanished would be a worse test.
 *
 * ## Keys
 *
 * This script never decrypts, prints, or fingerprints an API key. Providers
 * decrypt their own through FEED's `decryptApiKey`. The one place a key is
 * constructed is request 6, which encrypts a deliberately invalid string
 * through FEED's own `encryptApiKey` so the *provider* is what rejects it —
 * testing the refusal path rather than the encryption layer.
 *
 * ## Usage
 *
 *   ts-node scripts/live-smoke.ts                      # plan only, no network
 *   ts-node scripts/live-smoke.ts --unbilled           # free lookups only
 *   ts-node scripts/live-smoke.ts --bill               # the full sweep
 *   ts-node scripts/live-smoke.ts --bill --provider Google
 *   ts-node scripts/live-smoke.ts --bill --config 9
 *   ts-node scripts/live-smoke.ts --bill --include-frontier --ceiling 2.00
 *
 * Frontier models are skipped unless `--include-frontier`. The run aborts as
 * soon as recorded spend passes `--ceiling` (default $1.00), checked after
 * every billable request rather than estimated in advance.
 */

import type { AIConfiguration } from '@prisma/client';

import prisma from '../src/db';
import { AIServiceFactory } from '../src/services/ai/factory/AIServiceFactory';
import type { AITranslationService } from '../src/services/ai/base/AITranslationService';
import { encryptApiKey } from '../src/services/encryption';
import {
  acceptedReasoningValues,
  capabilitiesFor,
  findCatalogueEntry,
  hasReasoningControl,
  isCatalogueProvider,
} from '../src/services/ai/catalogue';
import {
  PROVIDER_FAILURE_CODES,
  classifyTranslationProviderError,
} from '../src/services/ai/provider-failure';

/**
 * The request shape the cost estimate assumes, measured and recorded in the
 * refresh document: about 250 input and 60 output tokens for a one-sentence
 * translation at no thinking.
 *
 * Request 4 is the exception — it asks for the highest reasoning level the
 * model accepts, and the doc budgets up to 2,000 output tokens of it. The
 * estimate uses that ceiling, so the figure printed before a run is the worst
 * case rather than the likely one.
 */
const ESTIMATE_INPUT_TOKENS = 250;
const ESTIMATE_OUTPUT_TOKENS = 60;
const ESTIMATE_REASONING_OUTPUT_TOKENS = 2_000;
const BILLABLE_REQUESTS = 4;

const DEFAULT_CEILING_USD = 1.0;

type RequestOutcome = {
  model: string;
  configId: number;
  request: string;
  billable: boolean;
  ok: boolean;
  detail: string;
  ms: number;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
};

interface Options {
  bill: boolean;
  unbilledOnly: boolean;
  includeFrontier: boolean;
  provider?: string;
  configId?: number;
  ceiling: number;
}

const parseArgs = (argv: string[]): Options => {
  const value = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at === -1 ? undefined : argv[at + 1];
  };

  const ceilingRaw = value('--ceiling');
  const configRaw = value('--config');

  return {
    bill: argv.includes('--bill'),
    unbilledOnly: argv.includes('--unbilled'),
    includeFrontier: argv.includes('--include-frontier'),
    provider: value('--provider'),
    configId: configRaw ? Number(configRaw) : undefined,
    ceiling: ceilingRaw ? Number(ceilingRaw) : DEFAULT_CEILING_USD,
  };
};

/**
 * The configurations this run will touch: live rows only.
 *
 * Soft-deleted rows are excluded here even though the usage dashboard now
 * shows them — the dashboard reports history that already happened, while
 * this spends money, and spending it against a configuration an administrator
 * has deleted would be indefensible.
 */
const selectConfigurations = async (options: Options): Promise<AIConfiguration[]> => {
  const configs = await prisma.aIConfiguration.findMany({
    where: {
      type: 'apikey',
      deletedAt: null,
      ...(options.configId ? { id: options.configId } : {}),
      ...(options.provider ? { serviceType: options.provider } : {}),
    },
    orderBy: [{ serviceType: 'asc' }, { id: 'asc' }],
  });

  return configs.filter((config) => {
    if (!config.model || !isCatalogueProvider(config.serviceType)) return false;
    if (options.includeFrontier) return true;
    const entry = findCatalogueEntry(config.model);
    return entry?.costTier !== 'frontier';
  });
};

/** Worst-case spend for one model's four billable requests, from catalogue prices. */
const estimateForModel = (model: string): number | null => {
  const entry = findCatalogueEntry(model);
  if (!entry) return null;

  const inputTokens = ESTIMATE_INPUT_TOKENS * BILLABLE_REQUESTS;
  const outputTokens =
    ESTIMATE_OUTPUT_TOKENS * (BILLABLE_REQUESTS - 1) + ESTIMATE_REASONING_OUTPUT_TOKENS;

  return (inputTokens * entry.pricing.input + outputTokens * entry.pricing.output) / 1_000_000;
};

const time = async <T>(work: () => Promise<T>): Promise<{ result?: T; error?: unknown; ms: number }> => {
  const started = Date.now();
  try {
    return { result: await work(), ms: Date.now() - started };
  } catch (error) {
    return { error, ms: Date.now() - started };
  }
};

/**
 * Requests 5-7: the three that are expected to cost nothing.
 *
 * All three go through `checkAccess()`, which every provider implements as a
 * model lookup — `models.retrieve` on OpenAI and Anthropic, `models.get` on
 * Google. That the refusals are unbilled is the providers' expected
 * behaviour, not a guarantee; confirm it against the first run's invoice.
 */
const unbilledRequests = async (
  config: AIConfiguration,
  service: AITranslationService,
): Promise<RequestOutcome[]> => {
  const model = config.model ?? 'unknown';
  const outcomes: RequestOutcome[] = [];

  const access = await time(() => service.checkAccess());
  outcomes.push({
    model,
    configId: config.id,
    request: '5. availability (model lookup)',
    billable: false,
    ok: access.result?.ok === true,
    detail: access.result?.ok ? 'reachable' : describeFailure(access.result?.error ?? access.error),
    ms: access.ms,
  });

  // 6. A validly encrypted key that the provider will reject. Encrypting it
  //    through FEED's own encryptApiKey is what makes this a test of the
  //    refusal path rather than of the encryption layer.
  const { encrypted, salt } = await encryptApiKey('sk-feed-live-smoke-deliberately-invalid');
  const badKey = AIServiceFactory.createServiceFromConfiguration({
    ...config,
    encryptedApiKey: encrypted,
    salt,
  } as AIConfiguration);
  const rejected = await time(() => badKey.checkAccess());
  const rejectedFailure = rejected.result?.ok
    ? null
    : classifyTranslationProviderError(rejected.result?.error ?? rejected.error);
  outcomes.push({
    model,
    configId: config.id,
    request: '6. invalid key',
    billable: false,
    ok: rejectedFailure === 'misconfigured',
    detail: rejected.result?.ok
      ? 'ACCEPTED an invalid key — that is the finding'
      : `${rejectedFailure} / ${rejectedFailure ? PROVIDER_FAILURE_CODES[rejectedFailure] : '—'}`,
    ms: rejected.ms,
  });

  // 7. A model id this account cannot call. A non-existent id exercises the
  //    same 404-shaped refusal as a real model outside an account's
  //    allow-list, and the point being tested is that FEED's message names
  //    the model rather than blaming the key.
  const unavailableId = `${config.model}-not-entitled`;
  const badModel = AIServiceFactory.createServiceFromConfiguration({
    ...config,
    model: unavailableId,
  } as AIConfiguration);
  const refused = await time(() => badModel.checkAccess());
  const refusedFailure = refused.result?.ok
    ? null
    : classifyTranslationProviderError(refused.result?.error ?? refused.error);
  outcomes.push({
    model,
    configId: config.id,
    request: '7. unusable model id',
    billable: false,
    ok: refusedFailure === 'misconfigured',
    detail: refused.result?.ok
      ? `ACCEPTED ${unavailableId} — that is the finding`
      : `${refusedFailure} / names model: ${describeFailure(
          refused.result?.error ?? refused.error,
        ).includes(unavailableId)}`,
    ms: refused.ms,
  });

  return outcomes;
};

/** Requests 1-4: the billable half. */
const billableRequests = async (
  config: AIConfiguration,
  service: AITranslationService,
): Promise<RequestOutcome[]> => {
  const model = config.model ?? 'unknown';
  const outcomes: RequestOutcome[] = [];

  const one = await time(() =>
    service.translateText({
      text: 'Canned black beans, low sodium.',
      targetLanguage: 'Spanish',
      context: 'food',
    }),
  );
  outcomes.push({
    model,
    configId: config.id,
    request: '1. translateText',
    billable: true,
    ok: Boolean(one.result?.translatedText),
    detail: one.result?.translatedText ?? describeFailure(one.error),
    ms: one.ms,
    promptTokens: one.result?.metrics.promptTokens,
    completionTokens: one.result?.metrics.completionTokens,
    costUsd: one.result?.metrics.totalCost,
  });

  // Arabic, with a duplicate among the three, so this exercises RTL, the
  // de-duplication, and that results come back matched to their ids.
  const two = await time(() =>
    service.translateTextBatch({
      texts: [
        { id: 'a', text: 'Rice' },
        { id: 'b', text: 'Canned tuna' },
        { id: 'c', text: 'Rice' },
      ],
      targetLanguage: 'Arabic',
      context: 'food',
    }),
  );
  const twoOk =
    two.result?.translations.length === 3
    && two.result.translations.every((t) => Boolean(t.translatedText));
  outcomes.push({
    model,
    configId: config.id,
    request: '2. translateTextBatch (ar)',
    billable: true,
    ok: Boolean(twoOk),
    detail: twoOk
      ? two.result!.translations.map((t) => `${t.id}=${t.translatedText}`).join(' | ')
      : describeFailure(two.error),
    ms: two.ms,
    promptTokens: two.result?.metrics.promptTokens,
    completionTokens: two.result?.metrics.completionTokens,
    costUsd: two.result?.metrics.totalCost,
  });

  const three = await time(() =>
    service.classifySegmentsBatch({
      segments: [
        { id: 's1', text: 'Food Pantry Hours' },
        { id: 's2', text: '12345' },
        { id: 's3', text: 'Please bring identification.' },
      ],
    }),
  );
  outcomes.push({
    model,
    configId: config.id,
    request: '3. classifySegmentsBatch',
    billable: true,
    ok: three.result?.classifications.length === 3,
    detail:
      three.result?.classifications
        .map((c) => `${c.id}:a=${c.a.toFixed(2)},b=${c.b.toFixed(2)}`)
        .join(' | ') ?? describeFailure(three.error),
    ms: three.ms,
    promptTokens: three.result?.metrics.promptTokens,
    completionTokens: three.result?.metrics.completionTokens,
    costUsd: three.result?.metrics.totalCost,
  });

  // 4. The highest reasoning level the model accepts. Models whose thinking
  //    is not a selectable level — Claude's extended thinking, and models with
  //    no control at all — have nothing to raise, so this is skipped rather
  //    than faked with a value the provider would refuse.
  const capabilities = capabilitiesFor(
    config.serviceType as 'OpenAI' | 'Anthropic' | 'Google',
    config.model!,
  );
  if (!hasReasoningControl(capabilities)) {
    outcomes.push({
      model,
      configId: config.id,
      request: '4. highest reasoning',
      billable: false,
      ok: true,
      detail: `skipped — reasoning kind "${capabilities.reasoning.kind}" has no selectable level`,
      ms: 0,
    });
    return outcomes;
  }

  const values = acceptedReasoningValues(capabilities);
  const highest = values[values.length - 1];
  const raised = AIServiceFactory.createServiceFromConfiguration({
    ...config,
    thinkingLevel: highest,
  } as AIConfiguration);
  const four = await time(() =>
    raised.translateText({
      text: 'Please bring your identification and a proof of address.',
      targetLanguage: 'Spanish',
      context: 'food',
    }),
  );
  outcomes.push({
    model,
    configId: config.id,
    request: `4. reasoning=${highest}`,
    billable: true,
    ok: Boolean(four.result?.translatedText),
    detail: four.result?.translatedText ?? describeFailure(four.error),
    ms: four.ms,
    promptTokens: four.result?.metrics.promptTokens,
    completionTokens: four.result?.metrics.completionTokens,
    costUsd: four.result?.metrics.totalCost,
  });

  return outcomes;
};

const describeFailure = (error: unknown): string => {
  if (!error) return 'no error reported';
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 200);
};

const usd = (n: number): string => `$${n.toFixed(4)}`;

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  const configs = await selectConfigurations(options);

  if (!configs.length) {
    console.log('No live configurations match. Nothing to do.');
    return;
  }

  console.log(`\nFEED live smoke sweep — ${configs.length} configuration(s)\n`);

  let estimateTotal = 0;
  for (const config of configs) {
    const estimate = estimateForModel(config.model!);
    if (estimate !== null) estimateTotal += estimate;
    const entry = findCatalogueEntry(config.model!);
    console.log(
      `  [${String(config.id).padStart(2)}] ${(config.model ?? '?').padEnd(26)} `
      + `${(config.serviceType ?? '?').padEnd(10)} ${(entry?.costTier ?? 'uncatalogued').padEnd(9)} `
      + `worst case ${estimate === null ? 'unknown (not in catalogue)' : usd(estimate)}`,
    );
  }
  console.log(
    `\n  Worst-case total for the billable half: ${usd(estimateTotal)}`
    + `\n  Ceiling for this run: ${usd(options.ceiling)}\n`,
  );

  if (!options.bill && !options.unbilledOnly) {
    console.log('Plan only — no request was sent. Add --unbilled for the free');
    console.log('checks, or --bill to run the whole sweep.\n');
    return;
  }

  const outcomes: RequestOutcome[] = [];
  let spent = 0;

  for (const config of configs) {
    const service = AIServiceFactory.createServiceFromConfiguration(config);

    outcomes.push(...(await unbilledRequests(config, service)));

    if (!options.bill) continue;

    if (spent > options.ceiling) {
      console.log(`\nCeiling reached at ${usd(spent)} — stopping before ${config.model}.\n`);
      break;
    }

    const billed = await billableRequests(config, service);
    outcomes.push(...billed);
    spent += billed.reduce((sum, o) => sum + (o.costUsd ?? 0), 0);
  }

  console.log('\nResults\n');
  for (const o of outcomes) {
    const tokens =
      o.promptTokens === undefined
        ? ''
        : ` ${o.promptTokens}in/${o.completionTokens}out ${usd(o.costUsd ?? 0)}`;
    console.log(
      `  ${o.ok ? 'pass' : 'FAIL'}  ${(o.model ?? '').padEnd(26)} `
      + `${o.request.padEnd(28)} ${String(o.ms).padStart(6)}ms${tokens}`,
    );
    if (!o.ok || o.detail.startsWith('skipped')) console.log(`        ${o.detail}`);
  }

  const failures = outcomes.filter((o) => !o.ok).length;
  console.log(
    `\n  ${outcomes.length - failures} passed, ${failures} failed. `
    + `Recorded spend this run: ${usd(spent)}.\n`,
  );
  console.log('  Spend is recorded as UsageRecord rows against each configuration');
  console.log('  and will appear in the usage dashboard.\n');

  if (failures) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error('Live smoke sweep failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
