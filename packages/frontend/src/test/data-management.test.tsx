// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { DataManagementWorkspace } from '@/components/data-management';

// Rollback, restore, and rule authoring are administrator-only as of beta.5
// (ISSUES.md #50a). These tests exercise the workspace itself, so the role is
// mocked rather than provided — most cases assert the administrator view, and
// `mockRole` flips it for the staff case below.
const authState = { isAdministrator: true };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { name: 'admin', email: 'admin@williamtemple.org', role: 'ADMINISTRATOR', accessState: 'ALLOWED' },
    isAdministrator: authState.isAdministrator,
    checkSession: async () => {},
    logout: async () => {},
  }),
}));
import type {
  DataShapingCatalogEntry,
  DataShapingRule,
} from '@/types/procurement';
import type { ImportHistoryRecord } from '@/services/data-import';

const CATALOG: DataShapingCatalogEntry[] = [
  { flag: 'pass_through', family: 'exclusion', description: 'Relayed to another agency.' },
  { flag: 'other_exclusion', family: 'exclusion', description: 'Excluded for another reason.' },
  { flag: 'at_risk', family: 'annotation', description: 'Fragile arrangement.' },
  { flag: 'estimated', family: 'annotation', description: 'Lower-resolution data.' },
  { flag: 'program_bound', family: 'annotation', description: 'Time-limited program.' },
];

const shapingRule = (overrides: Partial<DataShapingRule> = {}): DataShapingRule => ({
  id: 1,
  flag: 'pass_through',
  scope: 'donor',
  donorName: 'New Seasons - Slabtown',
  donorCode: 'RNS16',
  productCode: null,
  orderRevisionId: null,
  source: null,
  startDate: null,
  endDate: null,
  enabled: true,
  note: 'Couriered to another agency; never our inventory.',
  createdBy: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
  ...overrides,
});

vi.mock('@/services/procurement', () => ({
  procurementService: {
    getStatus: vi.fn(() => Promise.resolve({
      hasData: true,
      latestDeliveryDate: '2026-05-01',
      daysSinceLatestDelivery: 74,
      isStale: true,
      staleAfterDays: 30,
      coverage: {
        warehouse: {
          eventCount: 2100,
          earliestDeliveryDate: '2009-01-05',
          latestDeliveryDate: '2026-05-01',
        },
        freshAlliance: {
          eventCount: 826,
          earliestDeliveryDate: '2023-06-01',
          latestDeliveryDate: '2026-04-18',
        },
      },
    })),
    rollbackImports: vi.fn(),
    restoreImports: vi.fn(),
    importOfbExport: vi.fn(),
    importLegacyLedger: vi.fn(),
    getRules: vi.fn(() => Promise.resolve({ rules: [], catalog: CATALOG })),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  },
}));

vi.mock('@/services/data-import', () => ({
  dataImportService: {
    getHistory: vi.fn(() => Promise.resolve([])),
    changeHistoryStatus: vi.fn(),
    upload: vi.fn(),
    decide: vi.fn(),
    activate: vi.fn(),
    cancel: vi.fn(),
  },
}));

const procurementHistory = (
  overrides: Partial<ImportHistoryRecord> & Pick<ImportHistoryRecord, 'id' | 'source'>,
): ImportHistoryRecord => {
  const { id, source, ...rest } = overrides;
  return ({
  key: `procurement:${id}`,
  id,
  domain: 'procurement',
  source,
  datasetKind: 'orders',
  status: 'active',
  schemaVersion: 1,
  sourceRowCount: 10,
  recordCount: 2,
  recordUnit: 'events',
  warningCount: 0,
  rangeStart: '2026-06-01',
  rangeEnd: '2026-06-02',
  importedAt: '2026-07-22T20:00:00.000Z',
  rolledBackAt: null,
  restoredAt: null,
  relatedUploadKey: null,
  details: { kind: 'procurement', warnings: [], orders: [] },
  ...rest,
} as ImportHistoryRecord);
};

const serviceHistory = (
  overrides: Partial<ImportHistoryRecord> & Pick<ImportHistoryRecord, 'id' | 'source'>,
): ImportHistoryRecord => {
  const { id, source, ...rest } = overrides;
  return ({
  key: `service:${id}`,
  id,
  domain: 'service',
  source,
  datasetKind: 'visits',
  status: 'active',
  schemaVersion: 1,
  sourceRowCount: 27,
  recordCount: 18,
  recordUnit: 'visits',
  warningCount: 2,
  rangeStart: '2026-08-01',
  rangeEnd: '2026-08-06',
  importedAt: '2026-08-11T20:00:00.000Z',
  rolledBackAt: null,
  restoredAt: null,
  relatedUploadKey: null,
  details: {
    kind: 'service',
    encounterRevisionCount: 18,
    clientProfileRevisionCount: 10,
    personProfileRevisionCount: 21,
    metricObservationRevisionCount: 0,
    qualityIssueCount: 3,
    qualityGroups: [{ code: 'SIMC_MEMBER_COUNT_MISMATCH', severity: 'warning', count: 2 }],
  },
  ...rest,
} as ImportHistoryRecord);
};

