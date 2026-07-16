// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  Database,
  PackageOpen,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  AnalyticsRangeControl,
  analyticsRangeFromSearchParams,
  RANGE_URL_VALUES,
} from '@/components/analytics/range-control';
import { createPageTitleIcon } from '@/components/layout/page-title-icon';
import { OperationalAnalyticsWorkspace } from '@/components/operational-reports';
import { SectionHeader } from '@/components/shared/section-header';
import { ChartNoAxesCombinedIcon } from '@/components/ui/chart-no-axes-combined';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EnhancedDataTable } from '@/components/ui/enhanced-data-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { carbonCategoricalTheme, carbonTheme } from '@/lib/colors';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { messageService } from '@/services/message';
import { procurementService } from '@/services/procurement';
import type {
  AcquisitionClass,
  ProcurementAnalytics,
  ProcurementChannel,
  ProcurementProductContinuity,
} from '@/types/procurement';
import type { AnalyticsDateRange } from '@/types/analytics';
import { DEFAULT_ANALYTICS_RANGE } from '@/types/analytics';

const PageTitleAnalyticsIcon = createPageTitleIcon(ChartNoAxesCombinedIcon);
const MAX_SEASONAL_YEARS = 6;

const acquisitionMixConfig = {
  weight: { label: 'Inbound Weight', theme: carbonTheme('blue') },
} satisfies ChartConfig;

const channelMixConfig = {
  weight: { label: 'Inbound Weight', theme: carbonTheme('teal') },
} satisfies ChartConfig;

const monthlyWeightConfig = {
  donatedWeight: { label: 'Donated', theme: carbonTheme('green') },
  purchDonWeight: { label: 'Purch-Don', theme: carbonTheme('teal') },
  governmentWeight: { label: 'Government', theme: carbonTheme('purple') },
  purchasedWeight: { label: 'Purchased', theme: carbonTheme('orange') },
} satisfies ChartConfig;

const recurrenceConfig = {
  productCount: { label: 'Supplier Products', theme: carbonTheme('magenta') },
} satisfies ChartConfig;

const patternConfig = {
  activeMonthPercent: { label: 'Active-month coverage', theme: carbonTheme('blue') },
  receiptsPerActiveMonth: { label: 'Receipts per active month', theme: carbonTheme('purple') },
  totalWeight: { label: 'Total inbound pounds', theme: carbonTheme('teal') },
  ofbWarehouse: { label: 'OFB Warehouse', theme: carbonTheme('blue') },
  freshAlliance: { label: 'Fresh Alliance', theme: carbonTheme('green') },
} satisfies ChartConfig;

const acquisitionLabels: Record<AcquisitionClass, string> = {
  DONATED: 'Donated',
  'PURCH-DON': 'Purch-Don',
  GOVERNMENT: 'Government',
  PURCHASED: 'Purchased',
};

const channelLabels: Record<ProcurementChannel, string> = {
  ofb_warehouse: 'OFB Warehouse',
  fresh_alliance: 'Fresh Alliance',
};

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const toPounds = (hundredths: number) => hundredths / 100;
const pounds = (hundredths: number | null) =>
  hundredths === null
    ? 'Unknown'
    : `${toPounds(hundredths).toLocaleString(undefined, { maximumFractionDigits: 2 })} lb`;
