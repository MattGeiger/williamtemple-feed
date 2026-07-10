// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Reports API (Reports initiative §3). Interactive queries and per-card CSV
 * downloads share the inventory-analytics calculation service, so the
 * numbers on screen and in a download always agree.
 */

import { Router } from 'express';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import JSZip from 'jszip';
import { Prisma } from '@prisma/client';
import prisma from '../db';
import {
  buildTab,
  computeReportsTab,
  loadAnalyticsContext,
  ReportTabId,
  REPORT_TAB_IDS,
  TabResults,
} from '../services/inventory-analytics';
import {
  isValidLocalDate,
  isValidTimeZone,
  resolveRange,
} from '../services/inventory-analytics/timezone';
import {
  getReportCard,
  isValidCardSelection,
  REPORT_CARDS,
} from '../services/reports/card-registry';
import { buildCardCsv, toCsv } from '../services/reports/csv';
import { renderReportPdf } from '../services/reports/pdf';
import {
  normalizeTemplateName,
  staleCardIds,
  templateDataSchema,
  templateNameSearch,
  TEMPLATE_NAME_MAX,
  TEMPLATE_NAME_MIN,
} from '../services/reports/templates';

const router = Router();

const badRequest = (message: string) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 400;
  return error;
};

const rangeSchema = z
  .object({
    preset: z.enum([
      'last-30-days',
      'last-90-days',
      'last-6-months',
      'last-12-months',
      'ytd',
      'custom',
    ]),
    timeZone: z.string().refine(isValidTimeZone, {
      message: 'timeZone must be a valid IANA timezone',
    }),
    startDate: z.string().refine(isValidLocalDate).optional(),
    endDate: z.string().refine(isValidLocalDate).optional(),
  })
  .refine(
    (range) =>
      range.preset !== 'custom' || (range.startDate && range.endDate),
    { message: 'Custom ranges require startDate and endDate' }
  );

const querySchema = z.object({
  source: z.literal('reports'),
  tab: z.enum(REPORT_TAB_IDS as [ReportTabId, ...ReportTabId[]]).default('inventory-outlook'),
  range: rangeSchema,
  horizonDays: z
    .union([z.literal(14), z.literal(30), z.literal(60), z.literal(90)])
    .default(30),
  categoryIds: z.array(z.number().int().positive()).max(200).optional(),
  cardIds: z.array(z.string()).max(32).optional(),
});

function resolveValidatedRange(input: z.infer<typeof rangeSchema>) {
  return resolveRange(
    input.preset,
    input.timeZone,
    new Date(),
    input.preset === 'custom'
      ? { startDate: input.startDate!, endDate: input.endDate! }
      : undefined
  );
}

// Interactive query for the Reports workspace. Returns the requested tab's
// full dataset; the client renders the blocks it needs.
router.post('/query', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((issue) => issue.message).join(', '));
    }
    const { tab, range, horizonDays, categoryIds, cardIds } = parsed.data;

    if (cardIds) {
      const selection = isValidCardSelection('reports', cardIds);
      if (!selection.ok) throw badRequest(selection.message);
    }

    const resolved = resolveValidatedRange(range);
    const result = await computeReportsTab(tab, {
      range: resolved,
      horizonDays,
      categoryIds,
    });

    res.json({
      range: {
        preset: resolved.preset,
        startDate: resolved.startDate,
        endDate: resolved.endDate,
        timeZone: resolved.timeZone,
      },
      horizonDays,
      tab,
      result,
    });
  } catch (error) {
    next(error);
  }
});

