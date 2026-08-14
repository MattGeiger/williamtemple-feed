// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { describe, expect, test, vi } from 'vitest';
import { listImportHistory } from '../../../src/services/data-import';

describe('unified import history projection', () => {
  test('combines durable procurement and Service provenance without combining facts', async () => {
    const client = {
      procurementImport: {
        findMany: vi.fn().mockResolvedValue([{
          id: 7,
          source: 'ofb',
          status: 'active',
          schemaVersion: 2,
          rowCount: 12,
          orderCount: 3,
          warningCount: 0,
          warnings: [],
          rangeStart: '2026-07-01',
          rangeEnd: '2026-07-03',
          importedAt: new Date('2026-08-10T18:00:00.000Z'),
          rolledBackAt: null,
          restoredAt: null,
          unifiedFileHash: 'same-upload',
          orders: [],
        }]),
      },
      serviceImport: {
        findMany: vi.fn().mockResolvedValue([{
          id: 4,
          source: 'simc',
          datasetKind: 'visits',
          status: 'active',
          schemaVersion: 1,
          rowCount: 27,
          warningCount: 2,
          warnings: [],
          rangeStart: '2026-08-01',
          rangeEnd: '2026-08-06',
          importedAt: new Date('2026-08-11T18:00:00.000Z'),
          rolledBackAt: null,
          restoredAt: null,
          _count: {
            encounters: 18,
            clientProfiles: 10,
            personProfiles: 21,
            metricObservations: 0,
            qualityIssues: 3,
          },
          qualityIssues: [
            { code: 'SIMC_MEMBER_COUNT_MISMATCH', severity: 'warning' },
            { code: 'SIMC_MEMBER_COUNT_MISMATCH', severity: 'warning' },
            { code: 'SIMC_REPEAT_VISIT_PATTERN', severity: 'info' },
          ],
        }]),
      },
    };

    const history = await listImportHistory(client as never);

    expect(history.map((record) => record.key)).toEqual(['service:4', 'procurement:7']);
    expect(history[0]).toMatchObject({
      domain: 'service',
      source: 'simc',
      sourceRowCount: 27,
      recordCount: 18,
      recordUnit: 'visits',
      warningCount: 2,
      details: {
        encounterRevisionCount: 18,
        qualityIssueCount: 3,
        qualityGroups: [
          { code: 'SIMC_MEMBER_COUNT_MISMATCH', severity: 'warning', count: 2 },
          { code: 'SIMC_REPEAT_VISIT_PATTERN', severity: 'info', count: 1 },
        ],
      },
    });
    expect(history[1]).toMatchObject({
      domain: 'procurement',
      source: 'ofb',
      recordCount: 3,
      recordUnit: 'events',
      relatedUploadKey: 'same-upload',
    });
  });

  test('requests only active or rolled-back durable history', async () => {
    const client = {
      procurementImport: { findMany: vi.fn().mockResolvedValue([]) },
      serviceImport: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await listImportHistory(client as never);

    expect(client.procurementImport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['active', 'rolled_back'] } },
    }));
    expect(client.serviceImport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['active', 'rolled_back'] } },
    }));
  });
});
