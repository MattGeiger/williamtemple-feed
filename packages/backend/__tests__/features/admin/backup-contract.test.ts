// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  BACKUP_QUERY_ARGS,
  EXCLUDED_TABLES,
  INCLUDED_TABLES,
  REDACTED_COLUMNS,
  TABLE_CONTRACT_VERSION,
} from '../../../src/services/backup/table-contract';
import { checksumOf } from '../../../src/services/backup/sanitized-backup';

/**
 * The exclusion contract, enforced mechanically.
 *
 * docs/data-management/backup-and-restore.md says the artifact "will exclude at
 * minimum" key material, provider secrets, and authentication records. A prose
 * list cannot enforce itself: the realistic failure is not somebody deciding to
 * export `EncryptionKey`, it is somebody adding a table months from now and a
 * blanket export quietly picking it up — or an intended table quietly never
 * appearing.
 *
 * So every model in the schema must be named in exactly one of the two lists.
 * Adding a model without classifying it fails here.
 */

const schema = readFileSync(
  join(__dirname, '../../../prisma/schema.prisma'),
  'utf8'
);

const modelsInSchema = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(
  match => match[1]
);

describe('sanitized backup table contract', () => {
  it('classifies every model in the schema', () => {
    const classified = new Set<string>([
      ...INCLUDED_TABLES,
      ...Object.keys(EXCLUDED_TABLES),
    ]);

    const unclassified = modelsInSchema.filter(model => !classified.has(model));

    expect(
      unclassified,
      `Unclassified models: ${unclassified.join(', ')}. Add each to INCLUDED_TABLES ` +
        'or to EXCLUDED_TABLES with the reason it is left out — a new table must ' +
        'not drift into or out of backups by default.'
    ).toEqual([]);
  });

  it('names nothing that the schema does not define', () => {
    const known = new Set(modelsInSchema);
    const stale = [...INCLUDED_TABLES, ...Object.keys(EXCLUDED_TABLES)].filter(
      table => !known.has(table)
    );

    expect(stale, `Contract names tables that no longer exist: ${stale.join(', ')}`).toEqual([]);
  });

  it('never includes a table in both lists', () => {
    const both = INCLUDED_TABLES.filter(table => table in EXCLUDED_TABLES);
    expect(both).toEqual([]);
  });

  it('redacts secrets from tables it exports rather than dropping the table', () => {
    // Excluding AIConfiguration entirely (as beta.6 did) protected two columns
    // by discarding an administrator's model, cost, and rate configuration.
    expect(INCLUDED_TABLES).toContain('AIConfiguration');
    expect(EXCLUDED_TABLES).not.toHaveProperty('AIConfiguration');
    expect(REDACTED_COLUMNS.AIConfiguration).toEqual(['encryptedApiKey', 'salt']);
  });

  it('names redactions only for tables it actually exports', () => {
    // A redaction on an excluded or non-existent table is dead configuration
    // that reads as protection.
    for (const table of Object.keys(REDACTED_COLUMNS)) {
      expect(INCLUDED_TABLES, `${table} is redacted but not exported`).toContain(table);
    }
  });

  it('has bumped the contract version for operational observation clear revisions', () => {
    // Readers key on this, so a shape change that does not bump it is a silent
    // incompatibility.
    expect(TABLE_CONTRACT_VERSION).toBe(8);
  });

  it('keeps prepared Service imports outside the portable organization snapshot', () => {
    for (const table of [
      'ServiceImport',
      'ServiceClient',
      'ServicePerson',
      'ServiceEncounterRevision',
      'ServiceEncounterPerson',
      'ServiceClientProfileRevision',
      'ServiceClientProfileResponse',
      'ServicePersonProfileRevision',
      'ServicePersonProfileResponse',
      'ServiceQualityIssue',
      'ServiceQualityIssueDecision',
      'ServiceSourceResolution',
    ]) {
      expect(BACKUP_QUERY_ARGS).toHaveProperty(table);
    }
  });

  it('excludes every table that carries secrets or authority', () => {
    // Spelled out individually rather than as a loop: each of these is a
    // deliberate promise in backup-and-restore.md, and a failure should name
    // exactly which promise broke.
    expect(EXCLUDED_TABLES).toHaveProperty('EncryptionKey');
    expect(EXCLUDED_TABLES).toHaveProperty('VerificationToken');
    expect(EXCLUDED_TABLES).toHaveProperty('OtpFailure');
    // Authority: restoring these would restore access, not just data.
    expect(EXCLUDED_TABLES).toHaveProperty('User');
    expect(EXCLUDED_TABLES).toHaveProperty('AccessPolicy');
    expect(EXCLUDED_TABLES).toHaveProperty('AdminAuditLog');
  });

  it('gives a reason for every exclusion', () => {
    for (const [table, reason] of Object.entries(EXCLUDED_TABLES)) {
      expect(reason.length, `${table} has no reason recorded`).toBeGreaterThan(20);
    }
  });

  it('carries the organization data a pantry would need back', () => {
    for (const table of [
      'Category',
      'FoodItem',
      'Translation',
      'ShoppingListBuilderTemplate',
      'ProcurementImport',
      'ServiceEncounterRevision',
      'OperatingHoursRevision',
    ]) {
      expect(INCLUDED_TABLES).toContain(table);
    }
  });
});

describe('backup checksum', () => {
  it('is stable regardless of key order', () => {
    // Prisma does not guarantee column order across versions. If the checksum
    // depended on it, an unchanged database would produce a different digest
    // after an upgrade and the integrity check would be worthless.
    const a = { Category: [{ id: 1, name: 'Produce', sortOrder: 2 }] };
    const b = { Category: [{ sortOrder: 2, name: 'Produce', id: 1 }] };

    expect(checksumOf(a)).toBe(checksumOf(b));
  });

  it('changes when the data changes', () => {
    const before = { Category: [{ id: 1, name: 'Produce' }] };
    const after = { Category: [{ id: 1, name: 'Produce ' }] };

    expect(checksumOf(before)).not.toBe(checksumOf(after));
  });
});
