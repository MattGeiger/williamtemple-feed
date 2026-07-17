// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Eye, RotateCcw, Undo2 } from 'lucide-react';
import { UploadIcon } from '@/components/animate-ui/icons/upload';
import { createPageTitleIcon } from '@/components/layout/page-title-icon';
import { SectionHeader } from '@/components/shared/section-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Badge } from '@/components/ui/badge';
import { DatabaseIcon } from '@/components/ui/database';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EnhancedDataTable } from '@/components/ui/enhanced-data-table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TableActionMenu } from '@/components/ui/table-action-menu';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { messageService } from '@/services/message';
import { procurementService } from '@/services/procurement';
import type {
  ProcurementDataStatus,
  ProcurementImportRecord,
  ProcurementImportResult,
} from '@/types/procurement';
import type { TableBulkAction } from '@/types/table';
import { OfbImportDialog } from './ofb-import-dialog';

const PageTitleDataManagementIcon = createPageTitleIcon(DatabaseIcon);

type LifecycleAction = {
  mode: 'rollback' | 'restore';
  imports: ProcurementImportRecord[];
};

const sourceLabel = (source: string) => source === 'ofb' ? 'Oregon Food Bank' : source;
const dateLabel = (date: string) => format(parseISO(date), 'MMM d, yyyy');
const eventLabel = (kind: ProcurementImportRecord['orders'][number]['eventKind']) =>
  kind === 'fresh_alliance_receipt'
    ? 'Fresh Food Alliance Receipt'
    : 'OFB Warehouse Order';

