// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authOnboardingService, type TermsDocument } from '@/services/auth-onboarding';
import { ApiError } from '@/services/base';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { MarkdownGuideContent } from '@/components/help/MarkdownGuide';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AuthPageShell } from './auth-page-shell';

export function TermsAcceptanceForm({ document, reload }: { document: TermsDocument; reload: () => Promise<void> }) {
  const { user, checkSession, logout } = useAuth();
  const scrollRoot = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const viewport = scrollRoot.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
    if (!viewport) return;
    // Make the actual Shadcn scroll viewport keyboard reachable, not its root.
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', 'FEED Terms of Use');
    const check = () => {
      if (viewport.clientHeight > 0 && viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 2) setReachedEnd(true);
    };
    const observer = new ResizeObserver(check);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    viewport.addEventListener('scroll', check);
    check();
    return () => { observer.disconnect(); viewport.removeEventListener('scroll', check); };
  }, []);

  const submit = async () => {
    if (!reachedEnd || !accepted || saving) return;
    setSaving(true);
    try {
      await authOnboardingService.acceptTerms(document);
      await checkSession();
    } catch (error) {
      ErrorHandlerService.handleError(error, 'acceptTerms');
      if (error instanceof ApiError && error.code === 'TERMS_DOCUMENT_CHANGED') await reload();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <ScrollArea ref={scrollRoot} className="h-[45svh] rounded-md border">
        <article className="space-y-5 p-4 sm:p-6"><MarkdownGuideContent content={document.text} /></article>
      </ScrollArea>
      <p id="terms-progress" role="status" className="text-sm text-muted-foreground">
        {reachedEnd ? 'You can now confirm your agreement.' : 'Scroll to the end to enable the agreement checkbox.'}
      </p>
      <div className="flex items-start gap-3">
        <Checkbox id="agree-terms" checked={accepted} disabled={!reachedEnd || saving}
          aria-describedby="terms-progress" onCheckedChange={value => setAccepted(value === true)} />
        <Label htmlFor="agree-terms" className="leading-relaxed">I have read and agree to the FEED Terms of Use.</Label>
      </div>
      <p className="break-words text-xs text-muted-foreground">
        Your agreement will be retained for {user?.email}, with the document version and date and time of acceptance.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" disabled={saving} onClick={() => void logout()}>Sign out</Button>
        <Button disabled={!reachedEnd || !accepted || saving} onClick={() => void submit()}>
          {saving ? 'Saving agreement…' : 'Agree and continue'}
        </Button>
      </div>
    </div>
  );
}

/** Like login, this route sits outside RootLayout and uses its auth-shell exception. */
export function TermsPage({ acceptance = false }: { acceptance?: boolean }) {
  const { isAuthenticated, isLoading, termsAccepted } = useAuth();
  const [document, setDocument] = useState<TermsDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try { setDocument(await authOnboardingService.getTerms()); }
    catch (err) { setDocument(null); setError(ErrorHandlerService.toUserMessage(err)); }
  };
  useEffect(() => { void load(); }, []);

  if (acceptance && isLoading) return null;
  if (acceptance && !isAuthenticated) return <Navigate to="/login" replace />;
  if (acceptance && termsAccepted) return <Navigate to="/" replace />;

  return (
    <AuthPageShell wide>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{acceptance ? 'Before you continue' : 'FEED Terms of Use'}</CardTitle>
          <CardDescription>{acceptance ? 'Review and accept the current terms to enter FEED.' : 'Terms for access to this Organization’s FEED workspace.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error ? <div className="space-y-3"><p role="alert">{error}</p><Button variant="outline" onClick={() => void load()}>Try again</Button></div>
            : !document ? <p role="status">Loading the FEED Terms of Use…</p>
              : acceptance ? <TermsAcceptanceForm key={document.hash} document={document} reload={load} />
                : <article className="space-y-5"><MarkdownGuideContent content={document.text} /></article>}
          {!acceptance && <Button asChild variant="outline"><Link to={isAuthenticated ? '/' : '/login'}>{isAuthenticated ? 'Back to FEED' : 'Back to sign in'}</Link></Button>}
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