describe('Data Management', () => {
  test('uses the standard management table and surfaces stale procurement data', async () => {
    render(<DataManagementWorkspace />);

    expect(screen.getByRole('heading', { name: 'Data Management' })).toBeVisible();
    expect(await screen.findByText('Procurement data may be out of date')).toBeVisible();
    expect(screen.getByPlaceholderText('Filter imports...')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add Data' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Import OFB Data' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Import Legacy' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Source' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Records' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    expect(screen.getByTestId('pagination-controls')).toBeVisible();
  });
  test('reports each channel window separately without implying fault', async () => {
    render(<DataManagementWorkspace />);

    expect(await screen.findByText('OFB Warehouse')).toBeVisible();
    expect(screen.getByText('Fresh Food Alliance')).toBeVisible();

    // The windows differ because Fresh Alliance entry lags; both are stated
    // plainly rather than compared.
    // m/d/yyyy with no leading zeros, per lib/formatting/date.
    expect(screen.getByText('1/5/2009 – 5/1/2026')).toBeVisible();
    expect(screen.getByText('6/1/2023 – 4/18/2026')).toBeVisible();
    expect(screen.getByText('2,100 events')).toBeVisible();
    expect(screen.getByText('826 events')).toBeVisible();

    // A coverage gap measures available data-entry time, not performance, so
    // no surface may frame it as lateness or fault. See plan D12.
    for (const forbidden of [/overdue/i, /behind/i, /incomplete/i, /missing data/i, /failed to/i]) {
      expect(document.body.textContent).not.toMatch(forbidden);
    }
  });

  test('names the sibling row a unified upload produced, and only that row', async () => {
    const { dataImportService } = await import('@/services/data-import');
    vi.mocked(dataImportService.getHistory).mockResolvedValueOnce([
      procurementHistory({ id: 1, source: 'ofb', relatedUploadKey: 'hash-a' }),
      procurementHistory({ id: 2, source: 'ofb_pickup', relatedUploadKey: 'hash-a' }),
      // A standalone import (or one predating the column) shares no hash and
      // must not be labeled as paired with anything.
      procurementHistory({ id: 3, source: 'ofb', relatedUploadKey: null }),
    ]);

    render(<DataManagementWorkspace />);

    expect(await screen.findByText('Paired with OFB Agency Pickups')).toBeVisible();
    expect(screen.getByText('Paired with OFB Completed Orders')).toBeVisible();
    expect(screen.getAllByText(/Paired with/)).toHaveLength(2);
  });

  test('lists Service and procurement imports through one history contract', async () => {
    const { dataImportService } = await import('@/services/data-import');
    vi.mocked(dataImportService.getHistory).mockResolvedValueOnce([
      serviceHistory({ id: 1, source: 'link2feed', sourceRowCount: 78_308, recordCount: 78_308 }),
      serviceHistory({ id: 2, source: 'simc', sourceRowCount: 4_727, recordCount: 3_305 }),
      serviceHistory({
        id: 3,
        source: 'wth_tracking',
        datasetKind: 'operational_metrics',
        sourceRowCount: 1_114,
        recordCount: 1_114,
        recordUnit: 'observations',
      }),
      procurementHistory({ id: 4, source: 'legacy_community' }),
    ]);

    render(<DataManagementWorkspace />);

    expect(await screen.findByText('Link2Feed')).toBeVisible();
    expect(screen.getByText('SIMC')).toBeVisible();
    expect(screen.getByText('WTH Tracking')).toBeVisible();
    expect(screen.getByText('Community Donations (historical)')).toBeVisible();
    expect(screen.getByText('3,305 visits')).toBeVisible();
    expect(screen.getByText('1,114 observations')).toBeVisible();
  });
});

describe('Database tab visibility by role', () => {
  test('offers Analytics and Database to an administrator', async () => {
    render(<DataManagementWorkspace />);

    expect(await screen.findByRole('tab', { name: 'Analytics' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Database' })).toBeVisible();
  });

  test('shows staff the analytics content with no tab strip at all', async () => {
    authState.isAdministrator = false;
    try {
      render(<DataManagementWorkspace />);

      // The content is still there — staff lose the Database actions, not the page.
      expect(await screen.findByText('Data Rules')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Add Data' })).toBeVisible();

      // A single tab is chrome without a choice, so there is no tab strip.
      expect(screen.queryByRole('tablist')).toBeNull();
      expect(screen.queryByRole('tab', { name: 'Database' })).toBeNull();
    } finally {
      authState.isAdministrator = true;
    }
  });
});

describe('Data rules (D19/D20)', () => {
  test('invites a rule without inventing one, since only the agency knows its operation', async () => {
    render(<DataManagementWorkspace />);

    expect(await screen.findByText('Data Rules')).toBeVisible();
    expect(screen.getByText('No rules yet')).toBeVisible();
    // FEED ships no opinionated exclusions.
    expect(screen.getByRole('button', { name: /Add Rule/ })).toBeVisible();
  });

  test('shows staff what a rule does without offering to change it', async () => {
    const { procurementService } = await import('@/services/procurement');
    vi.mocked(procurementService.getRules).mockResolvedValueOnce({
      rules: [shapingRule()],
      catalog: CATALOG,
    });

    authState.isAdministrator = false;
    try {
      render(<DataManagementWorkspace />);

      // A rule changes what Analytics counts, so a staff member reading a total
      // has to be able to see that it is in force.
      expect(await screen.findByText('Data Rules')).toBeVisible();
      expect(screen.getByText('Active')).toBeVisible();

      // But authoring is the server's call to refuse, and the UI should not
      // offer an action that will come back 403.
      expect(screen.queryByRole('button', { name: /Add Rule/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Edit rule/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Delete rule/ })).toBeNull();
    } finally {
      authState.isAdministrator = true;
    }
  });

  test('restates a saved rule in plain language, with the reason it exists', async () => {
    const { procurementService } = await import('@/services/procurement');
    vi.mocked(procurementService.getRules).mockResolvedValueOnce({
      rules: [shapingRule()],
      catalog: CATALOG,
    });

    render(<DataManagementWorkspace />);

    expect(await screen.findByText(/Donations from New Seasons - Slabtown/)).toBeVisible();
    expect(screen.getByText(/code RNS16/)).toBeVisible();
    // The note carries the institutional knowledge the data cannot.
    expect(screen.getByText(/Couriered to another agency/)).toBeVisible();
  });

  test('states that exclusions are disclosed, never silently dropped', async () => {
    const { procurementService } = await import('@/services/procurement');
    vi.mocked(procurementService.getRules).mockResolvedValueOnce({
      rules: [shapingRule()],
      catalog: CATALOG,
    });

    render(<DataManagementWorkspace />);

    expect(await screen.findByText(/1 rule removes weight from supply totals/)).toBeVisible();
    expect(screen.getByText(/never silently dropped/)).toBeVisible();
  });

  test('shows a paused rule as paused rather than removing it from view', async () => {
    const { procurementService } = await import('@/services/procurement');
    vi.mocked(procurementService.getRules).mockResolvedValueOnce({
      rules: [shapingRule({ enabled: false })],
      catalog: CATALOG,
    });

    render(<DataManagementWorkspace />);

    expect(await screen.findByText('Paused')).toBeVisible();
  });

  test('describes a date-bounded rule with its window', async () => {
    const { procurementService } = await import('@/services/procurement');
    vi.mocked(procurementService.getRules).mockResolvedValueOnce({
      rules: [shapingRule({
        flag: 'program_bound',
        scope: 'date_range',
        donorName: null,
        donorCode: null,
        startDate: '2020-05-01',
        endDate: '2021-05-31',
        note: null,
      })],
      catalog: CATALOG,
    });

    render(<DataManagementWorkspace />);

    expect(
      await screen.findByText(/Everything received between 2020-05-01 and 2021-05-31/)
    ).toBeVisible();
  });
});

describe('Legacy community import (D22: a single-agency sidecar)', () => {
  test('uses the single Add Data action for OFB and historical procurement files', async () => {
    render(<DataManagementWorkspace />);

    expect(await screen.findByRole('button', { name: /Add Data/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Import OFB Data/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Import Legacy/ })).toBeNull();
  });

  test('names the legacy source without dressing it up as an OFB export', async () => {
    const { dataImportService } = await import('@/services/data-import');
    vi.mocked(dataImportService.getHistory).mockResolvedValueOnce([
      procurementHistory({
        id: 9,
        source: 'legacy_community',
        sourceRowCount: 596,
        recordCount: 550,
        rangeStart: '2016-10-01',
        rangeEnd: '2023-05-01',
        importedAt: '2026-07-23T20:00:00.000Z',
      }),
    ]);

    render(<DataManagementWorkspace />);

    expect(await screen.findByText('Community Donations (historical)')).toBeVisible();
  });
});
