// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { useEffect, useRef, useState } from 'react';
import { Bell } from "@/components/ui/icons";
import { BellDotIcon, type BellDotIconHandle } from "@/components/ui/bell-dot";
import { Button } from '@/components/ui/button';
import { AlertDialog } from './alert-dialog';
import { useAlerts } from '@/hooks/alerts/useAlerts';

export function AlertButton() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { unreadCount } = useAlerts({
    limit: 1, // We only need to know if there are any unread alerts
    refreshInterval: 30000
  });

  const hasUnread = unreadCount > 0;

  // Shake the bell when unread alerts appear (0 -> >0), to draw attention to
  // newly-spawned alerts. It also replays on hover (handlers below).
  const bellRef = useRef<BellDotIconHandle>(null);
  useEffect(() => {
    if (hasUnread) bellRef.current?.startAnimation();
  }, [hasUnread]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setDialogOpen(true)}
      >
        {hasUnread ? (
          <BellDotIcon
            ref={bellRef}
            size={20}
            style={{ color: 'var(--color-clearance)' }}
            onMouseEnter={() => bellRef.current?.startAnimation()}
            onMouseLeave={() => bellRef.current?.stopAnimation()}
          />
        ) : (
          <Bell className="h-5 w-5 text-muted-foreground" />
        )}
      </Button>
      <AlertDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}