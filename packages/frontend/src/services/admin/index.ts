// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import config from '@/config/config';
import { BaseApiService } from '@/services/base';
import type {
  AccessPolicy,
  AccessPolicyUpdate,
  AdministratorSummary,
  AuditPage,
  InviteResult,
  RosterUser,
  UserAccessState,
  UserRole,
} from '@/types/admin';

/**
 * Administrator-only API surface.
 *
 * Every method unwraps the server's envelope to the inner value — including
 * the mutations. Returning the raw envelope from a mutation while the GET
 * unwrapped correctly is a real bug this project has shipped before (see
 * AGENTS.md on `FoodItemService`): the malformed object lands in state and
 * crashes the next render, but only after a save.
 */
class AdminService extends BaseApiService {
  constructor() {
    super(config.api.endpoints.admin.base);
  }

  async getRoster(): Promise<{
    users: RosterUser[];
    administrators: AdministratorSummary;
  }> {
    const response = await this.get<{
      users: RosterUser[];
      administrators: AdministratorSummary;
    }>(config.api.endpoints.admin.users);
    return {
      users: response.users,
      administrators: response.administrators,
    };
  }

  async invite(email: string): Promise<InviteResult> {
    const response = await this.post<InviteResult>(
      config.api.endpoints.admin.invite,
      { email }
    );
    return {
      user: response.user,
      invitationEmailSent: response.invitationEmailSent,
    };
  }

  async setRole(id: string, role: UserRole): Promise<RosterUser> {
    const response = await this.put<{ user: RosterUser }>(
      config.api.endpoints.admin.userRole(id),
      { role }
    );
    return response.user;
  }

  async setAccess(
    id: string,
    accessState: UserAccessState
  ): Promise<RosterUser> {
    const response = await this.put<{ user: RosterUser }>(
      config.api.endpoints.admin.userAccess(id),
      { accessState }
    );
    return response.user;
  }

  async removeUser(id: string): Promise<RosterUser> {
    const response = await this.delete<{ user: RosterUser }>(
      config.api.endpoints.admin.userById(id)
    );
    return response.user;
  }

  async getAccessPolicy(): Promise<{
    policy: AccessPolicy;
    administrators: AdministratorSummary;
  }> {
    const response = await this.get<{
      policy: AccessPolicy;
      administrators: AdministratorSummary;
    }>(config.api.endpoints.admin.accessPolicy);
    return {
      policy: response.policy,
      administrators: response.administrators,
    };
  }

  async updateAccessPolicy(update: AccessPolicyUpdate): Promise<AccessPolicy> {
    const response = await this.put<{ policy: AccessPolicy }>(
      config.api.endpoints.admin.accessPolicy,
      update
    );
    return response.policy;
  }

  async getAudit(options: { limit?: number; offset?: number } = {}): Promise<AuditPage> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.offset !== undefined) params.set('offset', String(options.offset));

    const query = params.toString();
    const response = await this.get<{
      auditEntries: AuditPage['entries'];
      total: number;
      limit: number;
      offset: number;
    }>(`${config.api.endpoints.admin.audit}${query ? `?${query}` : ''}`);

    return {
      entries: response.auditEntries,
      total: response.total,
      limit: response.limit,
      offset: response.offset,
    };
  }
}

export const adminService = new AdminService();
