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

The future in-app **Backup** action will produce a versioned logical export of
approved organization data. It will exclude at minimum:

- `EncryptionKey` rows and equivalent key material;
- `AIConfiguration.encryptedApiKey`, salts, and provider secrets;
- OTP and verification tokens, lockout records, and active session material;
- environment/deployment secrets;
- temporary source uploads and generated files not covered by the contract.

Because it is selective, this artifact is not a raw SQLite snapshot. Restore
must create and validate a compatible database, import the approved logical
records transactionally, and then require fresh encryption initialization and
fresh AI provider keys.

## Status

**Scheduled as the 1.5.0-beta.6 feature.** The precondition this document set —
"deferred until Administrator authority is implemented" — was met by beta.4
(roles, roster, audit log) and beta.5 (privileged routes gated). The work is
unblocked rather than merely postponed.

It gets a design pass before implementation, the way the Admin page did: it is
the largest single feature in the authorization plan and the only one where a
mistake destroys production data. Open questions and the decisions the design
session must settle are in
[beta-6-backup-restore-brief.md](beta-6-backup-restore-brief.md).

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
