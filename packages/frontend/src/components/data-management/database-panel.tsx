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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { messageService } from '@/services/message';
import { adminService } from '@/services/admin';

/**
 * Administrator-only database actions.
 *
 * What the backup contains and omits lives in the Data Management help guide,
 * not on screen — it is a question most people ask once. The tooltips carry the
 * one thing that cannot wait: this file is not a whole-system backup.
 */
export function DatabasePanel() {
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { filename } = await adminService.downloadBackup();
      messageService.success(`Saved ${filename}.`);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'dataManagementBackup');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <AnimateIcon asChild animateOnHover animateOnTap>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleDownload()}
              disabled={isDownloading}
            >
              <DownloadIcon className="mr-2 h-4 w-4" />
              {isDownloading ? 'Preparing…' : 'Download Backup'}
            </Button>
          </AnimateIcon>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Saves your inventory, translations, templates, and imported history as
          a file. Leaves out keys and sign-in records, so it is not a complete
          server backup.
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wrapped: a disabled button does not fire the pointer events a
              tooltip needs, and the reason it is disabled is the whole point. */}
          <span tabIndex={0}>
            <Button variant="outline" size="sm" disabled>
              <UploadIcon className="mr-2 h-4 w-4" />
              Restore Backup
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Not available yet. Restoring replaces live data, so it is being
          designed before it is built.
        </TooltipContent>
      </Tooltip>
      </div>
    </TooltipProvider>
  );
}
