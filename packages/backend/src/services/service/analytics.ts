// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { PrismaClient } from '@prisma/client';
import prisma from '../../db';
import { getOperatingHoursSettings } from '../operating-hours';
import { resolveRange, type AnalyticsRangePreset } from '../inventory-analytics/timezone';

/**
 * Service Analytics — the third lens, beside Operations and Procurement.
 *
 * Two records describe the same pantry days and are treated as complementary,
 * not as authority and commentary:
 *
 * - **Formal intake** (Link2Feed through 2026-05-28, SIMC after) is the
 *   client-grained record: household sizes, demographics, repeat visits.
 * - **The Service Log** is WTH's own end-of-day record, entered by staff. It is
 *   the more complete count of what happened, because it covers days and
 *   households that intake missed.
 *
 * Neither is subordinate. They are never summed with each other, and where both
 * can answer a question the Service Log is preferred, because a hand-counted
 * total does not depend on every client completing intake.
 *
 * Metric grouping is driven by each metric's own `semanticRole` and
 * `contributesToOperationalTotal` flags rather than by hardcoded keys, so a
 * metric added later in Service Metrics administration lands in the right group
 * without a code change — and `unmet_demand` can never be counted as a service
 * delivered.
 */

/**
 * Bulk staff counts entered as one household because Link2Feed offered no
 * bulk-entry control. People tallies with no household identity, so they are
 * excluded from every household-grained measure — a single 264-person row would
 * wreck any household average.
 */
const HOUSEHOLD_KINDS = ['identified_household_encounter', 'identity_unavailable_encounter'];

export type ServiceBucketGranularity = 'day' | 'week' | 'month';

export interface ServiceAnalyticsFilters {
  preset: AnalyticsRangePreset;
  startDate?: string;
  endDate?: string;
}

export interface ServiceMethodDefinition {
  metricKey: string;
  displayName: string;
  unit: string;
  /** Administrator-configured icon, so the interface never keeps its own list. */
  iconName: string;
  /** First date this metric was recorded with a non-zero value, if ever. */
  firstRecordedDate?: string | null;
}