export function DataManagementWorkspace() {
  const [imports, setImports] = React.useState<ProcurementImportRecord[]>([]);
  const [status, setStatus] = React.useState<ProcurementDataStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [importOpen, setImportOpen] = React.useState(false);
  const [detailTarget, setDetailTarget] = React.useState<ProcurementImportRecord | null>(null);
  const [lifecycleAction, setLifecycleAction] = React.useState<LifecycleAction | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const tableRef = React.useRef<{ clearSelection?: () => void }>(null);

  const refresh = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const [loadedImports, loadedStatus] = await Promise.all([
        procurementService.getImports(),
        procurementService.getStatus(),
      ]);
      setImports(loadedImports);
      setStatus(loadedStatus);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'procurementImportHistory');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyLifecycleAction = async () => {
    if (!lifecycleAction) return;
    try {
      setIsUpdating(true);
      const ids = lifecycleAction.imports.map((record) => record.id);
      const updated = lifecycleAction.mode === 'rollback'
        ? await procurementService.rollbackImports(ids)
        : await procurementService.restoreImports(ids);
      setLifecycleAction(null);
      tableRef.current?.clearSelection?.();
      await refresh();
      if (updated === 0) {
        messageService.info(
          lifecycleAction.mode === 'rollback'
            ? 'The selected imports were already rolled back.'
            : 'The selected imports were already active.'
        );
      } else {
        messageService.success(
          lifecycleAction.mode === 'rollback'
            ? `Rolled back ${updated} import${updated === 1 ? '' : 's'}.`
            : `Restored ${updated} import${updated === 1 ? '' : 's'}.`
        );
      }
    } catch (error) {
      ErrorHandlerService.handleError(
        error,
        lifecycleAction.mode === 'rollback'
          ? 'procurementRollbackImports'
          : 'procurementRestoreImports'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const columns = React.useMemo<ColumnDef<ProcurementImportRecord>[]>(() => [
    {
      accessorKey: 'source',
      header: 'Source',
      size: 170,
      cell: ({ row }) => <span className="font-medium">{sourceLabel(row.original.source)}</span>,
    },
    {
      id: 'dateRange',
      header: 'Delivery Dates',
      size: 220,
      cell: ({ row }) => `${dateLabel(row.original.rangeStart)} – ${dateLabel(row.original.rangeEnd)}`,
    },
    {
      accessorKey: 'rowCount',
      header: 'Rows',
      size: 90,
      cell: ({ row }) => row.original.rowCount.toLocaleString(),
    },
    {
      accessorKey: 'orderCount',
      header: 'Events',
      size: 110,
    },
    {
      accessorKey: 'warningCount',
      header: 'Warnings',
      size: 110,
      cell: ({ row }) => row.original.warningCount > 0
        ? <Badge variant="outline">{row.original.warningCount}</Badge>
        : 'None',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 120,
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'active' ? 'secondary' : 'outline'}>
          {row.original.status === 'active' ? 'Active' : 'Rolled Back'}
        </Badge>
      ),
    },
    {
      accessorKey: 'importedAt',
      header: 'Imported',
      size: 170,
      cell: ({ row }) => format(new Date(row.original.importedAt), 'MMM d, yyyy h:mm a'),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableHiding: false,
      size: 72,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <TableActionMenu
            size="sm"
            triggerLabel={`Open actions for ${sourceLabel(row.original.source)} import`}
            actions={[
              {
                label: 'View Details',
                icon: Eye,
                onClick: () => setDetailTarget(row.original),
              },
              row.original.status === 'active'
                ? {
                    label: 'Rollback',
                    icon: Undo2,
                    variant: 'destructive' as const,
                    onClick: () => setLifecycleAction({ mode: 'rollback', imports: [row.original] }),
                  }
                : {
                    label: 'Restore Import',
                    icon: RotateCcw,
                    onClick: () => setLifecycleAction({ mode: 'restore', imports: [row.original] }),
                  },
            ]}
          />
        </div>
      ),
    },
  ], []);

  const bulkActions = React.useMemo<TableBulkAction<ProcurementImportRecord>[]>(() => [
    {
      label: 'Rollback Active Imports',
      icon: Undo2,
      variant: 'destructive',
      action: (selected) => {
        const active = selected.filter((record) => record.status === 'active');
        if (active.length === 0) {
          messageService.info('The selected imports are already rolled back.');
          return;
        }
        setLifecycleAction({ mode: 'rollback', imports: active });
      },
    },
    {
      label: 'Restore Rolled-Back Imports',
      icon: RotateCcw,
      action: (selected) => {
        const rolledBack = selected.filter((record) => record.status === 'rolled_back');
        if (rolledBack.length === 0) {
          messageService.info('The selected imports are already active.');
          return;
        }
        setLifecycleAction({ mode: 'restore', imports: rolledBack });
      },
    },
  ], []);

  const handleImported = async (result: ProcurementImportResult) => {
    if (result.outcome === 'imported') await refresh();
  };

  return (
    <div className="space-y-6 min-w-0 w-full pt-6">
      <SectionHeader
        title="Data Management"
        description="Import external data, review its provenance, and reverse unwanted imports."
        icon={PageTitleDataManagementIcon}
      />

      {status?.isStale && status.latestDeliveryDate && (
        <Alert variant="warning" className="items-start">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <AlertTitle>Procurement data may be out of date</AlertTitle>
            <AlertDescription>
              The latest OFB delivery is {status.daysSinceLatestDelivery} calendar days old ({dateLabel(status.latestDeliveryDate)}). Import a current export to refresh Procurement Analytics.
            </AlertDescription>
          </div>
        </Alert>
      )}

      <EnhancedDataTable
        ref={tableRef}
        columns={columns}
        data={imports}
        isLoading={isLoading}
        filterColumn="source"
        filterPlaceholder="Filter imports..."
        enableColumnVisibility
        defaultPageSize={5}
        selection={{
          enabled: true,
          selectionColumn: true,
          bulkActions,
        }}
        toolbarActions={[
          {
            label: 'Import OFB Data',
            icon: UploadIcon,
            variant: 'default',
            action: () => setImportOpen(true),
          },
        ]}
      />

      <OfbImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />

      <Dialog open={detailTarget !== null} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>Import Details</DialogTitle>
            <DialogDescription>
              Normalized provenance retained after the source CSV was discarded.
            </DialogDescription>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div><dt className="text-muted-foreground">Source</dt><dd className="font-medium">{sourceLabel(detailTarget.source)}</dd></div>
                <div><dt className="text-muted-foreground">Rows</dt><dd className="font-medium">{detailTarget.rowCount.toLocaleString()}</dd></div>
                <div><dt className="text-muted-foreground">Warnings</dt><dd className="font-medium">{detailTarget.warningCount}</dd></div>
              </dl>
              <ScrollArea className="h-72 rounded-md border">
                <div className="space-y-3 p-4">
                  {detailTarget.warnings.map((warning, index) => (
                    <div key={`${warning.code}-${warning.deliveryDate}-${index}`} className="border-b pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{warning.code.replace(/_/g, ' ')}</Badge>
                        <span className="text-sm font-medium">{dateLabel(warning.deliveryDate)}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{warning.message}</p>
                    </div>
                  ))}
                  {detailTarget.orders.map((order) => (
                    <div key={order.id} className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium">{eventLabel(order.eventKind)} {order.sourceOrderReference}</p>
                        <p className="text-sm text-muted-foreground">
                          {dateLabel(order.deliveryDate)} · {order.lineCount} lines · Revision {order.revision}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {order.isCurrent && <Badge variant="secondary">Current</Badge>}
                        {order.warningCodes.map((code) => (
                          <Badge key={code} variant="outline">{code.replace(/_/g, ' ')}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={lifecycleAction !== null} onOpenChange={(open) => !open && setLifecycleAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lifecycleAction?.mode === 'rollback' ? 'Rollback selected import data?' : 'Restore selected import data?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lifecycleAction?.mode === 'rollback'
                ? 'The normalized records remain in audit history, but their event revisions will stop contributing to Analytics. Previous active revisions are restored automatically.'
                : 'The selected import records will become active again. Newer active event revisions continue to take precedence.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyLifecycleAction()} disabled={isUpdating}>
              {isUpdating
                ? 'Updating…'
                : lifecycleAction?.mode === 'rollback' ? 'Rollback Import' : 'Restore Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
