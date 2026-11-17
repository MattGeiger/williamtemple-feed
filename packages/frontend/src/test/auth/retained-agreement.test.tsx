// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuditHistory } from '@/components/admin/audit-history';

const services = vi.hoisted(() => ({ audit: vi.fn(), agreement: vi.fn() }));
vi.mock('@/services/admin', () => ({ adminService: {
  getAudit: (...args: unknown[]) => services.audit(...args),
  getAgreement: (...args: unknown[]) => services.agreement(...args),
} }));

describe('Admin History retained agreement', () => {
  it('opens the accepted document snapshot, with original identity/time/version, from its History action', async () => {
    services.audit.mockResolvedValue({ total: 1, entries: [{
      id: 'terms:agreement-1', actorUserId: 'removed-account', actorLabel: 'synthetic@example.org',
      action: 'TERMS_ACCEPTED', targetType: 'TERMS', targetId: 'agreement-1',
      targetLabel: 'FEED Terms of Use · original-version', createdAt: '2026-11-16T20:00:00Z', detail: {},
    }] });
    services.agreement.mockResolvedValue({
      id: 'agreement-1', userId: 'removed-account', emailAtAcceptance: 'synthetic@example.org',
      termsVersion: 'original-version', termsHash: 'retained-document-hash',
      termsText: '# Original accepted document\n\nThe previous Organization and wording.',
      organizationName: 'Previous Organization', acceptedAt: '2026-11-16T20:00:00Z',
    });
    render(<MemoryRouter><AuditHistory /></MemoryRouter>);
    expect(await screen.findByText('Accepted FEED Terms of Use')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View agreement' }));
    expect(await screen.findByRole('heading', { name: 'Original accepted document' })).toBeInTheDocument();
    expect(screen.getByText('The previous Organization and wording.')).toBeInTheDocument();
    expect(screen.getByText(/synthetic@example.org · Accepted/)).toBeInTheDocument();
    expect(services.agreement).toHaveBeenCalledExactlyOnceWith('agreement-1');
    expect(screen.getByText('Document SHA-256: retained-document-hash')).toBeInTheDocument();
  });
});
