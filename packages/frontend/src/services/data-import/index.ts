// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { BaseApiService } from '@/services/base';
import type { ProcurementOrderSummary, ProcurementWarning } from '@/types/procurement';

export type ImportHistoryDomain = 'procurement' | 'service';
export type ImportHistoryStatus = 'active' | 'rolled_back';

interface ImportHistoryBase {
  key: string;
  id: number;
  domain: ImportHistoryDomain;
  source: string;
  datasetKind: string;
  status: ImportHistoryStatus;
  schemaVersion: number;
  sourceRowCount: number;
  recordCount: number;
  recordUnit: 'events' | 'visits' | 'observations' | 'profiles' | 'records';
  warningCount: number;
  rangeStart: string | null;
  rangeEnd: string | null;
  importedAt: string;
  rolledBackAt: string | null;
  restoredAt: string | null;
  relatedUploadKey: string | null;
}

export interface ProcurementImportHistoryRecord extends ImportHistoryBase {
  domain: 'procurement';
  datasetKind: 'orders';
  details: {
    kind: 'procurement';
    warnings: ProcurementWarning[];
    orders: ProcurementOrderSummary[];
  };
}

export interface ServiceImportHistoryRecord extends ImportHistoryBase {
  domain: 'service';
  details: {
    kind: 'service';
    encounterRevisionCount: number;
    clientProfileRevisionCount: number;
    personProfileRevisionCount: number;
    metricObservationRevisionCount: number;
    qualityIssueCount: number;
    qualityGroups: Array<{ code: string; severity: string; count: number }>;
  };
}

export type ImportHistoryRecord = ProcurementImportHistoryRecord | ServiceImportHistoryRecord;

export type Link2FeedReviewAction = 'apply_source_resolution' | 'keep_source_interpretation';

export interface DataImportReviewDecision {
  revision: number;
  action: Link2FeedReviewAction;
  recordKind: string | null;
  reportedHouseholdCount: number | null;
  reportedPeopleCount: number | null;
  eventLabel: string | null;
  reason: string;
  createdAt: string;
}

export interface DataImportReviewIssue {
  id: number;
  code: string;
  severity: 'info' | 'warning' | 'blocking';
  requiresDecision: boolean;
  field: string | null;
  safeDetails: {
    rowNumber?: number;
    serviceDate?: string;
    observedCount?: number;
    expectedMaximum?: number;
    recordKind?: string;
  };
  createdAt: string;
  decisions: DataImportReviewDecision[];
}

export interface Link2FeedReviewSummary {
  adapterVersion: number;
  rowCount: number;
  rangeStart: string;
  rangeEnd: string;
  identifiedEncounterCount: number;
  identityUnavailableEncounterCount: number;
  uniqueIdentifiedClientCount: number;
  reportedPeopleCount: number;
  clientVisitStatus: { first: number; returning: number; unknown: number };
  qualityIssueCount: number;
  blockingIssueCount: number;
  warningCount: number;
  autoResolvedIssueCount: number;
  unresolvedIssueCount: number;
  reconciliation: {
    encounters: { new: number; revised: number; unchanged: number };
    profiles: { new: number; revised: number; unchanged: number; unavailable: number };
  };
}

export interface SimcReviewSummary {
  adapterVersion: number;
  rawRowCount: number;
  visitCount: number;
  rangeStart: string;
  rangeEnd: string;
  serviceDateCount: number;
  eventCount: number;
  identifiedHouseholdCount: number;
  identifiedPersonCount: number;
  reportedPeopleCount: number;
  memberRowCount: number;
  memberCoveragePercent: number;
  visitsWithMemberCountMismatch: number;
  netMissingMemberRows: number;
  householdDatePairsWithMultipleVisits: number;
  qualityIssueCount: number;
  warningCount: number;
  unresolvedIssueCount: number;
  demographicCoverage: Record<string, { provided: number; notProvided: number }>;
  reconciliation: {
    encounters: { new: number; revised: number; unchanged: number };
    householdProfiles: { new: number; revised: number; unchanged: number; unavailable: number };
    personProfiles: { new: number; revised: number; unchanged: number };
  };
}

