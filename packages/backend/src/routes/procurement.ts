// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { rateLimiter } from '../middleware/rate-limiter';
import {
  ANALYTICS_RANGE_PRESETS,
  isValidLocalDate,
} from '../services/inventory-analytics/timezone';
import {
  getProcurementDataStatus,
  getProcurementAnalytics,
  importOfbCsv,
  listProcurementImports,
  ProcurementImportError,
  restoreProcurementImports,
  rollbackProcurementImports,
} from '../services/procurement';

const router = Router();
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== '.csv') {
      callback(new ProcurementImportError(
        'Choose a CSV created by the standardized OFB exporter.',
        'INVALID_OFB_FILE_TYPE'
      ));
      return;
    }
    callback(null, true);
  },
});

const idsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
}).strict();

const analyticsQuerySchema = z.object({
  preset: z.enum(ANALYTICS_RANGE_PRESETS).default('last-90-days'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  channel: z.enum(['ofb_warehouse', 'fresh_alliance']).optional(),
  acquisitionClass: z.enum(['DONATED', 'PURCH-DON', 'GOVERNMENT', 'PURCHASED']).optional(),
}).strict().superRefine((value, context) => {
  if (value.preset !== 'custom') return;
  if (!value.startDate || !isValidLocalDate(value.startDate)) {
    context.addIssue({ code: 'custom', path: ['startDate'], message: 'Choose a valid start date.' });
  }
  if (!value.endDate || !isValidLocalDate(value.endDate)) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'Choose a valid end date.' });
  }
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after the start date.' });
  }
});

router.get('/imports', rateLimiter, async (_req, res, next) => {
  try {
    res.json({ imports: await listProcurementImports() });
  } catch (error) {
    next(error);
  }
});

router.get('/status', rateLimiter, async (_req, res, next) => {
  try {
    res.json({ status: await getProcurementDataStatus() });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics', rateLimiter, async (_req, res, next) => {
  try {
    const filters = analyticsQuerySchema.parse(_req.query);
    res.json({ analytics: await getProcurementAnalytics(filters) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          message: 'Choose valid procurement filters and try again.',
          code: 'INVALID_PROCUREMENT_FILTERS',
          details: error.issues,
        },
      });
    }
    next(error);
  }
});

router.post('/imports/ofb', rateLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          message: 'Select an OFB CSV before importing data.',
          code: 'NO_OFB_FILE',
        },
      });
    }
    const result = await importOfbCsv(req.file.buffer, req.auth?.userId);
    res.status(result.outcome === 'imported' ? 201 : 200).json({ result });
  } catch (error) {
    if (error instanceof ProcurementImportError) {
      return res.status(error.statusCode).json({
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      });
    }
    next(error);
  }
});

router.post('/imports/rollback', rateLimiter, async (req, res, next) => {
  try {
    const { ids } = idsSchema.parse(req.body);
    res.json({ result: await rollbackProcurementImports(ids, req.auth?.userId) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          message: 'Select at least one valid import to roll back.',
          code: 'INVALID_IMPORT_SELECTION',
          details: error.issues,
        },
      });
    }
    next(error);
  }
});

router.post('/imports/restore', rateLimiter, async (req, res, next) => {
  try {
    const { ids } = idsSchema.parse(req.body);
    res.json({ result: await restoreProcurementImports(ids, req.auth?.userId) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          message: 'Select at least one valid import to restore.',
          code: 'INVALID_IMPORT_SELECTION',
          details: error.issues,
        },
      });
    }
    next(error);
  }
});

export default router;
