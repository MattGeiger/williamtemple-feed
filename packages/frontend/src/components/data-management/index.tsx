// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Archive, Eye, RotateCcw, SlidersHorizontal, Undo2 } from 'lucide-react';
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
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TableActionMenu } from '@/components/ui/table-action-menu';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { messageService } from '@/services/message';
import { useAuth } from '@/contexts/AuthContext';
import { procurementService } from '@/services/procurement';
import type {
  DataShapingCatalogEntry,
  DataShapingRule,
  ProcurementDataStatus,
  ProcurementImportRecord,
  UnifiedImportResult,
} from '@/types/procurement';
import type { TableBulkAction } from '@/types/table';
import { ProcurementCoverageStrip } from './coverage-strip';
import { DatabasePanel } from './database-panel';
import { DataShapingRuleDialog, type RuleDialogSeed } from './data-shaping-rule-dialog';
import { DataShapingRules } from './data-shaping-rules';
import { LegacyImportDialog } from './legacy-import-dialog';
import { OfbImportDialog } from './ofb-import-dialog';

const PageTitleDataManagementIcon = createPageTitleIcon(DatabaseIcon);

type LifecycleAction = {
  mode: 'rollback' | 'restore';
  imports: ProcurementImportRecord[];
};

// Both sources are the OFB portal; they differ by which export they came from.
const sourceLabel = (source: string) => {
  if (source === 'ofb') return 'OFB Completed Orders';
  if (source === 'ofb_pickup') return 'OFB Agency Pickups';
  if (source === 'legacy_community') return 'Community Donations (historical)';
  return source;
};
const dateLabel = (date: string) => format(parseISO(date), 'MM/dd/yyyy');
const eventLabel = (kind: ProcurementImportRecord['orders'][number]['eventKind']) => {
  if (kind === 'fresh_alliance_receipt') return 'Fresh Food Alliance Receipt';
  if (kind === 'community_donation_month') return 'Community Donation Month';
  return 'OFB Warehouse Order';
};

