// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { describe, expect, it } from 'vitest';
import {
  classifyLottoSummary,
  getLottoQueueAnalytics,
  listLottoQueueSessions,
  type LottoDailySummary,
} from '../../../src/services/service/lotto-queue';

const summary = (overrides: Partial<LottoDailySummary> = {}): LottoDailySummary => ({
  summaryId: 'summary-1', sessionId: 'session-1', revision: 1,
  supersedesSummaryId: null, contentHash: `sha256:${'a'.repeat(64)}`, isCurrent: true,
  serviceDate: '2026-08-20', serviceDateBasis: 'first_issue', timezone: 'America/Los_Angeles',
  sessionStartedAt: '2026-08-20T18:00:00.000Z', closedAt: '2026-08-20T21:00:00.000Z',
  recordedAt: '2026-08-20T21:00:00.100Z', mode: 'sequential', timingCoverage: 'complete',
  operatingWindow: { day: 'thursday', isOpen: true, openTime: '11:00', closeTime: '14:00' },
  ticketRange: { start: 1, end: 2 }, configuredCount: 2, issuedCount: 2, calledCount: 2,
  unclaimedCount: 0, returnedCount: 0, notCalledCount: 0, unpairedCallCount: 0,
  activitySignals: { allIssuedTicketsCalled: true, switchedRandomToSequential: true, appendedTickets: true },
  batches: [
    { sequence: 1, issuedAt: '2026-08-20T18:00:00.000Z', issuedCount: 1, mechanism: 'batch', mode: 'random' },
    { sequence: 2, issuedAt: '2026-08-20T19:00:00.000Z', issuedCount: 1, mechanism: 'append', mode: 'sequential' },
  ],
  ticketObservations: [
    { sequence: 1, batchSequence: 1, issuedAt: '2026-08-20T18:00:00.000Z', firstCalledAt: '2026-08-20T18:30:00.000Z', outcome: 'called' },
    { sequence: 2, batchSequence: 2, issuedAt: '2026-08-20T19:00:00.000Z', firstCalledAt: '2026-08-20T20:00:00.000Z', outcome: 'called' },
  ],
  ...overrides,
});

describe('LOTTO queue-session classification', () => {
  it('automatically includes a session only when all four strong signals are present', () => {
    expect(classifyLottoSummary(summary()).disposition).toBe('included_service');
    expect(classifyLottoSummary(summary({
      activitySignals: { allIssuedTicketsCalled: true, switchedRandomToSequential: true, appendedTickets: false },
    }))).toMatchObject({ disposition: 'needs_review' });
  });

  it('withholds activity outside the configured one-hour operating-hours margin', () => {
    const result = classifyLottoSummary(summary({
      sessionStartedAt: '2026-08-20T16:30:00.000Z',
      batches: [{ sequence: 1, issuedAt: '2026-08-20T16:30:00.000Z', issuedCount: 2, mechanism: 'full', mode: 'random' }],
      ticketObservations: [],
    }));
    expect(result.disposition).toBe('needs_review');
    expect(result.issues.map((issue) => issue.code)).toContain('activity_outside_operating_window');
  });

  it('does not carry a staff classification onto a corrected source revision', async () => {
    const source = summary({
      revision: 2,
      summaryId: 'summary-2',
      supersedesSummaryId: 'summary-1',
      contentHash: `sha256:${'b'.repeat(64)}`,
      activitySignals: {
        allIssuedTicketsCalled: true,
        switchedRandomToSequential: false,
        appendedTickets: false,
      },
    });
    const client = {
      lottoQueueSessionRevision: { findMany: async () => [{
        id: 2, ...source, source: 'lotto_api',
        sessionStartedAt: new Date(source.sessionStartedAt!),
        closedAt: new Date(source.closedAt), recordedAt: new Date(source.recordedAt),
        facts: source, initialDisposition: 'needs_review', rulesVersion: 1,
        importId: null, syncRunId: null, createdAt: new Date(), qualityIssues: [],
      }] },
      lottoQueueSessionResolution: { findMany: async () => [{
        id: 1, sessionId: source.sessionId, sourceRevision: 1, revision: 1,
        disposition: 'included_service', reason: 'Reviewed older facts',
        createdBy: 'staff', createdAt: new Date(),
      }] },
    };

    const [session] = await listLottoQueueSessions(client as never);
    expect(session.effectiveDisposition).toBe('needs_review');
    expect(session.latestResolution).toBeNull();
  });

  it('calculates serving intervals and the last call across the whole service day', async () => {
    const source = summary();
    const sessions = [1, 2].map((id) => ({
      id, ...source, summaryId: `summary-${id}`, sessionId: `session-${id}`,
      contentHash: `sha256:${String(id).repeat(64)}`, source: 'lotto_api',
      sessionStartedAt: new Date(source.sessionStartedAt!), closedAt: new Date(source.closedAt),
      recordedAt: new Date(source.recordedAt), operatingWindow: source.operatingWindow,
      facts: { ...source, summaryId: `summary-${id}`, sessionId: `session-${id}` },
      initialDisposition: 'included_service', rulesVersion: 1, importId: null,
      syncRunId: null, createdAt: new Date(), qualityIssues: [],
    }));
    const client = {
      lottoQueueSessionRevision: { findMany: async () => sessions },
      lottoQueueSessionResolution: { findMany: async () => [] },
      lottoQueueTicketObservation: { findMany: async () => [
        { sessionRevisionId: 1, issuedAt: new Date('2026-08-20T18:00:00Z'), firstCalledAt: new Date('2026-08-20T18:30:00Z') },
        { sessionRevisionId: 1, issuedAt: new Date('2026-08-20T18:00:00Z'), firstCalledAt: new Date('2026-08-20T19:00:00Z') },
        // Another closeout on the same service date repeats the final instant.
        { sessionRevisionId: 2, issuedAt: new Date('2026-08-20T18:30:00Z'), firstCalledAt: new Date('2026-08-20T19:00:00Z') },
      ] },
    };

    const analytics = await getLottoQueueAnalytics('2026-08-20', '2026-08-20', client as never);
    expect(analytics.historicalServingIntervalMinutes).toBe(30);
    expect(analytics.typicalLastCallLocalTime).toBe('12:00 PM');
  });
});