// Direct per-card CSV download (available outside selection mode).
router.post('/cards/:cardId/csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cardId } = req.params;
    const card = getReportCard(cardId);
    if (!card || card.source !== 'reports') {
      throw badRequest(`Unknown report block: ${cardId}`);
    }

    const parsed = querySchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((issue) => issue.message).join(', '));
    }
    const { range, horizonDays, categoryIds } = parsed.data;

    const resolved = resolveValidatedRange(range);
    // The card's registry entry names the tab whose dataset feeds it.
    const tab = card.tab as ReportTabId;
    const result = await computeReportsTab(tab, {
      range: resolved,
      horizonDays,
      categoryIds,
    });

    const { headers, rows } = buildCardCsv(cardId, { [tab]: result });
    const csv = toCsv(headers, rows);
    const filename = `${cardId}-${resolved.startDate}-to-${resolved.endDate}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// ---- Export (ZIP: landscape PDF + numbered per-card CSVs + manifest) --------

const exportSchema = z
  .object({
    source: z.literal('reports'),
    title: z
      .string()
      .transform((value) => value.trim().replace(/\s+/g, ' '))
      .pipe(z.string().min(3).max(48)),
    cardIds: z.array(z.string()).min(1),
    range: rangeSchema,
    horizonDays: z
      .union([z.literal(14), z.literal(30), z.literal(60), z.literal(90)])
      .default(30),
    categoryIds: z.array(z.number().int().positive()).max(200).optional(),
    includePdf: z.boolean().default(true),
    includeCsv: z.boolean().default(true),
  })
  .refine((body) => body.includePdf || body.includeCsv, {
    message: 'Select PDF, CSV, or both for the export',
  });

const CALCULATION_VERSION = 1;

const filenameSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report';

router.post('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = exportSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((issue) => issue.message).join(', '));
    }
    const { title, cardIds, range, horizonDays, categoryIds, includePdf, includeCsv } = parsed.data;

    const selection = isValidCardSelection('reports', cardIds);
    if (!selection.ok) throw badRequest(selection.message);
    const cards = cardIds.map((id) => getReportCard(id)!);

    // One server dataAsOf; every selected block computes from this single
    // canonical context, then all artifacts render from that result.
    const dataAsOf = new Date();
    const resolved = resolveValidatedRange(range);
    const context = await loadAnalyticsContext({
      range: resolved,
      horizonDays,
      categoryIds,
      asOf: dataAsOf,
    });
    const neededTabs = [...new Set(cards.map((card) => card.tab as ReportTabId))];
    const tabs: Partial<TabResults> = {};
    for (const tab of neededTabs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tabs as any)[tab] = buildTab(tab, context);
    }

    const rangeLabel = `${resolved.startDate} – ${resolved.endDate}` +
      (resolved.preset !== 'custom' ? ` (${resolved.preset})` : '');
    const filtersSummary = categoryIds?.length
      ? `${categoryIds.length} categories filtered`
      : 'All categories';

    const zip = new JSZip();

    if (includeCsv) {
      cards.forEach((card, index) => {
        const { headers, rows } = buildCardCsv(card.id, tabs);
        const number = String(index + 1).padStart(2, '0');
        zip.file(`${number}-${card.id}.csv`, toCsv(headers, rows));
      });
    }

    if (includePdf) {
      const outlook = tabs['inventory-outlook'];
      const notices: string[] = [
        'History before an item’s first ledger event is untracked; no earlier values are estimated.',
      ];
      if (outlook) {
        notices.push(
          `${outlook.kpis.itemsWithComputableCover} of ${outlook.kpis.inStockItems} in-stock items have burn-ready history.`
        );
      }
      const pdf = await renderReportPdf({
        title,
        rangeLabel,
        timeZone: resolved.timeZone,
        horizonDays,
        filtersSummary,
        dataAsOf: dataAsOf.toISOString(),
        cards,
        tabs,
        notices,
      });
      zip.file(`${filenameSlug(title)}.pdf`, pdf);
    }

    zip.file(
      'manifest.json',
      JSON.stringify(
        {
          title,
          generatedAt: new Date().toISOString(),
          dataAsOf: dataAsOf.toISOString(),
          range: {
            preset: resolved.preset,
            startDate: resolved.startDate,
            endDate: resolved.endDate,
            timeZone: resolved.timeZone,
          },
          horizonDays,
          filters: { categoryIds: categoryIds ?? [] },
          selectedCardIds: cardIds,
          calculationVersion: CALCULATION_VERSION,
          templateSchemaVersion: 1,
        },
        null,
        2
      )
    );

    const archive = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    const filename = `${filenameSlug(title)}-${resolved.startDate}-to-${resolved.endDate}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(archive);
  } catch (error) {
    next(error);
  }
});

