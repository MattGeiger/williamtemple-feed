// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// Client Analytics — the fourth lens, beside Operations, Procurement and
// Service.
//
// Service answers what happened on a service day; Clients answers who the
// people are. The two shared a tab while they shared an import, which is a
// reason about plumbing rather than about the questions being asked — a
// household-size distribution and a count of turned-away households are not
// the same kind of fact and do not belong under one heading.
//
// The date range still applies. These cards join demographics to encounters
// through the client id, so "how many non-English-speaking households did we
// serve in March 2023" is a question this lens can answer and a roster of
// everyone on file cannot.
//
// Today this reads the same Service analytics payload, because the Link2Feed
// and SIMC client exports are not imported yet. When they are, the payload
// changes and these cards keep their ids.

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SelectableBlock } from '@/components/reports/selection';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { carbonChartColors } from '@/lib/colors';
import { formatAxisNumber, formatNumber } from '@/lib/formatting/number';
import {
  serviceApi,
  type DemographicBreakdown,
  type ServiceAnalytics,
} from '@/services/service';
import type { AnalyticsDateRange } from '@/types/analytics';

const count = (value: number) => formatNumber(value);
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


/**
 * One demographic question as ranked bars.
 *
 * Ethnicity, gender identity and housing type differ only in which answers
 * they hold, so they share a component rather than three near-copies. The
 * denominators travel with it: a bar is meaningless without how many were
 * asked, and a multi-answer question needs to say why its bars sum above the
 * people counted.
 */
function BreakdownCard({
  cardId, title, description, breakdown, color, height = '320px', children,
}: {
  cardId: string;
  title: string;
  description: string;
  breakdown: DemographicBreakdown;
  color: string;
  height?: string;
  children?: React.ReactNode;
}) {
  if (breakdown.values.length === 0) return null;
  const percent = breakdown.asked > 0
    ? Math.round((breakdown.answered / breakdown.asked) * 100)
    : 0;
  const unit = breakdown.unit === 'people' ? 'people' : 'households';

  return (
    <SelectableBlock cardId={cardId}>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          <SourcePills sources={breakdown.sources.map(sourceLabel)} />
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{ count: { label: unit === 'people' ? 'People' : 'Households', color } } satisfies ChartConfig}
            className={`w-full`}
            style={{ height }}
          >
            <BarChart data={breakdown.values} layout="vertical" margin={{ left: 8, right: 24, top: 4 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={formatAxisNumber} />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={176} interval={0} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill={seriesColor('count')} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ChartContainer>
          <Footnote>
            About {percent}% of {unit} answered this question ({count(breakdown.answered)} of{' '}
            {count(breakdown.asked)}).
            {breakdown.multiValue &&
              ` A ${unit === 'people' ? 'person' : 'household'} can give more than one answer, so the bars sum above that.`}
            {children}
          </Footnote>
        </CardContent>
      </Card>
    </SelectableBlock>
  );
}

/** Record names as staff know them, not as the importer spells them. */
const sourceLabel = (source: string) =>
  source === 'link2feed' ? 'Link2Feed' : source === 'simc' ? 'SIMC' : source;

export function ClientAnalyticsLens({ range }: { range: AnalyticsDateRange }) {
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
      .catch((error) => ErrorHandlerService.handleError(error, 'clientAnalytics'))
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [range.preset, range.startDate, range.endDate]);

  if (isLoading && !analytics) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!analytics || !analytics.coverage.hasIntake) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>No client records in this range</CardTitle>
          <CardDescription>
            Client details come from intake. No Link2Feed or SIMC records cover these
            dates — widen the date range, or import visit data from Information &rarr;
            Data.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <ClientAnalyticsWorkspace analytics={analytics} />;
}

