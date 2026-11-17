// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TermsAcceptanceForm } from '@/components/auth/terms-page';
import { ProtectedRoute } from '@/components/protected-route';
import { FirstLoginReleaseNotes, ReleaseNotesDialog } from '@/components/release-notes/ReleaseNotesDialog';
import { ApiError } from '@/services/base';
import { APP_VERSION } from '@/config/app-version';

const state = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true, isLoading: false, termsAccepted: false,
    user: { email: 'staff@example.org' }, release: { version: '1.9.1', seen: false },
    checkSession: vi.fn().mockResolvedValue(undefined), logout: vi.fn(),
  },
  accept: vi.fn(), mark: vi.fn(), error: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('@/services/auth-onboarding', () => ({ authOnboardingService: {
  acceptTerms: (...args: unknown[]) => state.accept(...args),
  markReleaseSeen: (...args: unknown[]) => state.mark(...args),
} }));
vi.mock('@/services/error/ErrorHandlerService', () => ({ ErrorHandlerService: { handleError: (...args: unknown[]) => state.error(...args) } }));

const document = { title: 'FEED Terms of Use', version: '2026-11-16', organizationName: 'Example Organization', text: '# FEED Terms of Use\n\nExample Organization', hash: 'current-document-hash' };

beforeEach(() => {
  state.auth.isAuthenticated = true;
  state.auth.isLoading = false;
  state.auth.termsAccepted = false;
  state.auth.release = { version: APP_VERSION, seen: false };
  state.accept.mockReset().mockResolvedValue({});
  state.mark.mockReset().mockResolvedValue({});
  state.auth.checkSession.mockClear();
  state.error.mockClear();
});

function renderForm(reload = vi.fn()) {
  return render(<TermsAcceptanceForm document={document} reload={reload} />);
}

function reachEnd() {
  const viewport = screen.getByRole('region', { name: 'FEED Terms of Use' });
  Object.defineProperties(viewport, {
    clientHeight: { configurable: true, value: 400 },
    scrollHeight: { configurable: true, value: 1200 },
    scrollTop: { configurable: true, value: 800 },
  });
  fireEvent.scroll(viewport);
}

describe('explicit terms agreement', () => {
  it('requires both document-end reach and deliberate checking; reaching the end never checks automatically', async () => {
    renderForm();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Agree and continue' })).toBeDisabled();
    reachEnd();
    expect(screen.getByRole('checkbox')).toBeEnabled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Agree and continue' }));
    await waitFor(() => expect(state.accept).toHaveBeenCalledExactlyOnceWith(document));
    await waitFor(() => expect(state.auth.checkSession).toHaveBeenCalledTimes(1));
  });

  it('does not unlock after a failed save; a changed document triggers reloading for fresh review', async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    state.accept.mockRejectedValue(new ApiError('Review the new terms.', { status: 409, code: 'TERMS_DOCUMENT_CHANGED' }));
    renderForm(reload);
    reachEnd();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Agree and continue' }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(state.auth.checkSession).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalled();
  });

  it('does not mount workspace data or release notes before agreement', async () => {
    const workspace = vi.fn(() => <p>Workspace data</p>);
    const Workspace = workspace;
    render(<MemoryRouter initialEntries={['/']}><Routes>
      <Route element={<ProtectedRoute />}><Route path="/" element={<Workspace />} /></Route>
      <Route path="/terms/accept" element={<p>Agreement required</p>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText('Agreement required')).toBeInTheDocument();
    expect(workspace).not.toHaveBeenCalled();
    expect(state.mark).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('one shared release-notes modal', () => {
  it('presents an unseen release once and records the actual frontend version; dismiss remains available', async () => {
    render(<MemoryRouter><FirstLoginReleaseNotes /></MemoryRouter>);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: `Version ${APP_VERSION} — 2026-11-17` })).toBeInTheDocument();
    await waitFor(() => expect(state.mark).toHaveBeenCalledExactlyOnceWith(APP_VERSION));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not automatically present a seen release; manual sidebar-style opening uses the same content', async () => {
    state.auth.release.seen = true;
    render(<MemoryRouter><FirstLoginReleaseNotes /><ReleaseNotesDialog><button>Version {APP_VERSION}</button></ReleaseNotesDialog></MemoryRouter>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state.mark).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: `Version ${APP_VERSION}` }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Review FEED’s terms once, then continue working.')).toBeInTheDocument();
  });
});
