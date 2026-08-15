// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// Service Analytics — the third lens, beside Operations and Procurement.
//
// Two evidence layers overlap here and answer different questions. Formal
// intake (Link2Feed through 2026-05-28, then SIMC) is authoritative for how
// many households were served; WTH's own operational record is authoritative
// for HOW that service was delivered. They are never added together. The one
// card that shows both — Two Records, One Day — presents them as independent
// measurements of the same days, which is a comparison, not a sum, and it says
// so on the card.
//
// Every card here states its own interpretive boundary in its description, for
// the same reason the Community Donations cards do: a reader who is not told
// what a number excludes will assume it excludes nothing.
//
// Card selection and proposal rationale: docs/reports/service-analytics-card-proposal.md

import * as React from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine,
  XAxis, YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { SelectableBlock } from '@/components/reports/selection';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { carbonChartColors } from '@/lib/colors';
import { serviceApi, type ServiceAnalytics } from '@/services/service';
import type { AnalyticsDateRange } from '@/types/analytics';

/**
 * Fetches the lens for the workspace's shared date range.
 *
 * The preset travels to the server rather than being resolved here, so
 * "Last 90 days" means the same thing in Service as it does in Procurement.
 */
export function ServiceAnalyticsLens({ range }: { range: AnalyticsDateRange }) {
  const [analytics, setAnalytics] = React.useState<ServiceAnalytics | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    serviceApi.getAnalytics({
      preset: range.preset,
      ...(range.preset === 'custom' && range.startDate && range.endDate
        ? { startDate: range.startDate, endDate: range.endDate }
        : {}),
    })
      .then((result) => { if (active) setAnalytics(result); })
      .catch((error) => ErrorHandlerService.handleError(error, 'serviceAnalytics'))
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [range.preset, range.startDate, range.endDate]);

  if (isLoading && !analytics) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!analytics || analytics.summary.visits === 0) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>No service records in this range</CardTitle>
          <CardDescription>
            Service records begin with the first imported intake export. Widen the date
            range, or import Link2Feed or SIMC visit data from Information &rarr; Data.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <ServiceAnalyticsWorkspace analytics={analytics} />;
}

const count = (value: number) => value.toLocaleString();
const monthLabel = (month: string) => format(parseISO(`${month}-01`), 'MMM yyyy');

/**
 * Drops the month currently in progress from a monthly series.
 *
 * A partial month plotted beside complete ones reads as a collapse: at the time
 * of writing the newest month held two service days, so the line fell from
 * 1,474 to 239 and looked like service had stopped. The month is withheld
 * rather than drawn, and every card that does this says so.
 */
function withoutMonthInProgress<T extends { month: string }>(
  rows: T[],
): { rows: T[]; excludedMonth: string | null } {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const last = rows[rows.length - 1];
  if (!last || last.month !== currentMonth) return { rows, excludedMonth: null };
  return { rows: rows.slice(0, -1), excludedMonth: last.month };
}

/**
 * The month Link2Feed handed over to SIMC. Drawn as a labelled seam rather than
 * blended away: the two systems meet at 1,591 and 1,592 visits, and hiding the
 * boundary would also hide that agreement.
 */
const CUTOVER_MONTH = '2026-06';

/**
 * `ChartContainer` emits one CSS variable per *config key* — `--color-formal`,
 * not `--color-blue` — so a series binds to the key it was configured under.
 */
const seriesColor = (configKey: string) => `var(--color-${configKey})`;

