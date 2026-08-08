// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Play, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SectionHeader } from '@/components/shared/section-header';
import { createPageTitleIcon } from '@/components/layout/page-title-icon';
import { FileChartColumnIcon } from '@/components/ui/file-chart-column';
import { EnhancedDataTable } from '@/components/ui/enhanced-data-table';
import { SortableHeader } from '@/components/ui/sortable-header';
import { TableActionMenu } from '@/components/ui/table-action-menu';
import type { TableRowAction } from '@/types/table';
import { formatDateTime } from '@/lib/formatting/date';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { messageService } from '@/services/message';
import {
  analyticsReportsService,
  type AnalyticsReportTemplate,
} from '@/services/analytics-reports';
import { RunTemplateDialog, type RunTemplateTarget } from './run-dialog';
import {
  cardAvailability,
  outputsLabel,
  parseTemplateSpec,
  scopeLabel,
  type AnalyticsTemplateSpec,
} from './template-spec';

/**
 * Saved report templates.
 *
 * A template is the *shape* of a report — which cards, in which order, under
 * which filters — and deliberately not its date range. That is why the row
 * shows what a template contains rather than a period: the period is chosen
 * when it is run.
 *
 * The card registry is fetched once here rather than per dialog. It is needed
 * twice — to title the cards in the run dialog, and to mark a row whose cards
 * no longer exist — and a template that cannot be run should say so in the
 * table, before anyone opens it.
 */

const PageTitleReportsIcon = createPageTitleIcon(FileChartColumnIcon);

interface TemplateRow {
  id: number;
  name: string;
  cardCount: number;
  outputs: string;
  scope: string;
  updatedAt: string;
  spec: AnalyticsTemplateSpec;
}

const toRow = (template: AnalyticsReportTemplate): TemplateRow => {
  const spec = parseTemplateSpec(template);
  return {
    id: template.id,
    name: template.name,
    cardCount: spec.cardIds.length,
    outputs: outputsLabel(spec),
    scope: scopeLabel(spec),
    updatedAt: template.updatedAt,
    spec,
  };
};

export function ReportsManagementWorkspace() {
  const [templates, setTemplates] = React.useState<TemplateRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pendingDelete, setPendingDelete] = React.useState<TemplateRow | null>(null);
  const [runTarget, setRunTarget] = React.useState<RunTemplateTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // Null means "not known yet, or the lookup failed". Distinct from an empty
  // map: an empty map would say every saved card has been removed, which is a
  // far more alarming claim than "we could not check".
  const [cardTitles, setCardTitles] = React.useState<Record<string, string> | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setTemplates((await analyticsReportsService.getTemplates()).map(toRow));
    } catch (error) {
      ErrorHandlerService.handleError(error, 'analyticsReportTemplates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    // Failure is deliberately quiet: this only enriches the page, and a toast
    // about the card registry on a page about templates would puzzle more than
    // it explains. The run dialog falls back to showing stored ids.
    void analyticsReportsService
      .getCards()
      .then(cards =>
        setCardTitles(Object.fromEntries(cards.map(card => [card.id, card.title])))
      )
      .catch(() => setCardTitles(null));
  }, []);

  const missingCount = React.useCallback(
    (row: TemplateRow) => cardAvailability(row.spec, cardTitles).missing.length,
    [cardTitles]
  );

  const actionsFor = React.useCallback(
    (row: TemplateRow): TableRowAction[] => {
      const runnable = cardAvailability(row.spec, cardTitles).available.length;
      return [
        {
          label: 'Run report',
          icon: Play,
          onClick: () => setRunTarget({ id: row.id, name: row.name, spec: row.spec }),
          disabled: runnable === 0,
          title:
            runnable === 0
              ? row.cardCount === 0
                ? 'This template has no cards saved.'
                : 'None of this template’s cards are available any more.'
              : undefined,
        },
        {
          label: 'Delete template',
          icon: Trash2,
          variant: 'destructive',
          onClick: () => setPendingDelete(row),
        },
      ];
    },
    [cardTitles]
  );

  const columns = React.useMemo<ColumnDef<TemplateRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
        size: 280,
      },
      {
        accessorKey: 'cardCount',
        header: ({ column }) => <SortableHeader column={column}>Cards</SortableHeader>,
        size: 140,
        cell: ({ row }) => {
          const missing = missingCount(row.original);
          return (
            <span className="flex items-center gap-1.5">
              {row.original.cardCount}
              {missing > 0 && (
                <span
                  className="flex items-center gap-1 text-xs text-amber-600"
                  title={`${missing} card${missing === 1 ? '' : 's'} in this template ${missing === 1 ? 'is' : 'are'} no longer available.`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {missing} unavailable
                </span>
              )}
            </span>
          );
        },
      },
      { accessorKey: 'outputs', header: 'Includes', size: 200 },
      { accessorKey: 'scope', header: 'Filters', size: 200 },
      {
        accessorKey: 'updatedAt',
        header: ({ column }) => <SortableHeader column={column}>Last Saved</SortableHeader>,
        size: 190,
        cell: ({ row }) => formatDateTime(row.original.updatedAt),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableHiding: false,
        size: 72,
        cell: ({ row }) => (
          <TableActionMenu
            actions={actionsFor(row.original)}
            isLoading={isSubmitting}
            size="sm"
          />
        ),
      },
    ],
    [actionsFor, isSubmitting, missingCount]
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsSubmitting(true);
    try {
      await analyticsReportsService.deleteTemplate(pendingDelete.id);
      messageService.success(`Deleted "${pendingDelete.name}".`);
      setPendingDelete(null);
      await load();
    } catch (error) {
      ErrorHandlerService.handleError(error, 'analyticsReportTemplateDelete');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0 w-full pt-6">
      <SectionHeader
        title="Reports Management"
        description="Manage reusable report templates for consistent, repeatable reporting."
        icon={PageTitleReportsIcon}
      />

      {/* Where templates come from is not discoverable from this page alone —
          they are only created from Analytics — so it is said here once. */}
      <p className="text-sm text-muted-foreground">
        Templates are saved from Analytics — set your filters, choose cards, and
        tick <strong>Save as report template</strong>. Run one from here to
        generate it again for a new date range.
      </p>

      <EnhancedDataTable
        columns={columns}
        data={templates}
        isLoading={isLoading}
        filterColumn="name"
        filterPlaceholder="Filter templates..."
        enableColumnVisibility
        defaultPageSize={10}
        emptyMessage="No report templates saved yet."
      />

      <RunTemplateDialog
        target={runTarget}
        onOpenChange={open => !open && setRunTarget(null)}
        cardTitles={cardTitles}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={open => !open && !isSubmitting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the saved card selection and filters for everyone.
              Reports already downloaded are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
