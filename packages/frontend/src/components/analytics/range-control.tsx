// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as React from 'react';
import { format, isValid, parseISO, startOfYear, subDays } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import type {
  AnalyticsDateRange,
  AnalyticsRangePreset,
} from '@/types/analytics';

const PRESETS: Array<{ preset: Exclude<AnalyticsRangePreset, 'custom'>; label: string }> = [
  { preset: 'last-7-days', label: '7d' },
  { preset: 'last-30-days', label: '30d' },
  { preset: 'last-90-days', label: '90d' },
  { preset: 'ytd', label: 'YTD' },
  { preset: 'all', label: 'All' },
];

export const RANGE_URL_VALUES: Record<AnalyticsRangePreset, string> = {
  'last-7-days': '7d',
  'last-30-days': '30d',
  'last-90-days': '90d',
  ytd: 'ytd',
  all: 'all',
  custom: 'custom',
};

const URL_RANGE_PRESETS = Object.fromEntries(
  Object.entries(RANGE_URL_VALUES).map(([preset, value]) => [value, preset])
) as Record<string, AnalyticsRangePreset>;

const validDate = (value: string | null): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value;
};

export function analyticsRangeFromSearchParams(params: URLSearchParams): AnalyticsDateRange {
  const preset = URL_RANGE_PRESETS[params.get('range') ?? ''] ?? 'last-90-days';
  if (preset !== 'custom') return { preset };
  const startDate = params.get('from');
  const endDate = params.get('to');
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    return { preset: 'last-90-days' };
  }
  return { preset, startDate, endDate };
}

const dateRangeFromValue = (value: AnalyticsDateRange): DateRange | undefined => {
  if (value.preset === 'custom' && value.startDate && value.endDate) {
    return { from: parseISO(value.startDate), to: parseISO(value.endDate) };
  }
  const today = new Date();
  switch (value.preset) {
    case 'last-7-days':
      return { from: subDays(today, 6), to: today };
    case 'last-30-days':
      return { from: subDays(today, 29), to: today };
    case 'last-90-days':
      return { from: subDays(today, 89), to: today };
    case 'ytd':
      return { from: startOfYear(today), to: today };
    case 'all':
    case 'custom':
      return undefined;
  }
};

interface AnalyticsRangeControlProps {
  value: AnalyticsDateRange;
  onChange: (range: AnalyticsDateRange) => void;
}

export function AnalyticsRangeControl({ value, onChange }: AnalyticsRangeControlProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(
    dateRangeFromValue(value)
  );

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setDraft(dateRangeFromValue(value) ?? {
        from: subDays(new Date(), 89),
        to: new Date(),
      });
    }
    setIsOpen(open);
  };

  const customLabel = value.preset === 'custom' && value.startDate && value.endDate
    ? `${format(parseISO(value.startDate), 'MMM d')} – ${format(parseISO(value.endDate), 'MMM d, yyyy')}`
    : 'Custom range';

  const applyCustomRange = () => {
    if (!draft?.from || !draft.to) return;
    onChange({
      preset: 'custom',
      startDate: format(draft.from, 'yyyy-MM-dd'),
      endDate: format(draft.to, 'yyyy-MM-dd'),
    });
    setIsOpen(false);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium">Date Range</span>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Tabs
          value={value.preset}
          onValueChange={(preset) => onChange({ preset: preset as AnalyticsRangePreset })}
          className="w-full sm:w-auto"
        >
          <TabsList aria-label="Analytics date range" className="grid h-auto w-full grid-cols-5 sm:flex sm:w-auto">
            {PRESETS.map((option) => (
              <TabsTrigger key={option.preset} value={option.preset}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              aria-pressed={value.preset === 'custom'}
              className={value.preset === 'custom'
                ? 'w-full border-primary bg-accent justify-start sm:w-auto'
                : 'w-full justify-start sm:w-auto'}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              {customLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
            <Calendar
              mode="range"
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={isMobile ? 1 : 2}
              defaultMonth={draft?.from}
              startMonth={new Date(2000, 0, 1)}
              endMonth={new Date()}
              disabled={{ after: new Date() }}
            />
            <div className="space-y-3 border-t p-3">
              <p className="text-xs text-muted-foreground">
                Dates use the organization timezone configured in Settings.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!draft?.from || !draft.to}
                  onClick={applyCustomRange}
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
