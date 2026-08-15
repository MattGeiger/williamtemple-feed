// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// Service Analytics — the third lens, beside Operations and Procurement.
//
// Two records describe the same pantry days and are complementary, not
// authority and commentary. Formal intake (Link2Feed, then SIMC) is the
// client-grained record; the Service Log is WTH's own end-of-day count, entered
// by staff, and it covers days and households intake missed. They are never
// summed with each other, and where both can answer a question the Service Log
// is preferred — a hand-counted total does not depend on every client
// completing intake.
//
// Card copy follows one rule: the description says what the card shows, source
// pills say where it came from, and anything the reader must know to avoid
// misreading it goes in the footer. The footer is the place for caveats
// precisely because it is read last, after the shape of the data is already
// understood.
//
// Reused from the Procurement lens rather than reinvented:
// `buildSeasonalYearChartConfig` (year-over-year colour assignment) and the
// year-picker dropdown pattern from Seasonal Inbound Weight.

import * as React from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis, Bar, BarChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown } from '@/components/ui/icons';
import { SelectableBlock } from '@/components/reports/selection';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { carbonChartColors } from '@/lib/colors';
import { buildSeasonalYearChartConfig } from './index';
import {
  serviceApi,
  type ServiceAnalytics,
  type ServiceBucketGranularity,
} from '@/services/service';
import type { AnalyticsDateRange } from '@/types/analytics';

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
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  // Either record makes the range non-empty. Checking only intake is what told
  // staff "no service records" for the last seven days while their own Service
  // Log held entries through yesterday.
  const hasAnything = analytics
    && (analytics.coverage.hasIntake || analytics.coverage.hasServiceLog);

  if (!analytics || !hasAnything) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>No service records in this range</CardTitle>
          <CardDescription>
            Nothing was recorded in the Service Log and no intake data covers these
            dates. Widen the date range, record a service day in Service &rarr; Service
            Log, or import visit data from Information &rarr; Data.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <ServiceAnalyticsWorkspace analytics={analytics} />;
}

const count = (value: number) => value.toLocaleString();
const monthLabel = (month: string) => format(parseISO(`${month}-01`), 'MMM yyyy');
const dayLabel = (day: string) => format(parseISO(day), 'MMM d');

const bucketLabel = (granularity: ServiceBucketGranularity) =>
  granularity === 'month' ? monthLabel : dayLabel;

const bucketNoun: Record<ServiceBucketGranularity, string> = {
  day: 'day',
  week: 'week beginning',
  month: 'month',
};

/** The month Link2Feed handed over to SIMC. */
const CUTOVER_MONTH = '2026-06';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const seriesColor = (configKey: string) => `var(--color-${configKey})`;

/** Source provenance, stated as a pill rather than a sentence. */
function SourcePills({ sources }: { sources: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {sources.map((source) => (
        <Badge key={source} variant="outline" className="font-normal">{source}</Badge>
      ))}
    </div>
  );
}

function Footnote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs text-muted-foreground">{children}</p>;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Drops the bucket currently in progress from a series.
 *
 * A partial period plotted beside complete ones reads as a collapse: the newest
 * month once held two service days, so the line fell from 1,474 to 239 and
 * looked like service had stopped.
 */
function withoutPeriodInProgress<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
  granularity: ServiceBucketGranularity,
): { rows: T[]; excluded: string | null } {
  const last = rows[rows.length - 1];
  if (!last) return { rows, excluded: null };
  const value = String(last[key]);
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  // Only whole months are withheld. A day or week bucket is the thing staff are
  // actively looking at on a short range, and hiding today would be worse than
  // showing it.
  if (granularity !== 'month' || value !== currentMonth) return { rows, excluded: null };
  return { rows: rows.slice(0, -1), excluded: value };
}

