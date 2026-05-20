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
 * Domain validation - @williamtemple.org only
 */
const isAllowedDomain = (email: string): boolean => {
  return email.toLowerCase().endsWith('@williamtemple.org');
};

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

    if (!isAllowedDomain(email)) {
      const error = new Error('Only @williamtemple.org email addresses are allowed') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

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

    if (!isAllowedDomain(email)) {
      const error = new Error('Only @williamtemple.org email addresses are allowed') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

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

    if (!isAllowedDomain(email)) {
      const error = new Error('Only @williamtemple.org email addresses are allowed') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

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
    const token = req.cookies.auth_token;

    if (!token) {
      return res.json({ authenticated: false, user: null });
    }

    const payload = TokenService.verifyJWT(token);

    if (!payload) {
      res.clearCookie('auth_token');
      return res.json({ authenticated: false, user: null });
    }

    res.json({
      authenticated: true,
      user: {
        id: payload.userId,
        email: payload.email
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
