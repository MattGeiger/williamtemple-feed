// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

// Shows what FEED can currently see per procurement channel.
//
// The two OFB channels are reported on different schedules: Warehouse orders
// appear as they are delivered, while Fresh Alliance pickups appear only after
// someone has entered them into the OFB portal. That entry competes with direct
// service work at a short-staffed agency, so a Fresh Alliance window commonly
// trails the Warehouse window by weeks.
//
// This surface is therefore deliberately descriptive. It states the observed
// window and, where useful, offers a refresh — it never implies lateness,
// incompleteness as fault, or a coverage target. A gap measures available
// data-entry time, not performance. The food arrived and was distributed
// whether or not anyone had time to type it in. See
// docs/data-management/procurement-unification-plan.md (D12).

import { Card, CardContent } from '@/components/ui/card';
import type {
  ProcurementChannelCoverage,
  ProcurementDataStatus,
} from '@/types/procurement';

interface CoverageStripProps {
  status: ProcurementDataStatus | null;
  formatDate: (isoDate: string) => string;
}

interface ChannelRowProps {
  label: string;
  description: string;
  coverage: ProcurementChannelCoverage;
  formatDate: (isoDate: string) => string;
}

function ChannelRow({ label, description, coverage, formatDate }: ChannelRowProps) {
  const { eventCount, earliestDeliveryDate, latestDeliveryDate } = coverage;
  const hasWindow = eventCount > 0 && earliestDeliveryDate && latestDeliveryDate;

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm font-medium">{label}</p>
      {hasWindow ? (
        <>
          <p className="text-sm text-muted-foreground">
            {formatDate(earliestDeliveryDate)} – {formatDate(latestDeliveryDate)}
          </p>
          <p className="text-xs text-muted-foreground">
            {eventCount.toLocaleString()} {eventCount === 1 ? 'event' : 'events'}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Not imported yet</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </>
      )}
    </div>
  );
}

export function ProcurementCoverageStrip({ status, formatDate }: CoverageStripProps) {
  // Tolerates a status payload without coverage — an older cached response, or
  // a browser session held open across a backend deploy. A missing window is
  // not worth taking the page down for.
  if (!status?.coverage) return null;
  const { warehouse, freshAlliance } = status.coverage;
  if (!warehouse || !freshAlliance) return null;
  if (warehouse.eventCount === 0 && freshAlliance.eventCount === 0) return null;

  return (
    <Card>
      <CardContent className="grid gap-6 p-4 sm:grid-cols-2">
        <ChannelRow
          label="OFB Warehouse"
          description="Import a Completed Orders export to see this window."
          coverage={warehouse}
          formatDate={formatDate}
        />
        <ChannelRow
          label="Fresh Food Alliance"
          description="Import an Agency Pickups export to see this window."
          coverage={freshAlliance}
          formatDate={formatDate}
        />
      </CardContent>
    </Card>
  );
}
