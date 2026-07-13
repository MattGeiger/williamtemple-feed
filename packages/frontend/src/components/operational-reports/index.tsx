// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';

import { ArrowUpDown } from '@/components/ui/icons';
import { InventoryChart } from '@/components/dashboard/inventory-chart';
import { SectionHeader } from '@/components/shared/section-header';
import { createPageTitleIcon } from '@/components/layout/page-title-icon';
import { FileChartColumnIcon } from '@/components/ui/file-chart-column';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { EnhancedDataTable } from '@/components/ui/enhanced-data-table';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { operationalReportsService } from '@/services/operational-reports';
import {
  LimitChange,
  OperationalAnalyticsResult,
  OperationalRangePreset,
  RationedLimitSeries,
  UnavailableEpisode,
} from '@/types/operational-reports';
import { getChartColor, getChartStatusColor } from '@/lib/colors';

const PageTitleReportsIcon = createPageTitleIcon(FileChartColumnIcon);

const RANGE_LABELS: Record<OperationalRangePreset, string> = {
  'last-30-days': 'Last 30 Days',
  'last-90-days': 'Last 90 Days',
  'last-6-months': 'Last 6 Months',
  'last-12-months': 'Last 12 Months',
  ytd: 'Year to Date',
};

const availabilityConfig = {
  availabilityPercent: {
    label: 'Availability',
    theme: {
      light: getChartStatusColor('success', 'light'),
      dark: getChartStatusColor('success', 'dark'),
    },
  },
} satisfies ChartConfig;

const basePressureConfig = {
  limitedSupply: {
    label: 'Limited Supply',
    theme: {
      light: getChartStatusColor('warning', 'light'),
      dark: getChartStatusColor('warning', 'dark'),
    },
  },
  clearance: {
    label: 'Clearance',
    theme: { light: getChartColor(2, 'light'), dark: getChartColor(2, 'dark') },
  },
} satisfies ChartConfig;

// ChartContainer turns config keys into CSS variables, so the series key
// "1|household" needs a variable-safe form.
export const limitSeriesChartKey = (series: RationedLimitSeries) =>
  `limit_${series.limit}_${series.limitType}`;

export const limitSeriesLabel = (series: RationedLimitSeries) =>
  `${series.limit} Per ${series.limitType === 'person' ? 'Person' : 'Household'}`;

/**
 * The Operational Pressure chart draws one line per limit configuration
 * present in the range (e.g. "1 Per Household"), alongside Limited Supply
 * and Clearance. Series colors start past the base config's palette slots.
 */
export function buildPressureChart(result: OperationalAnalyticsResult) {
  const config: ChartConfig = { ...basePressureConfig };
  result.rationedLimitSeries.forEach((series, index) => {
    config[limitSeriesChartKey(series)] = {
      label: limitSeriesLabel(series),
      theme: {
        light: getChartColor(3 + index, 'light'),
        dark: getChartColor(3 + index, 'dark'),
      },
    };
  });
  const data = result.timeline.map((point) => ({
    ...point,
    ...Object.fromEntries(
      result.rationedLimitSeries.map((series) => [
        limitSeriesChartKey(series),
        point.rationedByLimit[series.key] ?? 0,
      ])
    ),
  }));
  return { config, data };
}

// Plain-language explanations for the Availability Summary KPIs, surfaced
// as hover tooltips. Keep these aligned with the backend definitions in
// packages/backend/src/services/operational-analytics.
const KPI_HELP: Record<string, string> = {
  'Tracked Availability':
    'Availability across the whole selected period: of all the days each tracked item could have been available, the share it actually was.',
  'Item Limits':
    'Food items that currently have a per-person or per-household limit — anything other than No Limit.',
  'Category Limits':
    'Categories that currently have a per-person or per-household limit — anything other than No Limit.',
  'Median Restoration':
    'Typical time for an out-of-stock item to come back in stock during the selected period. Half of restorations were faster, half slower.',
};

const formatPercent = (value: number | null) =>
  value === null ? 'Unknown' : `${value.toFixed(0)}%`;

const formatDuration = (hours: number) => {
  if (hours < 24) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
};

function CsvButton({ cardId, onExport }: { cardId: string; onExport: (id: string) => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={() => onExport(cardId)}>
      <Download className="mr-1 h-4 w-4" />
      Export CSV
    </Button>
  );
}