const dollars = (cents: number) =>
  (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const attributableDollars = (cents: number | null) =>
  cents === null ? 'Not attributable' : dollars(cents);

export function AnalyticsWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const activeTab = searchParams.get('tab') === 'procurement'
    ? 'procurement'
    : 'operations';
  const range = React.useMemo(
    () => analyticsRangeFromSearchParams(searchParams),
    // The serialized query is the stable source of truth for the range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchKey]
  );

  const updateSearchParams = React.useCallback((update: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    update(next);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setActiveTab = (tab: string) => updateSearchParams((next) => {
    if (tab === 'procurement') next.set('tab', tab);
    else next.delete('tab');
  });

  const setRange = (nextRange: AnalyticsDateRange) => updateSearchParams((next) => {
    next.set('range', RANGE_URL_VALUES[nextRange.preset]);
    if (nextRange.preset === 'custom' && nextRange.startDate && nextRange.endDate) {
      next.set('from', nextRange.startDate);
      next.set('to', nextRange.endDate);
    } else {
      next.delete('from');
      next.delete('to');
    }
  });

  return (
    <div className="space-y-6 min-w-0 w-full pt-6">
      <SectionHeader
        title="Analytics"
        description="Operational patterns and external supply data, kept in distinct analytical lenses."
        icon={PageTitleAnalyticsIcon}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-[360px]">
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="procurement">Procurement</TabsTrigger>
        </TabsList>
        <AnalyticsRangeControl value={range} onChange={setRange} />
        <TabsContents>
          <TabsContent value="operations" className="pt-4">
            <OperationalAnalyticsWorkspace showHeader={false} range={range} />
          </TabsContent>
          <TabsContent value="procurement" className="pt-4">
            <ProcurementAnalyticsWorkspace range={range} />
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
  );
}

export function ProcurementAnalyticsWorkspace({
  range = DEFAULT_ANALYTICS_RANGE,
}: {
  range?: AnalyticsDateRange;
} = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [analytics, setAnalytics] = React.useState<ProcurementAnalytics | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedSeasonalYears, setSelectedSeasonalYears] = React.useState<string[]>([]);
  const selectedChannel = searchParams.get('channel') === 'ofb_warehouse' ||
    searchParams.get('channel') === 'fresh_alliance'
    ? searchParams.get('channel')!
    : 'all';
  const acquisitionParam = searchParams.get('acquisition');
  const selectedAcquisition = acquisitionParam && acquisitionParam in acquisitionLabels
    ? acquisitionParam
    : 'all';

  const setProcurementFilter = (key: 'channel' | 'acquisition', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    procurementService.getAnalytics({
      ...range,
      ...(selectedChannel === 'all' ? {} : { channel: selectedChannel as ProcurementChannel }),
      ...(selectedAcquisition === 'all' ? {} : { acquisitionClass: selectedAcquisition as AcquisitionClass }),
    })
      .then((result) => {
        if (!active) return;
        setAnalytics(result);
        setSelectedSeasonalYears((current) => {
          const valid = current.filter((year) => result.availableYears.includes(year));
          return valid.length > 0 ? valid : result.availableYears.slice(0, 5).reverse();
        });
      })
      .catch((error) => ErrorHandlerService.handleError(error, 'procurementAnalytics'))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range, selectedAcquisition, selectedChannel]);

  const canCompareSeasons = Boolean(
    analytics && analytics.range.startDate.slice(0, 4) !== analytics.range.endDate.slice(0, 4)
  );
  const seasonalYears = canCompareSeasons
    ? selectedSeasonalYears
    : analytics?.availableYears.slice(0, 1) ?? [];
  const seasonalConfig = React.useMemo(
    () => Object.fromEntries(seasonalYears.map((year, index) => [
      year,
      { label: year, theme: carbonCategoricalTheme(index) },
    ])) satisfies ChartConfig,
    [seasonalYears]
  );
  const seasonalData = React.useMemo(() => {
    const rows = monthLabels.map((month, index) => ({ month, monthNumber: index + 1 } as Record<string, string | number>));
    for (const point of analytics?.seasonalWeight ?? []) {
      if (seasonalYears.includes(point.year)) {
        rows[point.month - 1][point.year] = toPounds(point.weightHundredths);
      }
    }
    return rows;
  }, [analytics, seasonalYears]);

  const monthlyWeight = React.useMemo(
    () => (analytics?.monthlyWeight ?? []).map((row) => ({
      month: row.month,
      donatedWeight: toPounds(row.donatedWeightHundredths),
      purchDonWeight: toPounds(row.purchDonWeightHundredths),
      governmentWeight: toPounds(row.governmentWeightHundredths),
      purchasedWeight: toPounds(row.purchasedWeightHundredths),
    })),
    [analytics]
  );
  const acquisitionMix = React.useMemo(
    () => (analytics?.acquisitionMix ?? []).map((row) => ({
      acquisitionClass: acquisitionLabels[row.acquisitionClass],
      weight: toPounds(row.weightHundredths),
    })),
    [analytics]
  );
  const channelMix = React.useMemo(
    () => (analytics?.channelMix ?? []).map((row) => ({
      channel: channelLabels[row.channel],
      weight: toPounds(row.weightHundredths),
    })),
    [analytics]
  );
  const patternData = React.useMemo(
    () => (analytics?.productContinuity ?? []).map((product) => ({
      ...product,
      activeMonthPercent: Number((product.activeMonthShare * 100).toFixed(1)),
      receiptsPerActiveMonth: Number(product.receiptsPerActiveMonth.toFixed(2)),
      totalWeight: toPounds(product.totalWeightHundredths),
    })),
    [analytics]
  );
  const continuityColumns = React.useMemo<ColumnDef<ProcurementProductContinuity>[]>(() => [
    {
      accessorKey: 'description',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Product <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 280,
      cell: ({ row }) => <span className="font-medium">{row.original.description}</span>,
    },
    { accessorKey: 'productCode', header: 'Code', size: 90 },
    {
      accessorKey: 'procurementChannel',
      header: 'Channel',
      size: 130,
      cell: ({ row }) => channelLabels[row.original.procurementChannel],
    },
    {
      accessorKey: 'acquisitionClass',
      header: 'Acquisition',
      size: 115,
      cell: ({ row }) => acquisitionLabels[row.original.acquisitionClass],
    },
    {
      accessorKey: 'receiptDateCount',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Receipt Dates <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 135,
    },
    {
      accessorKey: 'activeMonthShare',
      header: 'Active Months',
      size: 120,
      cell: ({ row }) => `${(row.original.activeMonthShare * 100).toFixed(1)}%`,
    },
    {
      accessorKey: 'totalWeightHundredths',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Total Weight <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 145,
      cell: ({ row }) => pounds(row.original.totalWeightHundredths),
    },
    {
      accessorKey: 'medianGapDays',
      header: 'Median Gap',
      size: 115,
      cell: ({ row }) => row.original.medianGapDays === null
        ? 'Insufficient history'
        : `${row.original.medianGapDays.toLocaleString(undefined, { maximumFractionDigits: 1 })} days`,
    },
    {
      accessorKey: 'lastReceivedDate',
      header: 'Last Received',
      size: 130,
      cell: ({ row }) => format(parseISO(row.original.lastReceivedDate), 'MMM d, yyyy'),
    },
  ], []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!analytics?.status.hasData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 p-6 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <div className="max-w-lg space-y-2">
            <h3 className="text-lg font-semibold">No procurement data yet</h3>
            <p className="text-sm text-muted-foreground">
              Import a standardized Oregon Food Bank CSV to begin analyzing inbound weight, acquisition mix, and product recurrence. FEED discards the source file after import.
            </p>
          </div>
          <Button onClick={() => navigate('/data-management')}>
            <Database className="mr-2 h-4 w-4" />
            Manage Procurement Data
          </Button>
        </CardContent>
      </Card>
    );
  }

  const summary = analytics.summary;
  const middleRange = summary.lowerQuartileOrderWeightHundredths === null || summary.upperQuartileOrderWeightHundredths === null
    ? 'Unknown'
    : `${pounds(summary.lowerQuartileOrderWeightHundredths)}–${pounds(summary.upperQuartileOrderWeightHundredths)}`;
  const acquisitionWeightTotal = analytics.acquisitionMix.reduce((sum, row) => sum + row.weightHundredths, 0);
  const channelWeightTotal = analytics.channelMix.reduce((sum, row) => sum + row.weightHundredths, 0);

  const toggleSeasonalYear = (year: string, checked: boolean) => {
    setSelectedSeasonalYears((current) => {
      if (!checked) return current.filter((value) => value !== year);
      if (current.includes(year)) return current;
      if (current.length >= MAX_SEASONAL_YEARS) {
        messageService.info(`Choose up to ${MAX_SEASONAL_YEARS} years so the seasonal comparison remains readable.`);
        return current;
      }
      return [...current, year].sort();
    });
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-semibold">Oregon Food Bank Procurement</h3>
          <p className="text-sm text-muted-foreground">
            Inbound supply observations remain separate from service-catalog availability.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/data-management')}>
          <Database className="mr-2 h-4 w-4" />
          Manage Procurement Data
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={selectedChannel} onValueChange={(value) => setProcurementFilter('channel', value)}>
          <SelectTrigger aria-label="Procurement channel"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="ofb_warehouse">OFB Warehouse</SelectItem>
            <SelectItem value="fresh_alliance">Fresh Alliance</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedAcquisition} onValueChange={(value) => setProcurementFilter('acquisition', value)}>
          <SelectTrigger aria-label="Acquisition class"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Acquisition Classes</SelectItem>
            {Object.entries(acquisitionLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {analytics.status.isStale && analytics.status.latestDeliveryDate && (
        <Alert variant="warning" className="items-start">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <AlertTitle>Procurement data may be out of date</AlertTitle>
            <AlertDescription>
              The latest recorded delivery was {analytics.status.daysSinceLatestDelivery} calendar days ago ({format(parseISO(analytics.status.latestDeliveryDate), 'MMM d, yyyy')}). Import a current OFB export before relying on recent-period trends.
            </AlertDescription>
          </div>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Inbound Supply Summary</CardTitle>
          <CardDescription>Source orders, receiving dates, inbound weight, and received-product recurrence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 xl:grid-cols-5">
            <ProcurementKpi label="Total Inbound Weight" value={pounds(summary.totalWeightHundredths)} />
            <ProcurementKpi label="Source Orders" value={summary.sourceOrderCount.toLocaleString()} />
            <ProcurementKpi label="Receiving Dates" value={summary.receivingDateCount.toLocaleString()} />
            <ProcurementKpi label="Typical Order" value={pounds(summary.medianOrderWeightHundredths)} />
            <ProcurementKpi label="Middle 50% of Orders" value={middleRange} />
            <ProcurementKpi label="Typical Source Lines" value={summary.medianLinesPerOrder?.toLocaleString() ?? 'Unknown'} />
            <ProcurementKpi label="Supplier Products Received" value={summary.supplierProductCodes.toLocaleString()} />
            <ProcurementKpi label="Received Once" value={summary.productsReceivedOnce.toLocaleString()} />
            <ProcurementKpi label="Received on 10+ Dates" value={summary.productsReceivedTenOrMore.toLocaleString()} />
            <ProcurementKpi label="Zero-Inbound Lines" value={summary.zeroInboundLineCount.toLocaleString()} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recorded Cost Summary</CardTitle>
          <CardDescription>
            {summary.costAdjustmentsAttributable
              ? 'Charges and credits remain separate; net values are never allocated across products'
              : 'Product charges follow the active filter; order-level fees, grants, and net cost cannot be attributed to one channel or acquisition class'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          <ProcurementKpi label="Gross Product Charges" value={dollars(summary.calculatedGrossProductChargesCents)} />
          <ProcurementKpi label="Service Fees" value={attributableDollars(summary.serviceFeesCents)} />
          <ProcurementKpi label="Grants Applied" value={attributableDollars(summary.grantsAppliedCents)} />
          <ProcurementKpi label="Net Recorded Charge" value={attributableDollars(summary.netRecordedCostCents)} />
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader><CardTitle>Acquisition Mix</CardTitle><CardDescription>Inbound pounds by OFB acquisition class</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer config={acquisitionMixConfig} className="h-72 min-w-0 w-full">
              <BarChart accessibilityLayer data={acquisitionMix} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis dataKey="acquisitionClass" type="category" width={92} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="weight" fill="var(--color-weight)" radius={3} />
              </BarChart>
            </ChartContainer>
            <MixDetails total={acquisitionWeightTotal} rows={analytics.acquisitionMix.map((row) => ({ label: acquisitionLabels[row.acquisitionClass], weight: row.weightHundredths }))} />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader><CardTitle>Procurement Channels</CardTitle><CardDescription>Fresh Alliance remains distinct from OFB warehouse supply</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer config={channelMixConfig} className="h-72 min-w-0 w-full">
              <BarChart accessibilityLayer data={channelMix} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis dataKey="channel" type="category" width={110} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="weight" fill="var(--color-weight)" radius={3} />
              </BarChart>
            </ChartContainer>
            <MixDetails total={channelWeightTotal} rows={analytics.channelMix.map((row) => ({ label: channelLabels[row.channel], weight: row.weightHundredths }))} />
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader><CardTitle>Product Recurrence Distribution</CardTitle><CardDescription>Only positive-quantity, positive-weight receipt dates contribute</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer config={recurrenceConfig} className="h-72 min-w-0 w-full">
              <BarChart accessibilityLayer data={analytics.recurrenceDistribution} margin={{ left: 8, right: 16 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} width={38} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="productCount" fill="var(--color-productCount)" radius={3} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader><CardTitle>Procurement Pattern Matrix</CardTitle><CardDescription>Coverage across observed months versus receipt frequency; point size represents inbound weight</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer config={patternConfig} className="h-72 min-w-0 w-full">
              <ScatterChart accessibilityLayer margin={{ left: 8, right: 18, top: 10 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="activeMonthPercent" domain={[0, 100]} unit="%" tickLine={false} axisLine={false} />
                <YAxis type="number" dataKey="receiptsPerActiveMonth" width={42} tickLine={false} axisLine={false} />
                <ZAxis type="number" dataKey="totalWeight" range={[35, 220]} />
                <ChartTooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.description} />}
                />
                <Scatter name="OFB Warehouse" data={patternData.filter((row) => row.procurementChannel === 'ofb_warehouse')} fill="var(--color-ofbWarehouse)" />
                <Scatter name="Fresh Alliance" data={patternData.filter((row) => row.procurementChannel === 'fresh_alliance')} fill="var(--color-freshAlliance)" />
                <ChartLegend content={<ChartLegendContent />} />
              </ScatterChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader><CardTitle>Inbound Weight Over Time</CardTitle><CardDescription>Monthly inbound pounds with acquisition classes kept separate</CardDescription></CardHeader>
        <CardContent>
          <ChartContainer config={monthlyWeightConfig} className="h-80 min-w-0 w-full">
            <LineChart accessibilityLayer data={monthlyWeight} margin={{ left: 8, right: 16 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickFormatter={(month: string) => format(parseISO(`${month}-01`), 'MMM yy')} />
              <YAxis width={52} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line dataKey="donatedWeight" stroke="var(--color-donatedWeight)" strokeWidth={2} dot={false} />
              <Line dataKey="purchDonWeight" stroke="var(--color-purchDonWeight)" strokeWidth={2} dot={false} />
              <Line dataKey="governmentWeight" stroke="var(--color-governmentWeight)" strokeWidth={2} dot={false} />
              <Line dataKey="purchasedWeight" stroke="var(--color-purchasedWeight)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="flex flex-col items-start justify-between gap-3 space-y-0 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Seasonal Inbound Weight</CardTitle>
            <CardDescription>
              {canCompareSeasons
                ? 'Calendar years within the selected range compared month by month'
                : 'Monthly inbound weight within the selected date range'}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!canCompareSeasons}>
              <Button variant="outline" className="w-full justify-between sm:w-auto">
                {seasonalYears.length === 1 ? seasonalYears[0] : `${seasonalYears.length} years`}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {analytics.availableYears.map((year) => (
                <DropdownMenuCheckboxItem
                  key={year}
                  checked={selectedSeasonalYears.includes(year)}
                  onCheckedChange={(checked) => toggleSeasonalYear(year, checked === true)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {year}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          {seasonalYears.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Choose at least one year.</div>
          ) : (
            <ChartContainer config={seasonalConfig} className="h-80 min-w-0 w-full">
              <LineChart accessibilityLayer data={seasonalData} margin={{ left: 8, right: 16 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis width={52} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {seasonalYears.map((year) => (
                  <Line key={year} dataKey={year} stroke={`var(--color-${year})`} strokeWidth={2} dot={seasonalYears.length === 1} connectNulls={false} />
                ))}
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Product Continuity</h3>
          <p className="text-sm text-muted-foreground">Supplier-product recurrence and observed-month coverage; this describes procurement continuity, not client availability.</p>
        </div>
        <EnhancedDataTable
          columns={continuityColumns}
          data={analytics.productContinuity}
          filterColumn="description"
          filterPlaceholder="Filter supplier products..."
          enableColumnVisibility
          defaultPageSize={10}
        />
      </section>
    </div>
  );
}

function MixDetails({ total, rows }: { total: number; rows: Array<{ label: string; weight: number }> }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-sm text-muted-foreground">{row.label}</dt>
          <dd className="font-medium">
            {total === 0 ? '0%' : `${(row.weight / total * 100).toFixed(1)}%`}
            <span className="ml-1 text-sm font-normal text-muted-foreground">({pounds(row.weight)})</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ProcurementKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="break-words text-xl font-semibold">{value}</p>
    </div>
  );
}
