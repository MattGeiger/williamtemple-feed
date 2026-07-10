// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

"use client";

import * as React from "react";
import { Link } from "react-router-dom";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { SectionHeader } from "@/components/shared/section-header";
import { createPageTitleIcon } from "@/components/layout/page-title-icon";
import { FileChartColumnIcon } from "@/components/ui/file-chart-column";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { messageService } from "@/services/message";
import { reportsService } from "@/services/reports";
import {
  PLANNING_HORIZONS,
  PlanningHorizon,
  RANGE_PRESET_LABELS,
  RangePreset,
  ReportsQueryRequest,
  ReportTabId,
  TabResults,
} from "@/types/reports";
import { InventoryOutlookTab } from "./inventory-outlook-tab";
import { UnitPricesTab } from "./unit-prices-tab";
import { ScarcityTab } from "./scarcity-tab";
import { ReplenishmentTab } from "./replenishment-tab";
import { DataCoverageTab } from "./data-coverage-tab";
import {
  ReportSelectionProvider,
  useReportSelection,
} from "./selection";
import { GenerateReportDialog } from "./generate-report-dialog";

const PageTitleReportsIcon = createPageTitleIcon(FileChartColumnIcon);

const REPORT_TABS: { value: ReportTabId; label: string }[] = [
  { value: "inventory-outlook", label: "Inventory Outlook" },
  { value: "unit-prices", label: "Unit Prices" },
  { value: "scarcity", label: "Scarcity & Availability" },
  { value: "replenishment", label: "Replenishment Planning" },
  { value: "data-coverage", label: "Data Coverage" },
];

type TabDataState = {
  [K in ReportTabId]?: TabResults[K] | null;
};

/** A template being applied from /reports/templates (via router state). */
export interface ApplyTemplateState {
  applyTemplate?: {
    cardIds: string[];
    range: ReportsQueryRequest["range"];
    horizonDays: PlanningHorizon;
  };
}

export function ReportsWorkspace(props: { applyTemplate?: ApplyTemplateState["applyTemplate"] }) {
  return (
    <ReportSelectionProvider>
      <ReportsWorkspaceInner {...props} />
    </ReportSelectionProvider>
  );
}

