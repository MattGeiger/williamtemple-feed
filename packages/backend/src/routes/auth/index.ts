// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { VerificationService } from '../../services/auth/verification-service';
import { TokenService } from '../../services/auth/token-service';
import { AccessPolicyService } from '../../services/auth/access-policy-service';

const router = Router();
const cookieDomain = process.env.COOKIE_DOMAIN?.trim();
const cookieDomainOption = cookieDomain ? cookieDomain : undefined;

const emailSchema = z.object({
  email: z.string().email('Please provide a valid email address')
});

const magicLinkVerifySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1)
});

const otpVerifySchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must contain only numbers')
});

/**
 * Every entry point below consults `AccessPolicyService.assertMayAuthenticate`,
 * which owns both the domain rule and the roster allowlist. It replaces the
 * local domain check that used to be duplicated across three handlers — and
 * that `/callback` never had at all, so a magic link could complete for an
 * address the OTP path would have refused.
 *
 * The gate is applied at request *and* at verify. Checking only at request
 * would honour a code or link issued moments before an administrator revoked
 * someone's access.
 */

/**
 * POST /api/auth/magic-link/request
 * Send magic link email
 */
router.post('/magic-link/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = emailSchema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Invalid request';
      const error = new Error(message) as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const { email } = result.data;

    await AccessPolicyService.assertMayAuthenticate(email);

    await VerificationService.sendMagicLink(email);

    res.json({
      success: true,
      message: 'Magic link sent successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/callback
 * Verify magic link and authenticate user
 */
router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = magicLinkVerifySchema.safeParse(req.query);

    if (!result.success) {
      return res.redirect(`${process.env.APP_URL}/login?error=invalid_link`);
    }

    const { email, token } = result.data;

    // Re-checked here, not only at request time: a link issued before a
    // revocation must not still resolve. A browser navigation gets a redirect
    // rather than a JSON error.
    try {
      await AccessPolicyService.assertMayAuthenticate(email);
    } catch {
      return res.redirect(`${process.env.APP_URL}/login?error=access_denied`);
    }

    const userId = await VerificationService.verifyMagicLink(email, token);

    if (!userId) {
      return res.redirect(`${process.env.APP_URL}/login?error=expired_link`);
    }

    // Generate JWT
    const jwtToken = TokenService.generateJWT(userId, email);

    // Set httpOnly cookie
    res.cookie('auth_token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: cookieDomainOption
    });

    // Redirect to dashboard
    res.redirect(process.env.APP_URL || 'http://localhost:5173');
  } catch (error) {
    console.error('[Auth] Callback error:', error);
    res.redirect(`${process.env.APP_URL}/login?error=verification_failed`);
  }
});

/**
 * POST /api/auth/otp/request
 * Send OTP code
 */
router.post('/otp/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = emailSchema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Invalid request';
      const error = new Error(message) as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const { email } = result.data;

    await AccessPolicyService.assertMayAuthenticate(email);

    await VerificationService.sendOTP(email);

    res.json({
      success: true,
      message: 'Verification code sent successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/otp/verify
 * Verify OTP code and authenticate user
 */
router.post('/otp/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = otpVerifySchema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Invalid request';
      const error = new Error(message) as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const { email, code } = result.data;

    await AccessPolicyService.assertMayAuthenticate(email);

    const userId = await VerificationService.verifyOTP(email, code);

    if (!userId) {
      const error = new Error('Invalid or expired verification code. Please request a new code.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT
    const token = TokenService.generateJWT(userId, email);

    // Set httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: cookieDomainOption
    });

    res.json({
      success: true,
      user: { id: userId, email }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/session
 * Get current session info
 */
router.get('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // `jwtAuthMiddleware` has already verified the cookie and loaded the
    // caller's current role and access state from the database, so this reads
    // what it attached rather than re-decoding the token. A revoked or deleted
    // account never reaches here — the middleware ends that session with a 401.
    if (!req.auth?.userId) {
      return res.json({ authenticated: false, user: null });
    }

    res.json({
      authenticated: true,
      user: {
        id: req.auth.userId,
        email: req.auth.email,
        role: req.auth.role,
        accessState: req.auth.accessState
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Clear auth cookie
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      domain: cookieDomainOption
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