export function ServiceAnalyticsWorkspace({ analytics }: { analytics: ServiceAnalytics }) {
  const { coverage, summary, overTime, seasonal, methodSeries, recordAgreement, householdSize, reachAndFrequency } = analytics;

  const { rows: timeline, excluded: timelinePartial } = React.useMemo(
    () => withoutPeriodInProgress(overTime, 'month', 'month'), [overTime]);

  const { rows: methodBuckets, excluded: methodPartial } = React.useMemo(
    () => withoutPeriodInProgress(methodSeries.buckets, 'bucket', methodSeries.granularity),
    [methodSeries]);

  const sizeData = React.useMemo(() => {
    const grouped: Array<{ label: string; visits: number }> = [];
    for (const row of householdSize) {
      const label = row.people >= 8 ? '8+' : String(row.people);
      const existing = grouped.find((entry) => entry.label === label);
      if (existing) existing.visits += row.visits;
      else grouped.push({ label, visits: row.visits });
    }
    return grouped;
  }, [householdSize]);

  const sizeTotal = sizeData.reduce((total, row) => total + row.visits, 0);
  const singlePersonShare = sizeTotal > 0
    ? Math.round((sizeData.find((row) => row.label === '1')?.visits ?? 0) / sizeTotal * 100)
    : 0;

  // The seasonal plot needs the same in-progress guard as the timeline: the
  // current month holds only the service days that have happened so far, and
  // plotting it beside eleven complete months makes the current year appear to
  // collapse. Only the current year's newest point is dropped — every prior
  // year's month is complete.
  const seasonalMonths = React.useMemo(() => {
    const now = new Date();
    const currentYear = String(now.getFullYear());
    const currentMonthLabel = MONTH_LABELS[now.getMonth()];
    return seasonal.months.map((row) => {
      if (row.month !== currentMonthLabel || row[currentYear] === undefined) return row;
      const { [currentYear]: _dropped, ...rest } = row;
      return rest;
    });
  }, [seasonal.months]);

  // Seasonal year picker, mirroring Seasonal Inbound Weight.
  const [selectedYears, setSelectedYears] = React.useState<string[] | null>(null);
  const years = seasonal.years;
  const activeYears = selectedYears ?? years;
  const seasonalConfig = React.useMemo(
    () => buildSeasonalYearChartConfig(activeYears, new Date().getFullYear()),
    [activeYears],
  );

  const methodConfig = React.useMemo(() => Object.fromEntries(
    methodSeries.methods.map((method, index) => [method.metricKey, {
      label: method.displayName,
      color: [
        carbonChartColors.blue.primary.light,
        carbonChartColors.cyan.primary.light,
        carbonChartColors.teal.primary.light,
        carbonChartColors.orange.primary.light,
        carbonChartColors.purple.primary.light,
      ][index % 5],
    }]),
  ) satisfies ChartConfig, [methodSeries.methods]);

  const labelBucket = bucketLabel(methodSeries.granularity);
  const householdsFromLog = summary.householdsSource === 'service_log';
  const serviceLogStartsLater = householdsFromLog
    && coverage.serviceLogFirstDate
    && coverage.serviceLogFirstDate > coverage.startDate;

  return (
    <div className="space-y-4">
      {/* ---- Service Summary ---------------------------------------------- */}
      <SelectableBlock cardId="service-summary">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Service Summary</CardTitle>
            <CardDescription>Pantry service recorded across both records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {coverage.hasServiceLog && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Service Log
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Tile label="Households served" value={count(summary.households)} />
                  {summary.methods.map((method) => (
                    <Tile
                      key={method.metricKey}
                      label={method.displayName}
                      value={count(method.households)}
                      hint={method.unit}
                    />
                  ))}
                </div>
                {summary.otherServices.metrics.length > 0 && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Tile
                      label="Other services and requests"
                      value={count(summary.otherServices.total)}
                      hint={summary.otherServices.unit}
                    />
                  </div>
                )}
              </div>
            )}

            {coverage.hasIntake && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Intake records
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Tile label="Visits" value={count(summary.visits)} />
                  <Tile label="People served" value={count(summary.peopleServed)} />
                  <Tile
                    label="Visits without a household record"
                    value={count(summary.identityUnavailableVisits)}
                  />
                  {!coverage.hasServiceLog && (
                    <Tile label="Households served" value={count(summary.households)} />
                  )}
                </div>
                <SourcePills sources={coverage.sources.map((source) =>
                  source.source === 'link2feed' ? 'Link2Feed' : 'SIMC')} />
              </div>
            )}

            <div className="space-y-1.5 border-t pt-3">
              <Footnote>
                People served counts every visit, so a household of three visiting twice
                is counted six times. It is likely an undercount: not every client
                discloses household size.
              </Footnote>
              {householdsFromLog && (
                <Footnote>
                  Households served comes from the Service Log, which staff enter at the
                  end of each pantry day. It is preferred over the intake count because
                  the changeover from Link2Feed to SIMC gave returning clients a second
                  profile, so counting intake records would report the same person twice.
                  {serviceLogStartsLater && coverage.serviceLogFirstDate && (
                    <> The Service Log begins {monthLabel(coverage.serviceLogFirstDate.slice(0, 7))}, later than the range shown.</>
                  )}
                </Footnote>
              )}
              {recordAgreement.sharedDays > 0 && (
                <Footnote>
                  Across {count(recordAgreement.sharedDays)} days covered by both records
                  they differ by an average of {recordAgreement.meanAbsoluteDailyDifference}{' '}
                  households a day ({recordAgreement.agreementPercent}% overall).
                </Footnote>
              )}
              {summary.bulkEntryVisits > 0 && (
                <Footnote>
                  Includes {count(summary.bulkEntryPeople)} people from{' '}
                  {count(summary.bulkEntryVisits)} bulk staff counts, which are excluded
                  from every household figure.
                </Footnote>
              )}
            </div>
          </CardContent>
        </Card>
      </SelectableBlock>

      {/* ---- Service Over Time -------------------------------------------- */}
      {timeline.length > 1 && (
        <SelectableBlock cardId="service-over-time">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Service Over Time</CardTitle>
              <CardDescription>Monthly service by record.</CardDescription>
              <SourcePills sources={['Link2Feed', 'SIMC', 'Service Log']} />
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  link2feedHouseholds: { label: 'Link2Feed households', color: carbonChartColors.blue.primary.light },
                  link2feedIndividuals: { label: 'Link2Feed individuals', color: carbonChartColors.cyan.primary.light },
                  simcHouseholds: { label: 'SIMC households', color: carbonChartColors.purple.primary.light },
                  simcIndividuals: { label: 'SIMC individuals', color: carbonChartColors.magenta.primary.light },
                  serviceLogHouseholds: { label: 'Service Log households', color: carbonChartColors.teal.primary.light },
                } satisfies ChartConfig}
                className="h-[300px] w-full"
              >
                <LineChart data={timeline} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} minTickGap={36} />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => monthLabel(String(value))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <ReferenceLine
                    x={CUTOVER_MONTH}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    label={{ value: 'Changed systems', position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  {(['link2feedHouseholds', 'link2feedIndividuals', 'simcHouseholds', 'simcIndividuals', 'serviceLogHouseholds'] as const).map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={seriesColor(key)}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
              <Footnote>
                The gap between the two intake lines is the changeover, not a drop in
                service.{timelinePartial && ` ${monthLabel(timelinePartial)} is still in progress and is not plotted.`}
              </Footnote>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}

      {/* ---- Households by Season ----------------------------------------- */}
      {years.length > 1 && (
        <SelectableBlock cardId="service-seasonal-households">
          <Card className="min-w-0">
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Households by Season</CardTitle>
                <CardDescription>Calendar years compared month by month.</CardDescription>
                <SourcePills sources={['Link2Feed', 'SIMC']} />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0">
                    Years <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto">
                  <DropdownMenuItem onSelect={() => setSelectedYears(years)}>Select all years</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSelectedYears([])}>Clear all years</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {years.map((year) => (
                    <DropdownMenuCheckboxItem
                      key={year}
                      checked={activeYears.includes(year)}
                      onSelect={(event) => event.preventDefault()}
                      onCheckedChange={(checked) => setSelectedYears(
                        checked
                          ? [...activeYears, year].sort()
                          : activeYears.filter((entry) => entry !== year),
                      )}
                    >
                      {year}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              {activeYears.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                  Choose at least one year.
                </div>
              ) : (
                <ChartContainer config={seasonalConfig} className="h-[300px] w-full">
                  <LineChart data={seasonalMonths} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={48} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {activeYears.map((year) => (
                      <Line
                        key={year}
                        type="monotone"
                        dataKey={year}
                        stroke={seriesColor(year)}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              )}
              <Footnote>
                Distinct households each month, so one household visiting twice in a
                month is counted once.
                {reachAndFrequency.length > 1 && (() => {
                  // Anchored to the busiest year rather than the first, because
                  // the first year on record covers only the months after
                  // service began and understates its own frequency.
                  const peak = reachAndFrequency.reduce((best, row) =>
                    row.visitsPerHousehold > best.visitsPerHousehold ? row : best);
                  const last = reachAndFrequency[reachAndFrequency.length - 1];
                  if (peak.year === last.year) return null;
                  return ` Visits per household moved from ${peak.visitsPerHousehold} in ${peak.year} to ${last.visitsPerHousehold} in ${last.year}; households are limited to two visits a month.`;
                })()}
              </Footnote>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}

      {/* ---- How Service Was Delivered ------------------------------------ */}
      {methodBuckets.length > 0 && (
        <SelectableBlock cardId="service-method-mix">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>How Service Was Delivered</CardTitle>
              <CardDescription>
                William Temple House&apos;s own operational record of service methods.
              </CardDescription>
              <SourcePills sources={['Service Log', 'Households']} />
            </CardHeader>
            <CardContent>
              {/* Lines, not a stacked area: stacking made the topmost series
                  read as the peak value against the axis, so emergency bags
                  looked like the largest method when they are the smallest. */}
              <ChartContainer config={methodConfig} className="h-[300px] w-full">
                <LineChart data={methodBuckets} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tickFormatter={(value) => labelBucket(String(value))} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => labelBucket(String(value))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {methodSeries.methods.map((method) => (
                    <Line
                      key={method.metricKey}
                      type="monotone"
                      dataKey={method.metricKey}
                      stroke={seriesColor(method.metricKey)}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
              <Footnote>
                Households per {bucketNoun[methodSeries.granularity]}. Pantry shopping and
                long lists count toward the two-visits-a-month limit; premade bags and
                emergency bags do not. Emergency bags began in November 2025 as a new
                programme, so the line is absent before then rather than zero.
                {methodPartial && ` ${monthLabel(methodPartial)} is still in progress and is not plotted.`}
              </Footnote>
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
                People per household as reported at intake, counted per visit.
              </CardDescription>
              <SourcePills sources={['Link2Feed', 'SIMC']} />
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
              <Footnote>
                {singlePersonShare}% of visits are by a household of one. Excludes
                outliers marked as special events, flagged during data import.
              </Footnote>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}
    </div>
  );
}
