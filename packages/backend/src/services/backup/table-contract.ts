// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * What a sanitized backup contains, and — just as importantly — what it does
 * not.
 *
 * `docs/data-management/backup-and-restore.md` is the approved boundary: a raw
 * SQLite snapshot necessarily carries key material, authentication records, and
 * encrypted provider secrets, so it stays an operator concern and is never a
 * browser download. The in-app artifact is a *selective logical export*, and
 * "selective" is only meaningful if the selection is enumerated rather than
 * implied.
 *
 * Every model in the schema appears in exactly one of these two lists. A test
 * reads the Prisma schema and fails if any model is missing from both, so a
 * table added later cannot drift into a backup — or silently out of one —
 * without somebody making that call deliberately.
 */

/** Organization operating data. The point of the artifact. */
export const INCLUDED_TABLES = [
  // Inventory and its translations
  'Category',
  'CategoryTranslation',
  'FoodItem',
  'FoodItemTranslation',
  'GlobalLimit',
  // Append-only operational history behind Analytics
  'FoodItemInventoryEvent',
  'CategoryInventoryEvent',
  // Languages and the translation cache
  'Language',
  'Translation',
  // Shopping list authoring
  'ShoppingListTemplate',
  'ShoppingListSection',
  'ShoppingListBuilderTemplate',
  'ShoppingListBuilderComponent',
  // Organization configuration
  'ExportSettings',
  'OperatingHoursRevision',
  'SystemPrompt',
  'FormattingChoice',
  'SavedCustomText',
  // Procurement observations and the overlays that shape them
  'ProcurementImport',
  'ProcurementOrderRevision',
  'ProcurementProduct',
  'ProcurementLine',
  'ProcurementDataRule',
] as const;

export type IncludedTable = (typeof INCLUDED_TABLES)[number];

/**
 * Everything deliberately left out, with the reason attached. The reason is
 * not decoration: it is what a future maintainer needs in order to judge
 * whether a request to "just add that table" is safe.
 */
export const EXCLUDED_TABLES: Record<string, string> = {
  // --- Secrets. Non-negotiable; this is why the artifact exists at all. ---
  EncryptionKey:
    'Key material. The runtime encryption key lives here, not in env (KeyManager.getActiveKey).',
  AIConfiguration:
    'Holds encryptedApiKey and salts. Provider keys are re-entered after a restore by design.',

  // --- Authentication material. ---
  VerificationToken: 'Live magic-link and OTP tokens.',
  OtpFailure: 'Lockout state; restoring it would resurrect or clear lockouts arbitrarily.',

  // --- Authority. Restoring these would restore *access*. ---
  User:
    'Restoring the roster restores authority: a stale or edited artifact could grant administrator access. ' +
    'In Domain mode the roster self-heals, because a successful sign-in recreates the row as Staff.',
  AccessPolicy:
    'Sign-in mode is an authority decision. A restore must not quietly widen or narrow who can sign in.',
  AdminAuditLog:
    'A security record. Importing it from a file would let someone rewrite the history of privileged actions.',

  // --- Rows that point at files the artifact does not carry. ---
  Document: 'References an uploaded file on disk; the artifact carries no file payloads.',
  TranslatedDocument: 'References a generated file on disk.',
  ShoppingListPDF: 'References a generated PDF on disk.',
  ShoppingListInstance: 'Generated output tied to ShoppingListPDF rows.',

  // --- Telemetry and transient state. ---
  ApiUsageLog: 'Per-request AI telemetry. Large, derived, and not organization operating data.',
  UsageRecord: 'Aggregated usage telemetry, rebuilt from operation rather than restored.',
  Alert: 'Transient notifications, regenerated from current state.',

  // --- Dormant. ---
  ReportTemplate:
    'Dormant prototype infrastructure pending an approved report-template contract (ISSUES.md #46).',
};

/**
 * Bumped when the shape of `data` changes in a way a reader must notice —
 * a table added or removed, or a payload restructured. Distinct from the FEED
 * version and from the migration name: an artifact can be produced by many FEED
 * builds while remaining the same contract.
 */
export const TABLE_CONTRACT_VERSION = 1;

export const ARTIFACT_KIND = 'feed-sanitized-backup';
