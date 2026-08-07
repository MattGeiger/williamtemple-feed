// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useReportSelection } from '@/components/reports/selection';
import { analyticsReportsService } from '@/services/analytics-reports';
import { messageService } from '@/services/message';

/**
 * The ZEV flow's modal, for the Analytics lenses.
 *
 * `components/reports/generate-report-dialog.tsx` is the original. Its
 * selection behaviour is reused unchanged (`useReportSelection`), but its props
 * are welded to the dormant registry's vocabulary — `horizonDays`,
 * `cardOptions`, `source`, `ReportTemplateData` — none of which an Analytics
 * card has. Rather than thread dead concepts through, this speaks the new
 * request and keeps the same shape on screen: ordered cards, output choice, one
 * archive.
 */

const TITLE_MIN = 3;
const TITLE_MAX = 120;

export interface ReportFilterContext {
  preset: string;
  startDate?: string;
  endDate?: string;
  channel?: 'ofb_warehouse' | 'fresh_alliance';
  acquisitionClass?: 'DONATED' | 'PURCH-DON' | 'GOVERNMENT' | 'PURCHASED';
  /** Human summary of the above, shown so the user can see what they will get. */
  summary: string;
}

export function AnalyticsReportDialog({
  open,
  onOpenChange,
  titles,
  filters,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Card id → the title the screen is showing for it right now. */
  titles: Record<string, string>;
  filters: ReportFilterContext;
  onGenerated: () => void;
}) {
  const { selectedIds, moveCard, removeCard } = useReportSelection();
  const [title, setTitle] = React.useState('Procurement Report');
  const [includePdf, setIncludePdf] = React.useState(true);
  const [includeCsv, setIncludeCsv] = React.useState(true);
  const [csvGrain, setCsvGrain] = React.useState<'condensed' | 'raw'>('condensed');
  const [isGenerating, setIsGenerating] = React.useState(false);

  const trimmed = title.trim().replace(/\s+/g, ' ');
  const titleValid = trimmed.length >= TITLE_MIN && trimmed.length <= TITLE_MAX;
  const outputValid = includePdf || includeCsv;
  const canGenerate = titleValid && outputValid && selectedIds.length > 0 && !isGenerating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    try {
      await analyticsReportsService.downloadReport({
        cardIds: selectedIds,
        title: trimmed,
        includePdf,
        includeCsv,
        csvGrain,
        preset: filters.preset,
        startDate: filters.startDate,
        endDate: filters.endDate,
        channel: filters.channel,
        acquisitionClass: filters.acquisitionClass,
      });
      messageService.success(`"${trimmed}" downloaded.`);
      onOpenChange(false);
      onGenerated();
    } catch {
      messageService.error(
        'Unable to generate the report. Check your connection and try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => !isGenerating && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Generate report</DialogTitle>
          <DialogDescription>
            {selectedIds.length} card{selectedIds.length === 1 ? '' : 's'} · {filters.summary}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="report-title">Title</Label>
            <Input
              id="report-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              maxLength={TITLE_MAX}
            />
          </div>

          {/* Order is meaningful: it is the order the cards appear in the PDF
              and the number prefix on each CSV. */}
          <div className="space-y-2">
            <Label>Included cards, in order</Label>
            <ol className="space-y-1">
              {selectedIds.map((cardId, index) => (
                <li
                  key={cardId}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{titles[cardId] ?? cardId}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Move ${titles[cardId] ?? cardId} up`}
                    disabled={index === 0}
                    onClick={() => moveCard(cardId, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Move ${titles[cardId] ?? cardId} down`}
                    disabled={index === selectedIds.length - 1}
                    onClick={() => moveCard(cardId, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Remove ${titles[cardId] ?? cardId}`}
                    onClick={() => removeCard(cardId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-3">
            <Label>Include</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-pdf"
                checked={includePdf}
                onCheckedChange={value => setIncludePdf(value === true)}
              />
              <Label htmlFor="include-pdf" className="font-normal">
                PDF with charts
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-csv"
                checked={includeCsv}
                onCheckedChange={value => setIncludeCsv(value === true)}
              />
              <Label htmlFor="include-csv" className="font-normal">
                CSV data, one file per card
              </Label>
            </div>

            {includeCsv && (
              // Only meaningful for a range long enough to have been condensed;
              // shown always so the choice is not a surprise when it matters.
              <div className="ml-6 space-y-2 border-l pl-4">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  CSV detail
                </Label>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="csv-grain"
                      className="mt-1"
                      checked={csvGrain === 'condensed'}
                      onChange={() => setCsvGrain('condensed')}
                    />
                    <span>
                      Condensed
                      <span className="block text-xs text-muted-foreground">
                        Matches the chart exactly.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="csv-grain"
                      className="mt-1"
                      checked={csvGrain === 'raw'}
                      onChange={() => setCsvGrain('raw')}
                    />
                    <span>
                      Raw
                      <span className="block text-xs text-muted-foreground">
                        Underlying months, even where the chart shows quarters.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={() => void handleGenerate()} disabled={!canGenerate}>
            {isGenerating ? 'Generating…' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
