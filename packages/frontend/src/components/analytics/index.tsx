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
  XAxis,
  YAxis,
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
import { Input } from '@/components/ui/input';
import { SearchIcon, type SearchIconHandle } from '@/components/ui/search';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { procurementService } from '@/services/procurement';
import type {
  AcquisitionClass,
  FreshAllianceCategorySummary,
  PaidProcurementProductSummary,
  ProcurementAnalytics,
  ProcurementChannel,
  ProcurementWarehouseProductSummary,
} from '@/types/procurement';
import type { AnalyticsDateRange } from '@/types/analytics';
import { DEFAULT_ANALYTICS_RANGE } from '@/types/analytics';
import { DonorAnalytics } from './donor-analytics';

const PageTitleAnalyticsIcon = createPageTitleIcon(ChartNoAxesCombinedIcon);

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

const channelMonthlyWeightConfig = {
  ofbWarehouseWeight: { label: 'OFB Warehouse', theme: carbonTheme('blue') },
  freshAllianceWeight: { label: 'Fresh Food Alliance', theme: carbonTheme('green') },
} satisfies ChartConfig;

const freshAllianceCategoryConfig = {
  weight: { label: 'Inbound Weight', theme: carbonTheme('green') },
} satisfies ChartConfig;

const paidProductSpendConfig = {
  spendDollars: { label: 'Paid Product Charges', theme: carbonTheme('blue') },
} satisfies ChartConfig;

const acquisitionLabels: Record<AcquisitionClass, string> = {
  DONATED: 'Donated',
  'PURCH-DON': 'Purch-Don',
  GOVERNMENT: 'Government',
  PURCHASED: 'Purchased',
};