export interface ServiceAnalytics {
  coverage: {
    startDate: string;
    endDate: string;
    granularity: ServiceBucketGranularity;
    sources: Array<{ source: string; firstDate: string; lastDate: string; encounters: number }>;
    hasIntake: boolean;
    hasServiceLog: boolean;
    /**
     * The Service Log's own span inside the range. It begins later than intake
     * — WTH started keeping it in October 2023 — so a figure drawn from it can
     * cover less than the range asked for, and the card has to say so rather
     * than presenting a short count as a whole-range total.
     */
    serviceLogFirstDate: string | null;
    serviceLogLastDate: string | null;
  };
  summary: {
    visits: number;
    peopleServed: number;
    identityUnavailableVisits: number;
    bulkEntryVisits: number;
    bulkEntryPeople: number;
    /** Households served, and which record produced the figure. */
    households: number;
    householdsSource: 'service_log' | 'intake' | 'none';
    /** Service Log method totals, in the order staff administer them. */
    methods: Array<ServiceMethodDefinition & { households: number }>;
    /** Ancillary services and requests, aggregated by semantic role. */
    /** Ancillary metrics reported individually, each with its own unit. */
    otherServices: Array<ServiceMethodDefinition & { total: number }>;
  };
  /** One row per service DAY. `month` retains its name as the axis key. */
  overTime: Array<{
    month: string;
    /** Null where the record does not cover the day — the line breaks there. */
    link2feedHouseholds: number | null;
    link2feedIndividuals: number | null;
    simcHouseholds: number | null;
    simcIndividuals: number | null;
    serviceLogHouseholds: number | null;
  }>;
  /** Households by calendar month, one key per year — for the seasonal plot. */
  seasonal: {
    years: string[];
    months: Array<Record<string, string | number>>;
  };
  methodSeries: {
    granularity: ServiceBucketGranularity;
    methods: ServiceMethodDefinition[];
    buckets: Array<Record<string, string | number>>;
  };
  recordAgreement: {
    sharedDays: number;
    intakeTotal: number;
    serviceLogTotal: number;
    meanAbsoluteDailyDifference: number;
    agreementPercent: number;
  };
  householdSize: Array<{ people: number; visits: number }>;
  reachAndFrequency: Array<{
    year: string;
    households: number;
    visits: number;
    visitsPerHousehold: number;
  }>;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const round = (value: number, places = 2): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/**
 * A service day is the unit staff work and record in, so short ranges stay
 * daily. Over a year or more the daily shape stops being readable: WTH runs a
 * hundred-household Thursday against a Friday backpack session serving five,
 * and that real swing renders as noise once hundreds of points are on screen.
 * Anything past a quarter is therefore monthly.
 */
const MONTHLY_THRESHOLD_DAYS = 90;

const granularityFor = (
  preset: AnalyticsRangePreset,
  startDate: string,
  endDate: string,
): ServiceBucketGranularity => {
  if (preset === 'ytd' || preset === 'all') return 'month';
  if (preset !== 'custom') return 'day';
  const days = Math.round(
    (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
  ) + 1;
  return days > MONTHLY_THRESHOLD_DAYS ? 'month' : 'day';
};

/** SQL producing the bucket key for a `serviceDate` column. */
const bucketExpression = (granularity: ServiceBucketGranularity, column: string): string => {
  if (granularity === 'day') return column;
  // Monday-start weeks, so a bucket never splits a Tuesday-to-Thursday service
  // week across two points.
  if (granularity === 'week') {
    return `date(${column}, '-' || ((strftime('%w', ${column}) + 6) % 7) || ' days')`;
  }
  return `substr(${column}, 1, 7)`;
};

export async function getServiceAnalytics(
  filters: ServiceAnalyticsFilters,
  client: PrismaClient = prisma,
): Promise<ServiceAnalytics> {
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
  const granularity = granularityFor(filters.preset, startDate, endDate);
  const kinds = HOUSEHOLD_KINDS;

  // Current definition revision per metric, carrying the flags that decide
  // which group each metric belongs to.
  const definitions = await client.$queryRaw<Array<{
    metricKey: string; displayName: string; unit: string;
    iconName: string;
    semanticRole: string;
    // SQLite stores this as 0/1 but Prisma hydrates the column's declared
    // Boolean type, so it arrives as a boolean — comparing it to 1 silently
    // matched nothing and emptied every Service Log group.
    contributesToOperationalTotal: boolean;
    displayOrder: number;
  }>>`
    SELECT d."metricKey", r."displayName", r."unit", r."semanticRole",
           r."iconName", r."contributesToOperationalTotal", r."displayOrder"
    FROM "ServiceMetricDefinition" d
    JOIN "ServiceMetricDefinitionRevision" r
      ON r."id" = (SELECT "id" FROM "ServiceMetricDefinitionRevision"
                   WHERE "metricId" = d."id" ORDER BY "revision" DESC LIMIT 1)
    ORDER BY r."displayOrder"`;

  const methodDefinitions = definitions.filter((row) =>
    row.semanticRole === 'served_household_method' && Boolean(row.contributesToOperationalTotal));
  const ancillaryDefinitions = definitions.filter((row) => row.semanticRole === 'ancillary_service');
  const methodKeys = methodDefinitions.map((row) => row.metricKey);
  const ancillaryKeys = ancillaryDefinitions.map((row) => row.metricKey);

  // Prisma's tagged template cannot expand an array into an IN list, so the key
  // lists are turned into placeholders. The values still travel as bound
  // parameters — only the placeholder count is assembled from a length.
  const inList = (keys: string[]) => keys.map(() => '?').join(', ');

  const metricTotals = methodKeys.length + ancillaryKeys.length === 0
    ? []
    : await client.$queryRawUnsafe<Array<{ metricKey: string; total: number | null }>>(
      `SELECT d."metricKey", SUM(COALESCE(o."countValue", 0)) AS "total"
       FROM "ServiceMetricObservationRevision" o
       JOIN "ServiceMetricDefinition" d ON d."id" = o."metricId"
       WHERE o."isCurrent" = 1 AND o."serviceDate" BETWEEN ? AND ?
         AND d."metricKey" IN (${inList([...methodKeys, ...ancillaryKeys])})
       GROUP BY d."metricKey"`,
      startDate, endDate, ...methodKeys, ...ancillaryKeys,
    );

  const totalFor = (key: string) =>
    Number(metricTotals.find((row) => row.metricKey === key)?.total ?? 0);

  const serviceLogSpan = methodKeys.length === 0 ? [] :
    await client.$queryRawUnsafe<Array<{ firstDate: string | null; lastDate: string | null }>>(
      `SELECT MIN(o."serviceDate") AS "firstDate", MAX(o."serviceDate") AS "lastDate"
       FROM "ServiceMetricObservationRevision" o
       JOIN "ServiceMetricDefinition" d ON d."id" = o."metricId"
       WHERE o."isCurrent" = 1 AND d."metricKey" IN (${inList(methodKeys)})`,
      ...methodKeys,
    );

  // When each method was first recorded, so a card can say "this began in
  // November 2025" from the data instead of a hardcoded sentence that goes
  // stale the moment a program changes.
  const methodStarts = methodKeys.length === 0 ? [] :
    await client.$queryRawUnsafe<Array<{ metricKey: string; firstDate: string }>>(
      `SELECT d."metricKey", MIN(o."serviceDate") AS "firstDate"
       FROM "ServiceMetricObservationRevision" o
       JOIN "ServiceMetricDefinition" d ON d."id" = o."metricId"
       WHERE o."isCurrent" = 1 AND o."countValue" > 0
         AND d."metricKey" IN (${inList(methodKeys)})
       GROUP BY d."metricKey"`,
      ...methodKeys,
    );

  const sourceSpans = await client.$queryRaw<Array<{
    source: string; firstDate: string; lastDate: string;
  }>>`
    SELECT "source", MIN("serviceDate") AS "firstDate", MAX("serviceDate") AS "lastDate"
    FROM "ServiceEncounterRevision" WHERE "isCurrent" = 1 GROUP BY "source"`;

  const coverageRows = await client.$queryRaw<Array<{
    source: string; firstDate: string; lastDate: string; encounters: bigint;
  }>>`
    SELECT "source", MIN("serviceDate") AS "firstDate", MAX("serviceDate") AS "lastDate",
           COUNT(*) AS "encounters"
    FROM "ServiceEncounterRevision"
    WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ${startDate} AND ${endDate}
    GROUP BY "source" ORDER BY MIN("serviceDate")`;

  const summaryRows = await client.$queryRaw<Array<{
    visits: bigint; intakeHouseholds: bigint; peopleServed: number | null;
    identityUnavailable: bigint; bulkVisits: bigint; bulkPeople: number | null;
  }>>`
    SELECT
      SUM(CASE WHEN "recordKind" IN ('identified_household_encounter','identity_unavailable_encounter') THEN 1 ELSE 0 END) AS "visits",
      COUNT(DISTINCT "clientId") AS "intakeHouseholds",
      -- Every recorded person, bulk-event tallies included. Those tallies are
      -- excluded from household counts because a crowd entered as one row is
      -- not a household, but the people in it were served.
      SUM(COALESCE("reportedPeopleCount", 0)) AS "peopleServed",
      SUM(CASE WHEN "recordKind" = 'identity_unavailable_encounter' THEN 1 ELSE 0 END) AS "identityUnavailable",
      SUM(CASE WHEN "recordKind" = 'special_event_people_aggregate' THEN 1 ELSE 0 END) AS "bulkVisits",
      SUM(CASE WHEN "recordKind" = 'special_event_people_aggregate' THEN COALESCE("reportedPeopleCount",0) ELSE 0 END) AS "bulkPeople"
    FROM "ServiceEncounterRevision"
    WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ${startDate} AND ${endDate}`;

  const overTimeRows = await client.$queryRawUnsafe<Array<{
    month: string; source: string; households: bigint; individuals: number | null;
  }>>(
    `SELECT ${bucketExpression(granularity, '"serviceDate"')} AS "month", "source",
            COUNT(*) AS "households",
            SUM(COALESCE("reportedPeopleCount", 0)) AS "individuals"
     FROM "ServiceEncounterRevision"
     WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ? AND ?
       AND "recordKind" IN (?, ?)
     GROUP BY "month", "source" ORDER BY "month", "source"`,
    startDate, endDate, kinds[0], kinds[1],
  );

  const serviceLogMonthly = methodKeys.length === 0 ? [] :
    await client.$queryRawUnsafe<Array<{ month: string; households: number | null }>>(
      `SELECT ${bucketExpression(granularity, 'o."serviceDate"')} AS "month",
              SUM(COALESCE(o."countValue",0)) AS "households"
       FROM "ServiceMetricObservationRevision" o
       JOIN "ServiceMetricDefinition" d ON d."id" = o."metricId"
       WHERE o."isCurrent" = 1 AND o."serviceDate" BETWEEN ? AND ?
         AND d."metricKey" IN (${inList(methodKeys)})
       GROUP BY "month" ORDER BY "month"`,
      startDate, endDate, ...methodKeys,
    );

  // Seasonal comparison uses per-month distinct households, which is sound even
  // though a whole-range distinct count is not: a client holds one profile per
  // system, and only one system is live in any given month.
  const seasonalRows = await client.$queryRaw<Array<{
    year: string; monthIndex: string; households: bigint;
  }>>`
    SELECT substr("serviceDate", 1, 4) AS "year",
           substr("serviceDate", 6, 2) AS "monthIndex",
           COUNT(DISTINCT "clientId") AS "households"
    FROM "ServiceEncounterRevision"
    WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ${startDate} AND ${endDate}
      AND "recordKind" IN (${kinds[0]}, ${kinds[1]})
    GROUP BY "year", "monthIndex" ORDER BY "year", "monthIndex"`;

  const bucketSql = bucketExpression(granularity, 'o."serviceDate"');
  const methodSeriesRows = methodKeys.length === 0 ? [] :
    await client.$queryRawUnsafe<Array<{ bucket: string; metricKey: string; total: number | null }>>(
      `SELECT ${bucketSql} AS "bucket", d."metricKey", SUM(COALESCE(o."countValue",0)) AS "total"
       FROM "ServiceMetricObservationRevision" o
       JOIN "ServiceMetricDefinition" d ON d."id" = o."metricId"
       WHERE o."isCurrent" = 1 AND o."serviceDate" BETWEEN ? AND ?
         AND d."metricKey" IN (${inList(methodKeys)})
       GROUP BY "bucket", d."metricKey" ORDER BY "bucket"`,
      startDate, endDate, ...methodKeys,
    );

  const agreementRows = methodKeys.length === 0 ? [] :
    await client.$queryRawUnsafe<Array<{ serviceDate: string; intake: number; serviceLog: number | null }>>(
      `WITH intake AS (
         SELECT "serviceDate", COUNT(*) AS "intake"
         FROM "ServiceEncounterRevision"
         WHERE "isCurrent" = 1
           AND "recordKind" IN ('identified_household_encounter','identity_unavailable_encounter')
         GROUP BY "serviceDate"),
       logged AS (
         SELECT o."serviceDate", SUM(COALESCE(o."countValue",0)) AS "serviceLog"
         FROM "ServiceMetricObservationRevision" o
         JOIN "ServiceMetricDefinition" d ON d."id" = o."metricId"
         WHERE o."isCurrent" = 1 AND d."metricKey" IN (${inList(methodKeys)})
         GROUP BY o."serviceDate")
       SELECT i."serviceDate", i."intake", l."serviceLog"
       FROM intake i JOIN logged l ON l."serviceDate" = i."serviceDate"
       WHERE i."serviceDate" BETWEEN ? AND ?`,
      ...methodKeys, startDate, endDate,
    );

  const sizeRows = await client.$queryRaw<Array<{ people: number; visits: bigint }>>`
    SELECT "reportedPeopleCount" AS "people", COUNT(*) AS "visits"
    FROM "ServiceEncounterRevision"
    WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ${startDate} AND ${endDate}
      AND "recordKind" = 'identified_household_encounter'
      AND "reportedPeopleCount" IS NOT NULL
    GROUP BY "reportedPeopleCount" ORDER BY "reportedPeopleCount"`;

  const reachRows = await client.$queryRaw<Array<{
    year: string; households: bigint; visits: bigint;
  }>>`
    SELECT substr("serviceDate", 1, 4) AS "year",
           COUNT(DISTINCT "clientId") AS "households",
           COUNT(*) AS "visits"
    FROM "ServiceEncounterRevision"
    WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ${startDate} AND ${endDate}
      AND "recordKind" = 'identified_household_encounter'
    GROUP BY "year" ORDER BY "year"`;

  // ---- assemble ----------------------------------------------------------
  const summary = summaryRows[0];
  const methods = methodDefinitions.map((row) => ({
    metricKey: row.metricKey,
    displayName: row.displayName,
    unit: row.unit,
    iconName: row.iconName,
    households: totalFor(row.metricKey),
  }));
  const serviceLogHouseholds = methods.reduce((total, row) => total + row.households, 0);
  const intakeHouseholds = Number(summary?.intakeHouseholds ?? 0);
  const visits = Number(summary?.visits ?? 0);

  // The Service Log is preferred for households served. A whole-range distinct
  // count over intake profiles overstates the client base, because the
  // Link2Feed-to-SIMC changeover gave returning clients a second profile — the
  // same person, counted twice. The hand-entered daily count has no such
  // duplication. Intake is the fallback only where the Service Log is silent.
  const householdsSource: 'service_log' | 'intake' | 'none' =
    serviceLogHouseholds > 0 ? 'service_log' : intakeHouseholds > 0 ? 'intake' : 'none';

  const spanOf = (source: string) => sourceSpans.find((row) => row.source === source);
  const l2fSpan = spanOf('link2feed');
  const simcSpan = spanOf('simc');
  // A bucket key is a date at day granularity and a "YYYY-MM" prefix at month
  // granularity, so span bounds are truncated to the same width before
  // comparison. Comparing "2020-10" against "2020-10-19" as strings would place
  // the bucket before its own span and blank out the record's first month.
  const toBucket = (date: string) => (granularity === 'month' ? date.slice(0, 7) : date);
  const within = (span: { firstDate: string; lastDate: string } | undefined, bucket: string) =>
    Boolean(span && bucket >= toBucket(span.firstDate) && bucket <= toBucket(span.lastDate));

  const monthly = new Map<string, ServiceAnalytics['overTime'][number]>();
  // Null inside a record's span means "recorded nothing that day"; null outside
  // it means "this record did not cover that day". Both render as a break, and
  // neither claims a zero that was never counted.
  const emptyMonth = (month: string) => ({
    month,
    link2feedHouseholds: within(l2fSpan, month) ? 0 : null,
    link2feedIndividuals: within(l2fSpan, month) ? 0 : null,
    simcHouseholds: within(simcSpan, month) ? 0 : null,
    simcIndividuals: within(simcSpan, month) ? 0 : null,
    serviceLogHouseholds: null as number | null,
  });
  for (const row of overTimeRows) {
    const entry = monthly.get(row.month) ?? emptyMonth(row.month);
    if (row.source === 'link2feed') {
      entry.link2feedHouseholds = Number(row.households);
      entry.link2feedIndividuals = Number(row.individuals ?? 0);
    } else if (row.source === 'simc') {
      entry.simcHouseholds = Number(row.households);
      entry.simcIndividuals = Number(row.individuals ?? 0);
    }
    monthly.set(row.month, entry);
  }
  for (const row of serviceLogMonthly) {
    const entry = monthly.get(row.month) ?? emptyMonth(row.month);
    entry.serviceLogHouseholds = Number(row.households ?? 0);
    monthly.set(row.month, entry);
  }

  const seasonalYears = [...new Set(seasonalRows.map((row) => row.year))].sort();
  const seasonalMonths = MONTH_LABELS.map((label, index) => {
    const key = String(index + 1).padStart(2, '0');
    const row: Record<string, string | number> = { month: label };
    for (const year of seasonalYears) {
      const match = seasonalRows.find((entry) => entry.year === year && entry.monthIndex === key);
      if (match) row[year] = Number(match.households);
    }
    return row;
  });

  const seriesBuckets = new Map<string, Record<string, string | number>>();
  for (const row of methodSeriesRows) {
    const entry = seriesBuckets.get(row.bucket) ?? { bucket: row.bucket };
    entry[row.metricKey] = Number(row.total ?? 0);
    seriesBuckets.set(row.bucket, entry);
  }
  // Within a method's life a missing row is a real zero — staff record every
  // method each service day. Before it existed there is nothing to report, so
  // the value stays absent and the line begins where the program did.
  for (const [bucket, entry] of seriesBuckets.entries()) {
    for (const key of methodKeys) {
      if (entry[key] !== undefined) continue;
      const start = methodStarts.find((row) => row.metricKey === key)?.firstDate;
      if (start && bucket >= toBucket(start)) entry[key] = 0;
    }
  }

  let absoluteDifference = 0;
  let intakeTotal = 0;
  let serviceLogTotal = 0;
  for (const row of agreementRows) {
    const intake = Number(row.intake);
    const logged = Number(row.serviceLog ?? 0);
    absoluteDifference += Math.abs(logged - intake);
    intakeTotal += intake;
    serviceLogTotal += logged;
  }

  return {
    coverage: {
      startDate,
      endDate,
      granularity,
      sources: coverageRows.map((row) => ({
        source: row.source,
        firstDate: row.firstDate,
        lastDate: row.lastDate,
        encounters: Number(row.encounters),
      })),
      hasIntake: visits > 0,
      hasServiceLog: serviceLogHouseholds > 0
        || ancillaryDefinitions.some((row) => totalFor(row.metricKey) > 0),
      serviceLogFirstDate: serviceLogSpan[0]?.firstDate ?? null,
      serviceLogLastDate: serviceLogSpan[0]?.lastDate ?? null,
    },
    summary: {
      visits,
      peopleServed: Number(summary?.peopleServed ?? 0),
      identityUnavailableVisits: Number(summary?.identityUnavailable ?? 0),
      bulkEntryVisits: Number(summary?.bulkVisits ?? 0),
      bulkEntryPeople: Number(summary?.bulkPeople ?? 0),
      households: householdsSource === 'service_log' ? serviceLogHouseholds : intakeHouseholds,
      householdsSource,
      methods,
      // Reported one metric at a time rather than as an "Other" bucket: staff
      // recognize "Camping Gear Requests", not a category label, and the units
      // differ between them.
      otherServices: ancillaryDefinitions.map((row) => ({
          metricKey: row.metricKey,
          displayName: row.displayName,
          unit: row.unit,
        iconName: row.iconName,
        total: totalFor(row.metricKey),
      })),
    },
    overTime: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
    seasonal: { years: seasonalYears, months: seasonalMonths },
    methodSeries: {
      granularity,
      methods: methodDefinitions.map((row) => ({
        metricKey: row.metricKey,
        displayName: row.displayName,
        unit: row.unit,
        iconName: row.iconName,
        firstRecordedDate: methodStarts.find((m) => m.metricKey === row.metricKey)?.firstDate ?? null,
      })),
      buckets: [...seriesBuckets.values()]
        .sort((a, b) => String(a.bucket).localeCompare(String(b.bucket))),
    },
    recordAgreement: {
      sharedDays: agreementRows.length,
      intakeTotal,
      serviceLogTotal,
      meanAbsoluteDailyDifference: agreementRows.length > 0
        ? round(absoluteDifference / agreementRows.length, 1)
        : 0,
      agreementPercent: intakeTotal > 0 ? round((serviceLogTotal / intakeTotal) * 100, 1) : 0,
    },
    householdSize: sizeRows.map((row) => ({ people: Number(row.people), visits: Number(row.visits) })),
    reachAndFrequency: reachRows.map((row) => {
      const households = Number(row.households);
      const rowVisits = Number(row.visits);
      return {
        year: row.year,
        households,
        visits: rowVisits,
        visitsPerHousehold: households > 0 ? round(rowVisits / households) : 0,
      };
    }),
  };
}
