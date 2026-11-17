# FEED terms acceptance and first-login release notes

Implemented locally for v1.9.1; not a production deployment record.

## Login sequence

Magic link/OTP verification establishes identity. `/api/auth/session` reports
current terms acceptance and whether the current backend release was presented
to this account. Protected frontend routes mount no workspace content until
acceptance is satisfied. The existing release-notes modal then opens for an
unseen release. No new dependency or per-account operational dataset is added.

## Published document and evidence

`packages/backend/src/services/auth/terms.ts` owns the exact published wording,
effective date and independent terms version. FEED is always the product name.
Only the opening Organization name varies, resolved from the activated backend
Appearance configuration. The remaining clauses use “the Organization”. The
developer’s personal name appears only in the opening attribution; subsequent
liability/support provisions name Temple Consulting, LLC.

The organization name is escaped as plain text before Markdown rendering.
Browser-only Appearance previews never enter the document. A legitimate
compiled default uses WTH; an Appearance resolution warning returns 503 rather
than substituting WTH for an organization whose settings could not be read.

`GET /api/auth/terms` is public and no-store. `/terms` displays it before or
after sign-in. `/terms/accept` uses the shared auth shell and a definite-height
Shadcn ScrollArea. Reaching the end enables an initially unchecked checkbox;
explicit checking enables **Agree and continue**. Sign out is always available.
Scroll reach is an interaction aid, not evidence of actual reading.

`POST /api/auth/terms` requires authenticated identity, the configured APP_URL
Origin, explicit boolean acceptance, and the displayed version and SHA-256.
Changed documents return 409 for re-review. No request-supplied identity,
timestamp, organization name or document text becomes evidence.

`TermsAcceptance` preserves account ID, email snapshot, Organization snapshot,
exact text, document version/hash and a database-generated UTC acceptance time.
A unique account/email/hash key preserves the first record on retry and prevents
an imported roster ID reused for another email from inheriting an agreement. A deterministic
History event is upserted in the same transaction, so retries never duplicate
History or replace the original timestamp. Admin → History’s **View agreement**
opens the retained snapshot through an administrator-only endpoint, not a
fresh rendering of today’s terms.

Publish wording changes with a new TERMS_VERSION and effective date. A changed
Organization name also changes the document hash and requires agreement to the
new document. Colors, logos, app-name settings and FEED application versions
do not change the agreement. Old agreements remain reviewable.

## Server enforcement

`requireTermsAcceptance` follows existing JWT/Basic middleware and protects
workspace APIs. It requires individual JWT identity and current acceptance;
Basic credentials, missing cookies, and the legacy caller-supplied internal-PDF
header cannot substitute for an account’s agreement. The active Chromium PDF
renderer does not make internal API calls with that header. No local auth
bypass was added.

Public inventory, branding, static files and health remain before the gate.
Auth routes remain reachable for sign-in, session checks, agreement and logout;
agreement/release mutations enforce their own identity and Origin. Existing
system status/initialize exceptions remain. A missing agreement returns 403
`TERMS_ACCEPTANCE_REQUIRED`, independently of 401 session expiry. The shared
frontend JSON, multipart and binary API methods redirect that code to the
acceptance screen. Database or identity-resolution failure never grants access.

## Release presentation

Both automatic opening and the sidebar version button use
`ReleaseNotesDialog`/`ReleaseNotesCard` and `docs/release-notes.md`. A unique
`UserReleaseVisit(userId, version)` stores the first presentation time, across
browsers and sign-ins. The modal is marked presented after it mounts; this is
not evidence of reading or another agreement. A failed write may cause the
modal to appear again at a later login. Manual opening remains available.

`POST /api/auth/release-seen` checks identity, Origin, current terms acceptance
and exact frontend/backend version match. Checking a session or accepting terms
alone never marks the release seen. Redeploying the same release does not show
it again. Previously recorded versions remain known across rollback/return.

## Account deletion, backup and restore

Both new tables deliberately have no roster foreign key. Like AdminAuditLog,
acceptance evidence survives deletion/replacement of a roster row; a newly
created account has a new ID and must agree again. Records are not shared with
ordinary staff through an audit endpoint.

Neither table enters portable organization backups. Importing another
deployment’s artifact cannot grant agreement or rewrite destination-local
evidence. Existing restore builds from a consistent live database copy and
replaces only selected units, so these excluded, independent tables survive.
Full operator database snapshots carry them and must remain protected.

## Local validation and release boundary

The additive `20261117000000_add_login_agreements` migration and its
`20261117010000_bind_agreements_to_account_email` identity-index follow-up create no
acceptances/visits for existing users. Apply it before running the feature;
Docker applies migrations at startup under the existing deployment process.
Version sources are 1.9.1. Production deployment, image publication, and Pi
changes are outside this implementation task.

Checks: both auth methods reach the agreement gate; direct workspace API access
is refused before agreement; agreement is explicit, current and retry-safe;
first-release notes follow acceptance and do not repeat on return; administrators
can inspect retained text; staff cannot; brand previews and cosmetic changes do
not affect agreement identity; stale documents, wrong origins and unavailable
storage fail closed; account deletion/restore preserve evidence.

### Local evidence — November 16, 2026

- Local development database backed up before migration; all 39 migrations
  applied and Prisma reports the schema current. Local `/health` reports 1.9.1;
  anonymous workspace access returns 401 and the public terms endpoint 200.
- Full backend suite: 115 files passed, 1,383 tests passed and two existing
  tests skipped. Full frontend suite: 90 files and 610 tests passed.
- Follow-up regressions added after those suite runs also pass: simultaneous
  acceptance retries and restore retention (17 tests across the two relevant
  backend files), and the full frontend auth folder (16 tests), including
  retained History snapshots and terms redirects for JSON/multipart/binary APIs.
- Frontend/backend production builds pass. The real frontend TypeScript ratchet
  passes against the checked-in baseline; 134 existing errors remain. The
  baseline has not been rewritten to hide debt.
- Browser: login shows 1.9.1; public terms render with the exact revised wording
  in light and dark, with no horizontal overflow at a 390px emulated width.
  The signed-in follow-up is recorded below. Integration tests use disposable local SQLite
  databases and exercise both real OTP and magic-link verification endpoints.
- No production deployment, image publication or LOTTO metric change.

### Signed-in browser follow-up — November 17, 2026

- The operator confirmed signing in and accepting locally. Observed the
  corresponding **Accepted FEED Terms of Use** entry in Admin → History.
- **View agreement** opened the retained document with its original acceptance
  time, version 2026-11-16, revised developer attribution/provisions, Organization
  name and SHA-256. The dialog rendered correctly and closed normally.
- The sidebar version button opened the shared release-notes modal with the
  1.9.1 entry first. It also closed normally.
- Reloading the authenticated local Admin route returned directly to Admin,
  with no agreement or release-notes modal and no stuck body pointer-events.
  This is a session-reentry browser check, not a fresh OTP/magic-link sign-in.
  Fresh sign-out/sign-in persistence remains covered by the integration tests;
  it was not repeated manually during this follow-up.
- Local browser checks only; production remains untouched.