// ---- Shared templates (organization-wide; no owner scoping) ------------------

const templateWireShape = (template: {
  id: number;
  name: string;
  source: string;
  templateData: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) => {
  const data = template.templateData as unknown as { cardIds?: string[] };
  return {
    id: template.id,
    name: template.name,
    source: template.source,
    templateData: template.templateData,
    // Stale ids are surfaced ("needs attention"), never silently dropped.
    staleCardIds: staleCardIds(
      template.source as 'reports' | 'dashboard',
      Array.isArray(data.cardIds) ? data.cardIds : []
    ),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
};

router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.reportTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ templates: templates.map(templateWireShape) });
  } catch (error) {
    next(error);
  }
});

const saveTemplateSchema = z.object({
  name: z
    .string()
    .transform(normalizeTemplateName)
    .pipe(z.string().min(TEMPLATE_NAME_MIN).max(TEMPLATE_NAME_MAX)),
  templateData: templateDataSchema,
});

// Create-or-update by normalized name within the template's source
// (Shopping List Builder same-name-save behavior). Saves from the live UI
// must reference known cards; stale ids only ever arrive via old rows.
router.post('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = saveTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((issue) => issue.message).join(', '));
    }
    const { name, templateData } = parsed.data;
    const selection = isValidCardSelection(templateData.source, templateData.cardIds);
    if (!selection.ok) throw badRequest(selection.message);

    const template = await prisma.reportTemplate.upsert({
      where: {
        source_nameSearch: {
          source: templateData.source,
          nameSearch: templateNameSearch(name),
        },
      },
      create: {
        name,
        nameSearch: templateNameSearch(name),
        source: templateData.source,
        templateData: templateData as unknown as Prisma.InputJsonValue,
      },
      update: {
        name,
        templateData: templateData as unknown as Prisma.InputJsonValue,
      },
    });
    res.status(201).json({ template: templateWireShape(template) });
  } catch (error) {
    next(error);
  }
});

const updateTemplateSchema = z.object({
  name: z
    .string()
    .transform(normalizeTemplateName)
    .pipe(z.string().min(TEMPLATE_NAME_MIN).max(TEMPLATE_NAME_MAX))
    .optional(),
  templateData: templateDataSchema.optional(),
});

router.put('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw badRequest('Invalid template ID');
    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((issue) => issue.message).join(', '));
    }
    const { name, templateData } = parsed.data;

    const existing = await prisma.reportTemplate.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Report template not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }
    if (templateData) {
      // `source` is immutable: the replacement data must keep it.
      if (templateData.source !== existing.source) {
        throw badRequest('A template cannot change its source');
      }
      const selection = isValidCardSelection(templateData.source, templateData.cardIds);
      if (!selection.ok) throw badRequest(selection.message);
    }

    try {
      const template = await prisma.reportTemplate.update({
        where: { id },
        data: {
          ...(name
            ? { name, nameSearch: templateNameSearch(name) }
            : {}),
          ...(templateData
            ? { templateData: templateData as unknown as Prisma.InputJsonValue }
            : {}),
        },
      });
      res.json({ template: templateWireShape(template) });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return res.status(400).json({
          error: {
            message: 'A template with this name already exists. Choose a different name.',
            code: 'DUPLICATE_REPORT_TEMPLATE_NAME',
          },
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.delete('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw badRequest('Invalid template ID');
    const existing = await prisma.reportTemplate.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Report template not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }
    await prisma.reportTemplate.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Registry listing for the client (single source of truth for card ids).
router.get('/cards', (_req: Request, res: Response) => {
  res.json({ cards: REPORT_CARDS });
});

export default router;
