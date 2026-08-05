// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { Resend } from 'resend';
import {
  BRAND,
  button,
  escapeHtml,
  heading,
  paragraph,
  renderEmail,
} from './email-layout';

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || 'login@williamtemple.app';
/**
 * The display name is the only branding visible in an inbox list, and it is
 * read before the message is opened. "FEED Login" named the system but not the
 * organisation, so the sender line carried nothing a recipient could recognise.
 */
const from = `FEED at William Temple House <${fromAddress}>`;

const assertEmailConfig = () => {
  if (!resendApiKey) {
    throw new Error('Email service not configured. Missing RESEND_API_KEY.');
  }
  if (!fromAddress.includes('@')) {
    throw new Error('Email service misconfigured: EMAIL_FROM must be a valid email address.');
  }
};

export class ResendService {
  /**
   * Send magic link email
   * @throws Error with user-friendly message if sending fails
   */
  static async sendMagicLink(email: string, token: string): Promise<void> {
    assertEmailConfig();
    const resend = new Resend(resendApiKey);
    // Points at the confirmation *page*, not the API. Following this link
    // consumes nothing; the token is spent only when the recipient presses the
    // button there, which POSTs it. Mail scanners prefetch links and would
    // otherwise burn a single-use token before the human ever clicked.
    const magicLink = `${process.env.APP_URL}/sign-in/confirm?token=${token}&email=${encodeURIComponent(email)}`;
    
    try {
      const { error } = await resend.emails.send({
        from,
        to: [email],
        subject: 'Sign in to FEED System',
        html: this.getMagicLinkTemplate(magicLink),
        text: this.getMagicLinkText(magicLink)
      });

      if (error) {
        console.error('[ResendService] Magic link error:', error);
        throw new Error('Unable to send sign-in link. Please try again or use verification code instead.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unable to send')) {
        throw error; // Re-throw our custom error
      }
      console.error('[ResendService] Unexpected error:', error);
      throw new Error('Email service temporarily unavailable. Please try again in a moment.');
    }
  }

  /**
   * Send OTP verification code
   * @throws Error with user-friendly message if sending fails
   */
  static async sendOTP(email: string, code: string): Promise<void> {
    assertEmailConfig();
    const resend = new Resend(resendApiKey);
    console.log('[ResendService] Sending OTP:', {
      to: email,
      from,
      apiKey: resendApiKey?.slice(0, 10) + '...'
    });

    try {
      const { error } = await resend.emails.send({
        from,
        to: [email],
        subject: 'Your FEED verification code',
        html: this.getOTPTemplate(code),
        text: this.getOTPText(code)
      });

      if (error) {
        console.error('[ResendService] OTP error:', error);
        throw new Error('Unable to send verification code. Please wait a moment and try again.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unable to send')) {
        throw error; // Re-throw our custom error
      }
      console.error('[ResendService] Unexpected error:', error);
      throw new Error('Email service temporarily unavailable. Please try again in a moment.');
    }
  }

  /**
   * Tell a newly invited staff member that they can sign in.
   *
   * Deliberately carries NO token — it links to the login page, where the
   * recipient enters their own address and receives a code. Inbound mail
   * scanners (Microsoft Defender, among others) prefetch links and would burn a
   * single-use token before the human ever clicked it; that is exactly why
   * magic links are the secondary path here. A plain page URL is safe to
   * prefetch.
   *
   * @throws Error with user-friendly message if sending fails
   */
  static async sendInvitation(email: string): Promise<void> {
    assertEmailConfig();
    const resend = new Resend(resendApiKey);
    const loginUrl = `${process.env.APP_URL || 'https://feed.williamtemple.app'}/login`;

    try {
      const { error } = await resend.emails.send({
        from,
        to: [email],
        subject: 'You have been given access to FEED',
        html: this.getInvitationTemplate(loginUrl, email),
        text: this.getInvitationText(loginUrl, email)
      });

      if (error) {
        console.error('[ResendService] Invitation error:', error);
        throw new Error('Unable to send the invitation email. The person was added to the roster and can be notified another way.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unable to send')) {
        throw error; // Re-throw our custom error
      }
      console.error('[ResendService] Unexpected error:', error);
      throw new Error('Email service temporarily unavailable. The person was added to the roster and can be notified another way.');
    }
  }

