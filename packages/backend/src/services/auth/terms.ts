// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../db';
import { resolveBrand } from '../brand-config';
import { AUDIT_ACTIONS } from './authorization';

// Published wording is immutable. Change this version whenever wording changes.
// FEED's application version is deliberately independent of this version.
export const TERMS_VERSION = '2026-11-16';
export const TERMS_TITLE = 'FEED Terms of Use';

export const TERMS_MESSAGES = {
  required: 'Read and accept the current FEED Terms of Use before continuing.',
  identityUnavailable: 'FEED cannot confirm the Organization for these terms right now. Wait a moment and try again.',
  changed: 'The terms have changed. Review the current document before agreeing.',
  origin: 'FEED could not confirm this request. Reload the page and try again.',
  signIn: 'Sign in to FEED before recording your agreement.',
};

export const termsError = (message: string, code: string, statusCode: number) =>
  Object.assign(new Error(message), { code, statusCode });

export function buildTermsDocument(organizationName: string) {
  // Brand fields are plain text, never Markdown supplied by an administrator.
  const name = organizationName.replace(/[\\`*_{}\[\]()<>#+.!|~-]/g, '\\$&');
  const text = `# FEED — Terms of Use

Effective date: November 16, 2026 · Version: ${TERMS_VERSION}

These terms govern your individual access to the FEED workspace provided by ${name} (“the Organization”). FEED—Food Equity & Efficient Delivery—was developed by Matt Geiger, Temple Consulting, LLC.

## 1. Authorized access

Use this workspace only while authorized by the Organization and for purposes connected with your assigned responsibilities. Your access is personal. Do not share sign-in links, verification codes, or an authenticated session with another person.

## 2. Shared workspace

FEED is a shared organizational workspace. Changes you make to inventory, templates, translations, settings, and other records may immediately affect other staff and the materials they produce. Make changes only within your responsibilities, check important changes, and promptly report mistakes.

## 3. Confidential information and organization data

Access, upload, use, download, and disclose information only as authorized by the Organization. Protect client, staff, financial, and operational information in accordance with the Organization’s applicable policies.

Do not enter unnecessary personal or sensitive information, or upload information you are not authorized to process. Store downloaded files securely and share them only with authorized recipients.

These terms do not transfer ownership of the Organization’s data to the software developer.

## 4. AI services and generated materials

Some FEED features send submitted content to the Organization’s configured third-party AI providers for translation or other processing. Submit only information approved for that use under the Organization’s policies.

Translations, generated documents, and reports may contain errors or omissions. Review important results before distributing them or relying on them for decisions. Use qualified human review when accuracy affects access to services, safety, or other significant interests.

## 5. Responsible use and security

Do not bypass access controls, access information beyond your authorization, interfere with the service, or use the workspace for unlawful purposes.

Protect the email account used to sign in. Sign out when finished on a shared device, and promptly report suspected unauthorized access, exposed information, or security problems to the Organization’s administrator.

## 6. Software license and branding

FEED’s application code is licensed under the GNU Affero General Public License, version 3 or later. These workspace terms do not replace that license or restrict rights it grants to use, study, modify, or share the software. Third-party components remain subject to their respective licenses.

Access to this workspace does not grant permission to use the Organization’s or Temple Consulting’s names, logos, or other branding beyond authorized use.

## 7. Availability, warranties, and liability

Unless a separate written agreement provides otherwise, FEED is provided “as is” and “as available,” without warranties to the extent permitted by law. Availability may depend on hardware, network access, hosting, and third-party services.

These terms do not create an obligation for Temple Consulting, LLC to provide ongoing development, maintenance, support, or uninterrupted service.

To the extent permitted by law, Temple Consulting, LLC is not liable to you for indirect, incidental, special, or consequential damages arising from your use of this workspace. Nothing in these terms excludes rights or liability that cannot lawfully be excluded.

## 8. Access changes and other agreements

The Organization may suspend or end your workspace access when your authorization ends, these terms are violated, or action is reasonably necessary to protect the service or its information.

These terms supplement the Organization’s applicable policies. They do not amend an executed agreement between the Organization and Temple Consulting, LLC; that agreement controls if there is a conflict.

## 9. Agreement and updates

By selecting **Agree and continue**, you confirm that you have read and agree to these terms. FEED will retain your account identity, the exact terms you accepted, their version, and the date and time of acceptance. The Organization’s administrators can review this record in Admin → History.

You will be asked to agree again when the terms are updated. A FEED software release alone does not require renewed agreement.

If you do not agree, sign out and contact the Organization’s administrator.

**Questions:** Contact the Organization’s administrator. Questions for Temple Consulting may be submitted at [templepdx.com/contact](https://templepdx.com/contact).
`;
  return {
    title: TERMS_TITLE, version: TERMS_VERSION, organizationName, text,
    hash: createHash('sha256').update(text, 'utf8').digest('hex'),
  };
}

export async function currentTermsDocument() {
  const brand = await resolveBrand();
  // No configured appearance is a valid WTH default. A resolver failure is
  // different: never ask another organization to accept WTH's fallback identity.
  if (brand.warning) throw termsError(TERMS_MESSAGES.identityUnavailable, 'TERMS_IDENTITY_UNAVAILABLE', 503);
  return buildTermsDocument(brand.config.identity.organizationName);
}

export async function hasAcceptedTerms(userId: string, hash: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, accessState: true } });
  if (!user || user.accessState === 'REVOKED') return false;
  return Boolean(await prisma.termsAcceptance.findUnique({
    where: { userId_emailAtAcceptance_termsHash: { userId, emailAtAcceptance: user.email, termsHash: hash } }, select: { id: true },
  }));
}

export async function recordTermsAcceptance(userId: string, payload: unknown) {
  const body = payload as Record<string, unknown> | null;
  if (!body || body.accepted !== true) {
    throw termsError(TERMS_MESSAGES.required, 'TERMS_ACCEPTANCE_REQUIRED', 400);
  }
  const document = await currentTermsDocument();
  if (body.version !== document.version || body.hash !== document.hash) {
    throw termsError(TERMS_MESSAGES.changed, 'TERMS_DOCUMENT_CHANGED', 409);
  }
  return prisma.$transaction(async tx => {
    // Read identity on the server. Request bodies cannot supply evidence fields.
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.accessState === 'REVOKED') {
      throw termsError(TERMS_MESSAGES.signIn, 'AUTH_REQUIRED', 401);
    }
    const acceptance = await tx.termsAcceptance.upsert({
      where: { userId_emailAtAcceptance_termsHash: { userId, emailAtAcceptance: user.email, termsHash: document.hash } },
      create: {
        userId, emailAtAcceptance: user.email, organizationName: document.organizationName,
        termsVersion: document.version, termsHash: document.hash, termsText: document.text,
      },
      update: {},
    });
    // The deterministic event id makes retries idempotent in History too.
    await tx.adminAuditLog.upsert({
      where: { id: `terms:${acceptance.id}` },
      create: {
        id: `terms:${acceptance.id}`, actorUserId: user.id, actorLabel: acceptance.emailAtAcceptance,
        action: AUDIT_ACTIONS.TERMS_ACCEPTED, targetType: 'TERMS',
        targetId: acceptance.id, targetLabel: `FEED Terms of Use · ${acceptance.termsVersion}`,
        detail: { acceptanceId: acceptance.id, termsVersion: acceptance.termsVersion,
          termsHash: acceptance.termsHash, organizationName: acceptance.organizationName } as Prisma.InputJsonValue,
        createdAt: acceptance.acceptedAt,
      },
      update: {},
    });
    return acceptance;
  });
}
