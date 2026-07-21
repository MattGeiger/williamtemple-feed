// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

// Fresh Food Alliance partner observations.
//
// Donor identity comes only from the OFB Agency Pickups export, which is the
// sole source that reports it. FEED records the partner OFB names and never
// infers one from dates, references, category mixes, or operational history.
//
// These are descriptive observations, not an assessment. FEED does not rank
// partners, score them, or explain why a partner's volume moved — a decline may
// reflect a store's own supply, a schedule change, another agency taking a
// route, or nothing at all. Staff know their partners; the software's job is to
// report what arrived.

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { carbonTheme } from '@/lib/colors';
import type { DonorSummary, DonorValueSummary } from '@/types/procurement';

interface DonorAnalyticsProps {
  donors: DonorSummary[];
  donorValue: DonorValueSummary;
  formatDate: (isoDate: string) => string;
}

const pounds = (hundredths: number) => Math.round(hundredths / 100);
const poundLabel = (hundredths: number) => `${pounds(hundredths).toLocaleString()} lb`;
const dollars = (cents: number) =>
  `$${Math.round(cents / 100).toLocaleString()}`;

// Matches the Carbon data-viz convention the other procurement charts use;
// a raw CSS variable renders black against the dark theme.
const donorMixConfig = {
  weight: { label: 'Received Pounds', theme: carbonTheme('teal') },
} satisfies ChartConfig;

export function DonorAnalytics({ donors, donorValue, formatDate }: DonorAnalyticsProps) {
  // Tolerates an analytics payload without donor fields — an older cached
  // response, or a session held open across a backend deploy. A missing
  // section is not worth taking the whole Analytics page down for.
  const safeDonors = React.useMemo(() => donors ?? [], [donors]);

  const mix = React.useMemo(
    () => safeDonors.map((donor) => ({
      donor: donor.donorName,
      weight: pounds(donor.weightHundredths),
    })),
    [safeDonors]
  );

  const totalWeightHundredths = React.useMemo(
    () => safeDonors.reduce((total, donor) => total + donor.weightHundredths, 0),
    [safeDonors]
  );

  const valuationCoverage = !donorValue || donorValue.totalWeightHundredths === 0
    ? null
    : Math.round(100 * donorValue.valuedWeightHundredths / donorValue.totalWeightHundredths);

  if (safeDonors.length === 0 || !donorValue) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Grocery Partners</CardTitle>
          <CardDescription>
            Partner identity comes from the OFB Agency Pickups export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
            No Agency Pickups observations match this range and filter. Import an
            Agency Pickups export from Data Management to see partner detail.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Grocery Partner Mix</CardTitle>
          <CardDescription>
            Received pounds by partner, as reported by Oregon Food Bank
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={donorMixConfig} className="h-80 min-w-0 w-full">
            <BarChart accessibilityLayer data={mix} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis dataKey="donor" type="category" width={190} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="weight" fill="var(--color-weight)" radius={3} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Recorded Donated Value</CardTitle>
          <CardDescription>
            {valuationCoverage === null
              ? 'Oregon Food Bank records a donor value per pound on some receipts'
              // The coverage figure is not a footnote. OFB leaves the rate blank
              // on a large share of historical rows, so the total is a partial
              // sum and must never be read as the value of all donated supply.
              : `Summed only where Oregon Food Bank recorded a rate — ${valuationCoverage}% of received pounds`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Recorded value</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {dollars(donorValue.recordedValueCents)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Pounds with a recorded rate</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {poundLabel(donorValue.valuedWeightHundredths)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Pounds without a recorded rate</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {poundLabel(donorValue.unvaluedWeightHundredths)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            Food without a recorded rate was received and distributed the same as
            any other. FEED reports the value Oregon Food Bank recorded and does
            not estimate a rate for the rest.
          </p>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Partner Pickup History</CardTitle>
          <CardDescription>
            Visit count and typical load differ by partner and shape routing and staffing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Pickups</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="text-right">Average load</TableHead>
                  <TableHead className="text-right">Categories</TableHead>
                  <TableHead className="whitespace-nowrap">Observed range</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeDonors.map((donor) => (
                  <TableRow key={donor.donorCode}>
                    <TableCell className="font-medium">{donor.donorName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {donor.pickupCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {poundLabel(donor.weightHundredths)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {totalWeightHundredths === 0
                        ? '—'
                        : `${Math.round(100 * donor.weightHundredths / totalWeightHundredths)}%`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {poundLabel(donor.averageWeightPerPickupHundredths)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {donor.categories.length}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(donor.firstReceivedDate)} – {formatDate(donor.lastReceivedDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
