// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { Request, Response, NextFunction } from 'express';
import { currentTermsDocument, hasAcceptedTerms, termsError, TERMS_MESSAGES } from '../../services/auth/terms';

export async function requireTermsAcceptance(req: Request, _res: Response, next: NextFunction) {
  // Auth routes enforce their own identity requirements. Public inventory,
  // branding, health and static files are mounted before this middleware.
  if (req.path === '/api/auth' || req.path.startsWith('/api/auth/')
    || ['/api/system/status', '/api/system/initialize'].includes(req.path)) return next();
  if (!req.path.startsWith('/api/')) return next();
  try {
    // Neither legacy Basic credentials nor a caller-supplied PDF header can
    // stand in for the individual account whose agreement is being checked.
    if (!req.auth?.userId) throw termsError(TERMS_MESSAGES.signIn, 'AUTH_REQUIRED', 401);
    const document = await currentTermsDocument();
    if (!await hasAcceptedTerms(req.auth.userId, document.hash)) {
      throw termsError(TERMS_MESSAGES.required, 'TERMS_ACCEPTANCE_REQUIRED', 403);
    }
    next();
  } catch (error) { next(error); }
}
