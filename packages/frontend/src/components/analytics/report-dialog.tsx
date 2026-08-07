// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvided,
  type DropResult,
} from '@hello-pangea/dnd';
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';

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
  const { selectedIds, applySelection, moveCard, removeCard } = useReportSelection();
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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const next = [...selectedIds];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    applySelection(next);
  };

  const renderRow = (
    cardId: string,
    index: number,
    provided: DraggableProvided,
    isDragging: boolean
  ) => (
    <li
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={`flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm ${
        isDragging ? 'shadow-lg ring-2 ring-primary/40' : ''
      }`}
    >
      <span
        {...provided.dragHandleProps}
        aria-label={`Reorder ${titles[cardId] ?? cardId}`}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{index + 1}</span>
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
  );

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
              and the number prefix on each CSV.
              
              Drag is the primary interaction, but the move buttons stay. This
              library ships a keyboard drag mode (space to lift, arrows to move,
              space to drop) and it does NOT work inside a Radix dialog —
              verified here with real key events: the lift never starts, the
              order never changes, and no announcement fires. Removing the
              buttons on the assumption that keyboard drag covers them would
              have made this list pointer-only. */}
          <div className="space-y-2">
            <Label id="card-order-label">Included cards, in order</Label>
            <p className="text-xs text-muted-foreground">
              Drag to reorder, or use the move buttons.
            </p>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable
                droppableId="report-cards"
                renderClone={(provided, _snapshot, rubric) =>
                  // Rendered into the body, not in place. Radix's dialog is
                  // positioned with a transform, and a transformed ancestor
                  // breaks position: fixed — without this the dragged card
                  // follows the cursor at an offset.
                  createPortal(
                    renderRow(selectedIds[rubric.source.index], rubric.source.index, provided, true),
                    document.body
                  )
                }
              >
                {droppable => (
                  <ol
                    ref={droppable.innerRef}
                    {...droppable.droppableProps}
                    aria-labelledby="card-order-label"
                    className="space-y-1"
                  >
                    {selectedIds.map((cardId, index) => (
                      <Draggable key={cardId} draggableId={cardId} index={index}>
                        {provided => renderRow(cardId, index, provided, false)}
                      </Draggable>
                    ))}
                    {droppable.placeholder}
                  </ol>
                )}
              </Droppable>
            </DragDropContext>
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
