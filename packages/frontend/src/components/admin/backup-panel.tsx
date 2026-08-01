// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { DownloadIcon } from '@/components/animate-ui/icons/download';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { messageService } from '@/services/message';
import { adminService } from '@/services/admin';

/**
 * Download a sanitized logical backup.
 *
 * The copy here is doing real work. Calling this a "database backup" would be
 * wrong in a way that matters: the artifact deliberately omits API keys,
 * encryption keys, sign-in records, and the staff roster, so an administrator
 * who believes it is a full snapshot would be planning a recovery around
 * something that cannot deliver one. The panel says what is in it, what is not,
 * and what still needs doing separately.
 */
export function BackupPanel() {
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { filename, rowTotal } = await adminService.downloadBackup();
      messageService.success(
        `Saved ${filename} — ${rowTotal.toLocaleString()} records of pantry data.`
      );
    } catch (error) {
      ErrorHandlerService.handleError(error, 'adminDownloadBackup');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Download a backup</CardTitle>
          <CardDescription>
            A copy of the pantry's working data that you can keep somewhere safe.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium">What it contains</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Categories, food items, and their limits</li>
                <li>Languages and every saved translation</li>
                <li>Shopping list templates and saved components</li>
                <li>Imported procurement history and data rules</li>
                <li>Operating hours and organization settings</li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-medium">What it leaves out, on purpose</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>AI provider keys and encryption keys</li>
                <li>Sign-in codes and session records</li>
                <li>The staff list and the activity history</li>
                <li>Uploaded and generated documents</li>
              </ul>
            </div>
          </div>

          <Alert variant="warning" className="items-start">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <AlertTitle>This is not a complete server backup</AlertTitle>
              <AlertDescription>
                Because it deliberately leaves out keys and sign-in records, it
                cannot restore FEED on its own — provider keys and staff access
                would need setting up again. For full disaster recovery, whoever
                maintains your server should also be taking snapshots there.
              </AlertDescription>
            </div>
          </Alert>

          <p className="text-sm text-muted-foreground">
            The file is plain JSON and describes itself: it records which version
            of FEED produced it, which data it contains, and a checksum for
            verifying it later. Keep it somewhere private — it still holds your
            organization's operating data.
          </p>
        </CardContent>

        <CardFooter className="justify-end">
          <AnimateIcon asChild animateOnHover animateOnTap>
            <Button onClick={() => void handleDownload()} disabled={isDownloading}>
              <DownloadIcon className="mr-2 h-4 w-4" />
              {isDownloading ? 'Preparing…' : 'Download backup'}
            </Button>
          </AnimateIcon>
        </CardFooter>
      </Card>
    </div>
  );
}
