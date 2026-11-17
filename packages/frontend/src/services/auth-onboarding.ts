// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { BaseApiService } from './base';

export interface TermsDocument {
  title: string;
  version: string;
  organizationName: string;
  text: string;
  hash: string;
}

export interface RetainedAgreement {
  id: string;
  userId: string;
  emailAtAcceptance: string;
  organizationName: string;
  termsVersion: string;
  termsHash: string;
  termsText: string;
  acceptedAt: string;
}

class AuthOnboardingService extends BaseApiService {
  constructor() { super('/api/auth'); }

  async getTerms(): Promise<TermsDocument> {
    return (await this.get<{ document: TermsDocument }>('/terms')).document;
  }

  async acceptTerms(document: TermsDocument) {
    return this.post('/terms', { accepted: true, version: document.version, hash: document.hash });
  }

  async markReleaseSeen(version: string) {
    return this.post('/release-seen', { version });
  }
}

export const authOnboardingService = new AuthOnboardingService();
