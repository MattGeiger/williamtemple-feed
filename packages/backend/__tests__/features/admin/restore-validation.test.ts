// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { describe, expect, it } from 'vitest';

import { readArtifact } from '../../../src/services/restore/artifact-reader';
import { checksumOf } from '../../../src/services/backup/sanitized-backup';
import {
  ARTIFACT_KIND,
  INCLUDED_TABLES,
  RESTORE_CLEARED_TABLES,
  TABLE_CONTRACT_VERSION,
} from '../../../src/services/backup/table-contract';
import {
  RESTORE_UNITS,
  closeSelection,
  tablesFor,
  type UnitId,
} from '../../../src/services/restore/restore-units';

/**
 * The validator is the only thing standing between an arbitrary uploaded file
 * and a process that replaces the live database. Everything it refuses, it must
 * refuse before anything touches disk — so these tests are exhaustive about the
 * refusals and specific about the reasons.
 */

const buildArtifact = (
  data: Record<string, unknown[]>,
  overrides: Record<string, unknown> = {}
) => {
  const rowCounts = Object.fromEntries(
    Object.entries(data).map(([table, rows]) => [table, rows.length])
  );

  return JSON.stringify({
    manifest: {
      artifact: ARTIFACT_KIND,
      tableContractVersion: TABLE_CONTRACT_VERSION,
      feedVersion: '1.5.0-beta.7',
      schemaVersion: '20260731000000_add_admin_roles_and_access_policy',
      generatedAt: '2026-08-04T00:00:00.000Z',
      generatedBy: 'tester',
      rowCounts,
      excluded: {},
      redacted: {},
      checksum: checksumOf(data),
      ...overrides,
    },
    data,
  });
};

const sampleData = {
  Category: [{ id: 1, name: 'Produce' }],
  Language: [{ id: 1, code: 'en' }],
};

