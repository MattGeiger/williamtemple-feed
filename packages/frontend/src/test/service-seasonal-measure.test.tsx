// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { ServiceAnalyticsWorkspace } from '@/components/analytics/service-analytics';
import type { ServiceAnalytics } from '@/services/service';

/**
 * Households by Season measures the same rows two ways.
 *
 * Households counts a household once a month however often it came; visits
 * counts every encounter. Nothing in the numbers says which question was
 * asked — 900 is 900 — so the card has to say it, and the two must not be
 * silently interchangeable.
 */

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);
Element.prototype.scrollIntoView = vi.fn();

const analytics = {
  coverage: {
    startDate: '2023-01-01',
    endDate: '2025-12-31',
    granularity: 'month',
    sources: [{ source: 'link2feed', firstDate: '2023-01-04', lastDate: '2025-12-20', encounters: 100 }],
    hasIntake: true,
    hasServiceLog: false,
    serviceLogFirstDate: null,
    serviceLogLastDate: null,
  },
  summary: {
    visits: 100, peopleServed: 250, identityUnavailableVisits: 7,
    bulkEntryVisits: 0, bulkEntryPeople: 0,
    households: 80, householdsSource: 'intake',
    methods: [], otherServices: [],
  },
  overTime: [],
  seasonal: {
    years: ['2023', '2024'],
    households: [
      { month: 'Jan', '2023': 5, '2024': 9 },
      { month: 'Feb', '2023': 6, '2024': 7 },
    ],
    visits: [
      { month: 'Jan', '2023': 41, '2024': 52 },
      { month: 'Feb', '2023': 43, '2024': 55 },
    ],
  },
  methodSeries: { granularity: 'month', methods: [], buckets: [] },
  recordAgreement: {
    sharedDays: 0, intakeTotal: 0, serviceLogTotal: 0,
    meanAbsoluteDailyDifference: 0, agreementPercent: 0,
  },
  unmetDemand: {
    granularity: 'month', buckets: [], householdsTurnedAway: 0,
    daysWithTurnAway: 0, daysRecorded: 0, capacityReachedDays: 0, firstRecordedDate: null,
  },
  languages: { values: [], householdsAsked: 0, householdsAnswered: 0 },
  responseCoverage: [],
  householdSize: [],
  reachAndFrequency: [],
} as unknown as ServiceAnalytics;

/** Scoped to the group, so a stray button elsewhere cannot satisfy the query. */
const measureButton = (name: 'Households' | 'Visits') =>
  within(screen.getByRole('group', { name: 'Measure' })).getByRole('button', { name });

describe('Households by Season measure toggle', () => {
  test('starts on households and says what that counts', () => {
    render(<ServiceAnalyticsWorkspace analytics={analytics} />);

    expect(screen.getByText('Households by Season')).toBeInTheDocument();
    expect(measureButton('Households')).toHaveAttribute('aria-pressed', 'true');
    expect(measureButton('Visits')).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByText(/one household visiting twice in a\s+month is counted once/)
    ).toBeInTheDocument();
  });

  test('switching to visits renames the card and changes what the footnote claims', () => {
    render(<ServiceAnalyticsWorkspace analytics={analytics} />);

    fireEvent.click(measureButton('Visits'));

    expect(screen.getByText('Visits by Season')).toBeInTheDocument();
    expect(measureButton('Visits')).toHaveAttribute('aria-pressed', 'true');

    // The claim has to flip with the data. Leaving "counted once" under a
    // visits chart would be the card lying about its own numbers.
    expect(screen.getByText(/one household visiting twice is counted\s+twice/)).toBeInTheDocument();
    expect(screen.queryByText(/counted once/)).not.toBeInTheDocument();
  });

  test('states which measure can see a visit with no household record', () => {
    render(<ServiceAnalyticsWorkspace analytics={analytics} />);

    // Households counts DISTINCT clientId, and an identity-unavailable visit
    // has none — so it is absent there and present in visits. Readers compared
    // the two and found them inconsistent; the card now explains why.
    expect(screen.getByText(/without a household record\s+are not counted here/)).toBeInTheDocument();

    fireEvent.click(measureButton('Visits'));
    expect(screen.getByText(/without a household record are included here/)).toBeInTheDocument();
  });

  test('the toggle is reachable as a labelled group', () => {
    render(<ServiceAnalyticsWorkspace analytics={analytics} />);
    const group = screen.getByRole('group', { name: 'Measure' });
    expect(within(group).getAllByRole('button')).toHaveLength(2);
  });
});