export function ServiceAnalyticsWorkspace({ analytics }: { analytics: ServiceAnalytics }) {
  const { summary, coverage, overTime, reachAndFrequency, methodMix, recordAgreement, householdSize } = analytics;

  // One row per month with both sources kept in their own series, so the seam
  // is visible and nothing is summed across it.
  const { rows: timeline, excludedMonth: timelinePartial } = React.useMemo(() => {
    const byMonth = new Map<string, { month: string; link2feed: number | null; simc: number | null; households: number }>();
    for (const row of overTime) {
      const entry = byMonth.get(row.month) ?? { month: row.month, link2feed: null, simc: null, households: 0 };
      if (row.source === 'link2feed') entry.link2feed = row.visits;
      if (row.source === 'simc') entry.simc = row.visits;
      entry.households += row.households;
      byMonth.set(row.month, entry);
    }
    const ordered = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
    return withoutMonthInProgress(ordered);
  }, [overTime]);

  const sizeData = React.useMemo(() => householdSize.map((row) => ({
    label: row.people >= 8 ? '8+' : String(row.people),
    people: row.people,
    visits: row.visits,
  })).reduce<Array<{ label: string; visits: number }>>((acc, row) => {
    const existing = acc.find((entry) => entry.label === row.label);
    if (existing) existing.visits += row.visits;
    else acc.push({ label: row.label, visits: row.visits });
    return acc;
  }, []), [householdSize]);

  const sizeTotal = sizeData.reduce((total, row) => total + row.visits, 0);
  const singlePersonShare = sizeTotal > 0
    ? Math.round((sizeData.find((row) => row.label === '1')?.visits ?? 0) / sizeTotal * 100)
    : 0;

  const agreementPercent = recordAgreement.formalTotal > 0
    ? (recordAgreement.operationalTotal / recordAgreement.formalTotal) * 100
    : 0;

  const { rows: methodRows, excludedMonth: methodPartial } = React.useMemo(
    () => withoutMonthInProgress(methodMix), [methodMix]);
  const { rows: agreementRows, excludedMonth: agreementPartial } = React.useMemo(
    () => withoutMonthInProgress(recordAgreement.months), [recordAgreement.months]);

  const hasFormal = timeline.length > 0;
  const hasOperational = methodRows.length > 0;

  return (
    <div className="space-y-4">
      {/* ---- Summary ------------------------------------------------------ */}
      <SelectableBlock cardId="service-summary">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Service Summary</CardTitle>
            <CardDescription>
              Formal intake records for {coverage.sources.map((source) => (
                source.source === 'link2feed' ? 'Link2Feed' : 'SIMC'
              )).join(' and ')}. Households and visits are counted per source and never
              added across them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryTile label="Visits" value={count(summary.visits)} />
              <SummaryTile label="Households" value={count(summary.households)} />
              <SummaryTile label="People reported" value={count(summary.peopleReported)} />
              <SummaryTile
                label="Visits without a household record"
                value={count(summary.identityUnavailableVisits)}
              />
            </div>
            {/* The user asked for a people-served figure with the incompleteness
                stated rather than the figure withheld. Both halves matter: the
                number is real, and it is a floor. */}
            <p className="mt-4 text-xs text-muted-foreground">
              People reported is a <strong>minimum</strong>. These records are known to
              under-report: intake has been high-friction, some service days were
              recorded on paper and reconciled later, and {count(summary.identityUnavailableVisits)}{' '}
              visits carry no household record at all. The true number of people served
              is almost certainly higher.
            </p>
            {summary.bulkEntryVisits > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Includes {count(summary.bulkEntryPeople)} people from{' '}
                {count(summary.bulkEntryVisits)} bulk staff counts, which are people
                tallies rather than households. Their people are counted here; they are
                excluded from every household figure on this page.
              </p>
            )}
          </CardContent>
        </Card>
      </SelectableBlock>

      {/* ---- Two Records, One Day ----------------------------------------- */}
      {recordAgreement.sharedDays > 0 && (
        <SelectableBlock cardId="service-record-agreement">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Two Records, One Day</CardTitle>
              <CardDescription>
                Two independent records of the same service days: the formal intake
                system, and William Temple House's own operational record. Shown side by
                side to compare them — they are never added together.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  formal: { label: 'Formal intake', color: carbonChartColors.blue.primary.light },
                  operational: { label: 'Operational record', color: carbonChartColors.teal.primary.light },
                } satisfies ChartConfig}
                className="h-[260px] w-full"
              >
                <LineChart data={agreementRows} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis tickLine={false} axisLine={false} width={44} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => monthLabel(String(value))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="formal" stroke={seriesColor('formal')} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="operational" stroke={seriesColor('operational')} strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
              <p className="mt-3 text-xs text-muted-foreground">
                Across {count(recordAgreement.sharedDays)} shared service days the two
                records differ by an average of{' '}
                <strong>{recordAgreement.meanAbsoluteDailyDifference} visits per day</strong>
                {' '}— {count(recordAgreement.operationalTotal)} against{' '}
                {count(recordAgreement.formalTotal)} overall, or {agreementPercent.toFixed(1)}%.
                Only days present in both records are compared; a day the operational
                record does not cover is not a day the two disagree.
                {agreementPartial && ` ${monthLabel(agreementPartial)} is still in progress and is not plotted.`}
              </p>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}

      {/* ---- Service Over Time -------------------------------------------- */}
      {hasFormal && (
        <SelectableBlock cardId="service-over-time">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Service Over Time</CardTitle>
              <CardDescription>
                Monthly visits by formal intake source. Link2Feed and SIMC are separate
                series meeting at the system changeover, drawn as one timeline with a
                marked boundary rather than blended into a single figure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  link2feed: { label: 'Link2Feed', color: carbonChartColors.blue.primary.light },
                  simc: { label: 'SIMC', color: carbonChartColors.purple.primary.light },
                } satisfies ChartConfig}
                className="h-[280px] w-full"
              >
                <LineChart data={timeline} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} minTickGap={36} />
                  <YAxis tickLine={false} axisLine={false} width={44} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => monthLabel(String(value))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <ReferenceLine
                    x={CUTOVER_MONTH}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    label={{ value: 'Changed systems', position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Line type="monotone" dataKey="link2feed" stroke={seriesColor('link2feed')} strokeWidth={2} dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="simc" stroke={seriesColor('simc')} strokeWidth={2} dot={false} connectNulls={false} />
                </LineChart>
              </ChartContainer>
              <p className="mt-3 text-xs text-muted-foreground">
                The gap between the two lines is the changeover, not a drop in service.
                {timelinePartial && ` ${monthLabel(timelinePartial)} is still in progress and is not plotted.`}
              </p>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}

      {/* ---- Reach and Frequency ------------------------------------------ */}
      {reachAndFrequency.length > 1 && (
        <SelectableBlock cardId="service-reach-and-frequency">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Reach and Frequency</CardTitle>
              <CardDescription>
                Households served each year, against how often each household visited.
                Two measurements of the same service, which have moved in opposite
                directions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  households: { label: 'Households served', color: carbonChartColors.blue.primary.light },
                  visitsPerHousehold: { label: 'Visits per household', color: carbonChartColors.magenta.primary.light },
                } satisfies ChartConfig}
                className="h-[280px] w-full"
              >
                <ComposedChart data={reachAndFrequency} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} width={48} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={36} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar yAxisId="left" dataKey="households" fill={seriesColor('households')} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="visitsPerHousehold" stroke={seriesColor('visitsPerHousehold')} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ChartContainer>
              {/* Staff-supplied context, not inferred from the data. The policy is
                  a real cause the chart cannot show; naming it is more honest than
                  leaving the reader to guess, and safer than letting the chart
                  imply the pantry became less useful. */}
              <p className="mt-3 text-xs text-muted-foreground">
                William Temple House limits households to two visits a month. Pantry
                shopping and long lists count toward that limit; premade bags and
                emergency bags do not. The chart shows both measurements and does not
                attribute the change to any single cause.
              </p>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}

      {/* ---- How Service Was Delivered ------------------------------------ */}
      {hasOperational && (
        <SelectableBlock cardId="service-method-mix">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>How Service Was Delivered</CardTitle>
              <CardDescription>
                William Temple House's own operational record of service methods. This
                card shows only that record — no formal intake counts appear here, so
                nothing on it should be added to the totals above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  shoppingVisits: { label: 'Pantry shopping', color: carbonChartColors.blue.primary.light },
                  longLists: { label: 'Long lists', color: carbonChartColors.cyan.primary.light },
                  premadeBags: { label: 'Premade bags', color: carbonChartColors.teal.primary.light },
                  emergencyBags: { label: 'Emergency bags', color: carbonChartColors.orange.primary.light },
                } satisfies ChartConfig}
                className="h-[280px] w-full"
              >
                <AreaChart data={methodRows} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} minTickGap={36} />
                  <YAxis tickLine={false} axisLine={false} width={44} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => monthLabel(String(value))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area type="monotone" stackId="method" dataKey="shoppingVisits" stroke={seriesColor('shoppingVisits')} fill={seriesColor('shoppingVisits')} fillOpacity={0.75} />
                  <Area type="monotone" stackId="method" dataKey="longLists" stroke={seriesColor('longLists')} fill={seriesColor('longLists')} fillOpacity={0.75} />
                  <Area type="monotone" stackId="method" dataKey="premadeBags" stroke={seriesColor('premadeBags')} fill={seriesColor('premadeBags')} fillOpacity={0.75} />
                  <Area type="monotone" stackId="method" dataKey="emergencyBags" stroke={seriesColor('emergencyBags')} fill={seriesColor('emergencyBags')} fillOpacity={0.75} />
                </AreaChart>
              </ChartContainer>
              <p className="mt-3 text-xs text-muted-foreground">
                Pantry shopping and long lists count toward the two-visits-a-month
                household limit; premade bags and emergency bags do not. Emergency bags
                began in November 2025 as a new programme responding to federal SNAP
                reductions and Oregon's declared food emergency — the series is absent
                before that date because the programme did not exist, not because it
                was unrecorded.
                {methodPartial && ` ${monthLabel(methodPartial)} is still in progress and is not plotted.`}
              </p>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}

      {/* ---- Household Size ----------------------------------------------- */}
      {sizeData.length > 0 && (
        <SelectableBlock cardId="service-household-size">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Household Size</CardTitle>
              <CardDescription>
                People per household as reported at intake, counted per visit. Excludes
                bulk staff counts, which record a crowd as one entry and would distort
                any household average.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{ visits: { label: 'Visits', color: carbonChartColors.blue.primary.light } } satisfies ChartConfig}
                className="h-[240px] w-full"
              >
                <BarChart data={sizeData} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={52} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => `${value} ${value === '1' ? 'person' : 'people'}`} />} />
                  <Bar dataKey="visits" fill={seriesColor('visits')} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
              <p className="mt-3 text-xs text-muted-foreground">
                {singlePersonShare}% of visits are by a household of one.
              </p>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