const channelLabels: Record<ProcurementChannel, string> = {
  ofb_warehouse: 'OFB Warehouse',
  fresh_alliance: 'Fresh Food Alliance',
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
const shortenedProductName = (description: string) =>
  description.length > 34 ? `${description.slice(0, 31)}…` : description;
const MAX_PAID_PRODUCT_SEARCH_RESULTS = 25;

export function buildSeasonalYearChartConfig(
  years: string[],
  currentYear: number
): ChartConfig {
  const paletteSize = 20;

  return Object.fromEntries(years.map((year) => {
    const numericYear = Number.parseInt(year, 10);
    const yearOffset = Number.isFinite(numericYear) ? currentYear - numericYear : 0;
    const colorIndex = ((yearOffset % paletteSize) + paletteSize) % paletteSize;

    return [year, { label: year, theme: carbonCategoricalTheme(colorIndex) }];
  })) satisfies ChartConfig;
}

export interface PaidProductSpendDatum {
  product: string;
  fullDescription: string;
  spendDollars: number;
  spendShare: number;
  productCount: number;
}

export interface PaidProductSearchResult {
  data: PaidProductSpendDatum[];
  matchCount: number;
}

function toPaidProductSpendDatum(
  product: PaidProcurementProductSummary,
  totalSpendCents: number
): PaidProductSpendDatum {
  return {
    product: shortenedProductName(product.description),
    fullDescription: `${product.description} (${product.productCode})`,
    spendDollars: product.totalSpendCents / 100,
    spendShare: totalSpendCents > 0
      ? product.totalSpendCents / totalSpendCents
      : 0,
    productCount: 1,
  };
}

export function buildPaidProductSpendData(
  paidProducts: PaidProcurementProductSummary[]
): PaidProductSpendDatum[] {
  const totalSpendCents = paidProducts.reduce(
    (sum, product) => sum + product.totalSpendCents,
    0
  );
  const topProducts = paidProducts
    .slice(0, 15)
    .map((product) => toPaidProductSpendDatum(product, totalSpendCents));
  const remainingProducts = paidProducts.slice(15);
  const remainingSpendCents = remainingProducts.reduce(
    (sum, product) => sum + product.totalSpendCents,
    0
  );

  if (remainingSpendCents > 0) {
    const productCountLabel = remainingProducts.length === 1 ? 'code' : 'codes';
    topProducts.push({
      product: `Other paid products (${remainingProducts.length} ${productCountLabel})`,
      fullDescription: `All remaining ${remainingProducts.length} paid OFB Warehouse product ${productCountLabel}`,
      spendDollars: remainingSpendCents / 100,
      spendShare: totalSpendCents > 0
        ? remainingSpendCents / totalSpendCents
        : 0,
      productCount: remainingProducts.length,
    });
  }

  return topProducts;
}

export function buildPaidProductSearchResult(
  paidProducts: PaidProcurementProductSummary[],
  query: string,
  limit = MAX_PAID_PRODUCT_SEARCH_RESULTS
): PaidProductSearchResult {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const totalSpendCents = paidProducts.reduce(
    (sum, product) => sum + product.totalSpendCents,
    0
  );
  const matches = paidProducts.filter((product) =>
    product.description.toLocaleLowerCase().includes(normalizedQuery) ||
    product.productCode.toLocaleLowerCase().includes(normalizedQuery)
  );

  return {
    data: matches
      .slice(0, limit)
      .map((product) => toPaidProductSpendDatum(product, totalSpendCents)),
    matchCount: matches.length,
  };
}

function PaidProductSearch({
  value,
  onChange,
  matchCount,
  displayedCount,
}: {
  value: string;
  onChange: (value: string) => void;
  matchCount: number;
  displayedCount: number;
}) {
  const searchIconRef = React.useRef<SearchIconHandle>(null);
  const hasQuery = value.trim().length > 0;

  React.useEffect(() => {
    searchIconRef.current?.startAnimation();
  }, []);

  const playSearchIcon = React.useCallback(() => {
    searchIconRef.current?.startAnimation();
  }, []);

  return (
    <div className="flex w-full flex-col gap-2 sm:max-w-md">
      <div
        className="relative"
        onMouseEnter={playSearchIcon}
        onClick={playSearchIcon}
      >
        <SearchIcon
          ref={searchIconRef}
          size={16}
          className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search paid products"
          placeholder="Search product name or OFB code..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pl-9"
        />
      </div>
      {hasQuery && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {matchCount > displayedCount
            ? `Showing the top ${displayedCount.toLocaleString()} of ${matchCount.toLocaleString()} matching product codes.`
            : `${matchCount.toLocaleString()} matching product ${matchCount === 1 ? 'code' : 'codes'}.`}
        </p>
      )}
    </div>
  );
}

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
  const [paidProductSearch, setPaidProductSearch] = React.useState('');
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
        setSelectedSeasonalYears(result.availableYears);
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
  const currentCalendarYear = new Date().getFullYear();
  const seasonalConfig = React.useMemo(
    () => buildSeasonalYearChartConfig(
      analytics?.availableYears ?? [],
      currentCalendarYear
    ),
    [analytics?.availableYears, currentCalendarYear]
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
      ofbWarehouseWeight: toPounds(row.ofbWarehouseWeightHundredths),
      freshAllianceWeight: toPounds(row.freshAllianceWeightHundredths),
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
  const paidProductSearchResult = React.useMemo(
    () => buildPaidProductSearchResult(
      analytics?.paidProducts ?? [],
      paidProductSearch
    ),
    [analytics, paidProductSearch]
  );
  const paidProductSpendData = React.useMemo(
    () => paidProductSearch.trim().length > 0
      ? paidProductSearchResult.data
      : buildPaidProductSpendData(analytics?.paidProducts ?? []),
    [analytics, paidProductSearch, paidProductSearchResult.data]
  );
  const paidProductChartHeight = Math.max(320, paidProductSpendData.length * 36 + 96);
  const freshAllianceCategoryMix = React.useMemo(
    () => (analytics?.freshAllianceCategories ?? []).slice(0, 10).map((category) => ({
      category: category.description.replace(/\s*\(Fresh Alliance\)\s*$/i, ''),
      weight: toPounds(category.totalWeightHundredths),
    })),
    [analytics]
  );
  const warehouseProductColumns = React.useMemo<ColumnDef<ProcurementWarehouseProductSummary>[]>(() => [
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
  const freshAllianceCategoryColumns = React.useMemo<ColumnDef<FreshAllianceCategorySummary>[]>(() => [
    {
      accessorKey: 'description',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Category <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 300,
      cell: ({ row }) => <span className="font-medium">{row.original.description}</span>,
    },
    { accessorKey: 'productCode', header: 'Source Code', size: 110 },
    {
      accessorKey: 'receiptEventCount',
      header: 'Receipt Events',
      size: 125,
    },
    {
      accessorKey: 'receivingDateCount',
      header: 'Receiving Dates',
      size: 130,
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
      accessorKey: 'lastReceivedDate',
      header: 'Last Received',
      size: 130,
      cell: ({ row }) => format(parseISO(row.original.lastReceivedDate), 'MMM d, yyyy'),
    },
  ], []);
  const paidProductColumns = React.useMemo<ColumnDef<PaidProcurementProductSummary>[]>(() => [
    {
      accessorKey: 'description',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Product <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 300,
      cell: ({ row }) => <span className="font-medium">{row.original.description}</span>,
    },
    { accessorKey: 'productCode', header: 'Code', size: 90 },
    {
      accessorKey: 'totalSpendCents',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Paid Charges <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 145,
      cell: ({ row }) => dollars(row.original.totalSpendCents),
    },
    {
      accessorKey: 'paidWeightHundredths',
      header: 'Paid Weight',
      size: 130,
      cell: ({ row }) => pounds(row.original.paidWeightHundredths),
    },
    {
      accessorKey: 'costPerPaidPoundCents',
      header: 'Cost / Paid lb',
      size: 140,
      cell: ({ row }) => row.original.costPerPaidPoundCents === null
        ? 'Unknown'
        : dollars(row.original.costPerPaidPoundCents),
    },
    { accessorKey: 'receiptDateCount', header: 'Receiving Dates', size: 135 },
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
              Import a standardized Oregon Food Bank CSV to analyze inbound weight, OFB Warehouse Orders, and Fresh Food Alliance receipts. FEED discards the source file after import.
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
  const middleRange = summary.lowerQuartileEventWeightHundredths === null || summary.upperQuartileEventWeightHundredths === null
    ? 'Unknown'
    : `${pounds(summary.lowerQuartileEventWeightHundredths)}–${pounds(summary.upperQuartileEventWeightHundredths)}`;
  const acquisitionWeightTotal = analytics.acquisitionMix.reduce((sum, row) => sum + row.weightHundredths, 0);
  const channelWeightTotal = analytics.channelMix.reduce((sum, row) => sum + row.weightHundredths, 0);
  const includesWarehouse = selectedChannel !== 'fresh_alliance';
  const includesFreshAlliance = selectedChannel !== 'ofb_warehouse';
  const allChannels = selectedChannel === 'all';

  const toggleSeasonalYear = (year: string, checked: boolean) => {
    setSelectedSeasonalYears((current) => {
      if (!checked) return current.filter((value) => value !== year);
      if (current.includes(year)) return current;
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
            <SelectItem value="fresh_alliance">Fresh Food Alliance</SelectItem>
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
          <CardDescription>
            {allChannels
              ? 'OFB Warehouse orders and Fresh Food Alliance receipts remain distinct'
              : selectedChannel === 'fresh_alliance'
                ? 'Grocery-partner donation receipts reported through Fresh Food Alliance'
                : 'Requested acquisitions fulfilled through the OFB warehouse'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 xl:grid-cols-4">
            <ProcurementKpi
              label={selectedChannel === 'fresh_alliance' ? 'Partner Donation Weight' : 'Total Inbound Weight'}
              value={pounds(summary.totalWeightHundredths)}
            />
            {allChannels && <ProcurementKpi label="Source Events" value={summary.sourceEventCount.toLocaleString()} />}
            {!allChannels && (
              <ProcurementKpi
                label={selectedChannel === 'fresh_alliance' ? 'Fresh Food Alliance Receipts' : 'OFB Warehouse Orders'}
                value={summary.sourceEventCount.toLocaleString()}
              />
            )}
            {allChannels && <ProcurementKpi label="OFB Warehouse Orders" value={summary.warehouseOrderCount.toLocaleString()} />}
            {allChannels && <ProcurementKpi label="Fresh Food Alliance Receipts" value={summary.freshAllianceReceiptCount.toLocaleString()} />}
            <ProcurementKpi label="Receiving Dates" value={summary.receivingDateCount.toLocaleString()} />
            {!allChannels && (
              <>
                <ProcurementKpi
                  label={selectedChannel === 'fresh_alliance' ? 'Typical Fresh Food Alliance Event' : 'Typical OFB Warehouse Event'}
                  value={pounds(summary.medianEventWeightHundredths)}
                />
                <ProcurementKpi
                  label={selectedChannel === 'fresh_alliance' ? 'Middle 50% of Fresh Events' : 'Middle 50% of Warehouse Events'}
                  value={middleRange}
                />
                <ProcurementKpi
                  label={selectedChannel === 'fresh_alliance' ? 'Typical Category Lines' : 'Typical Order Lines'}
                  value={summary.medianLinesPerEvent?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? 'Unknown'}
                />
              </>
            )}
            {includesWarehouse && <ProcurementKpi label="Warehouse Products" value={summary.warehouseProductCodes.toLocaleString()} />}
            {includesFreshAlliance && <ProcurementKpi label="Fresh Food Alliance Categories" value={summary.freshAllianceCategoryCodes.toLocaleString()} />}
            <ProcurementKpi
              label="Median Receiving Gap"
              value={summary.medianReceivingGapDays === null
                ? 'Insufficient history'
                : `${summary.medianReceivingGapDays.toLocaleString(undefined, { maximumFractionDigits: 1 })} days`}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            {allChannels
              ? 'Inbound Weight Over Time'
              : selectedChannel === 'fresh_alliance'
                ? 'Fresh Food Alliance Weight Over Time'
                : 'Warehouse Weight by Acquisition Class'}
          </CardTitle>
          <CardDescription>
            {allChannels
              ? 'Monthly inbound pounds with OFB Warehouse and Fresh Food Alliance kept separate'
              : selectedChannel === 'fresh_alliance'
                ? 'Monthly pounds reported through grocery-partner donation receipts'
                : 'Monthly warehouse pounds with OFB acquisition classes kept separate'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={selectedChannel === 'ofb_warehouse' ? monthlyWeightConfig : channelMonthlyWeightConfig}
            className="h-80 min-w-0 w-full"
          >
            <LineChart accessibilityLayer data={monthlyWeight} margin={{ left: 8, right: 16 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickFormatter={(month: string) => format(parseISO(`${month}-01`), 'MMM yy')} />
              <YAxis width={52} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {selectedChannel === 'ofb_warehouse' ? (
                <>
                  <Line dataKey="donatedWeight" stroke="var(--color-donatedWeight)" strokeWidth={2} dot={false} />
                  <Line dataKey="purchDonWeight" stroke="var(--color-purchDonWeight)" strokeWidth={2} dot={false} />
                  <Line dataKey="governmentWeight" stroke="var(--color-governmentWeight)" strokeWidth={2} dot={false} />
                  <Line dataKey="purchasedWeight" stroke="var(--color-purchasedWeight)" strokeWidth={2} dot={false} />
                </>
              ) : (
                <>
                  {allChannels && <Line dataKey="ofbWarehouseWeight" stroke="var(--color-ofbWarehouseWeight)" strokeWidth={2} dot={false} />}
                  <Line dataKey="freshAllianceWeight" stroke="var(--color-freshAllianceWeight)" strokeWidth={2} dot={false} />
                </>
              )}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {selectedChannel !== 'fresh_alliance' && <Card>
        <CardHeader>
          <CardTitle>Paid Procurement Summary</CardTitle>
          <CardDescription>
            {summary.costAdjustmentsAttributable
              ? 'Charges and credits remain separate; net values are never allocated across products'
              : 'Product charges follow the active acquisition filter; order-level fees, grants, and net cost cannot be attributed to one acquisition class'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          <ProcurementKpi label="Gross Product Charges" value={dollars(summary.calculatedGrossProductChargesCents)} />
          <ProcurementKpi label="Service Fees" value={attributableDollars(summary.serviceFeesCents)} />
          <ProcurementKpi label="Grants Applied" value={attributableDollars(summary.grantsAppliedCents)} />
          <ProcurementKpi label="Net Recorded Charge" value={attributableDollars(summary.netRecordedCostCents)} />
        </CardContent>
      </Card>}

      {selectedChannel !== 'fresh_alliance' && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Where Paid Procurement Dollars Went</CardTitle>
            <CardDescription>
              Exact OFB Warehouse product codes ranked by calculated product charges in the selected range
            </CardDescription>
            <PaidProductSearch
              value={paidProductSearch}
              onChange={setPaidProductSearch}
              matchCount={paidProductSearchResult.matchCount}
              displayedCount={paidProductSearchResult.data.length}
            />
          </CardHeader>
          <CardContent>
            {paidProductSpendData.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                {paidProductSearch.trim().length > 0
                  ? `No paid OFB Warehouse products match “${paidProductSearch.trim()}” in this range.`
                  : 'No paid OFB Warehouse product charges match this range and filter.'}
              </div>
            ) : (
              <ChartContainer
                config={paidProductSpendConfig}
                className="min-w-0 w-full"
                style={{ height: paidProductChartHeight }}
              >
                <BarChart
                  accessibilityLayer
                  data={paidProductSpendData}
                  layout="vertical"
                  margin={{ left: 8, right: 24 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => dollars(Math.round(value * 100))}
                  />
                  <YAxis dataKey="product" type="category" width={190} tickLine={false} axisLine={false} />
                  <ChartTooltip
                    content={(
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => payload[0]?.payload.fullDescription}
                        formatter={(value, _name, _item, _index, payload) => (
                          <div className="grid w-full gap-1">
                            <div className="flex w-full justify-between gap-3">
                              <span className="text-muted-foreground">Paid Product Charges</span>
                              <span className="font-mono font-medium tabular-nums">{dollars(Math.round(Number(value) * 100))}</span>
                            </div>
                            <div className="flex w-full justify-between gap-3">
                              <span className="text-muted-foreground">Share of Paid Charges</span>
                              <span className="font-mono font-medium tabular-nums">{(Number(payload.spendShare) * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex w-full justify-between gap-3">
                              <span className="text-muted-foreground">Product Codes</span>
                              <span className="font-mono font-medium tabular-nums">{Number(payload.productCount).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      />
                    )}
                  />
                  <Bar dataKey="spendDollars" fill="var(--color-spendDollars)" radius={3} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      )}

      {(includesWarehouse || allChannels) && (
        <div className={`grid min-w-0 gap-4 ${allChannels ? 'lg:grid-cols-2' : ''}`}>
        {includesWarehouse && <Card className="min-w-0">
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
        </Card>}

        {allChannels && <Card className="min-w-0">
          <CardHeader><CardTitle>Procurement Channels</CardTitle><CardDescription>Fresh Food Alliance remains distinct from OFB warehouse supply</CardDescription></CardHeader>
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
        </Card>}
        </div>
      )}

      {includesFreshAlliance && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Fresh Food Alliance Category Mix</CardTitle>
            <CardDescription>
              Broad OFB reporting categories—not individual products or inferred grocery partners
            </CardDescription>
          </CardHeader>
          <CardContent>
            {freshAllianceCategoryMix.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                No Fresh Food Alliance receipts match this range and filter.
              </div>
            ) : (
              <ChartContainer config={freshAllianceCategoryConfig} className="h-80 min-w-0 w-full">
                <BarChart accessibilityLayer data={freshAllianceCategoryMix} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis dataKey="category" type="category" width={150} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="weight" fill="var(--color-weight)" radius={3} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      )}

      {includesFreshAlliance && (
        <DonorAnalytics
          donors={analytics.donors}
          donorValue={analytics.donorValue}
          donorMonthlyWeight={analytics.donorMonthlyWeight}
          formatDate={(isoDate) => format(parseISO(isoDate), 'MMM d, yyyy')}
        />
      )}

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
                {seasonalYears.length === analytics.availableYears.length
                  ? 'All years'
                  : seasonalYears.length === 1
                    ? seasonalYears[0]
                    : `${seasonalYears.length} years`}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            {/* DropdownMenu owns this overflow; bound long histories to its available popper height. */}
            <DropdownMenuContent align="end" className="max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setSelectedSeasonalYears(analytics.availableYears);
                }}
              >
                Select all years
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setSelectedSeasonalYears([]);
                }}
              >
                Clear all years
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
                {seasonalYears.map((year) => {
                  const isCurrentYear = year === String(currentCalendarYear);

                  return (
                    <Line
                      key={year}
                      dataKey={year}
                      stroke={`var(--color-${year})`}
                      strokeWidth={isCurrentYear ? 3 : 2}
                      strokeLinecap="round"
                      dot={seasonalYears.length === 1}
                      connectNulls={false}
                      style={isCurrentYear
                        ? {
                            filter: `drop-shadow(0 0 2px var(--color-${year})) drop-shadow(0 0 5px var(--color-${year}))`,
                          }
                        : undefined}
                    />
                  );
                })}
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {includesWarehouse && analytics.paidProducts.length > 0 && <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Paid OFB Warehouse Products</h3>
          <p className="text-sm text-muted-foreground">
            Exact supplier products with calculated charges; this does not infer why the organization purchased them.
          </p>
        </div>
        <EnhancedDataTable
          columns={paidProductColumns}
          data={analytics.paidProducts}
          filterColumn="description"
          filterPlaceholder="Filter paid products..."
          enableColumnVisibility
          defaultPageSize={10}
        />
      </section>}

      {includesWarehouse && <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">OFB Warehouse Product History</h3>
          <p className="text-sm text-muted-foreground">Exact supplier products with receiving dates, inbound weight, and timing; Fresh Food Alliance categories are excluded.</p>
        </div>
        <EnhancedDataTable
          columns={warehouseProductColumns}
          data={analytics.warehouseProducts}
          filterColumn="description"
          filterPlaceholder="Filter supplier products..."
          enableColumnVisibility
          defaultPageSize={10}
        />
      </section>}

      {includesFreshAlliance && <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Fresh Food Alliance Receipt Categories</h3>
          <p className="text-sm text-muted-foreground">
            Broad categories reported through OFB. Partner identity is unavailable in this source and is never inferred.
          </p>
        </div>
        <EnhancedDataTable
          columns={freshAllianceCategoryColumns}
          data={analytics.freshAllianceCategories}
          filterColumn="description"
          filterPlaceholder="Filter receipt categories..."
          enableColumnVisibility
          defaultPageSize={10}
        />
      </section>}
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
