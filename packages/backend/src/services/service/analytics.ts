// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { PrismaClient } from '@prisma/client';
import prisma from '../../db';
import { getOperatingHoursSettings } from '../operating-hours';
import { resolveRange, type AnalyticsRangePreset } from '../inventory-analytics/timezone';

/**
 * Service Analytics — the third lens, beside Operations and Procurement.
 *
 * Two evidence layers overlap in time here and answer different questions:
 *
 * - **Formal intake** (Link2Feed through 2026-05-28, SIMC from 2026-06-02) is
 *   authoritative for how many households were served.
 * - **Operational tracking** (WTH's own record, from 2023-10-17) is
 *   authoritative for *how* that service was delivered.
 *
 * They are never added together. Every accessor below returns one layer or the
 * other, except `recordAgreement`, which deliberately reports them side by side
 * as two independent measurements of the same days — a comparison, not a sum.
 *
 * Design decisions recorded in docs/reports/service-analytics-card-proposal.md.
 */

/** Methods that count against WTH's two-visits-per-month household limit. */
export const LIMIT_COUNTING_METHODS = ['shopping_visits', 'long_lists'] as const;
/** Methods deliberately outside that limit. */
export const UNLIMITED_METHODS = ['premade_bags', 'emergency_bags'] as const;
export const SERVICE_METHOD_KEYS = [...LIMIT_COUNTING_METHODS, ...UNLIMITED_METHODS];

/**
 * Bulk staff counts entered as a single household because Link2Feed offered no
 * bulk-entry control. They are people tallies with no household identity, so
 * they are excluded from every household-grained measure — most importantly any
 * average household size, which a single 264-person row would wreck.
 */
const HOUSEHOLD_KINDS = ['identified_household_encounter', 'identity_unavailable_encounter'];

export interface ServiceAnalyticsFilters {
  preset: AnalyticsRangePreset;
  startDate?: string;
  endDate?: string;
}

export interface ServiceAnalytics {
  coverage: {
    startDate: string;
    endDate: string;
    sources: Array<{ source: string; firstDate: string; lastDate: string; encounters: number }>;
  };
  summary: {
    visits: number;
    households: number;
    peopleReported: number;
    identityUnavailableVisits: number;
    bulkEntryVisits: number;
    bulkEntryPeople: number;
  };
  overTime: Array<{
    month: string;
    source: string;
    visits: number;
    households: number;
    peopleReported: number;
  }>;
  reachAndFrequency: Array<{
    year: string;
    households: number;
    visits: number;
    visitsPerHousehold: number;
    newHouseholds: number;
  }>;
  methodMix: Array<{
    month: string;
    shoppingVisits: number;
    longLists: number;
    premadeBags: number;
    emergencyBags: number;
  }>;
  recordAgreement: {
    months: Array<{ month: string; days: number; formal: number; operational: number }>;
    sharedDays: number;
    formalTotal: number;
    operationalTotal: number;
    meanAbsoluteDailyDifference: number;
  };
  householdSize: Array<{ people: number; visits: number }>;
}

