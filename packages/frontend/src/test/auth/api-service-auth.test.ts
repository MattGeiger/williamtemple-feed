// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, BaseApiService } from '@/services/base';

class TestService extends BaseApiService {
  async ping() {
    return this.get<{ ok: boolean }>('/ping');
  }
  async upload() { return this.requestFormData('/upload', new FormData()); }
  async download() { return this.requestBinary('/download'); }
}

describe('BaseApiService authentication', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends cookies and omits Basic auth headers', async () => {
    const service = new TestService('/api/test');

    await service.ping();

    const [, options] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.credentials).toBe('include');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers.Authorization).toBeUndefined();
  });

  it.each(['ping', 'upload', 'download'] as const)('routes a terms-required %s response to agreement without turning it into login expiry', async method => {
    const location = { href: '', pathname: '/' };
    vi.stubGlobal('window', { location });
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {
      message: 'Read and accept the current FEED Terms of Use before continuing.', code: 'TERMS_ACCEPTANCE_REQUIRED',
    } }), { status: 403, headers: { 'content-type': 'application/json' } }));
    const service = new TestService('/api/test');
    const error = await service[method]().catch(err => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: 'TERMS_ACCEPTANCE_REQUIRED' });
    expect(location.href).toBe('/terms/accept');
  });
});
