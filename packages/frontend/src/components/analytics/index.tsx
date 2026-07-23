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
import { useTheme } from 'next-themes';
import {
  carbonCategoricalTheme,
  carbonChartColors,
  carbonTheme,
  type CarbonFamily,
  type CarbonGrade,
} from '@/lib/colors';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { procurementService } from '@/services/procurement';
import type {
  AcquisitionClass,
  FreshAllianceCategorySummary,
  FreshAllianceDonorCategorySummary,
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
/** Client-side key for rows with no donor on file, so it can live in a plain
 *  string[] selection array alongside real donor codes. Never sent to the
 *  server or presented as a real donor identity. */
const NOT_REPORTED_DONOR_CODE = '__not_reported__';

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

/**
 * Groups a paid product by the family prefix in its OFB description, e.g.
 * "Meals, Beef Stew 12/24oz" -> "Meals".
 *
 * This is a **display grouping derived from the product description**, not a
 * taxonomy Oregon Food Bank publishes as a field. It exists so the long tail of
 * paid products can be read at a glance. It must never be presented as an OFB
 * category, and a description without a recognizable prefix stays
 * "Unclassified" rather than being forced into a bucket.
 */
export function productFamily(description: string): string {
  const match = /^([^,]{2,40}),/.exec(description.trim());
  if (!match) return UNCLASSIFIED_FAMILY;
  const family = match[1].trim();
  return family.length > 0 ? family : UNCLASSIFIED_FAMILY;
}

export const UNCLASSIFIED_FAMILY = 'Unclassified';

/**
 * Fixed color assignment per product family, so a color always means the same
 * family everywhere it appears — this chart's bars, its legend, and its
 * aggregate-row tooltip — regardless of which families the current filter or
 * search happens to include or how they rank by spend. An index-based palette
 * (assign color N to whichever family is Nth by spend) would reassign colors
 * every time the visible family set changed, which defeats the point of a
 * legend.
 *
 * Order and shares reflect the real OFB Warehouse paid-product corpus profiled
 * during development (Meals 17%, Condiment 15%, Meat 13%, Other Protein 12%,
 * Fruit 9%, Dairy 9%, Veg 6%, Non-Food 6%, Grains 5%, Cereal 4%, Bev 2%,
 * Beans 2%, Pasta 1%, Rice 1%). The nine non-gray Carbon hue families each
 * take one slot at `primary` grade first (hue-hopped for maximum adjacent
 * contrast), then the remaining families repeat those hues at `secondary`
 * grade. `Unclassified` is pinned to `warmGray` — reserved, never assigned to
 * a real family — so a muted, deliberately unsaturated color visually marks
 * "not a real category" rather than looking like one.
 */
const FAMILY_COLOR_ASSIGNMENTS: Record<string, { family: CarbonFamily; grade: CarbonGrade }> = {
  Meals: { family: 'blue', grade: 'primary' },
  Condiment: { family: 'magenta', grade: 'primary' },
  Meat: { family: 'teal', grade: 'primary' },
  'Other Protein': { family: 'orange', grade: 'primary' },
  Fruit: { family: 'purple', grade: 'primary' },
  Dairy: { family: 'green', grade: 'primary' },
  Veg: { family: 'yellow', grade: 'primary' },
  'Non-Food': { family: 'cyan', grade: 'primary' },
  Grains: { family: 'red', grade: 'primary' },
  Cereal: { family: 'blue', grade: 'secondary' },
  Bev: { family: 'magenta', grade: 'secondary' },
  Beans: { family: 'teal', grade: 'secondary' },
  Pasta: { family: 'orange', grade: 'secondary' },
  Rice: { family: 'purple', grade: 'secondary' },
  [UNCLASSIFIED_FAMILY]: { family: 'warmGray', grade: 'primary' },
};

/** Non-gray hues, both grades, in the same hue-hopped order as the fixed
 *  family assignments above — excludes `warmGray` so a hashed fallback can
 *  never collide with a reserved "not really a category" color. Shared by
 *  every open-label-set color assignment in this file (product families
 *  outside the profiled set, and donors — D5: the donor roster has no fixed
 *  enum, so it never gets a hand-curated table the way families did). */
const CATEGORICAL_COLOR_FALLBACK_SLOTS: Array<{ family: CarbonFamily; grade: CarbonGrade }> = [
  'blue', 'magenta', 'teal', 'orange', 'purple', 'green', 'yellow', 'cyan', 'red',
].flatMap((family) => ([
  { family: family as CarbonFamily, grade: 'primary' as CarbonGrade },
  { family: family as CarbonFamily, grade: 'secondary' as CarbonGrade },
]));

/** Deterministic, stable per-label slot index — same label always lands on
 *  the same fallback color, across renders and sessions, without needing a
 *  hand-curated table. */
function hashLabel(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Assigns a stable color to any family label, including one this list has
 * never seen. A future OFB export could introduce a product-description
 * prefix outside the profiled set; rather than let that family silently
 * borrow another family's color (or fall through to the reserved gray), it
 * gets a deterministic hash-based slot from the same palette so its color is
 * still fixed and repeatable across renders, just not hand-picked.
 */
function familyColorAssignment(label: string): { family: CarbonFamily; grade: CarbonGrade } {
  const known = FAMILY_COLOR_ASSIGNMENTS[label];
  if (known) return known;
  return CATEGORICAL_COLOR_FALLBACK_SLOTS[hashLabel(label) % CATEGORICAL_COLOR_FALLBACK_SLOTS.length];
}

export function familyColorTheme(label: string): Record<'light' | 'dark', string> {
  const { family, grade } = familyColorAssignment(label);
  return carbonTheme(family, grade);
}

export function familyColorHex(label: string, scheme: 'light' | 'dark'): string {
  const { family, grade } = familyColorAssignment(label);
  return carbonChartColors[family][grade][scheme];
}

const NOT_REPORTED_DONOR_LABEL = 'Not Reported';

/**
 * Assigns a stable color to any donor name. Unlike product families, the
 * donor roster is deliberately open (D5: no fixed enum, no seeded partner
 * list — partners start and stop) so there is no hand-curated table to
 * consult; every real donor goes through the same hash-based fallback.
 * "Not Reported" (a category row with no donor on file) is pinned to
 * `warmGray`, the same reserved, muted "not really a category" treatment
 * `Unclassified` gets for product families.
 */
function donorColorAssignment(donorName: string): { family: CarbonFamily; grade: CarbonGrade } {
  if (donorName === NOT_REPORTED_DONOR_LABEL) return { family: 'warmGray', grade: 'primary' };
  return CATEGORICAL_COLOR_FALLBACK_SLOTS[hashLabel(donorName) % CATEGORICAL_COLOR_FALLBACK_SLOTS.length];
}

export function donorColorTheme(donorName: string): Record<'light' | 'dark', string> {
  const { family, grade } = donorColorAssignment(donorName);
  return carbonTheme(family, grade);
}

export function donorColorHex(donorName: string, scheme: 'light' | 'dark'): string {
  const { family, grade } = donorColorAssignment(donorName);
  return carbonChartColors[family][grade][scheme];
}


/** Chart config keys become CSS custom property names, so labels are slugged. */
export function familyCssKey(family: string): string {
  return `fam_${family.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
}

export interface PaidProductSpendDatum {
  product: string;
  fullDescription: string;
  spendDollars: number;
  spendShare: number;
  productCount: number;
  family: string;
  /** Present only on the aggregate row: spend per family inside it. */
  familyBreakdown?: Array<{ family: string; spendDollars: number }>;
}

export interface PaidProductChartSegment {
  family: string;
  spendDollars: number;
}

export interface PaidProductChartRow {
  product: string;
  fullDescription: string;
  spendDollars: number;
  spendShare: number;
  productCount: number;
  /** One entry for an ordinary product row; several for the aggregate row. */
  segments: PaidProductChartSegment[];
}

/**
 * Reshapes spend rows into the segments a stacked bar draws.
 *
 * Recharts' native per-series `stackId` stacking is unreliable at this
 * cardinality — a 14-series stack over this data renders no geometry at all,
 * a documented Recharts bug (recharts/recharts#3883, "Stacked Bar Chart
 * disappears when stackId is added for complex datasets"), reproduced here
 * even after eliminating undefined per-series values. Rather than keep
 * fighting that mechanism, the bar uses a single series with a custom `shape`
 * that draws each row's segments as adjacent `<rect>`s sized from
 * `segments` directly — full control, and it never touches Recharts' stack
 * math at all.
 */
export function buildPaidProductChartSeries(data: PaidProductSpendDatum[]): {
  rows: PaidProductChartRow[];
  families: Array<{ key: string; label: string }>;
} {
  const families: Array<{ key: string; label: string }> = [];
  const noteFamily = (label: string) => {
    const key = familyCssKey(label);
    if (!families.some((entry) => entry.key === key)) families.push({ key, label });
  };

  const rows: PaidProductChartRow[] = data.map((datum) => {
    const segments = datum.familyBreakdown && datum.familyBreakdown.length > 0
      ? datum.familyBreakdown
      : [{ family: datum.family, spendDollars: datum.spendDollars }];
    for (const segment of segments) noteFamily(segment.family);
    return {
      product: datum.product,
      fullDescription: datum.fullDescription,
      spendDollars: datum.spendDollars,
      spendShare: datum.spendShare,
      productCount: datum.productCount,
      segments,
    };
  });

  // Order families by total spend so the legend and segment order read
  // consistently with the rest of the chart.
  const totals = new Map<string, number>();
  for (const row of rows) {
    for (const segment of row.segments) {
      totals.set(segment.family, (totals.get(segment.family) ?? 0) + segment.spendDollars);
    }
  }
  families.sort((left, right) => (totals.get(right.label) ?? 0) - (totals.get(left.label) ?? 0));

  return { rows, families };
}

export interface FreshAllianceCategoryMixSegment {
  donor: string;
  weightPounds: number;
}

export interface FreshAllianceCategoryMixRow {
  category: string;
  fullDescription: string;
  weightPounds: number;
  segments: FreshAllianceCategoryMixSegment[];
}

/**
 * Groups (donor, category) rows back up into one bar per reporting category,
 * each segmented by donor. Unlike the paid-products chart there are only a
 * handful of Fresh Alliance categories (8 in the profiled corpus) and every
 * one is genuinely multi-donor, so there is no "top N + aggregate" cutoff
 * here — every category gets a real stack, not a lone bar plus one grouped
 * long tail.
 */
export function buildFreshAllianceCategoryMixSeries(
  rows: FreshAllianceDonorCategorySummary[]
): {
  rows: FreshAllianceCategoryMixRow[];
  donors: Array<{ key: string; label: string }>;
} {
  const donors: Array<{ key: string; label: string }> = [];
  const noteDonor = (label: string) => {
    const key = familyCssKey(label);
    if (!donors.some((entry) => entry.key === key)) donors.push({ key, label });
  };

  const byCategory = new Map<string, { fullDescription: string; segments: Map<string, number> }>();
  for (const row of rows) {
    const category = row.description.replace(/\s*\(Fresh Alliance\)\s*$/i, '');
    const entry = byCategory.get(category) ?? { fullDescription: row.description, segments: new Map() };
    entry.segments.set(row.donorName, (entry.segments.get(row.donorName) ?? 0) + toPounds(row.totalWeightHundredths));
    byCategory.set(category, entry);
    noteDonor(row.donorName);
  }

  const categoryRows: FreshAllianceCategoryMixRow[] = [...byCategory.entries()].map(
    ([category, { fullDescription, segments }]) => {
      const sortedSegments = [...segments.entries()]
        .map(([donor, weightPounds]) => ({ donor, weightPounds }))
        .sort((left, right) => right.weightPounds - left.weightPounds);
      return {
        category,
        fullDescription,
        weightPounds: sortedSegments.reduce((sum, segment) => sum + segment.weightPounds, 0),
        segments: sortedSegments,
      };
    }
  ).sort((left, right) => right.weightPounds - left.weightPounds);

  // Order the legend by total weight across all categories, matching the
  // paid-product family legend's convention.
  const donorTotals = new Map<string, number>();
  for (const row of categoryRows) {
    for (const segment of row.segments) {
      donorTotals.set(segment.donor, (donorTotals.get(segment.donor) ?? 0) + segment.weightPounds);
    }
  }
  donors.sort((left, right) => (donorTotals.get(right.label) ?? 0) - (donorTotals.get(left.label) ?? 0));

  return { rows: categoryRows, donors };
}

interface GenericBarSegment {
  /** CSS-safe key: both the React key and the `var(--color-{key})` fill lookup. */
  key: string;
  value: number;
}

/**
 * Draws one row's segments as adjacent rects instead of relying on Recharts'
 * per-series stacking. Recharts' native `stackId` stacking is unreliable at
 * the cardinality either chart in this file needs — a many-series stack over
 * this kind of data renders no geometry at all, a documented Recharts bug
 * (recharts/recharts#3883, "Stacked Bar Chart disappears when stackId is
 * added for complex datasets"), reproduced during development even after
 * eliminating undefined per-series values. Every stacked bar in this file
 * uses this one geometry function instead of fighting that mechanism a
 * second time per chart.
 *
 * A shared rounded clip path gives the whole bar rounded outer corners while
 * interior segment boundaries stay square, matching how a real stacked bar
 * reads. Recharts computes `x`/`width` for the underlying single-series `Bar`
 * exactly as it would for a plain flat-colored bar, so a row with one segment
 * fills the same rect a non-stacked bar would have.
 */
function renderStackedBarSegments(
  segments: GenericBarSegment[],
  x: number,
  y: number,
  width: number,
  height: number,
  clipId: string
): React.ReactElement {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  // A returned element is required, not null, for the degenerate case (a
  // zero-width bar has nothing to draw) -- Recharts' shape type demands it.
  if (width <= 0 || height <= 0 || total <= 0) return <g />;

  let cursor = x;
  return (
    <g>
      <clipPath id={clipId}>
        <rect x={x} y={y} width={width} height={height} rx={3} ry={3} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {segments.map((segment) => {
          const segmentWidth = (segment.value / total) * width;
          const rectX = cursor;
          cursor += segmentWidth;
          return (
            <rect
              key={segment.key}
              x={rectX}
              y={y}
              width={Math.max(segmentWidth, 0)}
              height={height}
              fill={`var(--color-${segment.key})`}
            />
          );
        })}
      </g>
    </g>
  );
}

interface PaidProductBarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: PaidProductChartRow;
}

// Recharts types its `shape` render-prop input as `unknown` (it is spread
// from internal state, not a typed public API), so the specific prop shape
// is asserted here rather than accepted as the parameter type directly.
function PaidProductBarShape(props: unknown) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, payload } = props as PaidProductBarShapeProps;
  const segments = (payload?.segments ?? []).map((segment) => ({
    key: familyCssKey(segment.family),
    value: segment.spendDollars,
  }));
  return renderStackedBarSegments(segments, x, y, width, height, `paid-product-bar-clip-${index}`);
}

interface FreshAllianceCategoryBarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: FreshAllianceCategoryMixRow;
}

function FreshAllianceCategoryBarShape(props: unknown) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, payload } =
    props as FreshAllianceCategoryBarShapeProps;
  const segments = (payload?.segments ?? []).map((segment) => ({
    key: familyCssKey(segment.donor),
    value: segment.weightPounds,
  }));
  return renderStackedBarSegments(segments, x, y, width, height, `fresh-alliance-category-bar-clip-${index}`);
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
    family: productFamily(product.description),
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
    // Individually these products are hairlines -- the largest is around 1% of
    // paid spend and the average is far less -- so stacking them by product
    // would be unreadable. Grouping the tail by family keeps the bar legible
    // and answers what the aggregate actually contains.
    const familySpend = new Map<string, number>();
    for (const product of remainingProducts) {
      const family = productFamily(product.description);
      familySpend.set(family, (familySpend.get(family) ?? 0) + product.totalSpendCents);
    }
    topProducts.push({
      product: `Other paid products (${remainingProducts.length} ${productCountLabel})`,
      fullDescription: `All remaining ${remainingProducts.length} paid OFB Warehouse product ${productCountLabel}`,
      spendDollars: remainingSpendCents / 100,
      spendShare: totalSpendCents > 0
        ? remainingSpendCents / totalSpendCents
        : 0,
      productCount: remainingProducts.length,
      family: UNCLASSIFIED_FAMILY,
      familyBreakdown: [...familySpend.entries()]
        .map(([family, cents]) => ({ family, spendDollars: cents / 100 }))
        .sort((left, right) => right.spendDollars - left.spendDollars),
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
        {/* Sticky beneath the app header (h-16) so the tab switcher and date
            range stay reachable across a long scroll of Procurement cards.
            Translucent + blurred to match the one existing sticky-content
            treatment in the app (GuideToc) rather than an opaque bar. */}
        <div className="sticky top-16 z-30 -mx-4 space-y-4 border-b border-border/70 bg-background/40 px-4 py-4 backdrop-blur-[14px] backdrop-saturate-150 supports-[backdrop-filter]:bg-background/40 sm:-mx-6 sm:px-6">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:w-[360px]">
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="procurement">Procurement</TabsTrigger>
          </TabsList>
          <AnalyticsRangeControl value={range} onChange={setRange} />
        </div>
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
  // ChartContainer scopes its color CSS variables to a per-instance
  // [data-chart=id] selector, and Recharts requires ChartContainer's only
  // child to be the chart itself — there's nowhere to mount a legend that
  // would inherit those variables. The family-color legend below resolves
  // hex values directly instead, matching the pattern already used in
  // dashboard/category-chart.tsx for the same reason.
  const { resolvedTheme } = useTheme();
  const colorScheme: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [analytics, setAnalytics] = React.useState<ProcurementAnalytics | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedSeasonalYears, setSelectedSeasonalYears] = React.useState<string[]>([]);
  const [selectedFreshAllianceDonors, setSelectedFreshAllianceDonors] = React.useState<string[]>([]);
  const [paidProductSearch, setPaidProductSearch] = React.useState('');
  const selectedChannel: 'all' | ProcurementChannel = searchParams.get('channel') === 'ofb_warehouse' ||
    searchParams.get('channel') === 'fresh_alliance'
    ? (searchParams.get('channel') as ProcurementChannel)
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
        setSelectedFreshAllianceDonors([...new Set(
          result.freshAllianceDonorCategories.map((row) => row.donorCode ?? NOT_REPORTED_DONOR_CODE)
        )]);
      })
      .catch((error) => ErrorHandlerService.handleError(error, 'procurementAnalytics'))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range, selectedAcquisition, selectedChannel]);

  // The card's own channel breakdown only applies when the page-level filter
  // is "All Channels" -- otherwise the analytics payload is already scoped to
  // one channel, and a second independent control here could disagree with
  // the filter a user can see at the top of the page. See
  // procurement-unification-plan.md: one source of truth, no contradictory
  // filter states.
  const [selectedSeasonalChannel, setSelectedSeasonalChannel] = React.useState<'all' | ProcurementChannel>('all');
  const effectiveSeasonalChannel = selectedChannel === 'all' ? selectedSeasonalChannel : selectedChannel;

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
    if (effectiveSeasonalChannel === 'all') {
      for (const point of analytics?.seasonalWeight ?? []) {
        if (seasonalYears.includes(point.year)) {
          rows[point.month - 1][point.year] = toPounds(point.weightHundredths);
        }
      }
    } else {
      for (const point of analytics?.seasonalChannelWeight ?? []) {
        if (point.channel !== effectiveSeasonalChannel || !seasonalYears.includes(point.year)) continue;
        const cell = rows[point.month - 1];
        cell[point.year] = (Number(cell[point.year]) || 0) + toPounds(point.weightHundredths);
      }
    }
    return rows;
  }, [analytics, seasonalYears, effectiveSeasonalChannel]);

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
  const paidProductSeries = React.useMemo(
    () => buildPaidProductChartSeries(paidProductSpendData),
    [paidProductSpendData]
  );
  const paidProductFamilyConfig = React.useMemo(
    () => Object.fromEntries(
      paidProductSeries.families.map((family) => [
        family.key,
        { label: family.label, theme: familyColorTheme(family.label) },
      ])
    ) satisfies ChartConfig,
    [paidProductSeries.families]
  );
  const paidProductChartHeight = Math.max(320, paidProductSpendData.length * 36 + 96);
  // Distinct donors present in the receipt-category breakdown, in the same
  // weight-descending order the backend already sorted the rows in — no
  // separate ranking needed here.
  const freshAllianceDonorOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ code: string; label: string }> = [];
    for (const row of analytics?.freshAllianceDonorCategories ?? []) {
      const code = row.donorCode ?? NOT_REPORTED_DONOR_CODE;
      if (seen.has(code)) continue;
      seen.add(code);
      options.push({ code, label: row.donorName });
    }
    return options;
  }, [analytics]);
  const freshAllianceDonorCategoryRows = React.useMemo(
    () => (analytics?.freshAllianceDonorCategories ?? []).filter(
      (row) => selectedFreshAllianceDonors.includes(row.donorCode ?? NOT_REPORTED_DONOR_CODE)
    ),
    [analytics, selectedFreshAllianceDonors]
  );
  // Built from the same donor-filtered rows as the table below, so narrowing
  // the donor filter narrows this chart consistently rather than showing a
  // different picture than what's selected.
  const freshAllianceCategoryMixSeries = React.useMemo(
    () => buildFreshAllianceCategoryMixSeries(freshAllianceDonorCategoryRows),
    [freshAllianceDonorCategoryRows]
  );
  const freshAllianceCategoryMixConfig = React.useMemo(
    () => Object.fromEntries(
      freshAllianceCategoryMixSeries.donors.map((donor) => [
        donor.key,
        { label: donor.label, theme: donorColorTheme(donor.label) },
      ])
    ) satisfies ChartConfig,
    [freshAllianceCategoryMixSeries.donors]
  );
  const freshAllianceCategoryMixHeight = Math.max(
    280,
    freshAllianceCategoryMixSeries.rows.length * 40 + 60
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
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Last Received <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 130,
      cell: ({ row }) => format(parseISO(row.original.lastReceivedDate), 'MMM d, yyyy'),
    },
  ], []);
  const freshAllianceDonorCategoryColumns = React.useMemo<ColumnDef<FreshAllianceDonorCategorySummary>[]>(() => [
    {
      accessorKey: 'donorName',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Donor <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 220,
      cell: ({ row }) => <span className="font-medium">{row.original.donorName}</span>,
    },
    {
      accessorKey: 'description',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Category <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 280,
    },
    { accessorKey: 'productCode', header: 'Source Code', size: 110 },
    {
      accessorKey: 'receiptEventCount',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Receipt Events <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 135,
    },
    {
      accessorKey: 'receivingDateCount',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Receiving Dates <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 140,
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
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Last Received <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
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
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Last Received <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
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

  const toggleFreshAllianceDonor = (donorCode: string, checked: boolean) => {
    setSelectedFreshAllianceDonors((current) => {
      if (!checked) return current.filter((value) => value !== donorCode);
      if (current.includes(donorCode)) return current;
      return [...current, donorCode];
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
          <FreshAlliancePendingNote pending={summary.freshAlliancePending} />
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
                config={paidProductFamilyConfig}
                className="min-w-0 w-full"
                style={{ height: paidProductChartHeight }}
              >
                <BarChart
                  accessibilityLayer
                  data={paidProductSeries.rows}
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
                  {/* One row summary rather than one entry per family
                      series, plus the family split when the bar actually has
                      more than one. */}
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as Record<string, unknown>;
                      const breakdown = row.familyBreakdown as
                        | Array<{ family: string; spendDollars: number }>
                        | undefined;
                      return (
                        <div className="grid min-w-[13rem] gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
                          <div className="font-medium">{String(row.fullDescription)}</div>
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Paid Product Charges</span>
                            <span className="font-mono font-medium tabular-nums">{dollars(Math.round(Number(row.spendDollars) * 100))}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Share of Paid Charges</span>
                            <span className="font-mono font-medium tabular-nums">{(Number(row.spendShare) * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Product Codes</span>
                            <span className="font-mono font-medium tabular-nums">{Number(row.productCount).toLocaleString()}</span>
                          </div>
                          {breakdown && breakdown.length > 0 && (
                            <div className="mt-1 grid gap-1 border-t border-border/50 pt-1.5">
                              <span className="text-muted-foreground">By product family</span>
                              {breakdown.map((entry) => (
                                <div key={entry.family} className="flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <span
                                      className="h-2 w-2 shrink-0 rounded-[2px]"
                                      style={{ backgroundColor: `var(--color-${familyCssKey(entry.family)})` }}
                                    />
                                    {entry.family}
                                  </span>
                                  <span className="font-mono font-medium tabular-nums">{dollars(Math.round(entry.spendDollars * 100))}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  {/* Colour carries product family, which the axis label does
                      not already encode. A custom shape draws each row's
                      segments directly (see PaidProductBarShape) instead of
                      Recharts' native stacking, which renders nothing at this
                      series count. */}
                  <Bar dataKey="spendDollars" shape={PaidProductBarShape} isAnimationActive={false} />
                </BarChart>
              </ChartContainer>
            )}
            {paidProductSeries.families.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Colored by product family:</span>
                {paidProductSeries.families.map((family) => (
                  <span key={family.key} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: familyColorHex(family.label, colorScheme) }}
                    />
                    {family.label}
                  </span>
                ))}
              </div>
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
              Broad OFB reporting categories, broken down by donor. Donor identity comes from the
              OFB Agency Pickups export and is never inferred beyond what it reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {freshAllianceCategoryMixSeries.rows.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                No Fresh Food Alliance receipts match this range and filter.
              </div>
            ) : (
              <ChartContainer
                config={freshAllianceCategoryMixConfig}
                className="min-w-0 w-full"
                style={{ height: freshAllianceCategoryMixHeight }}
              >
                <BarChart
                  accessibilityLayer
                  data={freshAllianceCategoryMixSeries.rows}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis dataKey="category" type="category" width={150} tickLine={false} axisLine={false} />
                  {/* One row summary plus the donor split, same pattern as the
                      paid-product chart's tooltip — a single Bar payload
                      entry per row, not one per donor series. */}
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as FreshAllianceCategoryMixRow;
                      return (
                        <div className="grid min-w-[13rem] gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
                          <div className="font-medium">{row.fullDescription}</div>
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Inbound Weight</span>
                            <span className="font-mono font-medium tabular-nums">{pounds(Math.round(row.weightPounds * 100))}</span>
                          </div>
                          {row.segments.length > 0 && (
                            <div className="mt-1 grid gap-1 border-t border-border/50 pt-1.5">
                              <span className="text-muted-foreground">By donor</span>
                              {row.segments.map((segment) => (
                                <div key={segment.donor} className="flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <span
                                      className="h-2 w-2 shrink-0 rounded-[2px]"
                                      style={{ backgroundColor: `var(--color-${familyCssKey(segment.donor)})` }}
                                    />
                                    {segment.donor}
                                  </span>
                                  <span className="font-mono font-medium tabular-nums">{pounds(Math.round(segment.weightPounds * 100))}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  {/* Colour carries donor, which the axis label does not
                      already encode. A custom shape draws each row's
                      segments directly (see renderStackedBarSegments)
                      instead of Recharts' native stacking, which renders
                      nothing at this series count. */}
                  <Bar dataKey="weightPounds" shape={FreshAllianceCategoryBarShape} isAnimationActive={false} />
                </BarChart>
              </ChartContainer>
            )}
            {freshAllianceCategoryMixSeries.donors.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Colored by donor:</span>
                {freshAllianceCategoryMixSeries.donors.map((donor) => (
                  <span key={donor.key} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: donorColorHex(donor.label, colorScheme) }}
                    />
                    {donor.label}
                  </span>
                ))}
              </div>
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
              {effectiveSeasonalChannel !== 'all' && (
                <> &middot; {channelLabels[effectiveSeasonalChannel]} only</>
              )}
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {/* Only offered when the page-level channel filter is "All
              Channels". A narrower page filter already scopes this card's
              data, so a second independent choice here could contradict the
              filter visible at the top of the page. */}
          {selectedChannel === 'all' && (
            <Select
              value={selectedSeasonalChannel}
              onValueChange={(value) => setSelectedSeasonalChannel(value as 'all' | ProcurementChannel)}
            >
              <SelectTrigger aria-label="Seasonal channel breakdown" className="w-full sm:w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="ofb_warehouse">OFB Warehouse</SelectItem>
                <SelectItem value="fresh_alliance">Fresh Food Alliance</SelectItem>
              </SelectContent>
            </Select>
          )}
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
          </div>
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
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold">Fresh Food Alliance Receipt Categories</h3>
            <p className="text-sm text-muted-foreground">
              Broad categories reported through OFB, by donor. Donor identity comes from the OFB
              Agency Pickups export and is never inferred beyond what it reports.
            </p>
            <FreshAlliancePendingNote pending={summary.freshAlliancePending} className="mt-1" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={freshAllianceDonorOptions.length === 0}>
              <Button variant="outline" className="w-full justify-between sm:w-auto">
                {selectedFreshAllianceDonors.length === freshAllianceDonorOptions.length
                  ? 'All Donors'
                  : selectedFreshAllianceDonors.length === 1
                    ? freshAllianceDonorOptions.find((option) => option.code === selectedFreshAllianceDonors[0])?.label ?? 'All Donors'
                    : `${selectedFreshAllianceDonors.length} donors`}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            {/* DropdownMenu owns this overflow; bound long donor rosters to its available popper height. */}
            <DropdownMenuContent align="end" className="max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setSelectedFreshAllianceDonors(freshAllianceDonorOptions.map((option) => option.code));
                }}
              >
                Select all donors
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setSelectedFreshAllianceDonors([]);
                }}
              >
                Clear all donors
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {freshAllianceDonorOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.code}
                  checked={selectedFreshAllianceDonors.includes(option.code)}
                  onCheckedChange={(checked) => toggleFreshAllianceDonor(option.code, checked === true)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {selectedFreshAllianceDonors.length === 0 && freshAllianceDonorOptions.length > 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            Choose at least one donor.
          </div>
        ) : (
          <EnhancedDataTable
            columns={freshAllianceDonorCategoryColumns}
            data={freshAllianceDonorCategoryRows}
            filterColumn="description"
            filterPlaceholder="Filter receipt categories..."
            enableColumnVisibility
            defaultPageSize={10}
          />
        )}
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

/**
 * States how much already-counted weight is still awaiting OFB's review.
 * Deliberately understated: OFB's "Confirmed" checkbox is an audit sign-off
 * on data the agency already reported, not a data-quality gate, so pending
 * weight is included in every total already -- this note explains that
 * fact, it does not correct or caveat a number that needs correcting. See
 * procurement-unification-plan.md D15.
 */
function FreshAlliancePendingNote({
  pending,
  className = '',
}: {
  pending: ProcurementAnalytics['summary']['freshAlliancePending'];
  className?: string;
}) {
  if (!pending) return null;
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      Includes {pounds(pending.weightHundredths)} of Fresh Food Alliance donations from{' '}
      {format(parseISO(pending.earliestDeliveryDate), 'MMM d, yyyy')} to{' '}
      {format(parseISO(pending.latestDeliveryDate), 'MMM d, yyyy')} still awaiting OFB's
      confirmation sign-off.
    </p>
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
