// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AddDataDialog } from '@/components/data-management/add-data/add-data-dialog';
import { SIMC_SERVICE_VISIT_ALLOWED_HEADERS } from '@/components/data-management/add-data/source-contracts';

const link2FeedFixture = readFileSync(
  resolve(process.cwd(), 'src/test/fixtures/add-data/link2feed-visits-with-extra-columns.csv'),
  'utf8',
);

const reviewJob = {
  id: 'clz1234567890123456789012',
  contractId: 'link2feed_visits_v1',
  domain: 'service',
  source: 'link2feed',
  datasetKind: 'visits',
  status: 'ready',
  fileSizeBytes: 716,
  recognizedFieldCount: 23,
  ignoredFieldCount: 4,
  totalRows: 1,
  processedRows: 1,
  warningCount: 0,
  unresolvedIssueCount: 0,
  activationOutcome: null,
  errorCode: null,
  errorMessage: null,
  reviewIssues: [],
  reviewSummary: {
    adapterVersion: 1,
    rowCount: 1,
    rangeStart: '2025-01-10',
    rangeEnd: '2025-01-10',
    identifiedEncounterCount: 1,
    identityUnavailableEncounterCount: 0,
    uniqueIdentifiedClientCount: 1,
    reportedPeopleCount: 2,
    clientVisitStatus: { first: 1, returning: 0, unknown: 0 },
    qualityIssueCount: 0,
    blockingIssueCount: 0,
    warningCount: 0,
    autoResolvedIssueCount: 0,
    unresolvedIssueCount: 0,
    reconciliation: {
      encounters: { new: 1, revised: 0, unchanged: 0 },
      profiles: { new: 1, revised: 0, unchanged: 0, unavailable: 0 },
    },
  },
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const simcFixture = [
  [...SIMC_SERVICE_VISIT_ALLOWED_HEADERS, 'Neighbor First Name'].join(','),
  [...SIMC_SERVICE_VISIT_ALLOWED_HEADERS.map(() => ''), 'Private'].join(','),
].join('\n');

const trackingFixture = readFileSync(
  resolve(process.cwd(), 'src/test/fixtures/add-data/wth-service-tracking.csv'),
  'utf8',
);

const ofbFixture = readFileSync(
  resolve(process.cwd(), 'src/test/fixtures/add-data/ofb-unified.csv'),
  'utf8',
);

const legacyFixture = [
  'calendar_year,month_num,month,source_canonical,disposition,in_ofb,weight_pounds,source_as_written,fiscal_year,source_file,caveat',
  '2023,1,January,Community donations,received,false,125,Community donations,FY2023,ledger.csv,',
].join('\n');

describe('Add Data workflow', () => {
  test('routes a unified OFB export through the established procurement importer', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({
      result: {
        outcome: 'imported',
        rowCount: 1,
        rangeStart: '2026-08-04',
        rangeEnd: '2026-08-04',
        warehouse: {
          outcome: 'imported',
          importId: 21,
          rowCount: 1,
          orderCount: 1,
          skippedOrderCount: 0,
          warningCount: 0,
          rangeStart: '2026-08-04',
          rangeEnd: '2026-08-04',
          warnings: [],
        },
        freshAlliance: null,
      },
    }, 201));
    const onImported = vi.fn();

    render(<AddDataDialog open onOpenChange={() => {}} onImported={onImported} />);
    expect(screen.getByRole('link', { name: 'Download the exporter' }))
      .toHaveAttribute('href', '/downloads/OFB-Order-CSV-Exporter-v2.0.0.zip');
    fireEvent.change(screen.getByLabelText('Choose data file'), {
      target: { files: [new File([ofbFixture], 'ofb-unified.csv', { type: 'text/csv' })] },
    });

    expect(await screen.findByText('OFB unified order export')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import Data' }));

    expect(await screen.findByText('OFB data imported')).toBeVisible();
    expect(screen.getByText(/1 row · 1 warehouse order · 0 pickups/)).toBeVisible();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/procurement/imports'),
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    expect(onImported).toHaveBeenCalledOnce();
    fetchSpy.mockRestore();
  });

  test('routes the WTH historical ledger through its existing sidecar importer', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({
      result: {
        outcome: 'imported',
        importId: 22,
        rowCount: 1,
        monthCount: 1,
        skippedMonthCount: 0,
        totalWeightHundredths: 12500,
        rangeStart: '2023-01-01',
        rangeEnd: '2023-01-01',
        sourceCount: 1,
      },
    }, 201));

    render(<AddDataDialog open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Choose data file'), {
      target: { files: [new File([legacyFixture], 'historical-donations.csv', { type: 'text/csv' })] },
    });

    expect(await screen.findByText('WTH historical community-donation ledger')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import Data' }));

    expect(await screen.findByText('Historical donations imported')).toBeVisible();
    expect(screen.getByText(/1 month · 125 lb/)).toBeVisible();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/procurement/imports/legacy'),
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    fetchSpy.mockRestore();
  });

  test('keeps Service imports administrator-only without hiding Add Data from staff', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<AddDataDialog open onOpenChange={() => {}} isAdministrator={false} />);

    fireEvent.change(screen.getByLabelText('Choose data file'), {
      target: {
        files: [new File([link2FeedFixture], 'link2feed-visits.csv', { type: 'text/csv' })],
      },
    });
    expect(await screen.findByText('Link2Feed visit export')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText(/Administrator access is required to import Service data/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Validate and Review' })).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test('detects locally, reviews the Link2Feed plan, and activates through the unified endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ job: reviewJob }, 201))
      .mockResolvedValueOnce(jsonResponse({
        result: {
          outcome: 'imported',
          value: {
            importId: 12,
            encounterRevisionCount: 1,
            profileRevisionCount: 1,
            qualityIssueCount: 0,
          },
        },
        job: { ...reviewJob, status: 'completed', activationOutcome: 'imported' },
      }, 201));
    render(<AddDataDialog open onOpenChange={() => {}} />);

    const input = screen.getByLabelText('Choose data file');
    fireEvent.change(input, {
      target: {
        files: [new File([link2FeedFixture], 'link2feed-visits.csv', { type: 'text/csv' })],
      },
    });

    expect(await screen.findByText('Link2Feed visit export')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('4 unrecognized columns will be ignored.')).toBeVisible();
    expect(screen.queryByText(/What FEED will do/)).toBeNull();

    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Validate and Review' }));
    expect(await screen.findByText('Ready to activate')).toBeVisible();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/data-import/jobs'),
      expect.objectContaining({ method: 'POST', body: expect.any(File) }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Activate Data' }));
    expect(await screen.findByText('Link2Feed data activated')).toBeVisible();
    expect(screen.getByText(/1 encounter revision and 1 client profile/)).toBeVisible();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    fetchSpy.mockRestore();
  });

  test('reviews SIMC in household, visit, and people language', async () => {
    const simcJob = {
      ...reviewJob,
      id: 'clz1234567890123456789013',
      contractId: 'simc_service_visits_v1',
      source: 'simc',
      recognizedFieldCount: SIMC_SERVICE_VISIT_ALLOWED_HEADERS.length,
      ignoredFieldCount: 1,
      totalRows: 2,
      processedRows: 2,
      warningCount: 1,
      reviewSummary: {
        adapterVersion: 1,
        rawRowCount: 2,
        visitCount: 1,
        rangeStart: '2026-06-02',
        rangeEnd: '2026-06-02',
        serviceDateCount: 1,
        eventCount: 1,
        identifiedHouseholdCount: 1,
        identifiedPersonCount: 1,
        reportedPeopleCount: 2,
        memberRowCount: 1,
        memberCoveragePercent: 50,
        visitsWithMemberCountMismatch: 1,
        netMissingMemberRows: 1,
        householdDatePairsWithMultipleVisits: 0,
        demographicCoverage: {},
        qualityIssueCount: 1,
        warningCount: 1,
        unresolvedIssueCount: 0,
        reconciliation: {
          encounters: { new: 1, revised: 0, unchanged: 0 },
          householdProfiles: { new: 1, revised: 0, unchanged: 0, unavailable: 0 },
          personProfiles: { new: 1, revised: 0, unchanged: 0 },
        },
      },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ job: simcJob }, 201))
      .mockResolvedValueOnce(jsonResponse({
        result: {
          outcome: 'imported',
          value: {
            importId: 13,
            encounterRevisionCount: 1,
            profileRevisionCount: 1,
            personProfileRevisionCount: 1,
            encounterPersonCount: 1,
            qualityIssueCount: 1,
          },
        },
        job: { ...simcJob, status: 'completed', activationOutcome: 'imported' },
      }, 201));

    render(<AddDataDialog open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Choose data file'), {
      target: { files: [new File([simcFixture], 'simc-service.csv', { type: 'text/csv' })] },
    });
    expect(await screen.findByText('SIMC service visit export')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Validate and Review' }));

    expect(await screen.findByText('Household-member coverage')).toBeVisible();
    expect(screen.getByText(/1 household · 1 identified person · 2 people represented/)).toBeVisible();
    expect(screen.getByText(/formal people totals remain unchanged/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Activate Data' }));
    expect(await screen.findByText('SIMC data activated')).toBeVisible();
    expect(screen.getByText(/1 visit revision, 1 household profile, and 1 person profile/)).toBeVisible();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    fetchSpy.mockRestore();
  });

  test('reviews WTH Tracking as operational detail without replacing formal totals', async () => {
    const trackingJob = {
      ...reviewJob,
      id: 'clz1234567890123456789014',
      contractId: 'wth_service_tracking_v1',
      source: 'wth_tracking',
      datasetKind: 'operational_metrics',
      recognizedFieldCount: 10,
      ignoredFieldCount: 0,
      reviewSummary: {
        adapterVersion: 2,
        rowCount: 1,
        serviceDateCount: 1,
        rangeStart: '2026-08-04',
        rangeEnd: '2026-08-04',
        metricCounts: { shopping_visits: 1 },
        explicitZeroCount: 0,
        regularHouseholdCount: 70,
        emergencyBagCount: 0,
        operationalHouseholdCount: 70,
        turnedAwayHouseholdCount: 0,
        campingGearRequestCount: 0,
        capacityReachedDayCount: 0,
        qualityIssueCount: 0,
        warningCount: 0,
        unresolvedIssueCount: 0,
        reconciliation: { observations: { new: 1, revised: 0, unchanged: 0 } },
        formalReconciliation: {
          overlapDateCount: 1,
          incompleteRegularMethodDateCount: 0,
          exactRegularMatchDateCount: 0,
          formalHouseholdCount: 72,
          regularOperationalHouseholdCount: 70,
          allOperationalHouseholdCount: 70,
          regularDifference: -2,
          allOperationalDifference: -2,
          meanAbsoluteDailyRegularDifference: 2,
        },
      },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ job: trackingJob }, 201))
      .mockResolvedValueOnce(jsonResponse({
        result: {
          outcome: 'imported',
          value: { importId: 14, metricObservationRevisionCount: 1, qualityIssueCount: 0 },
        },
        job: { ...trackingJob, status: 'completed', activationOutcome: 'imported' },
      }, 201));

    render(<AddDataDialog open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Choose data file'), {
      target: { files: [new File([trackingFixture], 'wth-tracking.csv', { type: 'text/csv' })] },
    });
    expect(await screen.findByText('WTH service-tracking export')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Validate and Review' }));

    expect(await screen.findByText('Metric observations')).toBeVisible();
    expect(screen.getByText(/70 regular-method households/)).toBeVisible();
    expect(screen.getByText(/remain operational detail/)).toBeVisible();
    expect(screen.getByText(/Regular methods are 2 lower overall/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Activate Data' }));
    expect(await screen.findByText('WTH Tracking data activated')).toBeVisible();
    expect(screen.getByText(/1 historical metric observation revision/)).toBeVisible();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    fetchSpy.mockRestore();
  });
});
