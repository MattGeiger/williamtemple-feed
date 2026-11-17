// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../db';
import { version as releaseVersion } from '../../../package.json';
import { currentTermsDocument, hasAcceptedTerms, recordTermsAcceptance, termsError, TERMS_MESSAGES } from '../../services/auth/terms';

export { releaseVersion };

export async function loginRequirements(userId: string) {
  const document = await currentTermsDocument();
  const [termsAccepted, visit] = await Promise.all([
    hasAcceptedTerms(userId, document.hash),
    prisma.userReleaseVisit.findUnique({ where: { userId_version: { userId, version: releaseVersion } } }),
  ]);
  return { termsAccepted, release: { version: releaseVersion, seen: Boolean(visit) } };
}

function requireIdentity(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.userId) return next(termsError(TERMS_MESSAGES.signIn, 'AUTH_REQUIRED', 401));
  next();
}

function requireAppOrigin(req: Request, _res: Response, next: NextFunction) {
  // APP_URL is the browser origin, including when Vite and Express use
  // different local ports. Do not trust Host or a forwarded header here.
  const allowed = new URL(process.env.APP_URL || 'http://localhost:5173').origin;
  if (req.get('origin') !== allowed) return next(termsError(TERMS_MESSAGES.origin, 'INVALID_ORIGIN', 403));
  next();
}

const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

router.get('/terms', async (_req, res, next) => {
  try { res.json({ document: await currentTermsDocument() }); }
  catch (error) { next(error); }
});

router.post('/terms', requireIdentity, requireAppOrigin, async (req, res, next) => {
  try {
    const acceptance = await recordTermsAcceptance(req.auth!.userId, req.body);
    res.json({ acceptance: { id: acceptance.id, acceptedAt: acceptance.acceptedAt } });
  } catch (error) { next(error); }
});

router.post('/release-seen', requireIdentity, requireAppOrigin, async (req, res, next) => {
  try {
    const requirements = await loginRequirements(req.auth!.userId);
    if (!requirements.termsAccepted) throw termsError(TERMS_MESSAGES.required, 'TERMS_ACCEPTANCE_REQUIRED', 403);
    // A stale frontend must not mark the backend's newer release as presented.
    if (req.body?.version !== releaseVersion) throw termsError('FEED has been updated. Reload the page to see the current release notes.', 'RELEASE_VERSION_CHANGED', 409);
    await prisma.userReleaseVisit.upsert({
      where: { userId_version: { userId: req.auth!.userId, version: releaseVersion } },
      create: { userId: req.auth!.userId, version: releaseVersion }, update: {},
    });
    res.json({ version: releaseVersion });
  } catch (error) { next(error); }
});

export default router;
