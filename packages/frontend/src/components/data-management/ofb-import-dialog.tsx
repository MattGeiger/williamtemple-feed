// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as React from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { UploadIcon } from '@/components/animate-ui/icons/upload';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { messageService } from '@/services/message';
import { procurementService } from '@/services/procurement';
import type { DetectedImportResult } from '@/types/procurement';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Names the export FEED recognized, so the confirmation is specific. */
function exportLabel(exportKind: DetectedImportResult['exportKind']): string {
  return exportKind === 'agency_pickups' ? 'Agency Pickups' : 'Completed Orders';
}

function importedSummary(result: DetectedImportResult): string {
  const rows = result.rowCount.toLocaleString();
  if (result.exportKind === 'agency_pickups') {
    const pickups = `${result.pickupCount} pickup${result.pickupCount === 1 ? '' : 's'}`;
    // Superseding is the part staff would otherwise have to reason about, so
    // the confirmation says plainly that weight was not counted twice.
    const superseded = result.supersededEventCount > 0
      ? `, replacing ${result.supersededEventCount} matching Completed Orders receipt${result.supersededEventCount === 1 ? '' : 's'} so weight is counted once`
      : '';
    return `Imported ${rows} rows across ${pickups} with donor detail${superseded}`;
  }
  const orders = `${result.orderCount} source event${result.orderCount === 1 ? '' : 's'}`;
  return `Imported ${rows} rows across ${orders}`;
}

interface OfbImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: DetectedImportResult) => Promise<void> | void;
}

export function OfbImportDialog({
  open,
  onOpenChange,
  onImported,
}: OfbImportDialogProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [result, setResult] = React.useState<DetectedImportResult | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setIsDragging(false);
      setIsImporting(false);
      setResult(null);
    }
  }, [open]);

  const selectFile = (selected: File | undefined) => {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      messageService.error('Choose a CSV created by the standardized OFB exporter.');
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      messageService.error('Choose an OFB CSV smaller than 5 MB.');
      return;
    }
    setResult(null);
    setFile(selected);
  };

  const importFile = async () => {
    if (!file) return;
    try {
      setIsImporting(true);
      const imported = await procurementService.importOfbExport(file);
      await onImported(imported);
      if (imported.outcome === 'duplicate') {
        messageService.info(
          `This ${exportLabel(imported.exportKind)} data is already current. No changes were made.`
        );
        onOpenChange(false);
        return;
      }
      if (imported.warningCount === 0) {
        messageService.success(
          `${importedSummary(imported)}.`,
          imported.importId === null ? undefined : {
            action: {
              label: 'Undo Import',
              onClick: () => {
                void procurementService.rollbackImports([imported.importId!])
                  .then(async () => {
                    await onImported(imported);
                    messageService.success('The import was rolled back.');
                  })
                  .catch((error) => ErrorHandlerService.handleError(
                    error,
                    'procurementRollbackImport'
                  ));
              },
            },
          }
        );
        onOpenChange(false);
        return;
      }
      setResult(imported);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'procurementImportOfb');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isImporting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Import OFB Data</DialogTitle>
          <DialogDescription>
            Import a Completed Orders or Agency Pickups CSV — FEED recognizes which one it is. The source file is discarded after import and never retained.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <Alert variant="warning" className="items-start">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <AlertTitle>Imported with source warnings</AlertTitle>
                <AlertDescription>
                  {importedSummary(result)} and preserved {result.warningCount} note{result.warningCount === 1 ? '' : 's'} for review.
                </AlertDescription>
              </div>
            </Alert>
            <ScrollArea className="h-56 rounded-md border">
              <ul className="space-y-3 p-4 text-sm">
                {result.warnings.map((warning, index) => (
                  <li key={`${warning.code}-${warning.deliveryDate}-${index}`}>
                    <p className="font-medium">{warning.deliveryDate}</p>
                    <p className="text-muted-foreground">{warning.message}</p>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div
              className={cn(
                'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-border'
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault();
                if (event.currentTarget === event.target) setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                selectFile(event.dataTransfer.files[0]);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">
                {isDragging ? 'Drop the OFB CSV here' : 'Drag and drop an OFB CSV'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">or choose one from this device</p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                disabled={isImporting}
                onClick={() => inputRef.current?.click()}
              >
                Choose CSV
              </Button>
            </div>

            {file && (
              <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.max(1, Math.round(file.size / 1024)).toLocaleString()} KB · discarded after import
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
                Cancel
              </Button>
              <AnimateIcon asChild animateOnHover animateOnTap>
                <Button onClick={() => void importFile()} disabled={!file || isImporting}>
                  <UploadIcon size={16} />
                  {isImporting ? 'Importing…' : 'Import Data'}
                </Button>
              </AnimateIcon>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
