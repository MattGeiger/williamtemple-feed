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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

/** Every line Service Over Time can draw, in the order they stack. */
const TIMELINE_SERIES = [
  ['link2feedHouseholds', 'Link2Feed households', carbonChartColors.blue.primary.light],
  ['link2feedIndividuals', 'Link2Feed individuals', carbonChartColors.cyan.primary.light],
  ['simcHouseholds', 'SIMC households', carbonChartColors.purple.primary.light],
  ['simcIndividuals', 'SIMC individuals', carbonChartColors.magenta.primary.light],
  ['serviceLogHouseholds', 'Service Log households', carbonChartColors.teal.primary.light],
] as const;

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
    <div className="flex items-center gap-4 border-b py-3.5 last:border-b-0">
      {/* The swatch is the icon's own tinted disc, so the key reads as a legend
          for the chart beside it without needing a separate colour chip. */}
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={color
          ? { backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)` }
          : { backgroundColor: 'hsl(var(--muted))' }}
      >
        <Icon
          className="h-5 w-5"
          {...(color ? { style: { color } } : {})}
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-base">{displayName}</span>
      <span className="shrink-0 text-lg font-semibold tabular-nums">
        {count(value)}
        {unit && <span className="ml-1.5 text-sm font-normal text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}

export function ServiceAnalyticsWorkspace({ analytics }: { analytics: ServiceAnalytics }) {
  const {
    coverage, summary, overTime, seasonal, methodSeries, recordAgreement, householdSize,
    unmetDemand, languages, responseCoverage,
  } = analytics;

  /**
   * The turned-away series carries nulls outside the Service Log's span. A bar
   * chart cannot express "no record" the way a line can break, so those buckets
   * are dropped rather than drawn as zero-height bars that would read as
   * confirmed zeros.
   */
  const unmetBuckets = React.useMemo(
    () => unmetDemand.buckets.filter((bucket) => bucket.turnedAway !== null),
    [unmetDemand.buckets],
  );

  /**
   * Fifty answers down to counts of one is not a chart. The most common are
   * plotted and the rest stated in the footnote — a display limit, not a
   * merge: nothing is folded into anything else, and the export carries all of
   * them.
   */
  const LANGUAGES_PLOTTED = 15;
  const languageRows = languages.values.slice(0, LANGUAGES_PLOTTED);
  const languageOverflow = Math.max(0, languages.values.length - languageRows.length);
  const languageAnsweredPercent = languages.householdsAsked > 0
    ? Math.round((languages.householdsAnswered / languages.householdsAsked) * 100)
    : 0;

  // Monthly buckets bring back the partial-period hazard: the newest month
  // holds only the service days that have happened, so plotting it beside
  // complete months reads as a collapse. Daily buckets need no such guard — a
  // service day is either recorded or absent, never half-counted.
  const currentMonth = new Date().toISOString().slice(0, 7);
  const dropPartial = <T extends { month?: string; bucket?: string }>(rows: T[], key: 'month' | 'bucket') => {
    if (coverage.granularity !== 'month') return { rows, excluded: null as string | null };
    const last = rows[rows.length - 1];
    if (!last || String(last[key]) !== currentMonth) return { rows, excluded: null as string | null };
    return { rows: rows.slice(0, -1), excluded: currentMonth };
  };

  const { rows: timeline, excluded: timelinePartial } = dropPartial(overTime, 'month');
  const { rows: methodBucketsRaw, excluded: methodPartial } = dropPartial(
    methodSeries.buckets as Array<{ bucket?: string }>, 'bucket',
  ) as { rows: Array<Record<string, string | number>>; excluded: string | null };

  const TOTAL_KEY = '__total';
  const methodBuckets = React.useMemo(() => methodBucketsRaw.map((bucket) => {
    const total = methodSeries.methods.reduce((sum, method) => {
      const value = bucket[method.metricKey];
      return typeof value === 'number' ? sum + value : sum;
    }, 0);
    return { ...bucket, [TOTAL_KEY]: total };
  }), [methodBucketsRaw, methodSeries.methods]);

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
  /**
   * Households counts a household once a month however often it came; visits
   * counts every encounter. Staff ask both questions of this chart — "how many
   * families did we reach in March" and "how busy was March" — and the shapes
   * differ, so the measure is a choice rather than an assumption.
   */
  const [seasonalMeasure, setSeasonalMeasure] =
    React.useState<'households' | 'visits'>('households');

  /**
   * Which records this range actually contains.
   *
   * `coverage.sources` is scoped to the range, so a 30-day window after the
   * June 2026 changeover reports SIMC and not Link2Feed. Naming a source that
   * contributed nothing — in a legend, a pill, or a caption — invites the
   * reader to look for a line that was never going to be there.
   */
  const presentSources = React.useMemo(
    () => new Set(coverage.sources.map((entry) => entry.source)),
    [coverage.sources],
  );
  const intakePills = React.useMemo(() => [
    ...(presentSources.has('link2feed') ? ['Link2Feed'] : []),
    ...(presentSources.has('simc') ? ['SIMC'] : []),
  ], [presentSources]);

  /**
   * One entry per record that reaches this range.
   *
   * The payload nulls a series outside its own coverage, so "has any non-null
   * value" is the same question as "did this record contribute". Building the
   * chart config from that rather than from a fixed list is what stops a
   * 30-day range after the changeover from offering two Link2Feed legend
   * entries with no lines under them.
   */
  const timelineKeys = React.useMemo(
    () => TIMELINE_SERIES
      .map(([key]) => key)
      .filter((key) => timeline.some((row) => row[key] !== null && row[key] !== undefined)),
    [timeline],
  );
  const timelineConfig = React.useMemo(() => Object.fromEntries(
    TIMELINE_SERIES
      .filter(([key]) => timelineKeys.includes(key))
      .map(([key, label, color]) => [key, { label, color }]),
  ) satisfies ChartConfig, [timelineKeys]);

  const seasonalMonths = React.useMemo(() => {
    const now = new Date();
    const currentYear = String(now.getFullYear());
    const currentMonthLabel = MONTH_LABELS[now.getMonth()];
    return seasonal[seasonalMeasure].map((row) => {
      if (row.month !== currentMonthLabel || row[currentYear] === undefined) return row;
      const { [currentYear]: _dropped, ...rest } = row;
      return rest;
    });
  }, [seasonal, seasonalMeasure]);

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

  const methodChartConfig = React.useMemo(() => ({
    ...methodConfig,
    [TOTAL_KEY]: { label: 'All households served', color: 'hsl(var(--muted-foreground))' },
  }) satisfies ChartConfig, [methodConfig]);

  const spansYears = coverage.startDate.slice(0, 4) !== coverage.endDate.slice(0, 4);
  const labelBucket = coverage.granularity === 'month'
    ? monthLabel
    : dayLabelFor(spansYears);
  const pointNoun = coverage.granularity === 'month' ? 'one month' : 'one service day';

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
          <CardContent>
            {/* The Service Log is the wider column because it carries the chart
                and the method key; intake is three figures and reads fine in a
                stacked rail beside it. */}
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
              {coverage.hasServiceLog && (
                <section aria-labelledby="service-log-heading" className="min-w-0">
                  <p
                    id="service-log-heading"
                    className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Service Log
                  </p>
                  <div className="grid gap-6 sm:grid-cols-[minmax(0,300px)_1fr] sm:items-center">
                    <ChartContainer config={methodConfig} className="aspect-square w-full max-w-[300px]">
                      <PieChart>
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Pie
                          isAnimationActive={!prefersReducedMotion()}
                          data={methodSlices}
                          dataKey="households"
                          nameKey="displayName"
                          innerRadius="68%"
                          outerRadius="100%"
                          paddingAngle={4}
                        >
                          <Label content={({ viewBox }) => {
                            if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                            return (
                              <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-4xl font-bold">
                                  {count(summary.households)}
                                </tspan>
                                <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 26} className="fill-muted-foreground text-sm">
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

                    {/* The key, in the order the administrator set. */}
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
                </section>
              )}

              {coverage.hasIntake && (
                <section aria-labelledby="intake-heading" className="min-w-0">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p
                      id="intake-heading"
                      className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Intake records
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {coverage.sources.map((source) => (
                        <Badge
                          key={source.source}
                          variant="outline"
                          className="font-normal"
                        >
                          {source.source === 'link2feed' ? 'Link2Feed' : 'SIMC'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Tile label="Visits" value={count(summary.visits)} icon={ShoppingBasket} />
                    <Tile label="People served *" value={count(summary.peopleServed)} icon={UsersRound} />
                    <Tile
                      label="Anonymous visits"
                      value={count(summary.identityUnavailableVisits)}
                      icon={BadgeQuestionMark}
                    />
                    {!coverage.hasServiceLog && (
                      <Tile label="Households served" value={count(summary.households)} />
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="mt-6 space-y-1 border-t pt-4">
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
              <SourcePills sources={[...intakePills, ...(coverage.hasServiceLog ? ['Service Log'] : [])]} />
            </CardHeader>
            <CardContent>
              <ChartContainer config={timelineConfig} className="h-[300px] w-full">
                <LineChart data={timeline} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={(value) => labelBucket(String(value))} tickLine={false} axisLine={false} minTickGap={44} />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip content={<ChartTooltipContent sortByValue labelFormatter={(value) => labelBucket(String(value))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {cutoverDate && <ReferenceLine
                    x={cutoverDate}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    label={{ value: cutoverLabel, position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />}
                  {timelineKeys.map((key) => (
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
                Each point is {pointNoun}.
                {spansCutover && ' The gap between the two intake lines is the changeover, not a drop in service.'}
                {timelinePartial && ` ${monthLabel(timelinePartial)} is still in progress and is not plotted.`}
              </Footnote>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}

      {/* ---- Households by Season ----------------------------------------- */}
      {years.length > 1 && (
        <SelectableBlock
          cardId="service-seasonal-households"
          options={{
            measure: seasonalMeasure,
            yearMode: selectedYears === null ? 'all-available' : 'selected',
            ...(selectedYears === null ? {} : { years: activeYears }),
          }}
        >
          <Card className="min-w-0">
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>
                  {seasonalMeasure === 'visits' ? 'Visits by Season' : 'Households by Season'}
                </CardTitle>
                <CardDescription>Calendar years compared month by month.</CardDescription>
                <SourcePills sources={intakePills} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/* The same animated segmented control the Date Range switcher
                    uses, rather than a second hand-rolled one: the highlight
                    slides between the two, so the change of measure is seen
                    rather than only read off a re-rendered title. Tabs with no
                    TabsContent is how that control is used there too. */}
                <Tabs
                  value={seasonalMeasure}
                  onValueChange={(value) =>
                    setSeasonalMeasure(value as 'households' | 'visits')}
                  className="w-auto"
                >
                  <TabsList aria-label="Measure" className="h-8">
                    <TabsTrigger value="households">Households</TabsTrigger>
                    <TabsTrigger value="visits">Visits</TabsTrigger>
                  </TabsList>
                </Tabs>
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
              </div>
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
                    {/* Sorted highest-first, so the tooltip's order matches how
                        the lines actually stack at the hovered month. The default
                        content lists series in render order — ascending year —
                        which reads as the inverse of what is on screen. Same
                        treatment as Seasonal Inbound Weight. */}
                    <ChartTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const rows = [...payload]
                          .filter((item) => item.value != null)
                          .sort((left, right) => Number(right.value) - Number(left.value));
                        if (rows.length === 0) return null;
                        return (
                          <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
                            <div className="font-medium">{String(label)}</div>
                            {rows.map((item) => (
                              <div key={String(item.dataKey)} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                                  {String(item.name ?? item.dataKey)}
                                </span>
                                <span className="font-mono font-medium tabular-nums">
                                  {count(Number(item.value))}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    {[...activeYears].sort().map((year) => {
                      const isCurrentYear = year === String(new Date().getFullYear());
                      return (
                        <Line
                          key={year}
                          type="monotone"
                          dataKey={year}
                          stroke={seriesColor(year)}
                          strokeWidth={isCurrentYear ? 3 : 2}
                          strokeLinecap="round"
                          dot={activeYears.length === 1}
                          connectNulls={false}
                          // Same emphasis Seasonal Inbound Weight gives the year
                          // in progress, so the two charts read alike.
                          style={isCurrentYear ? {
                            filter: `drop-shadow(0 0 2px var(--color-${year})) drop-shadow(0 0 5px var(--color-${year}))`,
                          } : undefined}
                        />
                      );
                    })}
                  </LineChart>
                </ChartContainer>
              )}
              <Footnote>
                {seasonalMeasure === 'visits' ? (
                  <>
                    Every visit each month, so repeated visits by the same household are
                    counted each time.
                  </>
                ) : (
                  <>
                    Distinct households each month, so repeated visits by the same
                    household are only counted once. Anonymous visits are counted but
                    not deduplicated.
                  </>
                )}
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
              <ChartContainer config={methodChartConfig} className="h-[300px] w-full">
                <LineChart data={methodBuckets} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tickFormatter={(value) => labelBucket(String(value))} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip content={<ChartTooltipContent sortByValue labelFormatter={(value) => labelBucket(String(value))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {/* Dashed and neutral so it reads as the sum of the others
                      rather than a fifth service method. */}
                  {/* Animation off deliberately: Recharts draws a line by
                      animating stroke-dasharray, which overwrites the dash that
                      makes this read as a total rather than a fifth method. */}
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey={TOTAL_KEY}
                    stroke={seriesColor(TOTAL_KEY)}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                  />
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
                Households per {coverage.granularity === 'month' ? 'month' : 'service day'}. Each
                line begins when that service was first recorded.
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
              <SourcePills sources={intakePills} />
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

      {/* ---- Capacity and Unmet Demand ------------------------------------ */}
      {unmetBuckets.length > 0 && (
        <SelectableBlock cardId="service-unmet-demand">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Turned Away</CardTitle>
              <CardDescription>
                Households the pantry could not serve, and the days capacity ran out.
              </CardDescription>
              <SourcePills sources={['Service Log']} />
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <Tile label="Households turned away" value={count(unmetDemand.householdsTurnedAway)} icon={UsersRound} />
                <Tile
                  label="Days it happened"
                  value={count(unmetDemand.daysWithTurnAway)}
                  hint={`of ${count(unmetDemand.daysRecorded)} recorded service days`}
                  icon={BadgeQuestionMark}
                />
                <Tile label="Times capacity was reached" value={count(unmetDemand.capacityReachedDays)} icon={ShoppingBasket} />
              </div>
              <ChartContainer
                config={{ turnedAway: { label: 'Households turned away', color: carbonChartColors.orange.primary.light } } satisfies ChartConfig}
                className="h-[220px] w-full"
              >
                <BarChart data={unmetBuckets} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="bucket"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={unmetDemand.granularity === 'month' ? monthLabel : dayLabelFor(true)}
                    minTickGap={24}
                  />
                  <YAxis tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) =>
                          unmetDemand.granularity === 'month' ? monthLabel(String(value)) : String(value)
                        }
                      />
                    }
                  />
                  <Bar dataKey="turnedAway" fill={seriesColor('turnedAway')} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
              <Footnote>
                Blank entries are treated as a zero count.
              </Footnote>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}

      {/* ---- Languages ---------------------------------------------------- */}
      {languageRows.length > 0 && (
        <SelectableBlock cardId="service-languages">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Languages Spoken at Home</CardTitle>
              <CardDescription>
                As households recorded them, in their own words.
              </CardDescription>
              <SourcePills sources={intakePills} />
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{ households: { label: 'Households', color: carbonChartColors.teal.primary.light } } satisfies ChartConfig}
                className="h-[420px] w-full"
              >
                <BarChart data={languageRows} layout="vertical" margin={{ left: 8, right: 24, top: 4 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="language"
                    tickLine={false}
                    axisLine={false}
                    width={132}
                    interval={0}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="households" fill={seriesColor('households')} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ChartContainer>
              <Footnote>
                About {languageAnsweredPercent}% of households answered this question
                {languageOverflow > 0 && `, across ${count(languages.values.length)} answers; the ${count(languageOverflow)} rarest are in the exported data`}
                . “Mandarin Chinese” counts as “Mandarin”; the export keeps every answer
                as recorded.
              </Footnote>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}

      {/* ---- Response Coverage -------------------------------------------- */}
      {responseCoverage.length > 0 && (
        <SelectableBlock cardId="service-response-coverage">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Demographics Questions Response Rate</CardTitle>
              <CardDescription>
                The denominator behind every other demographic figure.
              </CardDescription>
              <SourcePills sources={intakePills} />
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  provided: { label: 'Answered', color: carbonChartColors.blue.primary.light },
                  notProvided: { label: 'Not answered', color: carbonChartColors.warmGray.primary.light },
                } satisfies ChartConfig}
                className="h-[520px] w-full"
              >
                <BarChart data={responseCoverage} layout="vertical" margin={{ left: 8, right: 24, top: 4 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="displayName"
                    tickLine={false}
                    axisLine={false}
                    width={168}
                    interval={0}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="provided" stackId="a" fill={seriesColor('provided')} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="notProvided" stackId="a" fill={seriesColor('notProvided')} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ChartContainer>
              <Footnote>
                Questions asked during intake. Includes intake data from both Link2Feed
                and SIMC. Not all households have been asked the same questions.
                Declining to answer counts as not answered. Read any demographic share
                against this card first.
              </Footnote>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}
    </div>
  );
}
