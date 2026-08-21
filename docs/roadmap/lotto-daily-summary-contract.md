# LOTTO → FEED Daily Summary Contract

**Status:** Reviewed implementation contract for LOTTO's next release; FEED
ingestion remains v1.9.0 work.

**Reviewed:** 2026-08-20 against LOTTO v1.20.1 in
`/Users/russbook/Repos/lotto`.

## Purpose

LOTTO manages the live ticket queue. FEED needs durable, privacy-minimized
facts for historical analytics without reading LOTTO's Neon database or
depending on LOTTO during report generation.

LOTTO therefore owns two responsibilities before FEED v1.9.0 begins:

1. close each raffle session into durable append-only history when staff choose
   **Reset for New Day**; and
2. expose those closeouts through a versioned, read-only, machine-authenticated
   API that FEED can ingest incrementally.

This is a source contract, not a shared database model. LOTTO may change its
internal schema without changing the API as long as the v1 meanings remain
stable.

## What the current source can and cannot say

The live `RaffleState` has:

- an inclusive configured ticket range (`startNumber` → `endNumber`);
- the tickets actually placed into the draw (`generatedOrder`);
- final `returned` / `unclaimed` flags in `ticketStatus`; and
- one latest call timestamp per distinct ticket in `calledAt`.

Those facts support issued/configured count, generated count, distinct tickets
called, final status counts, and the pace between recorded calls.

They do **not** support actual client wait time. LOTTO does not record when an
individual ticket was issued, and recalling a ticket overwrites that ticket's
earlier `calledAt` value. FEED may derive and label **queue pace**—for example,
median seconds between the timestamps LOTTO retained—but must not relabel it as
observed wait time. A future wait-time feature requires an explicit issuance
event and, if recalls matter, an append-only call-event stream.

## Closeout model

### Stable session identity

Create a stable `sessionId` when the first range/order is successfully created
and preserve it through every state mutation and snapshot. Also record
`sessionStartedAt`. Default/reset state has neither value.

Older persisted states must continue to load. The LOTTO implementation should
document and test how it assigns an identity to an active pre-migration state
without making ordinary startup destructive.

### When a closeout is written

`Reset for New Day` is the v1 closeout boundary. If the current state contains
no active range, generated tickets, calls, or final ticket statuses, reset it
without writing an empty summary.

For a meaningful session, write the closeout before clearing the state. In
Postgres, the closeout insert, reset snapshot, and singleton-state replacement
must be one transaction. The local file fallback must preserve the same
observable guarantee: it must never clear the active state unless the closeout
has been durably written.

Snapshot cleanup must never delete daily summaries.

### Immutable revisions and idempotency

A closeout row is immutable. Store:

- `summaryId`: unique id for this immutable revision;
- `sessionId`: stable id shared by all revisions of one raffle session;
- `revision`: one-based, increasing within the session;
- `supersedesSummaryId`: previous revision id, or `null`;
- `contentHash`: deterministic hash of the contract payload; and
- `recordedAt`: the UTC instant this revision was committed.

Calculate `contentHash` from a canonical serialization of the session's source
facts: stable session id/start, timezone, mode, range, counts, and sorted call
timeline. Exclude closeout/revision metadata (`summaryId`, `revision`,
`supersedesSummaryId`, `isCurrent`, `serviceDate`, `closedAt`, `recordedAt`, and
the hash itself), or an unchanged re-close could never be idempotent. Enforce
uniqueness for both `(sessionId, revision)` and `(sessionId, contentHash)`.

The same `sessionId` + `contentHash` must be idempotent. A reset retry, or an
undo followed by an unchanged re-reset, returns the existing closeout rather
than appending a duplicate. If staff undo the reset, change the restored
session, and reset again, append a new revision that supersedes the earlier
one. Never update or delete the older revision.

The API returns all immutable revisions so FEED can ingest append-only data and
select the greatest revision for each `sessionId`. It may include a derived
`isCurrent` flag for convenience, but that flag is not stored by mutating old
rows.

## Contract v1

### Endpoint

```text
GET /api/integrations/feed/v1/daily-summaries
```

Query parameters:

- `from`: optional inclusive `YYYY-MM-DD` service date;
- `to`: optional inclusive `YYYY-MM-DD` service date;
- `cursor`: optional opaque cursor returned by the previous page; and
- `limit`: optional page size, default 100, maximum 500.

Order records by `serviceDate`, `closedAt`, `sessionId`, and `revision`, all
ascending. The cursor must preserve that stable order. Dates are interpreted as
the recorded service dates, not as UTC boundaries.

### Authentication

