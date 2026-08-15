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
  Bar, BarChart, CartesianGrid, Cell, Label, Line, LineChart, Pie, PieChart,
  ReferenceLine, XAxis, YAxis,
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
import { BadgeQuestionMark, ShoppingBasket, UsersRound } from 'lucide-react';
import { getIconComponent } from '@/lib/icon-library';
import { SelectableBlock } from '@/components/reports/selection';
import { prefersReducedMotion } from '@/lib/reduced-motion';
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
const round1 = (value: number) => Math.round(value * 10) / 10;
const monthLabel = (month: string) => format(parseISO(`${month}-01`), 'MMM yyyy');
const monthOfDate = (date: string) => format(parseISO(date), 'MMM yyyy');

/** Day labels carry the year only when the range crosses one. */
const dayLabelFor = (spansYears: boolean) => (day: string) =>
  format(parseISO(day), spansYears ? 'MMM d, yyyy' : 'MMM d');

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

/** Matches the Dashboard stat cards: figure left, icon top-right. */
function Tile({
  label, value, hint, icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * One Service Log method. The icon comes from the metric's own configuration,
 * so administration is the single place icons are chosen.
 */
function MethodRow({
  iconName, displayName, value, unit, color,
}: {
  iconName: string; displayName: string; value: number; unit?: string; color?: string;
}) {
  const Icon = getIconComponent(iconName);
  return (
    <div className="flex items-center gap-3 border-b py-2 last:border-b-0">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={color ? { backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` } : undefined}
      >
        <Icon
          className="h-4 w-4"
          {...(color ? { style: { color } } : {})}
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{displayName}</span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {count(value)}
        {unit && <span className="ml-1 font-normal text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}

export function ServiceAnalyticsWorkspace({ analytics }: { analytics: ServiceAnalytics }) {
  const { coverage, summary, overTime, seasonal, methodSeries, recordAgreement, householdSize, reachAndFrequency } = analytics;

  const timeline = overTime;
  const methodBuckets = methodSeries.buckets;

  // The changeover is marked at the first day SIMC recorded, taken from the
  // data rather than a hardcoded month, so the marker follows the record.
  const spansCutover = React.useMemo(() => {
    const hasL2f = overTime.some((row) => (row.link2feedHouseholds ?? 0) > 0 || (row.link2feedIndividuals ?? 0) > 0);
    const hasSimc = overTime.some((row) => (row.simcHouseholds ?? 0) > 0 || (row.simcIndividuals ?? 0) > 0);
    return hasL2f && hasSimc;
  }, [overTime]);
  const cutoverDate = React.useMemo(
    () => (spansCutover
      ? overTime.find((row) => (row.simcHouseholds ?? 0) > 0 || (row.simcIndividuals ?? 0) > 0)?.month ?? null
      : null),
    [overTime, spansCutover],
  );

  // Derived from which records actually meet at the boundary, so the marker
  // describes this organization's history rather than a hardcoded event.
  const cutoverLabel = React.useMemo(() => {
    const ordered = [...coverage.sources].sort((a, b) => a.firstDate.localeCompare(b.firstDate));
    const names = ordered.map((entry) => (entry.source === 'link2feed' ? 'Link2Feed' : 'SIMC'));
    return names.length === 2 ? `${names[0]} \u2192 ${names[1]}` : 'Record changed';
  }, [coverage.sources]);

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

  const methodSlices = React.useMemo(
    () => summary.methods.filter((method) => method.households > 0),
    [summary.methods],
  );

  const methodPalette = [
    carbonChartColors.blue.primary.light,
    carbonChartColors.cyan.primary.light,
    carbonChartColors.teal.primary.light,
    carbonChartColors.orange.primary.light,
    carbonChartColors.purple.primary.light,
  ];
  const methodColorFor = React.useCallback((metricKey: string) => {
    const index = summary.methods.findIndex((method) => method.metricKey === metricKey);
    return index < 0 ? undefined : methodPalette[index % methodPalette.length];
  }, [summary.methods]);

  const methodConfig = React.useMemo(() => Object.fromEntries(
    (methodSeries.methods.length > 0 ? methodSeries.methods : summary.methods)
      .map((method, index) => [method.metricKey, {
      label: method.displayName,
      color: methodPalette[index % methodPalette.length],
    }]),
  ) satisfies ChartConfig, [methodSeries.methods, summary.methods]);

  const spansYears = coverage.startDate.slice(0, 4) !== coverage.endDate.slice(0, 4);
  const labelBucket = dayLabelFor(spansYears);

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
                {/* One donut of the service methods, borrowing the Dashboard's
                    Inventory Distribution treatment, rather than five tiles that
                    wrapped unevenly and left the differently-united ancillary
                    figure stranded on a row of its own. */}
                <div className="grid gap-6 md:grid-cols-[minmax(0,240px)_1fr] md:items-center">
                  <ChartContainer config={methodConfig} className="aspect-square w-full max-w-[240px]">
                    <PieChart>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        isAnimationActive={!prefersReducedMotion()}
                        data={methodSlices}
                        dataKey="households"
                        nameKey="displayName"
                        innerRadius="70%"
                        outerRadius="100%"
                        paddingAngle={5}
                      >
                        <Label content={({ viewBox }) => {
                          if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                                {count(summary.households)}
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 22} className="fill-muted-foreground text-xs">
                                Households served
                              </tspan>
                            </text>
                          );
                        }} />
                        {methodSlices.map((slice) => (
                          <Cell
                            key={slice.metricKey}
                            fill={seriesColor(slice.metricKey)}
                            className="stroke-background"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>

                  {/* A single ranked column beside the donut, in the order the
                      administrator set. Two columns left the card sparse on the
                      right and stranded the differently-united ancillary row on
                      a line of its own. */}
                  <div className="min-w-0">
                    {summary.methods.map((method) => (
                      <MethodRow
                        key={method.metricKey}
                        iconName={method.iconName}
                        displayName={method.displayName}
                        value={method.households}
                        color={methodColorFor(method.metricKey)}
                      />
                    ))}
                    {summary.otherServices.map((service) => (
                      <MethodRow
                        key={service.metricKey}
                        iconName={service.iconName}
                        displayName={service.displayName}
                        value={service.total}
                        unit={service.unit}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {coverage.hasIntake && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Intake records
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Tile label="Visits" value={count(summary.visits)} icon={ShoppingBasket} />
                  <Tile label="People served *" value={count(summary.peopleServed)} icon={UsersRound} />
                  <Tile
                    label="Visits without a household record"
                    value={count(summary.identityUnavailableVisits)}
                    icon={BadgeQuestionMark}
                  />
                  {!coverage.hasServiceLog && (
                    <Tile label="Households served" value={count(summary.households)} />
                  )}
                </div>
                <SourcePills sources={coverage.sources.map((source) =>
                  source.source === 'link2feed' ? 'Link2Feed' : 'SIMC')} />
              </div>
            )}

            <div className="space-y-1 border-t pt-3">
              <Footnote>People served counts every visit by household size.</Footnote>
              <Footnote>
                * Not all clients disclose their household size, so this is likely an
                undercount of the true total.
              </Footnote>
              {recordAgreement.sharedDays > 0 && (
                <Footnote>
                  ** Across {count(recordAgreement.sharedDays)} days covered by both
                  records they differ by an average of{' '}
                  {Math.abs(round1(100 - recordAgreement.agreementPercent))}%.
                </Footnote>
              )}
              {serviceLogStartsLater && coverage.serviceLogFirstDate && (
                <Footnote>
                  ** The Service Log begins {monthOfDate(coverage.serviceLogFirstDate)}; earlier
                  dates in this range are covered by intake records only.
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
              <CardDescription>Service by day, by record.</CardDescription>
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
                  <XAxis dataKey="month" tickFormatter={(value) => labelBucket(String(value))} tickLine={false} axisLine={false} minTickGap={48} />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => labelBucket(String(value))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {cutoverDate && <ReferenceLine
                    x={cutoverDate}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    label={{ value: cutoverLabel, position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />}
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
                Each point is one service day.
                {spansCutover && ' The gap between the two intake lines is the changeover, not a drop in service.'}
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
                {(() => {
                  // Only complete calendar years are compared. The first year on
                  // record starts when service began, and the current year is
                  // still running, so quoting either against a full year
                  // compares different lengths of time.
                  const currentYear = String(new Date().getFullYear());
                  const complete = reachAndFrequency.filter((row, index) =>
                    row.year !== currentYear && index > 0);
                  if (complete.length < 2) return null;
                  const peak = complete.reduce((best, row) =>
                    row.visitsPerHousehold > best.visitsPerHousehold ? row : best);
                  const last = complete[complete.length - 1];
                  if (peak.year === last.year) return null;
                  return ` Across complete years, visits per household moved from ${peak.visitsPerHousehold} in ${peak.year} to ${last.visitsPerHousehold} in ${last.year}.`;
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
                Households per service day. Each line begins when that service was
                first recorded.
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