  /**
   * Simple HTML template for magic link email
   */
  /** Branded magic-link email. */
  private static getMagicLinkTemplate(magicLink: string): string {
    return renderEmail({
      title: 'Sign in to FEED',
      preheader: 'Your sign-in link for FEED — expires in 10 minutes.',
      content: [
        heading('Sign in to FEED'),
        paragraph(
          'You asked to sign in to FEED, the food pantry management system at ' +
            'William Temple House. Use the button below, then confirm on the page ' +
            'that opens.'
        ),
        `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding: 12px 0 24px 0;">${button(
          magicLink,
          'Sign in to FEED'
        )}</td></tr></table>`,
        paragraph(
          `This link expires in <strong style="color: ${BRAND.ink};">10 minutes</strong> and can only be used once.`
        ),
      ].join('\n'),
      security:
        'If you did not ask to sign in, you can ignore this message — the link ' +
        'expires on its own and nothing happens until it is confirmed.',
    });
  }

  /** Plain-text alternative. Sending HTML alone is itself a spam signal. */
  private static getMagicLinkText(magicLink: string): string {
    return [
      'Sign in to FEED',
      '',
      'You asked to sign in to FEED, the food pantry management system at',
      'William Temple House. Open the link below, then confirm on the page that',
      'opens:',
      '',
      magicLink,
      '',
      'This link expires in 10 minutes and can only be used once.',
      '',
      'If you did not ask to sign in, you can ignore this message.',
      'FEED will never ask you for a password.',
      '',
      'William Temple House - feed.williamtemple.app',
    ].join('\n');
  }

  /** Branded invitation email. Carries no token by design — see sendInvitation. */
  private static getInvitationTemplate(loginUrl: string, email: string): string {
    return renderEmail({
      title: 'Access to FEED',
      preheader: 'You have been given access to FEED at William Temple House.',
      content: [
        heading('You have access to FEED'),
        paragraph(
          `An administrator has added <strong style="color: ${BRAND.ink};">${escapeHtml(
            email
          )}</strong> to FEED, the food pantry management system at William Temple House.`
        ),
        `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding: 12px 0 24px 0;">${button(
          loginUrl,
          'Go to FEED'
        )}</td></tr></table>`,
        paragraph(
          'On the sign-in page, enter this email address and FEED will send you a ' +
            'six-digit verification code. There is no password to set up.'
        ),
      ].join('\n'),
      security:
        'If you were not expecting this, you can ignore it — no account is active ' +
        'until you sign in.',
    });
  }

  /** Plain-text alternative. */
  private static getInvitationText(loginUrl: string, email: string): string {
    return [
      'You have access to FEED',
      '',
      `An administrator has added ${email} to FEED, the food pantry management`,
      'system at William Temple House.',
      '',
      `Sign in here: ${loginUrl}`,
      '',
      'On the sign-in page, enter this email address and FEED will send you a',
      'six-digit verification code. There is no password to set up.',
      '',
      'If you were not expecting this, you can ignore it - no account is active',
      'until you sign in.',
      '',
      'William Temple House - feed.williamtemple.app',
    ].join('\n');
  }

  /** Branded verification-code email. */
  private static getOTPTemplate(code: string): string {
    return renderEmail({
      title: 'Your FEED verification code',
      preheader: `${code} is your FEED verification code — expires in 3 minutes.`,
      content: [
        heading('Your verification code'),
        paragraph(
          'Enter this code on the FEED sign-in page to finish signing in to the ' +
            'food pantry management system at William Temple House.'
        ),
        `<table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding: 8px 0 24px 0;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${BRAND.blueTint}" style="background-color: ${BRAND.blueTint}; border-radius: 8px; padding: 22px 34px;">
                    <span style="font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; font-size: 34px; font-weight: 700; letter-spacing: 10px; color: ${BRAND.blue}; line-height: 1;">${escapeHtml(
                      code
                    )}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`,
        paragraph(
          `This code expires in <strong style="color: ${BRAND.ink};">3 minutes</strong>.`,
          ' text-align: center;'
        ),
      ].join('\n'),
      security:
        'If you did not ask to sign in, you can ignore this message — the code ' +
        'expires on its own and is useless to anyone else.',
    });
  }

  /** Plain-text alternative. */
  private static getOTPText(code: string): string {
    return [
      'Your FEED verification code',
      '',
      `    ${code}`,
      '',
      'Enter this code on the FEED sign-in page to finish signing in to the food',
      'pantry management system at William Temple House.',
      '',
      'This code expires in 3 minutes.',
      '',
      'If you did not ask to sign in, you can ignore this message. FEED will never',
      'ask you to reply to this message with your code.',
      '',
      'William Temple House - feed.williamtemple.app',
    ].join('\n');
  }
}
