# beta.6 — Sanitized Backup and Restore: Design Brief

## Status

**Scheduled, not designed.** This is the input to a design session, not a plan.
It records what is already settled, what the session must decide, and the traps
that are already known — so that session starts from the current state of the
system rather than rediscovering it.

Preconditions are met: beta.4 delivered roles, the roster, and the audit log;
beta.5 gated the privileged routes. ISSUES.md #50b.

## Why this gets a design pass first

Every other item in the authorization plan was reversible. This one is not.
Restore replaces live data, and the failure mode is a pantry losing its
inventory, translations, templates, and procurement history on a service day.

The Admin page benefited from settling bootstrap, lockout guards, and the
allowlist model *before* any code existed — three decisions that would have
been expensive to change afterwards. Restore has more of those, not fewer.

## Already decided — do not re-litigate

From [backup-and-restore.md](backup-and-restore.md), approved and unchanged:

- **Two artifacts, not one.** A raw SQLite snapshot is an operator
  disaster-recovery concern and must never be a browser download; it
  necessarily contains authentication records, encryption keys, and encrypted
  provider secrets. The in-app artifact is a **sanitized logical backup**.
- **Exclusions are not optional**: `EncryptionKey` rows,
  `AIConfiguration.encryptedApiKey` and salts, OTP/verification tokens, lockout
  records, session material, environment secrets, temporary uploads.
- **Restore is not procurement rollback.** Rollback is a reversible domain
  action over retained import revisions; restore rebuilds a database.
- **Restore must require fresh encryption initialization and fresh provider
  keys afterwards**, because the artifact deliberately omits them.
- The nine-step restore safety contract in that document stands as written.

From the shared-environment principle (AGENTS.md): a backup covers the whole
organization. There is no per-user export and no per-user restore.

## What the design session must settle

1. **Artifact format and the version contract.** JSON manifest plus table
   payloads is the obvious shape, but the binding decision is what happens when
   the schema has moved on: refuse outright, refuse with a named migration
   path, or attempt a forward migration. Restoring a beta.4 artifact into a
   beta.9 database is the realistic case, and "attempt it and hope" is not an
   option. The manifest needs FEED version, schema/migration version, table
   contract version, row counts, and a checksum.

2. **What is actually in scope for the export.** Inventory (categories, food
   items, limits, statuses), translations, shopping-list templates and saved
   components, procurement imports and revisions, settings, operating hours,
   the user roster and audit log — each needs an explicit in/out decision, not
   a default. The roster is the interesting one: restoring it restores
   *authority*, so a malicious or stale artifact could grant administrator
   access. That may argue for excluding roles from the artifact and forcing the
   bootstrap path after restore.

3. **Maintenance mode.** The contract requires stopping writes during restore.
   FEED has no such mode today. Deciding what it means — reject writes with a
   specific status, or refuse at the router, and how the UI communicates it — is
   design work, not implementation detail.

4. **Where the pre-mutation operator snapshot lives**, given the Pi's storage,
   and who is responsible for pruning it. The contract requires taking one; it
   does not say where it goes or how many are kept.

5. **Transactional strategy.** The procurement import work is the precedent
   worth reading first: a full logical restore is far larger than a 10MB CSV,
   and the 30s interactive-transaction ceiling in `db.ts` is a real constraint
   measured on this hardware. Whether a restore can be one transaction at all,
   and what "atomic" means if it cannot, is the central technical question.

6. **How restore is invoked and confirmed.** A single button that replaces the
   database is not an acceptable affordance. What confirmation, what preview of
   what is about to change, what typed acknowledgement.

## Known traps from the work already done

- **Migrations auto-apply on container start** (`prisma migrate deploy` in the
  Docker CMD). A restore that writes a database at an older schema version will
  meet a migration on the next boot. That interaction must be designed, not
  discovered.
- **Timestamp storage.** Prisma writes SQLite `DateTime` as INTEGER
  milliseconds; `CURRENT_TIMESTAMP` writes TEXT, and SQLite orders every
  INTEGER before every TEXT regardless of value while Prisma reads both
  without complaint. A restore that reconstructs rows must match Prisma's
  format or it will silently corrupt every ordering. This cost real debugging
  time in beta.4 (ISSUES.md #55 sibling note; see the migration's comments).
- **Unique indexes are not in `.dump` output.** AGENTS.md records that a
  table-scoped SQLite dump omits unique indexes, after which Prisma `upsert`
  fails with `ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE
  constraint`. Any export/import that round-trips through dump-like output
  inherits this.
- **WAL mode** is on (beta.2). Whatever takes the operator snapshot must be
  WAL-aware or it will capture a torn database.
- **The encryption key lives in the database**, not in
  `ENCRYPTION_MASTER_KEY` (`KeyManager.getActiveKey`). "Restore then re-enter
  keys" therefore means re-initializing encryption, not editing an env file.

## Suggested shape of the work

Backup first, restore second, and ship them in that order rather than together.
A sanitized export is useful on its own — it is the artifact an operator would
want *before* attempting anything else — and it exercises the manifest, the
exclusion list, and the version contract with no ability to destroy anything.
Restore then has a real artifact to consume and a real format to validate
against.

That also means beta.6 could reasonably ship backup alone, with restore in
beta.7, if the design session concludes restore needs more time than the
release window allows.

## Reading order for whoever picks this up

1. [backup-and-restore.md](backup-and-restore.md) — the approved boundary.
2. [../auth/administrator-authorization.md](../auth/administrator-authorization.md) — what authority now exists to gate this.
3. [../auth/admin-page-implementation-plan.md](../auth/admin-page-implementation-plan.md) — how the last authorization feature was scoped and sequenced.
4. [ingestion-architecture.md](ingestion-architecture.md) — the measured account of what large transactional writes cost on the production Pi.
5. AGENTS.md, "Database and Auth Changes" and "Local Development Environment" — the dump/unique-index and production-data-handling notes.