Require `Authorization: Bearer <token>` on every request. This is a dedicated
machine-to-machine integration token configured in the LOTTO deployment, not a
NextAuth browser session and not a database credential. Missing configuration
must fail closed. Compare secrets without a timing-sensitive plain-string
branch and never log the token.

FEED stores its copy through FEED's existing encrypted-key machinery when the
v1.9.0 importer is built.

### Success envelope

```json
{
  "contractVersion": 1,
  "summaries": [
    {
      "summaryId": "summary_...",
      "sessionId": "session_...",
      "revision": 1,
      "supersedesSummaryId": null,
      "contentHash": "sha256:...",
      "isCurrent": true,
      "serviceDate": "2026-08-20",
      "timezone": "America/Los_Angeles",
      "sessionStartedAt": "2026-08-20T16:55:00.000Z",
      "closedAt": "2026-08-20T22:05:00.000Z",
      "recordedAt": "2026-08-20T22:05:00.125Z",
      "mode": "random",
      "ticketRange": {
        "start": 640,
        "end": 690
      },
      "issuedCount": 51,
      "generatedCount": 51,
      "calledCount": 47,
      "unclaimedCount": 3,
      "returnedCount": 1,
      "callTimeline": [
        {
          "sequence": 1,
          "calledAt": "2026-08-20T17:12:04.123Z"
        }
      ]
    }
  ],
  "nextCursor": null
}
```

### Field meanings

- `serviceDate` is the local calendar date at closeout in the session's stored
  IANA `timezone`. Persist it; do not recompute historical dates from a future
  deployment timezone.
- `sessionStartedAt` is when the first range/order for this session was
  successfully persisted.
- `closedAt` is the closeout instant used to derive `serviceDate`.
- `issuedCount` follows LOTTO's existing **Tickets Issued** meaning: the size
  of the inclusive configured range, or zero when no valid range exists.
- `generatedCount` is `generatedOrder.length`; it can be lower than
  `issuedCount` in batch workflows.
- `calledCount` is the number of distinct tickets represented in `calledAt`,
  including tickets whose final status is returned or unclaimed.
- `unclaimedCount` and `returnedCount` count the final mutually exclusive
  values in `ticketStatus`.
- `callTimeline` contains only the retained timestamps, sorted ascending and
  numbered from one. It deliberately omits ticket numbers. Its length must
  equal `calledCount`.
- All timestamps are ISO-8601 UTC strings. Counts and sequence values are
  non-negative integers.

Unknown additive fields may appear in v1 and consumers must ignore them. A
meaning change, field removal, or incompatible type requires a new `/v2/`
endpoint.

### Error behavior

- `400` for invalid dates, ranges, limits, or cursors;
- `401` for a missing or invalid bearer token;
- `503` when the integration token or summary store is not configured; and
- `500` for an unexpected server failure.

Return calm JSON errors without internal paths, SQL, stack traces, secrets, or
raw exception text. Send `Cache-Control: no-store` on success and error
responses.

## Privacy boundary

The response contains counts, session metadata, ephemeral range bounds, and
timestamps. It must not contain names, email addresses, browser/session ids,
staff identities, IP addresses, or a ticket-number-to-time/status mapping.
Ticket numbers are omitted from `callTimeline` because FEED does not need them.

## Acceptance criteria in LOTTO

- The canonical `schema.sql` and deployment documentation include the new
  append-only store and integration-token configuration.
- Database and local-file state managers implement equivalent closeout
  semantics.
- Reset writes a meaningful session closeout before clearing state.
- Blank reset writes no summary.
- Retried reset and unchanged undo/re-reset do not duplicate a revision.
- Changed undo/re-reset appends a superseding immutable revision.
- Snapshot cleanup cannot remove summaries.
- Service dates are correct across UTC date boundaries and daylight-saving
  changes for the stored timezone.
- The endpoint rejects unauthenticated requests, validates filters/cursors,
  paginates deterministically, emits the exact v1 meanings, and never exposes
  ticket numbers in the call timeline.
- Tests cover database and file paths, legacy state compatibility, closeout
  calculations, revision/idempotency behavior, authentication, privacy,
  pagination, and failure atomicity.
- LOTTO updates its `CHANGELOG.md`, implementation documentation,
  `.env.example`, deployment guide, and any affected staff Help guide.

## FEED follow-on

FEED v1.9.0 will persist the immutable source revisions locally, retain their
LOTTO provenance, select the greatest revision per `sessionId` for analytics,
and aggregate current sessions by `serviceDate`. FEED will label timing-derived
metrics as queue pace unless a later contract adds genuine issuance events.
