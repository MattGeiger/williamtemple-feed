// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || 'login@williamtemple.app';
const from = `FEED Login <${fromAddress}>`;

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
    const magicLink = `${process.env.APP_URL}/api/auth/callback?token=${token}&email=${encodeURIComponent(email)}`;
    
    try {
      const { error } = await resend.emails.send({
        from,
        to: [email],
        subject: 'Sign in to FEED System',
        html: this.getMagicLinkTemplate(magicLink)
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
        html: this.getOTPTemplate(code)
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
   * Simple HTML template for magic link email
   */
  private static getMagicLinkTemplate(magicLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Sign in to FEED</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 30px;">
                      <h1 style="color: #333333; font-size: 24px; margin: 0;">Sign in to FEED System</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 30px;">
                      <p style="color: #555555; font-size: 16px; line-height: 24px; margin: 0;">
                        Click the button below to sign in to your account. This link expires in 10 minutes.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 20px 0;">
                      <a href="${magicLink}" style="background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: 600; display: inline-block;">
                        Sign In
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top: 30px; border-top: 1px solid #eeeeee;">
                      <p style="color: #999999; font-size: 12px; line-height: 18px; margin: 0;">
                        If you didn't request this email, you can safely ignore it. This link will expire in 10 minutes.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  /**
   * Simple HTML template for OTP email
   */
  private static getOTPTemplate(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Your verification code</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 30px;">
                      <h1 style="color: #333333; font-size: 24px; margin: 0;">Your Verification Code</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 20px;">
                      <p style="color: #555555; font-size: 16px; line-height: 24px; margin: 0; text-align: center;">
                        Enter this code to sign in to your FEED account:
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 20px 0;">
                      <div style="background-color: #f6f9fc; border-radius: 8px; padding: 20px; display: inline-block;">
                        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #000000; font-family: 'Courier New', monospace;">
                          ${code}
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top: 20px;">
                      <p style="color: #555555; font-size: 14px; line-height: 20px; margin: 0; text-align: center;">
                        This code expires in 3 minutes.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top: 30px; border-top: 1px solid #eeeeee;">
                      <p style="color: #999999; font-size: 12px; line-height: 18px; margin: 0;">
                        If you didn't request this code, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }
}
