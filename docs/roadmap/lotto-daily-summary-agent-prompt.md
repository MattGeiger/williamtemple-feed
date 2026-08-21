# Prompt: Implement LOTTO Daily Summaries for FEED

Copy the prompt below into an AI coding agent whose workspace is the LOTTO
repository.

---

You are working in `/Users/russbook/Repos/lotto`.

Task 0: Read `AGENTS.md` completely and follow it throughout. This change is
within LOTTO's existing state-manager, Neon JSONB/store, Next.js route, Zod,
Vitest, and documentation patterns. Do not add a dependency or introduce a new
framework. Inspect before editing, preserve unrelated work, and use incremental
patches.

Task 1: Implement durable, append-only raffle-session closeouts when staff use
**Reset for New Day**.

Current source facts you must verify before editing:

- `RaffleState` lives in `src/lib/state-types.ts`.
- Production persistence is `src/lib/state-manager-db.ts`; local fallback is
  `src/lib/state-manager.ts`.
- `raffle_state` is a singleton and `raffle_snapshots` is undo/redo history.
- `calledAt` stores only the latest call timestamp per distinct ticket.
- `ticketStatus` contains final mutually exclusive `returned` / `unclaimed`
  values.
- The reset action is routed through `src/app/api/state/route.ts` and the Admin
  control is labelled **Reset for New Day**.
- `schema.sql` is the canonical database schema and must remain idempotent.

Add a stable `sessionId` and `sessionStartedAt` to active raffle state. Create
them when the first range/order is successfully persisted, preserve them across
all mutations and snapshots, and clear them on reset. Keep older state payloads
loadable and document/test the compatibility behavior for an active legacy
state that lacks these fields.

When reset is requested:

1. If there is no meaningful session—no active range, generated tickets,
   calls, or statuses—reset without writing an empty closeout.
2. Otherwise derive and durably write an immutable summary revision before the
   active state is cleared.
3. In Postgres, the summary insert, reset snapshot, and singleton-state update
   must be one transaction. If closeout persistence fails, the active state
   must remain intact.
4. Give the local file fallback the same observable guarantee. Use durable,
   append-only per-session/revision storage; do not make local development
   silently skip the feature.
5. Snapshot cleanup must never touch summaries.

Each immutable revision contains:

- `summaryId`;
- stable `sessionId`;
- one-based `revision`;
- `supersedesSummaryId` or `null`;
- deterministic `contentHash` (`sha256:` prefix);
- derived `isCurrent` when read;
- `serviceDate`, fixed at closeout in the session's stored IANA timezone;
- `timezone`;
- `sessionStartedAt`, `closedAt`, and `recordedAt` as instants;
- queue `mode`;
- `ticketRange.start` / `ticketRange.end`;
- `issuedCount`: inclusive configured-range size, matching LOTTO's current
  **Tickets Issued** meaning;
- `generatedCount`: `generatedOrder.length`;
- `calledCount`: distinct keys in `calledAt`, even if their final status is
  returned or unclaimed;
- final `unclaimedCount` and `returnedCount`; and
- `callTimeline`: the retained `calledAt` timestamps sorted ascending and
  represented only as `{ sequence, calledAt }`. Do not expose ticket numbers.

Build `contentHash` from a canonical serialization of the session source facts:
stable session id/start, timezone, mode, range, counts, and sorted call
timeline. Exclude `summaryId`, `revision`, `supersedesSummaryId`, `isCurrent`,
`serviceDate`, `closedAt`, `recordedAt`, and the hash itself. Add uniqueness
constraints for both `(sessionId, revision)` and `(sessionId, contentHash)`.

Immutability and reset/undo behavior are required:

- Same `sessionId` + `contentHash` is idempotent. A network retry or unchanged
  undo/re-reset must not create a duplicate.
- If staff undo a reset, change the restored session, and reset again, append a
  new revision that supersedes the prior one. Never update or delete the older
  revision.

Task 2: Add a versioned, read-only FEED integration endpoint:

```text
GET /api/integrations/feed/v1/daily-summaries
```

It accepts optional inclusive `from` / `to` service dates (`YYYY-MM-DD`), an
opaque `cursor`, and `limit` (default 100, maximum 500). Order by
`serviceDate`, `closedAt`, `sessionId`, and `revision`, ascending, with stable
cursor pagination.

Return:

```json
{
  "contractVersion": 1,
  "summaries": [],
  "nextCursor": null
}
```

The summary objects and meanings are exactly those listed above. All timestamps
on the wire are ISO-8601 UTC strings. Unknown additive fields are allowed in v1;
breaking changes require a future `/v2/` route.

Require `Authorization: Bearer <token>` for every request using a dedicated
deployment secret such as `FEED_DAILY_SUMMARY_TOKEN`. This is
machine-to-machine authentication, not NextAuth. Fail closed when the secret is
missing, compare supplied credentials safely, never log the token, and return
`Cache-Control: no-store`.

Error contract:

- `400` invalid dates/filter order/limit/cursor;
- `401` missing or invalid bearer token;
- `503` integration token or summary store not configured;
- `500` unexpected failure.

Return generic, ASK-aligned JSON errors without exception text, SQL, file paths,
or secrets.

Task 3: Preserve the evidence and privacy boundaries.

This contract supports queue pace—the intervals between the latest distinct
ticket-call timestamps LOTTO retained. It does **not** support actual client
wait time because LOTTO records no ticket issuance timestamp, and recalls can
overwrite an earlier `calledAt`. Do not introduce a metric or documentation
claim called wait time. Do not expose names, emails, staff/session identity, IP
addresses, or ticket-number-to-timestamp/status mappings.

Task 4: Test and document the feature completely.

Tests must cover:

- database and local-file closeout paths;
- legacy persisted state compatibility;
- inclusive issued count vs partial-batch generated count;
- called/final-status calculations and timestamp-only call timeline;
- blank reset;
- transaction/failure atomicity;
- reset retry idempotency;
- unchanged and changed undo/re-reset revision behavior;
- summary survival independent of snapshot retention;
- local service date around UTC day boundaries and daylight-saving changes;
- bearer authentication and fail-closed missing configuration;
- date validation, stable pagination, and cursor rejection;
- no ticket numbers or other disallowed fields in the response; and
- generic error responses that do not leak internals.

Update at least:

- `schema.sql`;
- `.env.example`;
- `docs/DEPLOYMENT.md` and the appropriate implementation/contract document;
- `CHANGELOG.md`; and
- any affected staff guide under `docs/user-guides/`, per `AGENTS.md`.

Run targeted tests first, then the full LOTTO test suite, lint, and production
build. Inspect the actual diff, report any pre-existing failures separately,
and do not push unless explicitly asked. If implementation discovery reveals a
contract conflict, stop before changing the contract and present the concrete
evidence and alternatives.

---
