// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as crypto from 'crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import prisma from '../../db';
import {
  activateBrandConfiguration,
  brandAssetIds,
  deactivateBrandConfiguration,
  ensureBrandTemplates,
  previewBrandConfiguration,
  saveBrandConfiguration,
} from '../../services/brand-config';

const router = Router();
const MAX_BRAND_ASSET_BYTES = 4 * 1024 * 1024;
const ALLOWED_BRAND_ASSET_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BRAND_ASSET_BYTES, files: 1 } });

router.get('/', async (_req, res, next) => {
  try {
    await ensureBrandTemplates();
    const configurations = await prisma.brandConfiguration.findMany({ orderBy: [{ isTemplate: 'desc' }, { updatedAt: 'desc' }] });
    return res.json({ configurations, activeId: configurations.find((row) => row.isActive)?.id ?? null });
  } catch (error) { return next(error); }
});

router.post('/preview', async (req, res, next) => {
  try { return res.json({ preview: previewBrandConfiguration(req.body?.payload) }); }
  catch (error) { return next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    return res.json({ configuration: await saveBrandConfiguration(req.params.id, req.body?.payload, req.body?.activate === true) });
  } catch (error) { return next(error); }
});

router.post('/activate/:id', async (req, res, next) => {
  try { return res.json({ configuration: await activateBrandConfiguration(req.params.id) }); }
  catch (error) { return next(error); }
});

router.post('/deactivate', async (_req, res, next) => {
  try { await deactivateBrandConfiguration(); return res.json({ activeId: null }); }
  catch (error) { return next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const row = await prisma.brandConfiguration.findUnique({ where: { id: req.params.id } });
    if (!row || row.isTemplate) return res.status(404).json({ error: { message: 'Choose a saved appearance configuration to delete.', code: 'BRAND_CONFIGURATION_NOT_FOUND' } });
    if (row.isActive) return res.status(409).json({ error: { message: 'Activate another appearance or return to the built-in appearance before deleting this one.', code: 'ACTIVE_BRAND_CONFIGURATION' } });
    const otherConfigurations = await prisma.brandConfiguration.findMany({
      where: { id: { not: row.id } }, select: { payload: true },
    });
    const retained = new Set(otherConfigurations.flatMap((configuration) => [...brandAssetIds(configuration.payload)]));
    const unreferenced = [...brandAssetIds(row.payload)].filter((id) => !retained.has(id));
    await prisma.$transaction([
      prisma.brandConfiguration.delete({ where: { id: req.params.id } }),
      prisma.brandAsset.deleteMany({ where: { id: { in: unreferenced } } }),
    ]);
    return res.status(204).end();
  } catch (error) { return next(error); }
});

const storePng = async (buffer: Buffer, filename: string, width?: number, height?: number) => {
  const pipeline = sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate();
  const transformed = width && height
    ? pipeline.resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    : pipeline;
  const output = await transformed.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
  const id = crypto.randomUUID();
  await prisma.brandAsset.create({
    data: {
      id,
      filename: filename.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 160) || 'brand-image.png',
      mimeType: 'image/png', width: output.info.width, height: output.info.height,
      dataBase64: output.data.toString('base64'),
    },
  });
  return { kind: 'database' as const, id, width: output.info.width, height: output.info.height };
};

router.post('/assets', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: { message: 'Choose a PNG, JPEG, WebP, or SVG image to upload.', code: 'BRAND_ASSET_REQUIRED' } });
    if (!ALLOWED_BRAND_ASSET_TYPES.has(req.file.mimetype)) {
      return res.status(415).json({ error: { message: 'That file type is not supported. Upload a PNG, JPEG, WebP, or SVG image.', code: 'UNSUPPORTED_BRAND_ASSET_TYPE' } });
    }
    const kind = req.body?.kind;
    if (!['logo-light', 'logo-dark', 'square'].includes(kind)) return res.status(400).json({ error: { message: 'Choose which brand image this upload should replace.', code: 'INVALID_BRAND_ASSET_KIND' } });
    const metadata = await sharp(req.file.buffer, { failOn: 'error', limitInputPixels: 40_000_000 }).metadata();
    if (!metadata.width || !metadata.height) throw Object.assign(new Error('FEED could not read that image. Export it as PNG, JPEG, WebP, or SVG and try again.'), { statusCode: 400 });
    if (kind === 'square' && Math.max(metadata.width, metadata.height) / Math.min(metadata.width, metadata.height) > 1.2) {
      throw Object.assign(new Error('The app mark needs to be square. Crop it to a square and upload it again.'), { statusCode: 400 });
    }
    const asset = await storePng(req.file.buffer, req.file.originalname);
    const derivatives = kind === 'square'
      ? await Promise.all([64, 192, 512].map((size) => storePng(req.file!.buffer, `${size}-${req.file!.originalname}`, size, size)))
      : [];
    return res.status(201).json({ asset, derivatives });
  } catch (error) {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: { message: 'That image is larger than 4 MB. Export or compress a smaller copy and try again.', code: 'BRAND_ASSET_TOO_LARGE' } });
    return next(error);
  }
});

/**
 * Router-level translation of storage failures into ASK-compliant messages.
 *
 * Everything above delegates to `next(error)`, which reaches the global handler
 * and reports the deliberately generic internal-failure message. That is right
 * for an unknown fault and wrong for a knowable one: an un-migrated deployment
 * fails *every* appearance mutation, and answering "could not complete that
 * request" tells an administrator nothing they can act on. The remaining cases
 * still fall through, so this narrows the generic message rather than replacing
 * it.
 */
router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  const raw = error instanceof Error ? error.message : '';

  if (/does not exist in the current database|no such table/i.test(raw)) {
    return res.status(503).json({
      error: {
        message:
          'Appearance storage has not been set up on this deployment yet, so this could not be saved. Run the pending database migrations, then try again.',
        code: 'BRAND_STORAGE_UNAVAILABLE',
      },
    });
  }

  if (/UNIQUE constraint failed|Unique constraint/i.test(raw)) {
    return res.status(409).json({
      error: {
        message:
          'Another appearance is already active. Return to the built-in appearance first, then activate this one.',
        code: 'BRAND_CONFIGURATION_CONFLICT',
      },
    });
  }

  return next(error);
});

export default router;
