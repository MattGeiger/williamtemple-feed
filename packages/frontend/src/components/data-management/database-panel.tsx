// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from 'react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { DownloadIcon } from '@/components/animate-ui/icons/download';
import { UploadIcon } from '@/components/animate-ui/icons/upload';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { messageService } from '@/services/message';
import { adminService } from '@/services/admin';
import { DATABASE_SUMMARY_GROUPS, type DatabaseSummary } from '@/types/admin';

/**
 * Administrator-only database actions, plus what the database is holding.
 *
 * Hints are native `title` attributes rather than Radix tooltips. A
 * `TooltipTrigger asChild` around an `AnimateIcon asChild` puts two Slots in
 * series, each trying to forward a ref through `AnimateIcon`, which is not a
 * forwardRef component — React warns and the ref is dropped
 * (docs/motion/ICON_ANIMATIONS.md). A one-line hint does not justify unpicking
 * that; the fuller explanation lives in the Data Management help guide.
 *
 * What the backup contains and omits lives in the Data Management help guide,
 * not on screen — it is a question most people ask once. The tooltips carry the
 * one thing that cannot wait: this file is not a whole-system backup.
 */
/** Bytes as something a person reads, not a number they have to convert. */
const sizeLabel = (bytes: number | null): string => {
  if (bytes === null) return 'Size unavailable';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

export function DatabasePanel() {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [summary, setSummary] = React.useState<DatabaseSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadSummary = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setSummary(await adminService.getDatabaseSummary());
    } catch (error) {
      ErrorHandlerService.handleError(error, 'databaseSummary');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const handleRestore = () => {
    messageService.info(
      'Restoring from a backup file is coming soon. Downloading a backup works today.'
    );
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { filename } = await adminService.downloadBackup();
      messageService.success(`Saved ${filename}.`);
      // The card shows when the last backup was taken; that is now.
      void loadSummary();
    } catch (error) {
      ErrorHandlerService.handleError(error, 'dataManagementBackup');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <AnimateIcon asChild animateOnHover animateOnTap>
          <Button
            size="sm"
            onClick={() => void handleDownload()}
            disabled={isDownloading}
            title="Saves your pantry data as a file. Excludes keys, sign-in records, and staff access."
          >
            <DownloadIcon className="mr-2 h-4 w-4" />
            {isDownloading ? 'Preparing…' : 'Download Backup'}
          </Button>
        </AnimateIcon>

        <AnimateIcon asChild animateOnHover animateOnTap>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestore}
            title="Restoring from a backup file is not available yet."
          >
            <UploadIcon className="mr-2 h-4 w-4" />
            Restore Backup
          </Button>
        </AnimateIcon>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What FEED is holding</CardTitle>
          <CardDescription>
            {isLoading || !summary
              ? 'Counting…'
              : `${summary.totalRecords.toLocaleString()} records · ${sizeLabel(summary.sizeBytes)}` +
                (summary.lastBackupAt
                  ? ` · last backup ${dateLabel(summary.lastBackupAt)}`
                  : ' · never backed up')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading || !summary ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {DATABASE_SUMMARY_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-sm font-medium">{group.label}</p>
                  <dl className="mt-2 space-y-1">
                    {group.tables.map(({ table, label }) => (
                      <div key={table} className="flex items-baseline justify-between gap-4">
                        <dt className="text-sm text-muted-foreground">{label}</dt>
                        <dd className="text-sm font-medium tabular-nums">
                          {(summary.rowCounts[table] ?? 0).toLocaleString()}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