export function OperationalReportsWorkspace() {
  const [preset, setPreset] = React.useState<OperationalRangePreset>('last-90-days');
  const [result, setResult] = React.useState<OperationalAnalyticsResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const timeZone = React.useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );
  const request = React.useMemo(() => ({ preset, timeZone }), [preset, timeZone]);
  const pressureChart = React.useMemo(
    () =>
      result ? buildPressureChart(result) : { config: basePressureConfig, data: [] },
    [result]
  );

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    operationalReportsService.query(request)
      .then((data) => active && setResult(data))
      .catch((error) => ErrorHandlerService.handleError(error, 'operationalReportsQuery'))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [request]);

  const exportCard = async (cardId: string) => {
    try {
      await operationalReportsService.downloadCardCsv(cardId, request);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'operationalReportsCsv');
    }
  };

  const exportRaw = async () => {
    try {
      await operationalReportsService.downloadRawCsv(request);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'operationalReportsRawCsv');
    }
  };

  return (
    <TooltipProvider>
    <div className="space-y-6 min-w-0 w-full pt-6">
      <div className="w-full min-w-0">
        <SectionHeader
          title="Reports"
          description="Availability, service pressure, and rationing history from everyday inventory updates."
          icon={PageTitleReportsIcon}
        />
      </div>

      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="w-full space-y-2 sm:w-auto">
          <Label htmlFor="operational-report-range">Date Range</Label>
          <Select value={preset} onValueChange={(value) => setPreset(value as OperationalRangePreset)}>
            <SelectTrigger id="operational-report-range" className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RANGE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => void exportRaw()}>
          <Download className="mr-2 h-4 w-4" />
          Export Raw History
        </Button>
      </div>

      {isLoading && !result ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      ) : result ? (
        <>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {/* Current stock status lives in the shared dashboard card; the
                summary card keeps the range-based and rationing KPIs. */}
            <InventoryChart />

            <Card className="min-w-0 h-full">
              <CardHeader className="flex flex-col items-start justify-between gap-2 space-y-0 sm:flex-row">
                <div>
                  <CardTitle>Availability Summary</CardTitle>
                  <CardDescription>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="w-fit cursor-help">
                          Five-minute correction sampling; raw events remain exportable
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-72">
                        When the same item is edited several times within five
                        minutes, reports count only the final result, so quick
                        fixes to a mistake don&apos;t read as real activity.
                        Every edit is still saved and included in raw exports.
                      </TooltipContent>
                    </Tooltip>
                  </CardDescription>
                </div>
                <CsvButton cardId="availability-summary" onExport={exportCard} />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Kpi label="Tracked Availability" value={formatPercent(result.summary.trackedAvailabilityPercent)} />
                  <Kpi label="Item Limits" value={String(result.summary.itemRationedNow)} />
                  <Kpi label="Category Limits" value={String(result.summary.categoryRationedNow)} />
                  <Kpi
                    label="Median Restoration"
                    value={result.summary.medianRestorationHours === null ? 'Unknown' : formatDuration(result.summary.medianRestorationHours)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader className="flex flex-col items-start justify-between gap-2 space-y-0 sm:flex-row">
                <div>
                  <CardTitle>Availability Over Time</CardTitle>
                  <CardDescription>Share of the tracked catalog available to clients</CardDescription>
                </div>
                <CsvButton cardId="availability-over-time" onExport={exportCard} />
              </CardHeader>
              <CardContent>
                <ChartContainer config={availabilityConfig} className="h-64 min-w-0 w-full">
                  <AreaChart data={result.timeline}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(value: string) => format(new Date(`${value}T00:00:00`), 'MMM d')} />
                    <YAxis domain={[0, 100]} width={34} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area dataKey="availabilityPercent" type="monotone" stroke="var(--color-availabilityPercent)" fill="var(--color-availabilityPercent)" fillOpacity={0.2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="flex flex-col items-start justify-between gap-2 space-y-0 sm:flex-row">
                <div>
                  <CardTitle>Operational Pressure</CardTitle>
                  <CardDescription>Recorded states shown separately without a composite score</CardDescription>
                </div>
                <CsvButton cardId="operational-pressure" onExport={exportCard} />
              </CardHeader>
              <CardContent>
                <ChartContainer config={pressureChart.config} className="h-64 min-w-0 w-full">
                  <LineChart data={pressureChart.data}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(value: string) => format(new Date(`${value}T00:00:00`), 'MMM d')} />
                    <YAxis allowDecimals={false} width={34} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line dataKey="limitedSupply" stroke="var(--color-limitedSupply)" dot={false} />
                    <Line dataKey="clearance" stroke="var(--color-clearance)" dot={false} />
                    {result.rationedLimitSeries.map((series) => (
                      <Line
                        key={series.key}
                        dataKey={limitSeriesChartKey(series)}
                        stroke={`var(--color-${limitSeriesChartKey(series)})`}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <DetailHeader title="Unavailable Episodes" description="Each recorded period when an item was unavailable" cardId="unavailable-episodes" onExport={exportCard} />
          <EnhancedDataTable columns={episodeColumns} data={result.episodes} isLoading={isLoading} filterColumn="itemName" filterPlaceholder="Filter items..." />

          <DetailHeader title="Rationing History" description="Item and category limit-policy changes" cardId="rationing-history" onExport={exportCard} />
          <EnhancedDataTable columns={limitColumns} data={result.limitChanges} isLoading={isLoading} filterColumn="entityName" filterPlaceholder="Filter items or categories..." />
        </>
      ) : null}
    </div>
    </TooltipProvider>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  const help = KPI_HELP[label];
  return (
    <div className="space-y-1">
      {help ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <p tabIndex={0} className="w-fit cursor-help text-sm text-muted-foreground">{label}</p>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{help}</TooltipContent>
        </Tooltip>
      ) : (
        <p className="text-sm text-muted-foreground">{label}</p>
      )}
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function DetailHeader({ title, description, cardId, onExport }: { title: string; description: string; cardId: string; onExport: (id: string) => void }) {
  return <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-semibold">{title}</h3><p className="text-sm text-muted-foreground">{description}</p></div><CsvButton cardId={cardId} onExport={onExport} /></div>;
}

// Sortable header, matching the ghost-button + ArrowUpDown pattern used by
// the management tables (e.g. category-management/data-table/columns.tsx).
function sortableHeader<TData>(label: string): ColumnDef<TData>['header'] {
  return ({ column }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

const episodeColumns: ColumnDef<UnavailableEpisode>[] = [
  { accessorKey: 'itemName', header: sortableHeader('Name') },
  { accessorKey: 'categoryName', header: sortableHeader('Category') },
  { accessorKey: 'startedAt', header: sortableHeader('Unavailable Since'), cell: ({ row }) => format(new Date(row.original.startedAt), 'MMM d, yyyy h:mm a') },
  {
    accessorKey: 'endedAt',
    header: sortableHeader('Available Again'),
    cell: ({ row }) => row.original.endedAt ? format(new Date(row.original.endedAt), 'MMM d, yyyy h:mm a') : 'Ongoing',
    // Ongoing episodes (null endedAt) sort as the most recent end.
    sortingFn: (a, b) => (a.original.endedAt ?? '￿').localeCompare(b.original.endedAt ?? '￿'),
  },
  { accessorKey: 'durationHours', header: sortableHeader('Duration'), cell: ({ row }) => formatDuration(row.original.durationHours) },
  { accessorKey: 'resolution', header: sortableHeader('Resolution'), cell: ({ row }) => ({ restored: 'Restored', deleted: 'Item deleted', open_at_range_end: 'Ongoing' }[row.original.resolution]) },
];

const limitColumns: ColumnDef<LimitChange>[] = [
  { accessorKey: 'entityName', header: sortableHeader('Name') },
  { accessorKey: 'entityType', header: sortableHeader('Type'), cell: ({ row }) => row.original.entityType === 'food_item' ? 'Food Item' : 'Category' },
  { accessorKey: 'categoryName', header: sortableHeader('Category'), cell: ({ row }) => row.original.categoryName ?? '—' },
  { accessorKey: 'limit', header: sortableHeader('Limit'), cell: ({ row }) => row.original.isNoLimit ? 'No Limit' : row.original.limit },
  { accessorKey: 'limitType', header: sortableHeader('Applies To'), cell: ({ row }) => row.original.isNoLimit ? '—' : row.original.limitType === 'person' ? 'Per Person' : 'Per Household' },
  { accessorKey: 'recordedAt', header: sortableHeader('Changed'), cell: ({ row }) => format(new Date(row.original.recordedAt), 'MMM d, yyyy h:mm a') },
];
