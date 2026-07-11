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

const pressureConfig = {
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
  itemRationed: {
    label: 'Item Limit',
    theme: { light: getChartColor(4, 'light'), dark: getChartColor(4, 'dark') },
  },
} satisfies ChartConfig;

// Plain-language explanations for the Availability Summary KPIs, surfaced
// as hover tooltips. Keep these aligned with the backend definitions in
// packages/backend/src/services/operational-analytics.
const KPI_HELP: Record<string, string> = {
  'Available Now':
    'Tracked items currently in stock, including items marked Limited Supply or Clearance.',
  'Unavailable Now':
    'Tracked items currently out of stock.',
  'Limited Supply':
    'In-stock items staff have flagged as Limited Supply (supply pressure recorded, item still available).',
  'Clearance':
    'In-stock items staff have flagged as Clearance.',
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
          <Card className="min-w-0">
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
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Kpi label="Available Now" value={String(result.summary.availableNow)} />
                <Kpi label="Unavailable Now" value={String(result.summary.unavailableNow)} />
                <Kpi label="Limited Supply" value={String(result.summary.limitedSupplyNow)} />
                <Kpi label="Clearance" value={String(result.summary.clearanceNow)} />
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
                <ChartContainer config={pressureConfig} className="h-64 min-w-0 w-full">
                  <LineChart data={result.timeline}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(value: string) => format(new Date(`${value}T00:00:00`), 'MMM d')} />
                    <YAxis allowDecimals={false} width={34} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line dataKey="limitedSupply" stroke="var(--color-limitedSupply)" dot={false} />
                    <Line dataKey="clearance" stroke="var(--color-clearance)" dot={false} />
                    <Line dataKey="itemRationed" stroke="var(--color-itemRationed)" dot={false} />
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

const episodeColumns: ColumnDef<UnavailableEpisode>[] = [
  { accessorKey: 'itemName', header: 'Name' },
  { accessorKey: 'categoryName', header: 'Category' },
  { accessorKey: 'startedAt', header: 'Unavailable Since', cell: ({ row }) => format(new Date(row.original.startedAt), 'MMM d, yyyy h:mm a') },
  { accessorKey: 'endedAt', header: 'Available Again', cell: ({ row }) => row.original.endedAt ? format(new Date(row.original.endedAt), 'MMM d, yyyy h:mm a') : 'Ongoing' },
  { accessorKey: 'durationHours', header: 'Duration', cell: ({ row }) => formatDuration(row.original.durationHours) },
  { accessorKey: 'resolution', header: 'Resolution', cell: ({ row }) => ({ restored: 'Restored', deleted: 'Item deleted', open_at_range_end: 'Ongoing' }[row.original.resolution]) },
];

const limitColumns: ColumnDef<LimitChange>[] = [
  { accessorKey: 'entityName', header: 'Name' },
  { accessorKey: 'entityType', header: 'Type', cell: ({ row }) => row.original.entityType === 'food_item' ? 'Food Item' : 'Category' },
  { accessorKey: 'categoryName', header: 'Category', cell: ({ row }) => row.original.categoryName ?? '—' },
  { accessorKey: 'limit', header: 'Limit', cell: ({ row }) => row.original.isNoLimit ? 'No Limit' : row.original.limit },
  { accessorKey: 'limitType', header: 'Applies To', cell: ({ row }) => row.original.isNoLimit ? '—' : row.original.limitType === 'person' ? 'Per Person' : 'Per Household' },
  { accessorKey: 'recordedAt', header: 'Changed', cell: ({ row }) => format(new Date(row.original.recordedAt), 'MMM d, yyyy h:mm a') },
];
