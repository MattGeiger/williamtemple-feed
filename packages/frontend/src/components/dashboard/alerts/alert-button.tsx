// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { useState } from 'react';
import { Bell } from "@/components/ui/icons";
import { BellDotIcon } from "@/components/ui/bell-dot";
import { Button } from '@/components/ui/button';
import { AlertDialog } from './alert-dialog';
import { useAlerts } from '@/hooks/alerts/useAlerts';

export function AlertButton() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { unreadCount } = useAlerts({
    limit: 1, // We only need to know if there are any unread alerts
    refreshInterval: 30000
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setDialogOpen(true)}
      >
        {unreadCount > 0 ? (
          // `animateOnMount` shakes the bell when the "new alerts" state first
          // appears (page load or 0 -> >0); it also shakes on hover. The icon
          // only mounts while there are unread alerts, so mount == appearance.
          <BellDotIcon
            size={20}
            animateOnMount
            style={{ color: 'var(--color-clearance)' }}
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