describe('restore artifact validation', () => {
  it('accepts an artifact FEED produced', () => {
    const result = readArtifact(buildArtifact(sampleData));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.manifest.generatedBy).toBe('tester');
  });

  it('refuses a file that is not JSON', () => {
    const result = readArtifact('this is not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe('NOT_JSON');
  });

  it('refuses JSON that is not a FEED backup', () => {
    const result = readArtifact(JSON.stringify({ hello: 'world' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe('NOT_A_FEED_BACKUP');
  });

  it('refuses another tool\'s artifact that happens to have manifest and data', () => {
    const result = readArtifact(
      JSON.stringify({ manifest: { artifact: 'some-other-tool' }, data: {} })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe('NOT_A_FEED_BACKUP');
  });

  it('refuses a backup from a newer FEED, naming what to do', () => {
    const result = readArtifact(
      buildArtifact(sampleData, { tableContractVersion: TABLE_CONTRACT_VERSION + 1 })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe('CONTRACT_TOO_NEW');
    // The message has to tell an administrator what to do about it.
    expect(result.problem.message).toMatch(/Update FEED/i);
  });

  it('refuses a file edited after FEED wrote it', () => {
    // The realistic tampering case: someone opens the JSON and changes a value.
    const artifact = JSON.parse(buildArtifact(sampleData));
    artifact.data.Category[0].name = 'Tampered';
    // Row counts still line up, so only the checksum catches this.
    const result = readArtifact(JSON.stringify(artifact));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe('CHECKSUM_MISMATCH');
  });

  it('refuses an artifact whose row counts disagree with its manifest', () => {
    const data = { ...sampleData };
    const artifact = JSON.parse(buildArtifact(data));
    artifact.manifest.rowCounts.Category = 99;
    // Recompute the checksum so the row-count check is what fires, not the checksum.
    artifact.manifest.checksum = checksumOf(artifact.data);

    const result = readArtifact(JSON.stringify(artifact));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe('ROW_COUNT_MISMATCH');
  });

  it('refuses a data section that is not a list of records', () => {
    const result = readArtifact(
      JSON.stringify({
        manifest: { artifact: ARTIFACT_KIND, tableContractVersion: 2 },
        data: { Category: 'not an array' },
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe('MALFORMED_DATA');
  });

  it('reads a v1 artifact, noting the older format rather than refusing', () => {
    // v1 predates AIConfiguration being included, so it simply lacks that table.
    const result = readArtifact(buildArtifact(sampleData, { tableContractVersion: 1 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.notes.join(' ')).toMatch(/format 1/);
  });

  it('does not refuse on schemaVersion drift, which is provenance not a gate', () => {
    const result = readArtifact(
      buildArtifact(sampleData, { schemaVersion: 'some_much_older_migration' })
    );
    expect(result.ok).toBe(true);
  });

  it('reports which units the artifact can actually supply', () => {
    const result = readArtifact(buildArtifact(sampleData));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Category belongs to inventory; Language to languages. Nothing else is present.
    expect(result.summary.availableUnits).toContain('inventory');
    expect(result.summary.availableUnits).toContain('languages');
    expect(result.summary.availableUnits).not.toContain('procurement');
  });

  it('ignores unknown sections instead of refusing the whole file', () => {
    const result = readArtifact(
      buildArtifact({ ...sampleData, SomeFutureTable: [{ id: 1 }] })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.unknownTables).toEqual(['SomeFutureTable']);
  });
});

describe('restore units are closed under foreign keys', () => {
  it('pulls in languages when inventory is chosen', () => {
    // FoodItemTranslation points at Language; restoring inventory without it
    // would leave translations referencing languages that are not there.
    const { units, added } = closeSelection(['inventory']);
    expect(units).toContain('languages');
    expect(added).toEqual(['languages']);
  });

  it('pulls in inventory and languages when shopping lists are chosen', () => {
    // Section tables bind to categories and items.
    const { units } = closeSelection(['shoppingLists']);
    expect(units).toEqual(expect.arrayContaining(['shoppingLists', 'inventory', 'languages']));
  });

  it('leaves procurement independent', () => {
    // Procurement identity comes from natural keys, which is what makes
    // "add back last month's imports" a safe standalone operation.
    const { units, added } = closeSelection(['procurement']);
    expect(units).toEqual(['procurement']);
    expect(added).toEqual([]);
  });

  it('leaves Service independent', () => {
    // Service identity is source-scoped and does not point at Inventory or
    // Procurement, so its complete fact family is a standalone restore unit.
    const { units, added } = closeSelection(['service']);
    expect(units).toEqual(['service']);
    expect(added).toEqual([]);
  });

  it('reports nothing added when the user already chose the dependency', () => {
    const { added } = closeSelection(['inventory', 'languages']);
    expect(added).toEqual([]);
  });

  it('names only tables the backup actually exports', () => {
    // A unit naming a table absent from the artifact would silently restore
    // nothing for that part of the selection.
    for (const unit of RESTORE_UNITS) {
      for (const table of unit.tables) {
        expect(INCLUDED_TABLES, `${unit.id} names ${table}`).toContain(table);
      }
    }
  });

  /**
   * ISSUES.md #73. `UsageRecord` references `AIConfiguration` and `Translation`;
   * `ShoppingListInstance` references `ShoppingListTemplate`. All three are
   * excluded from the artifact, so they survive the scratch copy still pointing
   * at rows the restore deletes — and abort it with a foreign key error.
   */
  it('clears referencing telemetry only when its parents are being replaced', () => {
    const clearedFor = (units: UnitId[]): string[] => {
      const replaced = new Set(tablesFor(units));
      return Object.entries(RESTORE_CLEARED_TABLES)
        .filter(([, rule]) => rule.references.some(parent => replaced.has(parent)))
        .map(([table]) => table);
    };

    // Configuration replaces AIConfiguration; languages replaces Translation.
    expect(clearedFor(closeSelection(['configuration']).units)).toContain('UsageRecord');
    expect(clearedFor(closeSelection(['languages']).units)).toContain('UsageRecord');
    expect(clearedFor(closeSelection(['shoppingLists']).units)).toContain('ShoppingListInstance');

    // The workaround that unblocked the real restore: Service and Procurement
    // touch none of these parents, so nothing is cleared for them.
    expect(clearedFor(closeSelection(['service']).units)).toEqual([]);
    expect(clearedFor(closeSelection(['procurement']).units)).toEqual([]);

    // A full restore clears both.
    const everything = clearedFor(RESTORE_UNITS.map(u => u.id));
    expect(everything).toEqual(expect.arrayContaining(['UsageRecord', 'ShoppingListInstance']));
  });

  it('covers every exported table across all units', () => {
    // Otherwise a full restore would quietly skip a table that backup carries.
    const covered = new Set(tablesFor(RESTORE_UNITS.map(u => u.id)));
    const uncovered = INCLUDED_TABLES.filter(t => !covered.has(t));
    expect(uncovered).toEqual([]);
  });
});