const round = (value: number, places = 2): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export async function getServiceAnalytics(
  filters: ServiceAnalyticsFilters,
  client: PrismaClient = prisma,
): Promise<ServiceAnalytics> {
  // The preset is resolved here, against the organization's timezone and the
  // earliest service date on record, exactly as procurement analytics resolves
  // its own — so "All" and "Last 90 days" mean one thing across every lens.
  const settings = await getOperatingHoursSettings(client as never);
  const earliest = await client.serviceEncounterRevision.aggregate({
    where: { isCurrent: true },
    _min: { serviceDate: true },
  });
  const resolved = resolveRange(
    filters.preset,
    settings.timezone,
    new Date(),
    filters.preset === 'custom' && filters.startDate && filters.endDate
      ? { startDate: filters.startDate, endDate: filters.endDate }
      : undefined,
    earliest._min.serviceDate ?? undefined,
  );
  const { startDate, endDate } = resolved;
  const kinds = HOUSEHOLD_KINDS;

  // Coverage is reported per source rather than as one span, because the two
  // formal sources meet at a cutover and a single blended range would hide it.
  const coverageRows = await client.$queryRaw<Array<{
    source: string; firstDate: string; lastDate: string; encounters: bigint;
  }>>`
    SELECT "source", MIN("serviceDate") AS "firstDate", MAX("serviceDate") AS "lastDate",
           COUNT(*) AS "encounters"
    FROM "ServiceEncounterRevision"
    WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ${startDate} AND ${endDate}
    GROUP BY "source" ORDER BY MIN("serviceDate")`;

  const summaryRows = await client.$queryRaw<Array<{
    visits: bigint; households: bigint; peopleReported: number | null;
    identityUnavailable: bigint; bulkVisits: bigint; bulkPeople: number | null;
  }>>`
    SELECT
      SUM(CASE WHEN "recordKind" IN ('identified_household_encounter','identity_unavailable_encounter') THEN 1 ELSE 0 END) AS "visits",
      COUNT(DISTINCT "clientId") AS "households",
      SUM(COALESCE("reportedPeopleCount", 0)) AS "peopleReported",
      SUM(CASE WHEN "recordKind" = 'identity_unavailable_encounter' THEN 1 ELSE 0 END) AS "identityUnavailable",
      SUM(CASE WHEN "recordKind" = 'special_event_people_aggregate' THEN 1 ELSE 0 END) AS "bulkVisits",
      SUM(CASE WHEN "recordKind" = 'special_event_people_aggregate' THEN COALESCE("reportedPeopleCount",0) ELSE 0 END) AS "bulkPeople"
    FROM "ServiceEncounterRevision"
    WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ${startDate} AND ${endDate}`;

  const overTimeRows = await client.$queryRaw<Array<{
    month: string; source: string; visits: bigint; households: bigint; peopleReported: number | null;
  }>>`
    SELECT substr("serviceDate", 1, 7) AS "month", "source",
           COUNT(*) AS "visits",
           COUNT(DISTINCT "clientId") AS "households",
           SUM(COALESCE("reportedPeopleCount", 0)) AS "peopleReported"
    FROM "ServiceEncounterRevision"
    WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ${startDate} AND ${endDate}
      AND "recordKind" IN (${kinds[0]}, ${kinds[1]})
    GROUP BY "month", "source" ORDER BY "month", "source"`;

  // A household is "new" the first time it is seen ANYWHERE in the record, not
  // the first time inside the selected range — otherwise narrowing the range
  // would relabel long-standing households as new.
  const reachRows = await client.$queryRaw<Array<{
    year: string; households: bigint; visits: bigint; newHouseholds: bigint;
  }>>`
    WITH firstSeen AS (
      SELECT "clientId", MIN("serviceDate") AS "firstDate"
      FROM "ServiceEncounterRevision"
      WHERE "isCurrent" = 1 AND "clientId" IS NOT NULL
      GROUP BY "clientId")
    SELECT substr(e."serviceDate", 1, 4) AS "year",
           COUNT(DISTINCT e."clientId") AS "households",
           COUNT(*) AS "visits",
           COUNT(DISTINCT CASE WHEN substr(f."firstDate",1,4) = substr(e."serviceDate",1,4)
                               THEN e."clientId" END) AS "newHouseholds"
    FROM "ServiceEncounterRevision" e
    LEFT JOIN firstSeen f ON f."clientId" = e."clientId"
    WHERE e."isCurrent" = 1 AND e."serviceDate" BETWEEN ${startDate} AND ${endDate}
      AND e."recordKind" IN (${kinds[0]}, ${kinds[1]})
    GROUP BY "year" ORDER BY "year"`;

  const methodRows = await client.$queryRaw<Array<{
    month: string; metricKey: string; total: number | null;
  }>>`
    SELECT substr(o."serviceDate", 1, 7) AS "month", d."metricKey", SUM(COALESCE(o."countValue",0)) AS "total"
    FROM "ServiceMetricObservationRevision" o
    JOIN "ServiceMetricDefinition" d ON d."id" = o."metricId"
    WHERE o."isCurrent" = 1 AND o."serviceDate" BETWEEN ${startDate} AND ${endDate}
      AND d."metricKey" IN ('shopping_visits','long_lists','premade_bags','emergency_bags')
    GROUP BY "month", d."metricKey" ORDER BY "month"`;

  // Only days where BOTH records exist. A day the spreadsheet never covered is
  // not a day the two disagree on.
  const agreementRows = await client.$queryRaw<Array<{
    serviceDate: string; formal: bigint; operational: number | null;
  }>>`
    WITH formal AS (
      SELECT "serviceDate", COUNT(*) AS "formal"
      FROM "ServiceEncounterRevision"
      WHERE "isCurrent" = 1 AND "recordKind" IN (${kinds[0]}, ${kinds[1]})
      GROUP BY "serviceDate"),
    operational AS (
      SELECT o."serviceDate", SUM(COALESCE(o."countValue",0)) AS "operational"
      FROM "ServiceMetricObservationRevision" o
      JOIN "ServiceMetricDefinition" d ON d."id" = o."metricId"
      WHERE o."isCurrent" = 1
        AND d."metricKey" IN ('shopping_visits','long_lists','premade_bags','emergency_bags')
      GROUP BY o."serviceDate")
    SELECT f."serviceDate", f."formal", o."operational"
    FROM formal f JOIN operational o ON o."serviceDate" = f."serviceDate"
    WHERE f."serviceDate" BETWEEN ${startDate} AND ${endDate}
    ORDER BY f."serviceDate"`;

  const sizeRows = await client.$queryRaw<Array<{ people: number; visits: bigint }>>`
    SELECT "reportedPeopleCount" AS "people", COUNT(*) AS "visits"
    FROM "ServiceEncounterRevision"
    WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ${startDate} AND ${endDate}
      AND "recordKind" = 'identified_household_encounter'
      AND "reportedPeopleCount" IS NOT NULL
    GROUP BY "reportedPeopleCount" ORDER BY "reportedPeopleCount"`;

  const summary = summaryRows[0];
  const methodByMonth = new Map<string, ServiceAnalytics['methodMix'][number]>();
  for (const row of methodRows) {
    const entry = methodByMonth.get(row.month)
      ?? { month: row.month, shoppingVisits: 0, longLists: 0, premadeBags: 0, emergencyBags: 0 };
    const value = Number(row.total ?? 0);
    if (row.metricKey === 'shopping_visits') entry.shoppingVisits = value;
    if (row.metricKey === 'long_lists') entry.longLists = value;
    if (row.metricKey === 'premade_bags') entry.premadeBags = value;
    if (row.metricKey === 'emergency_bags') entry.emergencyBags = value;
    methodByMonth.set(row.month, entry);
  }

  const agreementByMonth = new Map<string, { month: string; days: number; formal: number; operational: number }>();
  let absoluteDifference = 0;
  let formalTotal = 0;
  let operationalTotal = 0;
  for (const row of agreementRows) {
    const month = row.serviceDate.slice(0, 7);
    const formal = Number(row.formal);
    const operational = Number(row.operational ?? 0);
    const entry = agreementByMonth.get(month) ?? { month, days: 0, formal: 0, operational: 0 };
    entry.days += 1;
    entry.formal += formal;
    entry.operational += operational;
    agreementByMonth.set(month, entry);
    absoluteDifference += Math.abs(operational - formal);
    formalTotal += formal;
    operationalTotal += operational;
  }

  return {
    coverage: {
      startDate,
      endDate,
      sources: coverageRows.map((row) => ({
        source: row.source,
        firstDate: row.firstDate,
        lastDate: row.lastDate,
        encounters: Number(row.encounters),
      })),
    },
    summary: {
      visits: Number(summary?.visits ?? 0),
      households: Number(summary?.households ?? 0),
      peopleReported: Number(summary?.peopleReported ?? 0),
      identityUnavailableVisits: Number(summary?.identityUnavailable ?? 0),
      bulkEntryVisits: Number(summary?.bulkVisits ?? 0),
      bulkEntryPeople: Number(summary?.bulkPeople ?? 0),
    },
    overTime: overTimeRows.map((row) => ({
      month: row.month,
      source: row.source,
      visits: Number(row.visits),
      households: Number(row.households),
      peopleReported: Number(row.peopleReported ?? 0),
    })),
    reachAndFrequency: reachRows.map((row) => {
      const households = Number(row.households);
      const visits = Number(row.visits);
      return {
        year: row.year,
        households,
        visits,
        visitsPerHousehold: households > 0 ? round(visits / households) : 0,
        newHouseholds: Number(row.newHouseholds),
      };
    }),
    methodMix: [...methodByMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
    recordAgreement: {
      months: [...agreementByMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
      sharedDays: agreementRows.length,
      formalTotal,
      operationalTotal,
      meanAbsoluteDailyDifference: agreementRows.length > 0
        ? round(absoluteDifference / agreementRows.length, 1)
        : 0,
    },
    householdSize: sizeRows.map((row) => ({ people: Number(row.people), visits: Number(row.visits) })),
  };
}
