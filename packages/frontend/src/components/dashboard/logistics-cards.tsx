// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

"use client";

import * as React from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, DollarSign, Gauge, PackageX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { reportsService } from "@/services/reports";
import type { DashboardSnapshot } from "@/types/reports";
import { SelectableBlock } from "@/components/reports/selection";

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function DashboardLogisticsCards() {
  const [data, setData] = React.useState<DashboardSnapshot | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    reportsService.queryDashboard({
      source: "dashboard",
      range: { preset: "last-90-days", timeZone },
      horizonDays: 30,
    }).then((response) => {
      if (!cancelled) setData(response.result);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => { cancelled = true; };
  }, []);

  const cards = data ? [
    {
      id: "dashboard-projected-stockouts",
      title: "Projected Stockouts",
      value: String(data.logistics.projectedStockouts),
      description: "in-stock items projected out within 30 days",
      href: "/reports?tab=inventory-outlook",
      icon: PackageX,
    },
    {
      id: "dashboard-quantity-coverage",
      title: "Quantity Coverage",
      value: data.logistics.quantityCoveragePercent === null
        ? "Unknown"
        : `${data.logistics.quantityCoveragePercent.toFixed(0)}%`,
      description: `${data.logistics.quantityKnownItems} of ${data.logistics.totalItems} items have quantities`,
      href: "/reports?tab=data-coverage",
      icon: ClipboardCheck,
    },
    {
      id: "dashboard-median-cover",
      title: "Median Days of Cover",
      value: data.logistics.medianDaysOfCover === null
        ? "Unknown"
        : data.logistics.medianDaysOfCover.toFixed(1),
      description: `${data.logistics.coverReadyItems} calculable in-stock items`,
      href: "/reports?tab=inventory-outlook",
      icon: Gauge,
    },
    {
      id: "dashboard-replenishment-cost",
      title: "Known 30-Day Replenishment Cost",
      value: formatMoney(data.logistics.knownReplenishmentCostCents),
      description: `${data.logistics.donatedDemandItems} donated · ${data.logistics.unknownCostDemandItems} unknown-cost excluded`,
      href: "/reports?tab=replenishment",
      icon: DollarSign,
    },
  ] : [];

  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-20" /><Skeleton className="mt-2 h-3 w-full" /></CardContent></Card>
        ))}
        {failed && <p className="col-span-full text-sm text-muted-foreground">Inventory logistics metrics are unavailable. Refresh the Dashboard to try again.</p>}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <SelectableBlock key={card.id} cardId={card.id}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
              <Button variant="link" size="sm" className="mt-1 h-auto p-0" asChild>
                <Link to={card.href}>View report</Link>
              </Button>
            </CardContent>
          </Card>
        </SelectableBlock>
      ))}
    </div>
  );
}