export interface WthTrackingReviewSummary {
  adapterVersion: number;
  rowCount: number;
  serviceDateCount: number;
  rangeStart: string;
  rangeEnd: string;
  metricCounts: Record<string, number>;
  explicitZeroCount: number;
  regularHouseholdCount: number;
  emergencyBagCount: number;
  operationalHouseholdCount: number;
  turnedAwayHouseholdCount: number;
  campingGearRequestCount: number;
  capacityReachedDayCount: number;
  qualityIssueCount: number;
  warningCount: number;
  unresolvedIssueCount: number;
  reconciliation: {
    observations: { new: number; revised: number; unchanged: number };
  };
  formalReconciliation: {
    overlapDateCount: number;
    incompleteRegularMethodDateCount: number;
    exactRegularMatchDateCount: number;
    formalHouseholdCount: number;
    regularOperationalHouseholdCount: number;
    allOperationalHouseholdCount: number;
    regularDifference: number;
    allOperationalDifference: number;
    meanAbsoluteDailyRegularDifference: number;
  };
}

export interface DataImportJobReview {
  id: string;
  contractId: string | null;
  domain: string | null;
  source: string | null;
  datasetKind: string | null;
  status: 'awaiting_review' | 'ready' | 'activating' | 'completed' | 'failed' | 'cancelled' | string;
  fileSizeBytes: number;
  recognizedFieldCount: number;
  ignoredFieldCount: number;
  totalRows: number | null;
  processedRows: number;
  warningCount: number;
  unresolvedIssueCount: number;
  reviewSummary: Link2FeedReviewSummary | SimcReviewSummary | WthTrackingReviewSummary | null;
  activationOutcome: 'imported' | 'no_op' | null;
  errorCode: string | null;
  errorMessage: string | null;
  reviewIssues: DataImportReviewIssue[];
}

export interface DataImportActivationResult {
  outcome: 'imported' | 'no_op';
  value: {
    importId: number | null;
    encounterRevisionCount: number;
    profileRevisionCount: number;
    personProfileRevisionCount?: number;
    encounterPersonCount?: number;
    metricObservationRevisionCount?: number;
    qualityIssueCount: number;
  };
}

class DataImportApiService extends BaseApiService {
  constructor() {
    super('/api/data-import');
  }

  async getHistory(): Promise<ImportHistoryRecord[]> {
    const response = await this.get<{ imports: ImportHistoryRecord[] }>('/history');
    return response.imports;
  }

  async changeHistoryStatus(
    mode: 'rollback' | 'restore',
    imports: Array<{ domain: ImportHistoryDomain; id: number }>,
  ): Promise<number> {
    const response = await this.post<{ result: { updated: number } }>(
      '/history/lifecycle',
      { mode, imports },
    );
    return response.result.updated;
  }

  async upload(file: File): Promise<DataImportJobReview> {
    const response = await this.request<{ job: DataImportJobReview }>('/jobs', {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': file.type === 'application/csv' ? file.type : 'text/csv' },
    });
    return response.job;
  }

  async decide(
    jobId: string,
    issueId: number,
    input: { action: Link2FeedReviewAction; reason: string; eventLabel?: string },
  ): Promise<DataImportJobReview> {
    const response = await this.post<{ job: DataImportJobReview }>(
      `/jobs/${jobId}/issues/${issueId}/decision`,
      input,
    );
    return response.job;
  }

  async activate(jobId: string): Promise<{
    result: DataImportActivationResult;
    job: DataImportJobReview;
  }> {
    return this.post(`/jobs/${jobId}/activate`);
  }

  async cancel(jobId: string): Promise<void> {
    await this.delete(`/jobs/${jobId}`);
  }
}

export const dataImportService = new DataImportApiService();
