// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * Roles authorize actions; they never partition feature data. Every
 * authenticated user still sees the same shared organization dataset.
 */
export type UserRole = 'STAFF' | 'ADMINISTRATOR';

/** Revocation blocks sign-in under both access modes. */
export type UserAccessState = 'ALLOWED' | 'REVOKED';

export type AccessMode = 'DOMAIN' | 'ALLOWLIST';

export interface RosterUser {
  id: string;
  email: string;
  role: UserRole;
  accessState: UserAccessState;
  /** Null until the person completes their first sign-in. */
  emailVerified: string | null;
  /** The evidence an administrator prunes by. */
  lastLoginAt: string | null;
  invitedAt: string | null;
  invitedBy: string | null;
  createdAt: string;
}

export interface AdministratorSummary {
  mode: AccessMode;
  /** Administrators who could actually sign in right now. */
  eligible: number;
  /** How many this mode requires. */
  required: number;
}

export interface AccessPolicy {
  id: number;
  mode: AccessMode;
  deniedMessage: string;
  contactEmail: string;
  updatedAt: string;
}

export interface AccessPolicyUpdate {
  mode?: AccessMode;
  deniedMessage?: string;
  contactEmail?: string;
}

export interface AuditEntry {
  id: string;
  actorUserId: string | null;
  actorLabel: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  detail: unknown;
  createdAt: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface InviteResult {
  user: RosterUser;
  /** False when the roster row was created but the notification failed. */
  invitationEmailSent: boolean;
}

export const DENIED_MESSAGE_MAX_LENGTH = 240;

/** Human wording for audit actions, used by the Audit tab. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  ROLE_GRANTED: 'Made Administrator',
  ROLE_REVOKED: 'Changed to Staff',
  ACCESS_REVOKED: 'Access revoked',
  ACCESS_RESTORED: 'Access restored',
  USER_INVITED: 'Invited',
  USER_DELETED: 'Removed from roster',
  ACCESS_POLICY_UPDATED: 'Access settings changed',
};
