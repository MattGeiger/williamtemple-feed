# Backup and Restore Boundary

## Decision

FEED needs two different recovery artifacts. Calling both of them “database
backup” would obscure a critical security distinction.

### Operator disaster-recovery snapshot

A transactionally consistent SQLite snapshot is a byte-level recovery artifact.
It necessarily contains authentication records, encryption-key records,
encrypted API-key material, and other system configuration. It remains an
operator-controlled Raspberry Pi/deployment workflow and must not be offered as
a general browser download.

### Sanitized portable backup

The in-app **Backup** action produces a versioned logical export of approved
organization data. Three categories, not two — the middle one was added
2026-08-02 after excluding whole tables proved coarser than this document ever
asked for:

**Excluded entirely**

- `EncryptionKey` rows and equivalent key material;
- OTP and verification tokens, lockout records, and active session material;
- `AccessPolicy` — sign-in mode is authority, and a file that could flip an
  instance from Allowlist to Domain is the artifact-grants-access problem in
  another form;
- `AdminAuditLog` — a security record; importing it from a file would let
  someone rewrite the history of privileged actions;
- environment/deployment secrets;
- rows referencing files the artifact does not carry (documents, generated
  PDFs), and telemetry.

**Included with columns redacted**

- `AIConfiguration` minus `encryptedApiKey` and `salt`. The rest of that row —
  model, temperature, thinking level, token limits, cost limits, rate limits,
  active flag — is an administrator's work and should survive a restore. Only
  the secret leaves.

**Included, with authority neutralised**

- `User`. Excluding the roster does not preserve it: under build-and-swap the
  restored database is migrations plus artifact, so an absent roster means an
  *empty* one, which arms the fresh-instance bootstrap and hands administrator
  to whoever signs in first. The roster is therefore carried, but **every
  restored role lands as `STAFF`** regardless of the file, and the
  administrator performing the restore is re-granted. No artifact can confer
  authority; no one loses their staff list.

  This puts staff email addresses in the artifact. They are largely
  public-facing already, and an address without a reachable inbox cannot pass
  OTP.

Because it is selective, this artifact is not a raw SQLite snapshot. Restore
must create and validate a compatible database, import the approved logical
records, and then require fresh encryption initialization and fresh AI provider
keys.

## Status

**Backup shipped in 1.5.0-beta.6. Restore is designed and approved
(2026-08-02), not yet built.**

The design pass this document called for has happened. Its decisions —
build-and-swap rather than a live transaction, in-memory maintenance mode,
replace-never-merge, partial units closed under foreign keys, the roster
resolution above, and the clean-slate model — are recorded in
[beta-6-backup-restore-brief.md](beta-6-backup-restore-brief.md), which also
named two prerequisites that had to land first: editable API keys, and
`AIConfiguration` redaction in place of exclusion. **Both are implemented**, and
the artifact now declares table contract version 2 — beta.6 artifacts declare
version 1 and carry no `AIConfiguration` at all.

## Restore safety contract

Restore is privileged. Administrator authority now exists to gate it. The
workflow must:

1. upload to isolated temporary storage;
2. validate artifact type, manifest, checksums, FEED/schema version, and table
   contract before touching live data;
3. create an operator recovery snapshot before mutation;
4. enter controlled maintenance mode and stop new writes;
5. import or replace data atomically using the artifact-specific strategy;
6. run integrity and contract checks;
7. restart/reconnect the backend cleanly;
8. delete rejected and completed temporary artifacts;
9. require fresh encryption/API-key setup for sanitized restores.

Procurement rollback is not database restore. It is a reversible domain action
that changes which retained import revisions contribute to Analytics.
