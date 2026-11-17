// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { APP_VERSION } from '@/config/app-version';
import { useAuth } from '@/contexts/AuthContext';
import { authOnboardingService } from '@/services/auth-onboarding';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { ReleaseNotesCard } from './ReleaseNotesCard';

export function ReleaseNotesDialog({ children, open, onOpenChange }: {
  children?: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="border-0! bg-transparent! p-0! shadow-none! outline-hidden! ring-0! focus:outline-hidden! focus-visible:outline-hidden! focus-visible:ring-0! sm:max-w-2xl [&>button]:right-4 [&>button]:top-4">
        <DialogTitle className="sr-only">Release Notes</DialogTitle>
        <DialogDescription className="sr-only">What’s new in FEED through version {APP_VERSION}.</DialogDescription>
        <ReleaseNotesCard />
      </DialogContent>
    </Dialog>
  );
}

export function FirstLoginReleaseNotes() {
  const { release, checkSession } = useAuth();
  const [open, setOpen] = useState(!release.seen);
  const attempted = useRef(false);
  useEffect(() => {
    // Mark only the frontend release actually presented. Merely checking the
    // session (or accepting terms) must not consume the first-login notice.
    if (!open || release.seen || attempted.current) return;
    attempted.current = true;
    void authOnboardingService.markReleaseSeen(APP_VERSION)
      .then(() => checkSession())
      .catch(error => ErrorHandlerService.handleError(error, 'releaseSeen'));
  }, [open, release.seen, checkSession]);
  return <ReleaseNotesDialog open={open} onOpenChange={setOpen} />;
}
