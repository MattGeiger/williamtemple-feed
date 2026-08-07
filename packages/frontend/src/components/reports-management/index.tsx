// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';

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

/**
 * Saved report templates.
 *
 * A template is the *shape* of a report — which cards, in which order, under
 * which filters — and deliberately not its date range. That is why the row
 * shows what a template contains rather than a period: the period is chosen
 * when it is run.
 *
 * Running a template from here is not built yet. Rather than show a Run action
 * that does nothing, the page says so once, above the table.
 */

const PageTitleReportsIcon = createPageTitleIcon(FileChartColumnIcon);

interface TemplateRow {
  id: number;
  name: string;
  cardCount: number;
  outputs: string;
  scope: string;
  updatedAt: string;
}

/** Reads the stored payload defensively: it is JSON written by an older client. */
const toRow = (template: AnalyticsReportTemplate): TemplateRow => {
  const data = (template.templateData ?? {}) as Record<string, unknown>;
  const cardIds = Array.isArray(data.cardIds) ? data.cardIds : [];
  const outputs = [
    data.includePdf === false ? null : 'PDF',
    data.includeCsv === false ? null : `CSV (${data.csvGrain === 'raw' ? 'raw' : 'condensed'})`,
  ].filter(Boolean);

  // The filters a template pins, in the words the Analytics page uses.
  const scope = [
    data.channel === 'ofb_warehouse'
      ? 'OFB Warehouse'
      : data.channel === 'fresh_alliance'
        ? 'Fresh Food Alliance'
        : null,
    typeof data.acquisitionClass === 'string' ? String(data.acquisitionClass) : null,
  ].filter(Boolean);

  return {
    id: template.id,
    name: template.name,
    cardCount: cardIds.length,
    outputs: outputs.join(' + ') || '—',
    scope: scope.length > 0 ? scope.join(' · ') : 'All channels',
    updatedAt: template.updatedAt,
  };
};

export function ReportsManagementWorkspace() {
  const [templates, setTemplates] = React.useState<TemplateRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pendingDelete, setPendingDelete] = React.useState<TemplateRow | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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

  const actionsFor = React.useCallback(
    (row: TemplateRow): TableRowAction[] => [
      {
        label: 'Delete template',
        icon: Trash2,
        variant: 'destructive',
        onClick: () => setPendingDelete(row),
      },
    ],
    []
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
        size: 90,
        cell: ({ row }) => `${row.original.cardCount}`,
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
    [actionsFor, isSubmitting]
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

      {/*
        Said once, plainly, rather than implied by a Run action that does
        nothing. Templates saved now are stored and will work here when the
        run flow lands.
      */}
      <p className="text-sm text-muted-foreground">
        Templates are saved from Analytics — set your filters, choose cards, and
        tick <strong>Save as report template</strong>. Running one from here is
        not available yet; you can review and remove them in the meantime.
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
