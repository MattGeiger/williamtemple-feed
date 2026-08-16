// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { PrismaClient } from '@prisma/client';
import prisma from '../../db';
import { getOperatingHoursSettings } from '../operating-hours';
import { resolveRange, type AnalyticsRangePreset } from '../inventory-analytics/timezone';
import { serviceProfileDimensionLabel } from './profiles';

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
  /**
   * The seasonal plot: twelve calendar months, one key per year.
   *
   * Two measures of the same rows, because they answer different questions and
   * a reader comparing years needs to say which they mean. Households counts a
   * household once however often it came; visits counts every encounter.
   *
   * An anonymous visit counts as one household in the first measure. It is a
   * household — Link2Feed just recorded no client id — so what is missing is
   * the ability to deduplicate it, not the household itself.
   */
  seasonal: {
    years: string[];
    households: Array<Record<string, string | number>>;
    visits: Array<Record<string, string | number>>;
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
  /**
   * Service not delivered — the only record of it there is.
   *
   * Staff confirmed that a service day with no turned-away entry means nobody
   * was turned away, so absence inside the Service Log's own span is a true
   * zero. Outside that span it is silence, and the series does not begin.
   */
  unmetDemand: {
    granularity: ServiceBucketGranularity;
    /** Null before the Service Log covers the bucket, so the line begins there. */
    buckets: Array<{ bucket: string; turnedAway: number | null }>;
    householdsTurnedAway: number;
    /** Days it happened, against days the Log was kept — the honest denominator. */
    daysWithTurnAway: number;
    daysRecorded: number;
    capacityReachedDays: number;
    firstRecordedDate: string | null;
  };
  /**
   * Household languages, merged only where two labels are the same word.
   *
   * Only redundant label variants are merged — "Mandarin Chinese" into
   * "Mandarin" — because that is the two intake systems writing one answer two
   * ways. Different names stay different: "Chinese" is not a longer spelling
   * of "Mandarin", and "Farsi" is not a misspelling of "Persian". The export
   * carries every answer exactly as recorded.
   */
  languages: {
    /** Chart-facing, with redundant label variants merged. */
    values: Array<{ language: string; households: number }>;
    /** Every answer as recorded. The export carries these, so nothing is lost. */
    rawValues: Array<{ language: string; households: number }>;
    /** How many recorded labels the merge folds away, for the card's note. */
    mergedLabels: number;
    householdsAsked: number;
    householdsAnswered: number;
  };
  /**
   * For each question actually asked, how many households answered it.
   *
   * The card that keeps every other demographic figure honest: a share is
   * meaningless without the denominator it was drawn from. Questions differ
   * between the two intake systems, so each one reports which asked it.
   *
   * Excludes dimensions the systems derive rather than ask, and treats a
   * decline as not answered — `NON_ANSWER_LABELS` in `profiles.ts` strips
   * "prefer not to answer" and its variants at import, so a response status of
   * `provided` means a household said something substantive.
   */
  responseCoverage: Array<{
    dimension: string;
    displayName: string;
    provided: number;
    notProvided: number;
    sources: string[];
  }>;
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
      COUNT(DISTINCT "clientId")
             + SUM(CASE WHEN "recordKind" = 'identity_unavailable_encounter' THEN 1 ELSE 0 END) AS "intakeHouseholds",
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
  // Visits come from the same rows, counted without the DISTINCT.
  //
  // An anonymous visit is still a household — Link2Feed simply recorded no
  // client id for it — so it counts as one household rather than being dropped
  // from the household measure. What is lost is deduplication, not the
  // household: two anonymous visits by the same family count twice, because
  // nothing in the record can tell they were the same family. The household
  // series is therefore a slight over-count on those rows and a far smaller
  // error than omitting them, which understated 2023 by nearly 13%.
  const seasonalRows = await client.$queryRaw<Array<{
    year: string; monthIndex: string; households: bigint; visits: bigint;
  }>>`
    SELECT substr("serviceDate", 1, 4) AS "year",
           substr("serviceDate", 6, 2) AS "monthIndex",
           COUNT(DISTINCT "clientId")
             + SUM(CASE WHEN "recordKind" = 'identity_unavailable_encounter' THEN 1 ELSE 0 END) AS "households",
           COUNT(*) AS "visits"
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

  // Service not delivered. Turned-away counts and capacity markers are the
  // only trace of it, and they are sparse by nature — 38 recorded days across
  // two years — so they are reported against the days the Log was kept rather
  // than against the calendar.
  const unmetKeys = definitions
    .filter((row) => row.semanticRole === 'unmet_demand')
    .map((row) => row.metricKey);
  const capacityKeys = definitions
    .filter((row) => row.semanticRole === 'capacity_marker')
    .map((row) => row.metricKey);

  const unmetBucketRows = unmetKeys.length === 0 ? [] :
    await client.$queryRawUnsafe<Array<{ bucket: string; total: number | null }>>(
      `SELECT ${bucketSql} AS "bucket", SUM(COALESCE(o."countValue",0)) AS "total"
       FROM "ServiceMetricObservationRevision" o
       JOIN "ServiceMetricDefinition" d ON d."id" = o."metricId"
       WHERE o."isCurrent" = 1 AND o."serviceDate" BETWEEN ? AND ?
         AND d."metricKey" IN (${inList(unmetKeys)})
       GROUP BY "bucket" ORDER BY "bucket"`,
      startDate, endDate, ...unmetKeys,
    );

  const unmetTotals = unmetKeys.length === 0 ? [] :
    await client.$queryRawUnsafe<Array<{
      households: number | null; daysWithTurnAway: bigint; firstDate: string | null;
    }>>(
      `SELECT SUM(COALESCE(o."countValue",0)) AS "households",
              COUNT(DISTINCT CASE WHEN COALESCE(o."countValue",0) > 0
                                  THEN o."serviceDate" END) AS "daysWithTurnAway",
              MIN(CASE WHEN COALESCE(o."countValue",0) > 0 THEN o."serviceDate" END) AS "firstDate"
       FROM "ServiceMetricObservationRevision" o
       JOIN "ServiceMetricDefinition" d ON d."id" = o."metricId"
       WHERE o."isCurrent" = 1 AND o."serviceDate" BETWEEN ? AND ?
         AND d."metricKey" IN (${inList(unmetKeys)})`,
      startDate, endDate, ...unmetKeys,
    );

  const capacityDays = capacityKeys.length === 0 ? [] :
    await client.$queryRawUnsafe<Array<{ days: bigint }>>(
      `SELECT COUNT(DISTINCT o."serviceDate") AS "days"
       FROM "ServiceMetricObservationRevision" o
       JOIN "ServiceMetricDefinition" d ON d."id" = o."metricId"
       WHERE o."isCurrent" = 1 AND o."serviceDate" BETWEEN ? AND ?
         AND d."metricKey" IN (${inList(capacityKeys)})
         AND (o."timeValue" IS NOT NULL OR COALESCE(o."countValue",0) > 0)`,
      startDate, endDate, ...capacityKeys,
    );

  // Days the Service Log was kept at all — the denominator a turned-away
  // figure has to be read against.
  const loggedDays = await client.$queryRaw<Array<{ days: bigint }>>`
    SELECT COUNT(DISTINCT "serviceDate") AS "days"
    FROM "ServiceMetricObservationRevision"
    WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ${startDate} AND ${endDate}`;

  /**
   * Demographics are read for the households actually served in the range,
   * not for whichever profiles happen to have been written in it. Each client
   * carries exactly one current profile, so this is a join rather than a
   * pick-the-latest.
   */
  /**
   * The only language answers that are merged, and the line that decides it.
   *
   * These pairs differ by a **redundant qualifier** — the same name with
   * "Chinese" appended, which is how the two intake systems happened to label
   * the same answer. Collapsing them corrects a labelling artefact.
   *
   * Answers that are *different names* are never merged, even when a linguist
   * would call them one language:
   *
   * - "Farsi" and "Persian" are the same language under two names, and which
   *   one a household used is something it told us.
   * - "Chinese" is not a longer way of writing "Mandarin" — it could be either
   *   variety, and resolving it would be inventing data.
   * - "Sign Language" and "American Sign Language" differ by a qualifier that
   *   is not redundant; it names which sign language.
   *
   * Extending this map means arguing that two spellings are the same word, not
   * that two languages are close enough.
   */
  const LANGUAGE_LABEL_ALIASES: Record<string, string> = {
    'Mandarin Chinese': 'Mandarin',
    'Cantonese Chinese': 'Cantonese',
  };

  // Merged in SQL rather than by summing afterwards: a household that recorded
  // both "Mandarin" and "Mandarin Chinese" must count once under Mandarin, and
  // adding the two totals would count it twice.
  const languageCase = `CASE j."value"
${Object.entries(LANGUAGE_LABEL_ALIASES)
    .map(([from, to]) => `      WHEN '${from}' THEN '${to}'`)
    .join('\n')}
      ELSE j."value" END`;

  const languageSql = (label: string) => `
    WITH served AS (
      SELECT DISTINCT "clientId" FROM "ServiceEncounterRevision"
      WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ? AND ?
        AND "clientId" IS NOT NULL
    )
    SELECT ${label} AS "language", COUNT(DISTINCT p."clientId") AS "households"
    FROM "ServiceClientProfileRevision" p
    JOIN served s ON s."clientId" = p."clientId"
    JOIN "ServiceClientProfileResponse" r ON r."profileRevisionId" = p."id"
    JOIN json_each(r."values") j
    WHERE p."isCurrent" = 1 AND r."dimension" = 'household_languages'
      AND r."responseStatus" = 'provided'
    GROUP BY "language" ORDER BY "households" DESC, "language"`;

  const languageRows = await client.$queryRawUnsafe<
    Array<{ language: string; households: bigint }>
  >(languageSql(languageCase), startDate, endDate);

  // Every answer as recorded, for the export — merging is a reading aid on the
  // chart, not a rewrite of what households said.
  const languageRawRows = await client.$queryRawUnsafe<
    Array<{ language: string; households: bigint }>
  >(languageSql('j."value"'), startDate, endDate);

  const coverageByDimension = await client.$queryRaw<Array<{
    dimension: string; responseStatus: string; households: bigint; sources: string;
  }>>`
    WITH served AS (
      SELECT DISTINCT "clientId" FROM "ServiceEncounterRevision"
      WHERE "isCurrent" = 1 AND "serviceDate" BETWEEN ${startDate} AND ${endDate}
        AND "clientId" IS NOT NULL
    )
    SELECT r."dimension", r."responseStatus",
           COUNT(DISTINCT p."clientId") AS "households",
           GROUP_CONCAT(DISTINCT p."source") AS "sources"
    FROM "ServiceClientProfileRevision" p
    JOIN served s ON s."clientId" = p."clientId"
    JOIN "ServiceClientProfileResponse" r ON r."profileRevisionId" = p."id"
    WHERE p."isCurrent" = 1
    GROUP BY r."dimension", r."responseStatus"`;

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

  // The one measure that stays identified-only. Everywhere else an anonymous
  // visit counts as a household; here it cannot, because this asks how often a
  // household returns and an anonymous row carries no repeat information at
  // all. Folding them in would add one visit and one household apiece and drag
  // the average toward 1 — an artefact of recording, reported as behaviour.
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
  // A month a year did not run stays absent rather than zero, so a partial year
  // stops where its data stops instead of diving to the axis.
  const seasonalBy = (pick: (row: { households: bigint; visits: bigint }) => bigint) =>
    MONTH_LABELS.map((label, index) => {
      const key = String(index + 1).padStart(2, '0');
      const row: Record<string, string | number> = { month: label };
      for (const year of seasonalYears) {
        const match = seasonalRows.find((entry) => entry.year === year && entry.monthIndex === key);
        if (match) row[year] = Number(pick(match));
      }
      return row;
    });
  const seasonalHouseholds = seasonalBy((row) => row.households);
  const seasonalVisits = seasonalBy((row) => row.visits);

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

  // Absence inside the Service Log's span is a zero staff confirmed; outside
  // it there is no record to read, so the bucket stays null and the line
  // begins where the Log does.
  const logSpanFirst = serviceLogSpan[0]?.firstDate ?? null;
  const logSpanLast = serviceLogSpan[0]?.lastDate ?? null;
  const unmetByBucket = new Map(
    unmetBucketRows.map((row) => [row.bucket, Number(row.total ?? 0)]),
  );
  const unmetBuckets = logSpanFirst && logSpanLast
    ? [...new Set(methodSeriesRows.map((row) => row.bucket))]
      .sort()
      .map((bucket) => ({
        bucket,
        turnedAway:
          bucket >= toBucket(logSpanFirst) && bucket <= toBucket(logSpanLast)
            ? unmetByBucket.get(bucket) ?? 0
            : null,
      }))
    : [];

  /**
   * Dimensions the intake systems fill in themselves rather than asking.
   *
   * Both sit at essentially 100% answered — `no_fixed_address` on every SIMC
   * profile, `county_fips` on all but five — because they are required fields
   * derived at entry, not questions a household chose to answer. Leaving them
   * on a response-rate card puts two guaranteed full bars at the top and
   * flatters every real question below them.
   */
  const DERIVED_DIMENSIONS = new Set(['no_fixed_address', 'county_fips']);

  const coverageTotals = new Map<string, {
    provided: number; notProvided: number; sources: Set<string>;
  }>();
  for (const row of coverageByDimension) {
    if (DERIVED_DIMENSIONS.has(row.dimension)) continue;
    const entry = coverageTotals.get(row.dimension)
      ?? { provided: 0, notProvided: 0, sources: new Set<string>() };
    if (row.responseStatus === 'provided') entry.provided += Number(row.households);
    else entry.notProvided += Number(row.households);
    for (const source of String(row.sources ?? '').split(',')) {
      if (source) entry.sources.add(source);
    }
    coverageTotals.set(row.dimension, entry);
  }

  const toLanguageValues = (rows: Array<{ language: string; households: bigint }>) =>
    rows.map((row) => ({ language: row.language, households: Number(row.households) }));
  const languageValues = toLanguageValues(languageRows);
  const languageRawValues = toLanguageValues(languageRawRows);
  const languagesAsked = coverageTotals.get('household_languages');

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
    seasonal: {
      years: seasonalYears,
      households: seasonalHouseholds,
      visits: seasonalVisits,
    },
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
    unmetDemand: {
      granularity,
      buckets: unmetBuckets,
      householdsTurnedAway: Number(unmetTotals[0]?.households ?? 0),
      daysWithTurnAway: Number(unmetTotals[0]?.daysWithTurnAway ?? 0),
      daysRecorded: Number(loggedDays[0]?.days ?? 0),
      capacityReachedDays: Number(capacityDays[0]?.days ?? 0),
      firstRecordedDate: unmetTotals[0]?.firstDate ?? null,
    },
    languages: {
      values: languageValues,
      rawValues: languageRawValues,
      mergedLabels: Object.keys(LANGUAGE_LABEL_ALIASES).length,
      householdsAsked: (languagesAsked?.provided ?? 0) + (languagesAsked?.notProvided ?? 0),
      householdsAnswered: languagesAsked?.provided ?? 0,
    },
    responseCoverage: [...coverageTotals.entries()]
      .map(([dimension, entry]) => ({
        dimension,
        displayName: serviceProfileDimensionLabel(dimension),
        provided: entry.provided,
        notProvided: entry.notProvided,
        sources: [...entry.sources].sort(),
      }))
      // Best-answered first: the card is read to find the questions that
      // cannot carry a percentage, and those belong at the bottom where the
      // eye lands last on a ranked list.
      .sort((a, b) => {
        const aShare = a.provided / Math.max(1, a.provided + a.notProvided);
        const bShare = b.provided / Math.max(1, b.provided + b.notProvided);
        return bShare - aShare || a.dimension.localeCompare(b.dimension);
      }),
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
