// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { Router } from 'express';
import multer from 'multer';

import { auditActorFrom } from '../../middleware/auth/require-admin';
import { AdminAuditService } from '../../services/auth/admin-audit-service';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../services/auth/authorization';
import { readArtifact } from '../../services/restore/artifact-reader';
import { RestoreService } from '../../services/restore/restore-service';
import { CleanSlateService } from '../../services/seed/clean-slate-service';
import {
  RESTORE_UNITS,
  closeSelection,
  type UnitId,
} from '../../services/restore/restore-units';

/**
 * Restore endpoints. Mounted under the admin router, which already applies
 * `requireAdmin` to everything, so authority is settled before this file runs.
 *
 * Validation and execution are deliberately **two requests**. The administrator
 * sees what the file contains and what will be replaced before anything
 * happens, which is the difference between a confirmation and a dare. It also
 * means the expensive, irreversible path is only reachable from a state the
 * user explicitly confirmed.
 */

const router = Router();

/**
 * Sized against a real artifact, not against the database file.
 *
 * The instinct is to scale from the ~29MB SQLite file, and it is wrong by about
 * 4×: the same data exported as pretty-printed JSON measured **120MB**, driven
 * by ~121k procurement lines each carrying repeated key names. A 64MB cap —
 * the first guess here — would have rejected every real backup this instance
 * produces, and only a test with production-scale data caught it.
 *
 * 256MB leaves room for the procurement table to roughly double before this
 * needs revisiting.
 *
 * **This is the ceiling to watch.** The artifact is held in memory as a Buffer,
 * then a string, then a parsed object, so peak usage is several times the file
 * size. Past this point the fix is streaming the parse rather than a bigger
 * number — see docs/data-management/beta-6-backup-restore-brief.md.
 */
const MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ARTIFACT_BYTES, files: 1 },
});

/** GET /api/admin/restore/units — what a partial restore can select. */
router.get('/units', (_req, res) => {
  res.json({
    units: RESTORE_UNITS.map(unit => ({
      id: unit.id,
      label: unit.label,
      description: unit.description,
      requires: unit.requires,
    })),
  });
});

/**
 * POST /api/admin/restore/validate — inspect an artifact without touching data.
 *
 * Reads nothing from and writes nothing to the live database. A file that fails
 * here never reaches the restore path at all.
 */
router.post('/validate', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: { code: 'NO_FILE', message: 'Choose a backup file to upload.' },
    });
    return;
  }

  const result = readArtifact(req.file.buffer.toString('utf8'));

  if (!result.ok) {
    // 422, not 500: the request was well-formed, the file was not.
    res.status(422).json({ success: false, error: result.problem });
    return;
  }

  res.json({
    success: true,
    summary: {
      generatedAt: result.summary.manifest.generatedAt,
      generatedBy: result.summary.manifest.generatedBy,
      feedVersion: result.summary.manifest.feedVersion,
      tableContractVersion: result.summary.manifest.tableContractVersion,
      rowCounts: result.summary.manifest.rowCounts,
      availableUnits: result.summary.availableUnits,
      rowsByUnit: result.summary.rowsByUnit,
      notes: result.summary.notes,
    },
  });
});

/**
 * POST /api/admin/restore — build the replacement database and swap it in.
 *
 * Responds *before* the process exits, so the browser gets a result rather than
 * a dropped connection: the swap is complete by the time this returns, and the
 * exit is scheduled a moment later.
 */
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Choose a backup file to upload.' },
      });
      return;
    }

    const result = readArtifact(req.file.buffer.toString('utf8'));
    if (!result.ok) {
      res.status(422).json({ success: false, error: result.problem });
      return;
    }

    const requested = parseUnits(req.body?.units);
    if (!requested.length) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_UNITS',
          message: 'Choose at least one thing to restore.',
        },
      });
      return;
    }

    const available = new Set(result.summary.availableUnits);
    const missing = requested.filter(unit => !available.has(unit));
    if (missing.length) {
      res.status(422).json({
        success: false,
        error: {
          code: 'UNIT_NOT_IN_BACKUP',
          message: `That backup does not contain: ${missing.join(', ')}.`,
        },
      });
      return;
    }

    const { units } = closeSelection(requested);
    const actor = auditActorFrom(req);

    // Recorded before the swap so it lands in the pre-restore snapshot too.
    // The audit log is carried across in the rebuilt file, so the entry
    // survives the restore that produced it.
    await AdminAuditService.record({
      actor,
      action: AUDIT_ACTIONS.BACKUP_RESTORED,
      targetType: AUDIT_TARGET_TYPES.BACKUP,
      targetLabel: result.summary.manifest.generatedAt,
      detail: {
        units,
        checksum: result.summary.manifest.checksum,
        tableContractVersion: result.summary.manifest.tableContractVersion,
        generatedAt: result.summary.manifest.generatedAt,
      },
    });

    const outcome = await RestoreService.run({
      data: result.artifact.data,
      units,
      actor: actor.label,
      reason: 'Restoring a backup',
    });

    res.json({
      success: true,
      restored: {
        units,
        tables: outcome.restoredTables,
        rowsWritten: outcome.rowsWritten,
        backupTakenAt: result.summary.manifest.generatedAt,
      },
      // The UI uses this to switch to "FEED is restarting" and start polling.
      restarting: outcome.swapped,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/restore/reset — return the instance to a seeded state.
 *
 * Lives beside restore because it is the same machinery, and separate from it
 * because it is the opposite intent: restore recovers, reset discards. JSON
 * rather than multipart — there is no file, which is exactly why the
 * pre-swap snapshot is the only way back.
 */
router.post('/reset', async (req, res, next) => {
  try {
    const withExamples = req.body?.withExamples !== false;
    const clearRoster = req.body?.clearRoster === true;
    const actor = auditActorFrom(req);

    // Recorded before the swap. The audit log is carried across rather than
    // cleared, so the entry describing the reset survives the reset.
    await AdminAuditService.record({
      actor,
      action: AUDIT_ACTIONS.CLEAN_SLATE_APPLIED,
      targetType: AUDIT_TARGET_TYPES.DATABASE,
      targetLabel: withExamples ? 'clean slate with examples' : 'clean slate, structure only',
      detail: { withExamples, clearRoster },
    });

    const outcome = await CleanSlateService.run({
      withExamples,
      clearRoster,
      actor: actor.label,
    });

    res.json({
      success: true,
      reset: {
        withExamples,
        rosterCleared: outcome.rosterCleared,
        seeded: outcome.seeded,
        clearedTables: outcome.clearedTables.length,
      },
      restarting: outcome.swapped,
    });
  } catch (error) {
    next(error);
  }
});

const parseUnits = (raw: unknown): UnitId[] => {
  const known = new Set(RESTORE_UNITS.map(unit => unit.id as string));

  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];

  return list
    .map(value => String(value).trim())
    .filter(value => known.has(value)) as UnitId[];
};

export default router;