function ReportsWorkspaceInner({
  applyTemplate,
}: {
  applyTemplate?: ApplyTemplateState["applyTemplate"];
}) {
  const timeZone = React.useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const [activeTab, setActiveTab] = React.useState<ReportTabId>("inventory-outlook");
  const [preset, setPreset] = React.useState<RangePreset>("last-90-days");
  const [customRange, setCustomRange] = React.useState<DateRange | undefined>();
  const [horizon, setHorizon] = React.useState<PlanningHorizon>(30);
  const [tabData, setTabData] = React.useState<TabDataState>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const {
    isSelecting,
    selectedIds,
    startSelecting,
    cancelSelecting,
    applySelection,
  } = useReportSelection();

  // Applying a shared template restores controls and selection.
  React.useEffect(() => {
    if (!applyTemplate) return;
    setPreset(applyTemplate.range.preset);
    if (applyTemplate.range.preset === "custom" && applyTemplate.range.startDate && applyTemplate.range.endDate) {
      setCustomRange({
        from: new Date(`${applyTemplate.range.startDate}T00:00:00`),
        to: new Date(`${applyTemplate.range.endDate}T00:00:00`),
      });
    }
    setHorizon(applyTemplate.horizonDays);
    applySelection(applyTemplate.cardIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyTemplate]);

  const buildRequest = React.useCallback(
    (tab: ReportTabId): (ReportsQueryRequest & { tab: ReportTabId }) | null => {
      if (preset === "custom") {
        if (!customRange?.from || !customRange?.to) return null;
        return {
          source: "reports",
          tab,
          range: {
            preset,
            timeZone,
            startDate: format(customRange.from, "yyyy-MM-dd"),
            endDate: format(customRange.to, "yyyy-MM-dd"),
          },
          horizonDays: horizon,
        };
      }
      return {
        source: "reports",
        tab,
        range: { preset, timeZone },
        horizonDays: horizon,
      };
    },
    [preset, customRange, horizon, timeZone]
  );

  // Controls invalidate every tab's cache; the active tab refetches below.
  React.useEffect(() => {
    setTabData({});
  }, [preset, customRange, horizon]);

  React.useEffect(() => {
    if (tabData[activeTab]) return; // cached for current controls
    const request = buildRequest(activeTab);
    if (!request) return; // custom range not fully picked yet
    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);
    reportsService
      .query(request)
      .then((response) => {
        if (!cancelled) {
          setTabData((current) => ({
            ...current,
            [response.tab]: response.result,
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
          messageService.error(
            "Unable to load the report data. Check your connection and try again."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, tabData, buildRequest]);

  const handleExportCsv = async (cardId: string) => {
    const request = buildRequest(activeTab);
    if (!request) {
      messageService.error(
        "Pick both custom dates before exporting this block."
      );
      return;
    }
    try {
      await reportsService.downloadCardCsv(cardId, request);
    } catch {
      messageService.error(
        "Unable to export the CSV. Check your connection and try again."
      );
    }
  };

  const tabProps = <T extends ReportTabId>(tab: T) => ({
    result: (tabData[tab] ?? null) as TabResults[T] | null,
    isLoading,
    loadFailed,
    onExportCsv: handleExportCsv,
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reports"
        description="Live inventory analytics: coverage, burn rates, and replenishment outlook."
        icon={PageTitleReportsIcon}
      />

      {/* Range + horizon controls apply to every tab */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="report-range">Date Range</Label>
          <Select
            value={preset}
            onValueChange={(value) => setPreset(value as RangePreset)}
          >
            <SelectTrigger id="report-range" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RANGE_PRESET_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {preset === "custom" && (
          <div className="space-y-2">
            <Label>Custom Dates</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[260px] justify-start font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customRange?.from && customRange?.to
                    ? `${format(customRange.from, "MMM d, yyyy")} – ${format(customRange.to, "MMM d, yyyy")}`
                    : "Pick a date range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={setCustomRange}
                  numberOfMonths={2}
                  defaultMonth={customRange?.from}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="report-horizon">Planning Horizon</Label>
          <Select
            value={String(horizon)}
            onValueChange={(value) =>
              setHorizon(Number(value) as PlanningHorizon)
            }
          >
            <SelectTrigger id="report-horizon" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANNING_HORIZONS.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {days} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selection mode controls stay available on every tab */}
        <div className="ml-auto flex items-end gap-2">
          {!isSelecting ? (
            <>
              <Button variant="outline" asChild>
                <Link to="/reports/templates">Templates</Link>
              </Button>
              <Button onClick={startSelecting}>Generate Report</Button>
            </>
          ) : (
            <>
              <span className="pb-2 text-sm text-muted-foreground">
                {selectedIds.length} of 8 selected
              </span>
              <Button variant="ghost" onClick={cancelSelecting}>
                Cancel
              </Button>
              <Button
                onClick={() => setGenerateOpen(true)}
                disabled={selectedIds.length === 0}
              >
                Continue
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ReportTabId)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          {REPORT_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContents>
          <TabsContent value="inventory-outlook" className="space-y-4 pt-4">
            <InventoryOutlookTab {...tabProps("inventory-outlook")} />
          </TabsContent>
          <TabsContent value="unit-prices" className="space-y-4 pt-4">
            <UnitPricesTab {...tabProps("unit-prices")} />
          </TabsContent>
          <TabsContent value="scarcity" className="space-y-4 pt-4">
            <ScarcityTab {...tabProps("scarcity")} />
          </TabsContent>
          <TabsContent value="replenishment" className="space-y-4 pt-4">
            <ReplenishmentTab {...tabProps("replenishment")} />
          </TabsContent>
          <TabsContent value="data-coverage" className="space-y-4 pt-4">
            <DataCoverageTab {...tabProps("data-coverage")} />
          </TabsContent>
        </TabsContents>
      </Tabs>

      <GenerateReportDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        range={
          buildRequest(activeTab)?.range ?? { preset, timeZone }
        }
        rangeSummary={
          preset === "custom" && customRange?.from && customRange?.to
            ? `${format(customRange.from, "MMM d, yyyy")} – ${format(customRange.to, "MMM d, yyyy")}`
            : RANGE_PRESET_LABELS[preset]
        }
        horizonDays={horizon}
        onGenerated={cancelSelecting}
      />
    </div>
  );
}
