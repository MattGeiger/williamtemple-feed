// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { adminService } from '@/services/admin';
import { AUDIT_ACTION_LABELS, type AuditEntry } from '@/types/admin';

const PAGE_SIZE = 25;

/**
 * Who did what, to whom, and when.
 *
 * The first entries on a freshly upgraded instance are the beta.4 migration's
 * own mass grant, recorded as `system:beta.4-migration` so the roster's origin
 * is on the record rather than appearing as administrators from nowhere.
 */
const actorLabel = (entry: AuditEntry): string => {
  if (entry.actorLabel === 'system:beta.4-migration') return 'FEED upgrade';
  if (entry.actorLabel === 'operator:cli') return 'Server console';
  return entry.actorLabel;
};

export function AuditHistory() {
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    adminService
      .getAudit({ limit: PAGE_SIZE, offset })
      .then(page => {
        if (cancelled) return;
        setEntries(page.entries);
        setTotal(page.total);
      })
      .catch(error => ErrorHandlerService.handleError(error, 'adminAuditHistory'))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [offset]);

  const showingTo = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Affected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nothing recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>{actorLabel(entry)}</TableCell>
                  <TableCell>
                    {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.targetLabel ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {offset + 1}–{showingTo} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={offset === 0 || isLoading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={showingTo >= total || isLoading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
