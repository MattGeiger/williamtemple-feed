// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { describe, expect, it } from 'vitest';

import { ResendService } from '../resend-service';
import { BRAND } from '../email-layout';

/**
 * Sign-in mail is the one message staff get that looks like what they are
 * trained to distrust. These assertions cover the parts that make it
 * recognisable — and the parts that must survive an email client refusing to
 * load remote images.
 */

// `private` is a compile-time notion; the templates are reachable at runtime.
const templates = ResendService as unknown as {
  getMagicLinkTemplate(link: string): string;
  getMagicLinkText(link: string): string;
  getOTPTemplate(code: string): string;
  getOTPText(code: string): string;
  getInvitationTemplate(url: string, email: string): string;
  getInvitationText(url: string, email: string): string;
};

const allHtml = () => [
  ['magic link', templates.getMagicLinkTemplate('https://feed.williamtemple.app/x')],
  ['verification code', templates.getOTPTemplate('123456')],
  ['invitation', templates.getInvitationTemplate('https://feed.williamtemple.app/login', 'a@b.org')],
];

describe('email branding', () => {
  it.each(allHtml())('%s carries the organisation and the palette', (_name, html) => {
    expect(html).toContain('William Temple House');
    expect(html).toContain('Food Equity &amp; Efficient Delivery');
    expect(html).toContain(BRAND.blue);
    expect(html).toContain('/brand/wth-logo-email.png');
  });

  it.each(allHtml())('%s still reads as FEED with images blocked', (_name, html) => {
    // Outlook and privacy-filtered clients suppress remote images by default.
    // The wordmark must therefore be live text, and the logo must have alt
    // text — if the brand only existed inside the <img>, the message would
    // arrive anonymous.
    const withoutImages = html.replace(/<img[^>]*>/g, '');

    expect(withoutImages).toContain('William Temple House');
    expect(withoutImages).toContain('FEED');
    expect(html).toMatch(/<img[^>]+alt="William Temple House"/);
  });

  it.each(allHtml())('%s never asks for anything back', (_name, html) => {
    expect(html).toContain('never ask you for a password');
    expect(html).toContain('never ask you to');
  });

  it('shows the code, and escapes anything interpolated', () => {
    expect(templates.getOTPTemplate('482913')).toContain('482913');

    const html = templates.getInvitationTemplate(
      'https://feed.williamtemple.app/login',
      '<script>x</script>@b.org'
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sends a plain-text alternative alongside the HTML', () => {
    // HTML with no text part scores worse with spam filters — the opposite of
    // what this change is for.
    const texts = [
      templates.getMagicLinkText('https://feed.williamtemple.app/x'),
      templates.getOTPText('123456'),
      templates.getInvitationText('https://feed.williamtemple.app/login', 'a@b.org'),
    ];

    for (const text of texts) {
      expect(text).not.toContain('<');
      expect(text).toContain('William Temple House');
    }
    expect(texts[1]).toContain('123456');
  });

  it('gives each message its own inbox preview line', () => {
    // Without a preheader, clients scrape the first visible text — which is the
    // same wordmark in every message, so every FEED email would preview alike.
    const previews = allHtml().map(([, html]) => {
      const match = /opacity: 0; color: transparent; height: 0; width: 0;">\s*([^<]+)/.exec(
        html as string
      );
      return match?.[1].trim();
    });

    expect(previews.every(Boolean)).toBe(true);
    expect(new Set(previews).size).toBe(previews.length);
  });
});
