// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../services/auth/token-service';

const cookieDomain = process.env.COOKIE_DOMAIN?.trim();
const cookieDomainOption = cookieDomain ? cookieDomain : undefined;

export const jwtAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.auth_token;

  if (!token) {
    return next();
  }

  try {
    const payload = TokenService.verifyJWT(token);

    if (payload) {
      req.auth = {
        userId: payload.userId,
        email: payload.email,
      };
      return next();
    }

    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      domain: cookieDomainOption,
    });
  } catch (error) {
    console.warn('[Auth] JWT verification failed:', error);
  }

  return next();
};