export function DataManagementWorkspace() {
  // Rollback, restore, and data-shaping rules are administrator actions
  // (ISSUES.md #50a) — the server refuses them for Staff. Hiding the controls
  // keeps a staff member from meeting a 403 they could not have predicted;
  // it is not the boundary, which lives on the route.
  const { isAdministrator } = useAuth();
  const [imports, setImports] = React.useState<ProcurementImportRecord[]>([]);
  const [status, setStatus] = React.useState<ProcurementDataStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [importOpen, setImportOpen] = React.useState(false);
  const [legacyOpen, setLegacyOpen] = React.useState(false);
  const [detailTarget, setDetailTarget] = React.useState<ProcurementImportRecord | null>(null);
  const [lifecycleAction, setLifecycleAction] = React.useState<LifecycleAction | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [rules, setRules] = React.useState<DataShapingRule[]>([]);
  const [ruleCatalog, setRuleCatalog] = React.useState<DataShapingCatalogEntry[]>([]);
  const [rulesLoading, setRulesLoading] = React.useState(true);
  const [ruleSeed, setRuleSeed] = React.useState<RuleDialogSeed | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = React.useState(false);
  const [ruleToDelete, setRuleToDelete] = React.useState<DataShapingRule | null>(null);
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

  const refreshRules = React.useCallback(async () => {
    try {
      setRulesLoading(true);
      const { rules: loaded, catalog } = await procurementService.getRules();
      setRules(loaded);
      setRuleCatalog(catalog);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'procurementDataRules');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    void refreshRules();
  }, [refresh, refreshRules]);

  // Donors FEED has actually seen, offered when authoring a rule so staff pick
  // from what the source reported rather than retyping a name from memory.
  const donorSuggestions = React.useMemo(() => {
    const seen = new Map<string, { name: string; code: string | null }>();
    for (const record of imports) {
      for (const order of record.orders) {
        if (!order.donorName) continue;
        if (!seen.has(order.donorName)) {
          seen.set(order.donorName, { name: order.donorName, code: order.donorCode });
        }
      }
    }
    return [...seen.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [imports]);

  const openRuleDialog = React.useCallback((seed: RuleDialogSeed | null) => {
    setRuleSeed(seed);
    setRuleDialogOpen(true);
  }, []);

  const toggleRule = async (rule: DataShapingRule, enabled: boolean) => {
    try {
      await procurementService.updateRule(rule.id, { enabled });
      await refreshRules();
    } catch (error) {
      ErrorHandlerService.handleError(error, 'procurementDataRules');
    }
  };

  const confirmDeleteRule = async () => {
    if (!ruleToDelete) return;
    try {
      setIsUpdating(true);
      await procurementService.deleteRule(ruleToDelete.id);
      setRuleToDelete(null);
      await refreshRules();
      messageService.success('Rule removed. The observations it covered are counted again.');
    } catch (error) {
      ErrorHandlerService.handleError(error, 'procurementDataRules');
    } finally {
      setIsUpdating(false);
    }
  };

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

  // A unified upload always produces two rows -- Warehouse and Fresh Alliance
  // are permanently separate source namespaces (D3) -- correlated by sharing
  // one unifiedFileHash. Grouped here so the table can name the sibling
  // rather than leaving two differently-labeled rows looking unrelated.
  const pairedSourceByImportId = React.useMemo(() => {
    const bySameUpload = new Map<string, ProcurementImportRecord[]>();
    for (const record of imports) {
      if (!record.unifiedFileHash) continue;
      const group = bySameUpload.get(record.unifiedFileHash) ?? [];
      group.push(record);
      bySameUpload.set(record.unifiedFileHash, group);
    }
    const result = new Map<number, string>();
    for (const group of bySameUpload.values()) {
      for (const record of group) {
        const sibling = group.find((other) => other.id !== record.id && other.source !== record.source);
        if (sibling) result.set(record.id, sourceLabel(sibling.source));
      }
    }
    return result;
  }, [imports]);

  const columns = React.useMemo<ColumnDef<ProcurementImportRecord>[]>(() => [
    {
      accessorKey: 'source',
      header: 'Source',
      size: 170,
      cell: ({ row }) => {
        const pairedWith = pairedSourceByImportId.get(row.original.id);
        return (
          <div className="min-w-0">
            <span className="font-medium">{sourceLabel(row.original.source)}</span>
            {pairedWith && (
              <p className="text-xs text-muted-foreground">
                Paired with {pairedWith}
              </p>
            )}
          </div>
        );
      },
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
      cell: ({ row }) => format(new Date(row.original.importedAt), 'MM/dd/yyyy h:mm a'),
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
              ...(isAdministrator
                ? [
                    {
                      // An import is something you can reshape after the fact,
                      // not only roll back (D20). Seeded with this import's
                      // source and window so the rule starts where the user is
                      // looking.
                      label: 'Shape Data',
                      icon: SlidersHorizontal,
                      onClick: () => openRuleDialog({
                        scope: 'donor',
                        source: row.original.source,
                        startDate: row.original.rangeStart,
                        endDate: row.original.rangeEnd,
                      }),
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
                  ]
                : []),
            ]}
          />
        </div>
      ),
    },
  ], [isAdministrator, openRuleDialog, pairedSourceByImportId]);

  const bulkActions = React.useMemo<TableBulkAction<ProcurementImportRecord>[]>(() => (
    !isAdministrator ? [] : [
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
  ]), [isAdministrator]);

  const handleImported = async (result: UnifiedImportResult) => {
    if (result.outcome === 'imported') await refresh();
  };

  // One definition, rendered by whichever branch applies below. Duplicating
  // the JSX would double every future edit — and every type error in it.
  const analyticsContent = (
    <>
    <ProcurementCoverageStrip status={status} formatDate={dateLabel} />

    {status?.isStale && status.latestDeliveryDate && (
      <Alert variant="warning" className="items-start">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <AlertTitle>Procurement data may be out of date</AlertTitle>
          <AlertDescription>
            The most recent observation FEED holds is from {dateLabel(status.latestDeliveryDate)}. Importing a current export will refresh Procurement Analytics.
          </AlertDescription>
        </div>
      </Alert>
    )}

    <DataShapingRules
      rules={rules}
      isLoading={rulesLoading}
      onAdd={() => openRuleDialog(null)}
      onEdit={(rule) => openRuleDialog({ rule })}
      onToggle={(rule, enabled) => void toggleRule(rule, enabled)}
      onDelete={setRuleToDelete}
      canManage={isAdministrator}
    />
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
        {
          // A permanent single-agency sidecar (D22), deliberately separate
          // from the OFB drop-zone above and hidden under white-label.
          label: 'Import Legacy',
          icon: Archive,
          variant: 'outline',
          action: () => setLegacyOpen(true),
        },
      ]}
    />

    </>
  );

  return (
    <div className="space-y-6 min-w-0 w-full pt-6">
      <SectionHeader
        title="Data Management"
        description="Import external data, download and restore database backups."
        icon={PageTitleDataManagementIcon}
      />

      {/* Staff see only the Analytics content and no tab strip: a single tab
          is chrome without a choice. Administrators also get Database, whose
          actions the server gates independently of this rendering. */}
      {isAdministrator ? (
        <Tabs defaultValue="analytics">
          <TabsList>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
          </TabsList>

          <TabsContents>
            <TabsContent value="analytics" className="space-y-6 pt-4">
              {analyticsContent}
            </TabsContent>

            <TabsContent value="database" className="pt-4">
              <DatabasePanel />
            </TabsContent>
          </TabsContents>
        </Tabs>
      ) : (
        <div className="space-y-6">{analyticsContent}</div>
      )}

      <OfbImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />

      <LegacyImportDialog
        open={legacyOpen}
        onOpenChange={setLegacyOpen}
        onImported={refresh}
      />

      <DataShapingRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        catalog={ruleCatalog}
        seed={ruleSeed}
        donorSuggestions={donorSuggestions}
        onSaved={refreshRules}
      />

      <AlertDialog open={ruleToDelete !== null} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Nothing that was imported changes. The observations this rule covered simply stop
              carrying its flag, so any total that had honored it will include them again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRule} disabled={isUpdating}>
              Remove Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                {pairedSourceByImportId.get(detailTarget.id) && (
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-muted-foreground">From the same export as</dt>
                    <dd className="font-medium">{pairedSourceByImportId.get(detailTarget.id)}</dd>
                  </div>
                )}
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
