// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth/require-admin';
import { rateLimiter } from '../middleware/rate-limiter';
import {
  createServiceMetricConfiguration,
  getServiceDay,
  listServiceMetricConfigurations,
  saveServiceDay,
  seedWthServiceConfiguration,
  SERVICE_ENTRY_STATES,
  SERVICE_METRIC_SEMANTIC_ROLES,
  SERVICE_METRIC_UNITS,
  SERVICE_METRIC_VALUE_TYPES,
  SERVICE_PANTRY_STATUSES,
  ServiceFoundationError,
  ServiceLogError,
  updateServiceMetricConfiguration,
} from '../services/service';

const router = Router();

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableDescription = z.string().max(500).nullable();
const metricConfigurationSchema = z.object({
  displayName: z.string().min(1).max(80),
  description: nullableDescription,
  iconName: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  valueType: z.enum(SERVICE_METRIC_VALUE_TYPES),
  unit: z.enum(SERVICE_METRIC_UNITS),
  semanticRole: z.enum(SERVICE_METRIC_SEMANTIC_ROLES),
  contributesToOperationalTotal: z.boolean(),
  capacityTarget: z.number().int().nonnegative().nullable(),
  effectiveStartDate: localDate,
  effectiveEndDate: localDate.nullable(),
  displayPosition: z.number().int().positive(),
  isActive: z.boolean(),
}).strict();
const updateMetricConfigurationSchema = metricConfigurationSchema.extend({
  expectedRevision: z.number().int().positive(),
}).strict();
const metricIdSchema = z.coerce.number().int().positive();
const dayObservationSchema = z.object({
  metricId: z.number().int().positive(),
  countValue: z.number().int().nonnegative().nullable(),
  booleanValue: z.boolean().nullable(),
  timeValue: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
}).strict();
const saveDaySchema = z.object({
  pantryStatus: z.enum(SERVICE_PANTRY_STATUSES),
  entryState: z.enum(SERVICE_ENTRY_STATES),
  observations: z.array(dayObservationSchema).max(250),
}).strict();

const sendServiceError = (res: Parameters<Parameters<typeof router.get>[1]>[1], error: unknown) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: {
        code: 'INVALID_SERVICE_REQUEST',
        message: 'Check the Service fields and try again.',
        details: error.issues,
      },
    });
  }
  if (error instanceof ServiceLogError) {
    return res.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
    });
  }
  if (error instanceof ServiceFoundationError) {
    return res.status(400).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
  }
  return null;
};

router.get('/metrics', rateLimiter, requireAdmin, async (_req, res, next) => {
  try {
    return res.json({ metrics: await listServiceMetricConfigurations() });
  } catch (error) {
    return sendServiceError(res, error) ?? next(error);
  }
});

router.post('/metrics/wth-defaults', rateLimiter, requireAdmin, async (req, res, next) => {
  try {
    const result = await seedWthServiceConfiguration(req.auth?.userId ?? null);
    return res.status(result.metricsCreated > 0 || result.capacityPlanCreated ? 201 : 200).json(result);
  } catch (error) {
    return sendServiceError(res, error) ?? next(error);
  }
});

router.post('/metrics', rateLimiter, requireAdmin, async (req, res, next) => {
  try {
    const input = metricConfigurationSchema.parse(req.body);
    const metric = await createServiceMetricConfiguration(input, req.auth?.userId ?? null);
    return res.status(201).json({ metric });
  } catch (error) {
    return sendServiceError(res, error) ?? next(error);
  }
});

router.put('/metrics/:metricId', rateLimiter, requireAdmin, async (req, res, next) => {
  try {
    const metricId = metricIdSchema.parse(req.params.metricId);
    const input = updateMetricConfigurationSchema.parse(req.body);
    const revision = await updateServiceMetricConfiguration(metricId, input, req.auth?.userId ?? null);
    return res.json({ revision });
  } catch (error) {
    return sendServiceError(res, error) ?? next(error);
  }
});

router.get('/days/:serviceDate', rateLimiter, async (req, res, next) => {
  try {
    const serviceDate = localDate.parse(req.params.serviceDate);
    return res.json({ day: await getServiceDay(serviceDate) });
  } catch (error) {
    return sendServiceError(res, error) ?? next(error);
  }
});

router.put('/days/:serviceDate', rateLimiter, async (req, res, next) => {
  try {
    const serviceDate = localDate.parse(req.params.serviceDate);
    const input = saveDaySchema.parse(req.body);
    const day = await saveServiceDay(serviceDate, input, req.auth?.userId ?? null);
    return res.json({ day });
  } catch (error) {
    return sendServiceError(res, error) ?? next(error);
  }
});

export default router;