export function ClientAnalyticsWorkspace({ analytics }: { analytics: ServiceAnalytics }) {
  const {
    coverage, householdSize, languages, responseCoverage, ageBands, geography, demographics,
  } = analytics;

  /**
   * Only the records this range contains. `coverage.sources` is range-scoped,
   * so a window after the June 2026 changeover names SIMC alone rather than
   * offering a Link2Feed pill with nothing behind it.
   */
  const presentSources = React.useMemo(
    () => new Set(coverage.sources.map((entry) => entry.source)),
    [coverage.sources],
  );
  const intakePills = React.useMemo(() => [
    ...(presentSources.has('link2feed') ? ['Link2Feed'] : []),
    ...(presentSources.has('simc') ? ['SIMC'] : []),
  ], [presentSources]);

  // The tail past seven is thin and reaches twelve, so it folds into one 8+
  // bucket rather than drawing five bars that round to nothing.
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

  /**
   * Fifty answers down to counts of one is not a chart. The most common are
   * plotted and the rest stated in the footnote — a display limit, not a
   * merge: the export carries every answer.
   */
  const LANGUAGES_PLOTTED = 15;
  const languageRows = languages.values.slice(0, LANGUAGES_PLOTTED);
  const languageOverflow = Math.max(0, languages.values.length - languageRows.length);
  /**
   * Postal codes are a long tail — 272 of them, most with a handful of
   * households. The named rows are the ones a reader can act on; the rest are
   * summed into one row rather than dropped, so the bars still account for
   * every household with a recorded address.
   */
  /**
   * Which record's ages to show. Not a filter — the two count different
   * people, so switching changes what a bar means.
   */
  const [ageSource, setAgeSource] = React.useState<'link2feed' | 'simc'>(
    ageBands.link2feed.available ? 'link2feed' : 'simc',
  );
  const activeAges = ageSource === 'link2feed' ? ageBands.link2feed : ageBands.simc;

  const POSTAL_CODES_PLOTTED = 12;
  const geographyRows = React.useMemo(() => {
    const top = geography.postalCodes.slice(0, POSTAL_CODES_PLOTTED);
    const tail = geography.postalCodes.slice(POSTAL_CODES_PLOTTED);
    const tailTotal = tail.reduce((sum, row) => sum + row.clients, 0);
    return tailTotal > 0
      ? [...top, { postalCode: `${tail.length} more postal codes`, clients: tailTotal }]
      : top;
  }, [geography.postalCodes]);

  const languageAnsweredPercent = languages.householdsAsked > 0
    ? Math.round((languages.householdsAnswered / languages.householdsAsked) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* ---- Household Size ----------------------------------------------- */}
      {sizeData.length > 0 && (
        <SelectableBlock cardId="clients-household-size">
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
                  <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={formatAxisNumber} />
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

      {/* ---- Age ----------------------------------------------------------- */}
      <SelectableBlock cardId="clients-age-bands" options={{ source: ageSource }}>
        <Card className="min-w-0">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Age of People Served</CardTitle>
              <CardDescription>
                Age as of {ageBands.asOfYear}, for those served in this range.
              </CardDescription>
              <SourcePills sources={[sourceLabel(ageSource)]} />
            </div>
            {/* The two records count different people, so this is a source
                switch rather than a filter — the y-axis changes meaning with
                it, from households to people. */}
            <Tabs
              value={ageSource}
              onValueChange={(value) => setAgeSource(value as 'link2feed' | 'simc')}
              className="w-auto"
            >
              <TabsList aria-label="Age source" className="h-8">
                <TabsTrigger value="link2feed">Link2Feed</TabsTrigger>
                <TabsTrigger value="simc">SIMC</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {!activeAges.available ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No ages recorded in this range from {sourceLabel(ageSource)}.
                {ageSource === 'link2feed'
                  ? ' Link2Feed stopped receiving visits at the June 2026 changeover.'
                  : ' SIMC records began in June 2026.'}
              </p>
            ) : (
              <>
                <ChartContainer
                  config={{ count: { label: activeAges.unit === 'people' ? 'People' : 'Households', color: carbonChartColors.purple.primary.light } } satisfies ChartConfig}
                  className="h-[260px] w-full"
                >
                  <BarChart data={activeAges.bands} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={formatAxisNumber} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill={seriesColor('count')} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
                <Footnote>
                  {ageSource === 'link2feed'
                    ? 'Link2Feed records one birth year per household — the person who registered — so these are heads of household.'
                    : 'SIMC records a birth year for each household member, so these are people.'}
                  {activeAges.withoutBirthYear > 0 &&
                    ` ${count(activeAges.withoutBirthYear)} have no birth year on file and are not counted here.`}
                  {activeAges.estimatedBirthYears > 0 &&
                    ` ${count(activeAges.estimatedBirthYears)} birth years were estimated at intake rather than reported.`}
                </Footnote>
              </>
            )}
          </CardContent>
        </Card>
      </SelectableBlock>

      {/* ---- Ethnicity, gender, housing ------------------------------------ */}
      <BreakdownCard
        cardId="clients-ethnicity"
        title="Ethnicity"
        description="As households reported it at intake."
        breakdown={demographics.ethnicity}
        color={carbonChartColors.magenta.primary.light}
      >
        {' Recorded in Link2Feed only; SIMC asks a different question with different categories.'}
      </BreakdownCard>

      <BreakdownCard
        cardId="clients-race-simc"
        title="Race or Ethnicity (SIMC)"
        description="As each household member reported it at intake."
        breakdown={demographics.simcRaceOrEthnicity}
        color={carbonChartColors.orange.primary.light}
        height="280px"
      >
        {' Counted in people rather than households, and not comparable with the Link2Feed ethnicity card — the two systems ask different questions.'}
      </BreakdownCard>

      <BreakdownCard
        cardId="clients-gender-identity"
        title="Gender Identity"
        description="As households reported it at intake."
        breakdown={demographics.genderIdentity}
        color={carbonChartColors.cyan.primary.light}
        height="280px"
      />

      <BreakdownCard
        cardId="clients-housing-type"
        title="Housing Type"
        description="Where households said they were living."
        breakdown={demographics.housingType}
        color={carbonChartColors.green.primary.light}
        height="360px"
      >
        {' Pairs with the no-fixed-address figure on Where Households Live.'}
      </BreakdownCard>

      {/* ---- Geography ------------------------------------------------------ */}
      {geographyRows.length > 0 && (
        <SelectableBlock cardId="clients-geography">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Where Households Live</CardTitle>
              <CardDescription>Households by postal code.</CardDescription>
              <SourcePills sources={intakePills} />
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{ clients: { label: 'Households', color: carbonChartColors.green.primary.light } } satisfies ChartConfig}
                className="h-[380px] w-full"
              >
                <BarChart data={geographyRows} layout="vertical" margin={{ left: 8, right: 24, top: 4 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={formatAxisNumber} />
                  <YAxis
                    type="category"
                    dataKey="postalCode"
                    tickLine={false}
                    axisLine={false}
                    width={148}
                    interval={0}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="clients" fill={seriesColor('clients')} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ChartContainer>
              <Footnote>
                A postal code is not a catchment area, and this is not a map — it is
                where households said they live.
                {geography.noFixedAddressAsked && geography.noFixedAddress > 0 &&
                  ` ${count(geography.noFixedAddress)} households have no fixed address and are counted separately, not by postal code: SIMC requires one, so the agency's own is recorded instead.`}
                {geography.clientsWithoutPostalCode > 0 &&
                  ` ${count(geography.clientsWithoutPostalCode)} did not give a postal code.`}
              </Footnote>
            </CardContent>
          </Card>
        </SelectableBlock>
      )}

      {/* ---- Languages ---------------------------------------------------- */}
      {languageRows.length > 0 && (
        <SelectableBlock cardId="clients-languages">
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
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={formatAxisNumber} />
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
        <SelectableBlock cardId="clients-response-coverage">
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
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={formatAxisNumber} />
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
