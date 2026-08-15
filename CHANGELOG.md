# Changelog

All notable changes to FEED are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.5.0-beta.16] — 2026-08-15

Makes the import window say what is actually happening. Following the first
real end-to-end import, where the panel reported finished work as still
running.

### Fixed

- **The import window now names the step it is on.** It showed "Validated
  79,308 of 79,308 records" with a full progress bar while it was in fact
  preparing the reviewed data for activation — a stage that can take minutes of
  its own. Each step now says what it is doing, and a four-step marker shows how
  much of the process remains.

- **Elapsed time is now measured per step.** It counted from the moment of
  upload, so the figure shown while preparing silently included however long
  staff spent entering review decisions.

- **A full progress bar no longer appears while work continues.** Reading every
  record is not the end of validation — the records are then checked against
  existing data — so the bar gives way to an indeterminate one at the point
  counting stops.

- **The window now notices when activation finishes.** Activation could complete
  on the server while the window still offered `Activate Data`, because the
  response confirming the request was sent before the status had changed.

### Changed

- **Review decisions carry the previous answer forward as an editable default.**
  A historical archive raises the same kind of question repeatedly — WTH's first
  import had 13 special-event aggregates — and each one previously needed its
  label and reason typed from scratch. Every decision still requires its own
  explicit Save, and no answer is ever applied to another record automatically.

## [1.5.0-beta.15] — 2026-08-15

### Fixed

- **A Link2Feed import that needs review decisions now reaches the review
  step.** Since the previous release such an import stopped short: the progress
  counter kept climbing after the work had finished, saving a decision was
  refused as "no longer awaiting review", and reopening the import could not
  recover it. The import itself was complete and correct throughout — only the
  step that hands it back to you was missing. SIMC and WTH Tracking imports were
  not affected.

- **An import that cannot finish now fails visibly instead of appearing to run
  forever.** FEED checks that a completed import has recorded a result, and says
  so plainly when one has not.

- **An interrupted import now releases its temporary data immediately** —
  staged records and the uploaded file — rather than waiting for the daily
  cleanup.

## [1.5.0-beta.14] — 2026-08-14

### Fixed

- **The resume-an-import panel now reads as a panel.** Its heading, explanation,
  and button were laid out side by side rather than stacked, because FEED's
  `Alert` is intentionally a single centred row — icon, title, and text on one
  line — and this panel is not that shape. It is now built the same way as the
  import progress panel it sits alongside.

## [1.5.0-beta.13] — 2026-08-14

Makes large imports completable, and visible while they run. Measured on the
production Pi, a 79,308-row Link2Feed export takes 167.8 seconds to prepare —
past the ~100-second limit the hosting layer allows any single request, so that
import could not finish however fast the pipeline became.

### Changed

- **Imports now continue on the server instead of inside the browser's
  request.** Uploading returns as soon as the file is stored and identified;
  validation and activation carry on independently. The practical effect is that
  a large historical import completes at all — previously the connection was cut
  at roughly a hundred seconds and the result was unreachable even though the
  server had finished the work.

- **The import window now reports real progress.** It shows records validated
  against the total, a progress bar once the total is known, and elapsed time
  before then. It never shows an invented percentage. FEED had been recording
  this progress all along with no way to display it, because the browser was
  waiting on the same request that produced it.

- **An import in progress can be reopened.** Closing the window, refreshing, or
  losing the connection no longer abandons the work. FEED offers to return to an
  import that is still running or still waiting on review decisions. Closing the
  window during an import leaves it running — the button now reads `Close` — and
  existing data remains unchanged until activation.

- **An import interrupted by a server restart now fails clearly** instead of
  appearing to run forever, and says a restart interrupted it.

### Fixed

- **Activation details survive the wait.** Now that activation completes after
  the response, its record counts are stored with the import job so the window
  can report exactly what became active.

Makes real Link2Feed visit exports importable. Verified against WTH's
production export: 79,308 visits spanning 2020-10-19 to 2026-05-28 parse with
no blocking issues.

### Fixed

- **FEED now reads Link2Feed visit exports as Link2Feed writes them.** Every
  test fixture had been built from pre-serialized sample data, so two
  differences in the real export had gone unnoticed — its dates are written in
  ISO form rather than as spreadsheet day numbers, and each data row ends with
  one more separator than the header row declares. Either alone stopped an
  import at its first row. FEED now accepts both date encodings, treats the
  exporter's extra empty field as expected, and still rejects rows that are
  genuinely misshapen. Which columns FEED reads is unchanged: recognized
  columns are imported, everything else — including Notes and name fields — is
  ignored and never stored.

- **A visits file re-saved through a spreadsheet is now refused, with the
  reason.** Spreadsheets rewrite Link2Feed's dates into a two-digit-year style
  that states neither the century nor whether the month or day comes first, so
  a 2025 visit can silently import as 1925. FEED declines such a file and asks
  for the original export instead of guessing.

## [1.5.0-beta.11] — 2026-08-14

Corrects two defects found while investigating the beta.10 import stall on a
24 MB Link2Feed visits export. Neither is a throughput fix; the performance
question itself is still open and is scoped in
`docs/data-management/link2feed-import-benchmark-plan.md`.

### Fixed

- **Expired import files are now deleted on schedule.** Uploaded data exports
  are held in restricted temporary staging and documented to expire after 24
  hours. The expiry sweep was implemented but never scheduled, so a staged file
  that escaped the normal success, failure, and cancel paths — a browser closed
  mid-import, a container restart — could remain on the server indefinitely.
  FEED now runs the sweep at startup and hourly, and the startup wiring is
  covered by a test. Because Link2Feed and SIMC exports carry client-level
  information, this is a data-retention correction rather than a cleanup
  convenience.

- **Large data imports are no longer rejected before FEED can respond.** The web
  server capped request bodies at 16 MB while Add Data accepted 64 MB, so any
  export between those sizes was refused in transit with no message FEED could
  turn into an explanation — the import dialog simply appeared to stall. The two
  limits now match, and each records that it must change with the other.

## [1.5.0-beta.10] — 2026-08-14

Adds FEED's canonical Service data foundation, unified external-data entry,
native pantry-service logging, and the operational migration path from WTH's
Tracking workbook. It also consolidates the related navigation and management
interfaces established through localhost acceptance testing.

### Changed

- **Service Metrics now use location-neutral pantry terminology.** The WTH
  default is `Pantry Shopping Visits`; existing seeded configurations are
  updated by migration without changing the stable `shopping_visits` identity
  or imported observations. Tracking adapter version 2 still recognizes
  location-qualified source labels and retains their original text solely as
  import provenance.

- **Service Metric configuration now uses a compact three-step dialog.** Add
  and Edit share the AI Configuration Back/Next navigation pattern while
  keeping each panel on the dialog surface: name, description, and the shared
  Category icon grid; metric definition, position, and effective dates; then
  operational-total and daily-entry participation. The previous popover icon
  picker and whole-dialog scroll region were removed.

- **Service Log sections now adapt to their metric count.** The three
  operational sections share a two-column page grid: one or two metrics use a
  half-page section, while three or more expand to the full page. Metric cards
  render two per row instead of compressing into a three-column layout.

- **FEED's Lucide dependency and shared icon registry are expanded.** Category
  editing now exposes 137 icons, including new Shapes & Symbols and Outdoors
  groups plus additional bag, document, calculation, and pointer choices. The
  Shopping List PDF SVG registry was regenerated from the same installed
  Lucide version to preserve preview/export parity.

- **Service Log daily entry now has one Save action.** The page no longer asks
  staff to choose between `Save Draft` and `Finalize Day`, and it no longer
  exposes a Draft/Finalized badge. Saving commits the shared day immediately;
  revision and audit history remain intact behind the interaction.

- **The Service Date navigator now shows the full weekday and calendar date.**
  Historical selections use labels such as `Thursday, July 9th, 2026`; today's
  selection retains the `Today` cue alongside the same unambiguous date.

- **Service Metric ordering now uses plain ordinal positions.** The Add/Edit
  dialog presents `1st`, `2nd`, `3rd`, and so on instead of exposing internal
  numerical sort values. Creating or moving a metric atomically rebalances the
  shared metric list while preserving append-only definition revisions.

### Fixed

- **Service Log metric inputs now align consistently along the bottom of each
  card.** User-defined names and descriptions can wrap without shifting the
  count, choice, or time controls out of alignment with neighboring metrics.

- **Imported WTH Tracking observations now continue as editable Service Log
  data.** Historical values populate the native daily fields instead of
  remaining hidden behind a source-specific read filter. FEED maintains one
  current observation per metric and date across imported and native sources;
  edits and intentional clears append native revisions while preserving the
  original workbook provenance. Import rollback or restore cannot displace a
  later staff correction. The additive
  `20260813120000_unify_service_metric_observations` migration records cleared
  revisions and enforces the single-current projection. Sanitized backup table
  contract version 8 preserves clear revisions while older artifacts restore
  their observations as recorded values.

- **Service Metric changes now take effect on the open Service Log
  immediately.** Saving, adding, or seeding metric definitions refreshes both
  the configuration table and the current day's field definitions without a
  page reload. The silent refresh preserves any unsaved daily-entry values
  already typed by staff.

- **Document integrity checks now report state changes instead of repeating the
  same missing-file error on every document-list read.** A missing DOCX is
  marked and logged once, routine checks leave the existing warning unchanged,
  and the warning is cleared if the file later becomes available again. This
  also avoids repeatedly changing the document's `updatedAt` timestamp for an
  already-known storage issue.

### Added

- **Service Metrics now support user-selected icons.** Administrators choose
  from the same searchable library used by Categories. The icon is stored with
  each effective-dated metric revision and renders in both the configuration
  table and its daily Service Log card. Existing WTH definitions receive
  editable semantic defaults through the additive
  `20260813140000_add_service_metric_icons` migration. Sanitized backup table
  contract version 9 preserves these choices; older artifacts restore the
  neutral package icon.

- **Unified Add Data now supports the one-time WTH service Tracking
  migration.** A WTH-owned exporter converts the changing workbook cross-tab
  into a versioned long-form CSV rather than making spreadsheet coordinates a
  permanent FEED API. It retains only directly entered approved metrics,
  preserves blank and formula-generated future zeroes separately from directly
  entered zero, excludes Total and Notes, and carries worksheet/cell
  provenance. The operational adapter validates
  effective-dated metric definitions, previews new/revised/unchanged
  observations, reconciles regular methods against active Link2Feed/SIMC formal
  household totals without adding the sources together, and activates or
  no-ops atomically. Invalid source cells block export with an exact reference.
  Service-week dates are anchored to the Tuesday–Thursday block that intersects
  the start of each month; they are not inferred as the nth occurrence of each
  weekday. This prevents a fifth-row November value from being misdated into
  December. After the identified source cell was corrected, the supplied
  34-sheet workbook exported successfully as 1,114 direct observations across
  318 service dates from October 17, 2023 through August 6, 2026, and the
  operational adapter accepted the complete artifact without a duplicate or
  contract warning. Staff then repeated the documented export command against
  the corrected workbook and received the same 1,114-observation result. The
  additive `20260811200000_add_wth_tracking_ingestion`
  migration was also applied successfully in local testing; it stores durable
  workbook provenance and transient normalized review rows. Sanitized backup
  table contract version 7 preserves the new optional provenance fields. The
  final Add Data review activated all 1,114 historical revisions with no
  warning or unresolved issue. On 303 complete formal-overlap dates, regular
  methods were 59 households higher overall with a 4.27 mean absolute daily
  difference; four incomplete dates were excluded without treating blanks as
  zero.

- **Unified Add Data now imports SIMC service visits.** A representative
  sanitized export establishes one formal household
  encounter per Visit ID, SIMC-scoped household and person identities, linked
  encounter membership, household composition, birth-year-only person
  profiles, and field-specific demographic participation. Additional Notes and
  every non-allowlisted column are discarded. The adapter stages a review,
  reports member completeness and repeat same-day household visits, reconciles
  new/revised/unchanged visits and profiles, and activates or no-ops atomically.
  The reviewed June–August sample
  reconciles 3,305 SIMC visits against 3,247 regular-method Tracking households
  and 200 separately recorded Emergency Bags, preserving SIMC as formal
  authority and Tracking as operational detail. WTH's actual source transition
  remains Link2Feed through late May and SIMC from the first week of June; the
  shorter sanitized extracts do not manufacture a production coverage gap.
  The complete localhost workflow was also activated successfully: 3,305 visit
  revisions, 1,443 household profiles, and 2,166 person profiles, representing
  4,760 reported people; 36 non-allowlisted columns were ignored and 21
  structured quality warnings were retained.

- **FEED now has a native, organization-wide Service Log.** Authenticated staff
  can record effective-dated count, yes/no, and time fields for a service day,
  preserve blank separately from explicit zero, save the shared day, or mark
  the pantry closed. Every save appends auditable day and observation
  revisions while maintaining one shared current projection. Administrators
  manage the metric vocabulary through the standard table and Add/Edit dialog;
  an explicit idempotent action installs WTH's historical aliases, seven stable
  metrics, and its 145-household regular capacity plan without making those
  organization-specific defaults universal. Current entry uses Pantry Shopping
  Visits, Long Lists, Emergency Bags, capacity time, and camping-gear
  requests; effective-dated history retains Visits, Lists, and Turned Away.

- **Unified Add Data now has an operational Link2Feed visits branch.** The
  administrator-only modal streams the detected CSV into private staging,
  projects only the public `link2feed_visits_v1` allowlist, discards Notes and
  full birth dates, normalizes demographic participation, and previews new,
  revised, and unchanged facts before activation. Unusually large anonymous
  people counts require an explicit keep-as-household or event-tally decision;
  the confirmed November 24, 2025 WTH outdoor market is applied through a
  WTH-owned source-resolution preset outside the reusable parser. Reviewed
  revisions materialize under a non-visible pending import, then one short
  transaction activates them. A full-scale 78,308-row synthetic regression
  produced 78,308 encounters, 9,509 latest client profiles, and 133,126
  normalized response rows; an identical second artifact was a no-op.

- **The canonical Service foundation now has its first persistent contract.**
  New organization-wide tables retain Service import provenance, source-scoped
  client identities, immutable encounter/profile revisions, canonical profile
  responses, and append-only source resolutions without coupling them to
  Procurement. Domain validation preserves identified, anonymous, special-event
  people aggregates, and formal aggregate record kinds. Demographic source
  values normalize to `provided` or `not_provided`, while an absent source
  question remains unavailable. Configurable outlier review raises a warning
  without capping or reclassifying source values. Effective-dated operational
  metrics preserve typed count/boolean/time observations, capacity targets,
  blank-versus-zero, and daily revision history. Effective-dated capacity
  plans keep the overall formal-service target distinct from operational-method
  targets. Structured quality findings and append-only operator decisions make
  reviewed exceptions auditable. Service is also a complete, independent
  sanitized backup/restore unit under table contract version 5.

- **Unified Add Data now has its ingestion lifecycle foundation.** Transient
  database jobs and append-only progress events track staging, inspection,
  review, activation, completion, failure, and cancellation without entering
  sanitized backups. CSV bytes stream to server-generated private files under
  a 64 MB ceiling, are SHA-256 hashed during transfer, and are re-hashed and
  re-detected before activation. Unknown, failed, cancelled, completed, and
  expired artifacts have explicit deletion paths. Shared helpers detect
  unchanged snapshots, record `no_op` separately from `imported`, confine active
  fact writes to one transaction, and recompute Service revision winners during
  rollback or restore. The Link2Feed visits adapter is the first production
  branch; other detected contracts remain on their existing or pending paths.

- **Unified Add Data detection now has a backend source of truth.** A read-only,
  administrator-only header-inspection route recognizes registered Procurement and
  Service contracts without receiving CSV data rows, returns only
  recognized/ignored counts, and never offers a parser override. Procurement
  header constants were extracted from their parsers so existing importers and
  the global classifier cannot drift.

- **Data Management now includes a unified Add Data workflow.** One
  modal inspects a CSV locally, identifies existing OFB and WTH historical
  procurement contracts, operational Link2Feed visit, SIMC, and WTH
  service-tracking contracts, plus the pending Link2Feed client contract, and
  opens the correct source-specific flow.
  The Link2Feed, SIMC, and WTH Tracking branches can now validate, reconcile,
  and activate data; OFB and historical procurement use the same modal while
  retaining their established import services. Synthetic fixtures verify that original
  Link2Feed exports may contain extra personal columns while FEED recognizes
  only the reviewed allowlist.

### Changed

- **Shopping Lists, Service Log, and Admin now have clearer Lucide identities.**
  Their page headings use `clipboard-pen`, `users-round`, and `shield-user`,
  respectively, through the same 28px mount-and-hover title animation as
  Categories and Food Items. Native animate-ui sidebar variants preserve the
  exact resting geometry while animating the pen stroke, assembling the
  service household, or drawing the administrative shield on full-link hover
  and tap. The Information sidebar also shortens **Data Management** to
  **Data** without changing its route or page title.

- **Reports Management now uses Lucide's `file-chart-pie` icon.** Its 28px
  page-title variant animates on mount and direct hover, matching Categories
  and Food Items, while the native animate-ui sidebar variant traces the file
  and chart before the pie slice fans into place on full-link hover and tap.

- **Service Log now keeps entry, trends, and metric configuration together.**
  The shared 7d/30d/90d/YTD/All/Custom range control is ready for Service
  visualization cards. Daily entry defaults to **Today** in the pantry timezone;
  arrow actions move only across weekdays enabled in Operating Hours, while a
  single-date version of the established Custom range calendar permits past
  special-event dates outside the recurring schedule. Administrator-only
  Service Metrics now sits beneath the daily-entry cards instead of general
  Settings, without adding another sidebar destination.

- **The Add Data spreadsheet hero now traces into view.** Its Lucide
  `file-spreadsheet` geometry is preserved verbatim in a native animate-ui icon;
  the file outline, folded corner, and spreadsheet marks draw on when the modal
  opens and replay when the drop target is hovered or pressed.

- **Data Management now has one minimal Add Data experience.** The separate
  OFB and Legacy toolbar actions are removed. One modal identifies a CSV before
  upload, then routes unified OFB and WTH historical procurement files through
  their established importers or routes Link2Feed, SIMC, and canonical WTH
  Tracking files through staged Service review and activation. Staff retain
  procurement import access; Service imports remain administrator-only. The
  modal adopts the Document Translator's focused upload flow and AI
  Configuration's concise hero treatment, removes step counters and technical
  transformation prose, and reports only information needed for the next
  decision. Older single-channel OFB exports are recognized but direct users
  to the supported unified export.

- **The Service Analytics contract now distinguishes formal authority from
  operational detail.** Link2Feed and SIMC facts supply authoritative
  household/individual and demographic measures; WTH Tracking and the future
  native FEED Service Log supply service-method, capacity, unmet-demand, and
  ancillary observations without replacing formal totals. The plan now defines
  demographic participation/denominators, discards unreliable Link2Feed Notes,
  resolves the November 24, 2025 `264` value as a Thanksgiving special-event
  people tally, and specifies the Tracking-to-FEED cutover.

- **The Add Data modal supplies the OFB Chrome extension.** Its concise upload
  state links directly to a FEED-hosted version 2.0.0
  exporter package. The ZIP includes the unpacked extension in its own folder
  and a visually verified two-page PDF guide covering Chrome Developer mode,
  Load unpacked, installation confirmation, Primarius export, FEED import,
  troubleshooting, and privacy. The previous channel-by-channel paragraph was
  removed from the modal; those schema details remain in the procurement
  documentation where they can be maintained without crowding the task.

- **Reports Management now supports the standard bulk-selection workflow.**
  Staff can select individual templates or the current page, see and clear the
  selected count, and choose **Delete Selected** from the shared Actions menu.
  Row-level and bulk deletion use the same established confirmation, including
  the warning that report templates are shared across the organization. The
  backend validates and deletes the full Analytics-template selection in one
  source-scoped transaction, so stale or mixed-source selections cannot partly
  succeed.

- **New Analytics reports suggest a title from their selected lenses.** A
  Procurement-only selection starts as `Procurement Report`, an Operations-only
  selection starts as `Operations Report`, and a mixed selection starts as
  `Combined Report`. The title remains an ordinary editable field, and once the
  user changes it FEED does not overwrite their wording.

### Fixed

- **The Imports table now shows every durable Add Data activation.** Its read
  path previously queried only `ProcurementImport`, so Link2Feed, SIMC, and WTH
  Tracking were active but invisible beside OFB and Community Donations. Data
  Management now reads a cross-domain provenance projection over both
  `ProcurementImport` and `ServiceImport`; it reports generic data dates,
  meaningful imported-record counts, warnings, status, and import time while
  preserving domain-specific details and rollback/restore behavior. Transient
  jobs and pending Service materialization remain excluded from history.

- **WTH Tracking review no longer rejects approved source aliases or reports
  workflow failures as CSV row errors.** The first 500-row staging callback
  encountered a location-qualified shopping-visit label in November 2024 while
  the effective FEED display alias was still `Visits`, then surfaced the
  callback failure as an unreadable row 501. Approved exporter labels now
  remain source provenance after their canonical metric key is established;
  editable UI display aliases do not determine whether a historical fact is
  valid. CSV syntax errors are still reported by row, while configuration and persistence
  errors retain their own ASK-aligned messages.

- **Service metric fields no longer lose their edge shadows inside the Add/Edit
  dialog.** The fixed-height Shadcn ScrollArea now uses the established
  padded content wrapper, keeping focus rings and control shadows inset inside
  the Radix viewport instead of clipping them at the modal body's edges.

- **Analytics report PDF parity and table lifecycle.** Seasonal Inbound Weight
  now includes every available year for automatic/All selections, retains an
  explicitly chosen subset, and stops lines at the selected range instead of
  drawing out-of-range zeroes. Where Paid Procurement Dollars Went preserves
  the on-screen family stack in its aggregate tail bar. Recurring Availability
  and Category Pressure now print axes and bar-end values, while Operational
  Pressure prints collision-aware latest values. Starting or finishing the
  report workflow no longer remounts Operations tables or leaves them inert, so
  their sort and page state reach the report and remain usable afterward.

## [1.5.0-beta.9] — 2026-08-07

Supersedes 1.5.0-beta.8, which was never deployed — its work (the Admin History
table, the rebuilt Analytics reports, saved-template runs) ships here.

### Added

- **Reports, rebuilt as an export of Analytics.** Any of the twenty-three Analytics
  cards can be selected and exported as one archive: a printable PDF, a CSV per
  card, and a manifest recording the range and filters used.

  The design decision that makes it safe is a single sentence: a report is an
  export of what Analytics already shows, not a second analytical engine. Every
  card renders the same numbers under the same filters, so a report makes no
  claim the screen does not. The previous attempt had its own 31-card registry
  computing its own answers, which is how it drifted into the claims RITE
  rejected (ISSUES #46).

  The workflow is ZEV's, revived rather than rebuilt: one **Generate Report**
  action puts the page into selection mode, cards take an order number as they
  are picked, and a single modal chooses PDF and/or CSV. The per-card export
  buttons rejected during ideation were still rendering on the Operations lens
  and have been removed.

  Charts are authored server-side rather than captured from the browser. Three
  approaches were built and measured against the same data first: printing the
  live page produced 5.8MB and 139 raster images of application chrome;
  serializing the DOM lost every legend. Server-authored SVG is the only one
  that needs no browser, which is what lets a saved template regenerate later.
  The tradeoff is explicit — the PDF shows the same numbers in a chart drawn for
  paper, not a pixel copy of the screen.

  Filters travel, including each card's own. A search box, a donor filter, a
  year selection, or a table's sort are frozen when selection begins, because
  the modal offers no filter controls and a run must mean what the page showed.
  Tables keep their filter, sort, visible columns, and page size, and print with
  a repeating header and rows that never split across a page.

  Long ranges condense automatically — a bar needs 1.6mm to read as a bar — and
  the card says so, with the way to get the detail back. Templates store the
  card selection and filters but deliberately not the date range, which is
  chosen each time a report is run.

  Architecture in `docs/reports/analytics-report-architecture.md`; staff-facing
  guide at Help → Generating Reports.

- **Saved templates run from Reports Management.** A template is listed with its
  cards, outputs and filters, and **Run report** regenerates it for a period
  chosen at run time. The dialog asks for the date range and nothing else,
  because the template supplies the rest — and it asks with the same range
  control the Analytics page uses, so a template's second run means what its
  first one did.

  Each run starts from the default period rather than inheriting the previous
  one. A range carried over silently is exactly the mistake that "a template has
  no date range" exists to prevent.

  Cards can be retired from the registry after a template names one. That is now
  surfaced *before* generating — an "N unavailable" badge in the table, a warning
  in the run dialog, a disabled Run when nothing survives — and only the
  surviving cards are requested. The server's `X-Unknown-Card-Ids` header still
  reports them, but telling someone their report is short a card after they have
  downloaded it is not telling them.

  An unread card registry is distinguished from an empty one: a failed lookup
  reports nothing missing rather than announcing that every saved card has been
  deleted.


### Changed

- **Admin → History is a standard table.** It was the last hand-rolled one on
  the Admin page: its own pager, its own header markup, and a locale-dependent
  `Aug 4, 2026, 5:53 PM` beside every other table's `8/4/2026 5:53 PM`. It now
  runs through `EnhancedDataTable` with sorting, a filter, column visibility,
  and pagination.

  Sorting and filtering happen in the browser, so the whole log is loaded up
  front rather than a page at a time — a partial load would make the filter lie,
  reporting "no results" for an entry that exists but was never fetched. In an
  audit log, which people consult precisely to find one past action, that is the
  worst available failure. The table records administrative actions only, so it
  grows by a handful of rows a month; a 2,000-entry ceiling exists so an
  unexpectedly large log degrades visibly instead of hanging the page.

### Fixed

- **The two heaviest audit entries had no wording.** `BACKUP_RESTORED` and
  `CLEAN_SLATE_APPLIED` were added to the backend in beta.5/6 and never given
  labels, so "the database was replaced" and "the database was wiped" appeared
  in Admin → History as raw SCREAMING_SNAKE identifiers. They now read *Backup
  restored* and *Reset to clean slate* — deliberately distinct, because restore
  recovers and reset discards. A test now asserts every backend audit action has
  frontend wording, and that no wording outlives its action.

- **A restore entry no longer shows a wire-format timestamp.** The Affected
  column rendered the backup artifact's own `2026-08-04T22:20:41.415Z`.

- **Eight Analytics cards could be seen but not exported.** Recurring
  Availability, Operational Pressure, Grocery Partner Mix, Recorded Donated
  Value, Fresh Food Alliance Pickup History, Fresh Food Alliance Donations Over
  Time, and both legacy donation cards were never wrapped for selection, so
  they sat still while everything around them wiggled and could not be put in a
  report. All eight are registered; the registry holds 23.

  Their card-level controls travel like every other card's: the partner picker
  and the Show Legacy Data switch on the donations timeline, the source picker
  on the legacy timeline. A partner's silent month exports as a zero rather
  than a gap, because a gap lets the line bridge it and draw a delivery that
  never happened.

  A test now reads the lens components and fails when a card renders without a
  `SelectableBlock`, or when a registered card loses its place on the page.
  Nothing enforced this before, which is why eight cards drifted out of reach.

- **Printed charts labelled dollars and item counts as pounds.** The bar
  primitive hard-coded a `lb` suffix, so "Where Paid Procurement Dollars Went"
  printed `43,245 lb` for $43,245 of spend, and Availability Summary printed
  `58 lb` for a count of items. Each card states its own unit now. Found by
  rendering a PDF and reading it, not by a test — the CSV had it right all
  along, which is exactly how it stayed invisible.

- **Long product names printed over their own bars.** The label column is a
  fixed width and nothing truncated, so "Meat, Chicken Drumsticks (12/3.4 lb
  trays)" ran straight through the bar beside it. Labels are measured against
  real Helvetica advance widths — an average character width mis-cuts a name in
  capitals and a name in narrow lowercase in opposite directions — and cut with
  an ellipsis. The CSV still carries every name in full, so the abbreviation is
  only ever in the picture.

- **Available Assortment Over Time rendered at half width** with empty space
  beside it. Its `md:col-span-2` was on the inner card while the selection
  wrapper was the actual grid item, so the span applied to something that was
  not a grid child. The two-column grid was doing nothing — both cards in it
  were full width — and is gone.

- **Recurring Availability stranded a KPI beside dead space.** A `max-w-4xl`
  cap ended the divider under the third tile and held the chart to about half
  the card, so the fourth tile floated above nothing and the chart read as a
  fragment. It fills the card, and the item-name axis has the room to prove it.

### Changed

- **Tables wiggle in selection mode, like every other block.** They were held
  deliberately still, on the theory that swaying a whole table was too much; in
  use that read as "this one is not selectable", which is the opposite of what
  the motion is for.

  Amplitude is now scaled to block width. A rotation throws the far corner
  further the wider the element is, so one fixed angle makes a full-width table
  sway several times as far as a half-width card; the angle scales by
  `reference / width`, holding the visible sweep roughly constant. Wide cards
  get the same treatment, not just tables. The `variant="table"` prop existed
  only to suppress motion and has been removed.

## [1.5.0-beta.7] — 2026-08-05

Deployed to production 2026-08-05, from beta.2. Migrations 23 → 24. This entry
was cut in two passes — the restore work was written up first and the rest
accumulated under Unreleased — but all of it shipped in the same image, so it
is one release.

### Added

- **Reset to a clean slate, from Data Management → Database.** The reset the
  data-management arc was built toward: an administrator can return the instance
  to a seeded starting state without SSH, VNC, or a terminal.

  It shares restore's machinery — `buildAndSwap` now holds the dangerous
  sequence once (consistent copy, foreign-key verification, pre-swap snapshot,
  maintenance mode, WAL checkpoint, rename, exit) so both features exercise it
  and it only has to be proven once. It is *not* a restore, and the copy never
  lets those blur: restore recovers, reset discards. The dialog states what will
  be deleted with a live record count, and requires typing RESET, because the
  button sits beside Download Backup and there is no artifact to come back from.

  Two choices: **start with examples** (default) and **also remove everyone's
  access** (off by default — clearing the roster arms the fresh-instance
  bootstrap, which must be chosen rather than discovered).

- **A clean slate in three layers.** Structural (global limit, English enabled),
  reference (all 59 supported languages as *available*, not enabled — a fresh
  instance with 59 switched on would put 59 columns of untranslated text in
  front of staff on day one), and illustrative (optional examples).

  The illustrative layer is three categories and nine items: Produce with no
  limits, Dairy and Meat capped at 3 with each item at 1. One status badge per
  category — Carrots out of stock, Chicken Limited, Yogurt Clearance — because
  the badges are independent of the numeric limit, and putting `isLimited` on
  every item that has a limit would demonstrate nothing.

- **An example Shopping List Builder template**, authored by hand and captured
  into the seed with eight reusable saved components. The Builder is the hardest
  feature to discover; a template that already binds a real inventory-backed
  section table to real categories and limits is documentation that runs.

  **Its inventory ids are symbolic.** The authored template referenced
  `categoryId: 14` and `foodItemId: 177` — ids that come from SQLite's
  autoincrement high-water mark, which survives the deletes a reset performs, so
  they differ on every instance and after every reset. Stored literally they
  would bind the example table to whatever rows hold those ids later. The seed
  stores `@@CAT:Name@@` / `@@ITEM:Name@@` and resolves them against the rows it
  just created, throwing rather than silently rendering an empty table. Verified
  across three id-spaces (14/15/16 authored, 1/2/3 fresh, 17/18/19 reseeded),
  and the seeded template renders to a valid PDF.

- **Sign-in emails look like William Temple House.** The verification code,
  magic link, and invitation messages carried no identity — a black button, grey
  text, no logo, no organisation name, and a sender line reading "FEED Login".
  Sign-in mail is the one message staff receive that looks exactly like what
  security training tells them to distrust, and these gave a cautious recipient
  nothing to recognise.

  All three now render through one shell (`email-layout.ts`) with the WTH logo,
  the app's own blue and gold, and the FEED wordmark as live text. The sender is
  `FEED at William Temple House`.

  The design assumes **images are blocked**, because in Outlook and
  privacy-filtered clients they are: the wordmark and palette are text and
  background colours, not image slices, so the mail still reads as WTH with the
  logo suppressed. Each message also gained a plain-text alternative (HTML-only
  mail scores worse with spam filters) and its own inbox preheader (without one,
  clients scrape the first visible text, so every FEED email previewed alike).

  A logo is not a security control — anyone can copy one. The line doing the
  real work is in the footer: *FEED will never ask you for a password, and will
  never ask you to reply to this message with a code*, which gives staff a rule
  they can apply to the next message, including one FEED did not send. See
  `docs/auth/email-branding.md`.

### Fixed

- **The two-administrator refusal explains itself instead of saying "An
  unexpected error occurred" (ISSUES.md #60).** The backend message was already
  specific and actionable; it never reached the toast. The frontend caps error
  messages at 240 characters as defence against leaked driver dumps, and this
  one ran to 251 — so the entire explanation was replaced with the generic
  fallback. The Domain-mode variant was 129 characters and displayed fine, which
  is why only the two-administrator rule looked broken.

  Errors that arrive with an application error code are now exempt from the
  length cap: a code means one of our own routes wrote the prose, and a leaked
  dump never carries one. The shape checks still apply, so the exemption cannot
  smuggle an artifact through. The message was also cut to three sentences —
  what happens, the rule, the way out — at 132 characters.

- **A clean slate no longer leaves the instance without AI system prompts.**
  The prompts lived only in `scripts/seed-all.ts`, which the production image
  never copies, while `SystemPrompt` is part of the backup contract and so was
  cleared by a reset with nothing to put back. They are reference data — how
  FEED talks to a translation provider, not agency content — and now live under
  `src/services/seed/` and seed in every clean slate, with or without examples.
  Found by checking what a reset actually left behind rather than what it was
  supposed to.

- **The development seed and the clean slate share one source.**
  `scripts/seed-all.ts` had its own copies of the 59 languages, the system
  prompts, and the global limit; it now calls the same seeding code the reset
  uses and keeps only its larger development inventory.

- **Alert rows no longer stagger.** `AlertTitle` kept `mb-1` and `leading-none`
  from upstream shadcn's *stacked* layout, but this alert is a centred flex row:
  the margin lifted the title above its siblings and the line-height put its
  text on a different baseline than the description. Icon, title, and
  description now share one vertical midpoint.

- **Empty analytics states name the period.** "No Usage Data Yet … will appear
  after translation activity begins" read as *never any* and sent someone
  looking for data loss; there was none. The ranges are calendar-based, not
  rolling — "This Month" means since the 1st — so on the 4th of a quiet month a
  busy previous month shows nothing. The empty state now says which period is
  empty and that earlier activity is not shown.

  That first pass then advised widening the range from a card that had no range
  control: Period and Service were rendered only in the populated branch, so the
  one state that needed them was the one state without them. Both filters are
  now defined once and rendered by every state that can act on them. The Service
  list falls back to the configured services when a period recorded no activity,
  so it is a working filter rather than a dropdown with one dead entry.

### Known

- After a restore or reset, `npm run dev` does not come back on its own:
  `ts-node-dev --respawn` waits for a file change rather than restarting on
  exit. Touch a source file or restart the dev server. Production is unaffected
  — Docker's `restart: unless-stopped` restarts on any exit code.

**In-app restore.** An administrator can put the database back from a backup
file without SSH, VNC, or a terminal — the point of the whole data-management
arc. No schema or migration changes.

### Added

- **Restore from a backup, from the Database tab.** Choose a file, see what is
  in it, pick what to bring back, confirm, and FEED restarts on the restored
  data. Validation is a separate round trip from execution, so what the file
  contains is on screen *before* anything is replaced — the difference between a
  confirmation and a dare.

- **Build and swap, never a live transaction.** The largest procurement import
  already lands near 18s against the 30s transaction ceiling; a full restore is
  an order of magnitude larger, and raising the ceiling would mean holding a
  multi-minute write lock that blocks the pantry for nothing if it fails at
  minute four.

  Instead FEED takes a consistent copy of the live database with `VACUUM INTO`,
  rewrites only the selected units inside that copy, verifies it, snapshots the
  original, and swaps the new file in with a single `rename(2)`. The live
  database is untouched until that one syscall, and rollback is renaming the
  snapshot back.

  The design called for `migrate deploy` against an empty file. Copying the live
  one reaches the same place with fewer moving parts: the schema is necessarily
  current because it *is* the live schema, everything a partial restore is not
  replacing is already correct rather than needing a carry-across pass, and
  `VACUUM INTO` is WAL-safe by construction. It also settles the roster question
  the design worried about — accounts, access policy, keys, and the audit log
  are simply still there, because they were never removed.

- **Partial restore, in units closed under foreign keys.** Inventory, languages
  and translations, shopping lists, procurement, and configuration. Not
  arbitrary table checkboxes: `FoodItemTranslation` and the inventory events
  reference food items and categories by autoincrement id, so a selection that
  is not FK-closed produces rows pointing at rows that were not restored. The
  modal adds dependencies for you and says why, rather than refusing and making
  you solve a graph. Procurement is genuinely independent, which makes "add back
  last month's imports" a safe standalone operation.

- **Maintenance mode**, in memory and process-local. A database flag would live
  in the file being replaced, and a crashed restore must not be able to strand
  the instance — a restart clears this one, and `restart: unless-stopped`
  guarantees the restart. Mutations get 503 naming what is happening and who
  started it; reads keep working, so staff can still look things up.

- **The app restarts itself by exiting.** No Docker socket, no privileged
  access, no host agent.

### Changed

- **Upload cap sized from a real artifact: 256MB.** Scaling from the ~29MB
  SQLite file gives the wrong answer by about 4× — the same data as
  pretty-printed JSON measures **120MB**, driven by ~121k procurement lines each
  repeating their key names. The first cap here was 64MB and would have rejected
  every real backup this instance produces. Only testing at production scale
  caught it. Memory is the next ceiling, not the number: the artifact is held as
  a buffer, a string, and a parsed object, so streaming is the fix past this
  point rather than a bigger limit.

- **API keys can be changed on an existing AI configuration.** Edit previously
  showed a disabled row of bullets and told the administrator to create a new
  configuration to rotate a key — which meant re-entering every cost, token, and
  rate setting, and left the old configuration to be found and deleted.

  The field is editable now and write-only: it opens blank with a `••••••••••••`
  placeholder, which reads as *deliberately hidden* rather than *empty*. Blank
  on save leaves the stored key untouched; a typed value replaces it, with a
  fresh salt.

  This was a prerequisite for restore, not a convenience: a restored
  configuration arrives keyless by design, and without an editable field the
  only way to make it work again was to delete it and start over.

- **`AIConfiguration` is now backed up with its two secret columns stripped,**
  rather than excluded whole. beta.6 dropped the entire table to protect
  `encryptedApiKey` and `salt`, which also discarded the administrator's model
  choice, temperature, thinking level, token limits, cost limits, and rate
  limits. `backup-and-restore.md` only ever asked for column-level exclusion.

  The redaction *deletes* the columns rather than nulling them, so a restore
  cannot mistake an empty key for a real one. **Table contract version is now
  2**, and beta.6 artifacts (version 1) still read, through a reader for that
  version.

- **React 19.2.7**, up from 18.2. The ported animate-ui components were written
  for React 19, where `ref` is an ordinary prop; three rounds of `forwardRef`
  fixes existed only to bridge that gap. `cmdk` moved to 1.1.1 with it — at
  1.0.0 it pinned React 18 and was the one real blocker. No source changes were
  needed: the codebase had none of the React 19 breaking patterns.

### Fixed

- **Refs are no longer dropped by the ported animate-ui components.**
  `AnimateIcon`, the animate-ui `Slot`, and all 69 generated icon files handled
  `ref` as a prop, which React 18 never delivers — 16 "Function components
  cannot be given refs" warnings on a single page load.

  The warnings were the visible part. Radix tooltip triggers never received the
  element they anchor against, and `TabsTrigger` registered `null` with the tab
  indicator instead of the trigger it exists to measure.

- **`Switch` no longer spreads Radix's control props onto the DOM button**,
  which made React log and discard an `onCheckedChange` attribute every render.

- **The sidebar no longer shows a redundant "About" tooltip.** Hovering About
  put a second "About" bubble beside the label. That footer block only renders
  with the sidebar expanded — where the label is already visible.

- **Removed `@types/react-beautiful-dnd`**, a dead type whose runtime package
  was never installed. Both surfaces that actually drag use native browser APIs:
  the Shopping List Builder uses pointer events, the Document Translator's
  upload uses HTML5 drop events.

## [1.5.0-beta.6] — 2026-08-01

Sanitized backup, a database summary, and the Data Management page restructured
around it. No schema or migration changes.

### Added

- **Download a sanitized backup** from Data Management → Database,
  administrator-only and recorded in the activity history. It is a *selective
  logical export*, not a database snapshot — the distinction is the whole point
  of `docs/data-management/backup-and-restore.md`. A raw SQLite snapshot
  necessarily carries encryption keys, encrypted provider secrets, and
  authentication records, so it stays an operator concern and is never a browser
  download.

  The artifact describes itself: artifact kind, table-contract version, FEED
  version, the migration the database has applied, per-table row counts, the
  full exclusion list *with the reason for each*, and a SHA-256 over
  canonicalised data. Canonicalised because Prisma does not guarantee column
  order, and a checksum that changed on an unchanged database after an upgrade
  would be worthless. Read inside a transaction so an import landing mid-export
  cannot produce an incoherent file.

  **Authority is excluded deliberately.** `User`, `AccessPolicy`, and
  `AdminAuditLog` are left out, so a stale or edited artifact cannot grant
  administrator access, widen who may sign in, or rewrite the history of
  privileged actions. Also excluded: key material, provider secrets, sign-in
  tokens, rows pointing at files the artifact does not carry, and telemetry.

- **A database summary** on the same tab: grouped record counts, the file size,
  and when the last backup was taken. Counted over the same table contract the
  backup exports, so the figures describe exactly what a backup would contain —
  a summary with its own list would eventually disagree with the artifact.

- **The exclusion contract is enforced by a test, not by prose.** Every model in
  `schema.prisma` must be classified as included or excluded; the test reads the
  schema and fails naming any model in neither. Verified by adding a probe model
  and confirming it fails. The realistic leak was never somebody exporting
  `EncryptionKey` on purpose — it was a table added later that a blanket export
  quietly picked up.

### Changed

- **Data Management is now tabbed: Analytics and Database.** Analytics is the
  default and holds everything the page had before. Database holds the backup
  actions. Staff see the Analytics content with no tab strip at all — a single
  tab is chrome without a choice — while administrators get both. The server
  gates the Database actions independently; the tab strip is presentation.
- **Data Rules moved above the import toolbar** and its description shrank to
  one line, with the detail behind a tooltip. The rules govern every total shown
  above them, so ending the page with them below a paginated table read wrong.
- **Dates are `mm/dd/yyyy` throughout the page** — coverage strip, delivery
  ranges, import timestamps, the staleness alert, and the detail dialog.
- **Restore Backup is present but not yet functional.** It answers with a
  "coming soon" message rather than sitting disabled, matching AI
  Configuration's *Reset to Defaults*: a dead control gives the user nothing to
  act on. Restore replaces live data and its design questions are still open —
  see `docs/data-management/beta-6-backup-restore-brief.md`.

### Fixed

- **Variant styling the Tailwind v4 codemod silently removed** (ISSUES.md #58).
  The upgrade rewrote `outline` → `outline-solid` across its template pass;
  that rename is correct for utility *classes* and was also applied to eight
  `variant="outline"` prop values and two TypeScript unions. Neither `Button`
  nor `Badge` has an `outline-solid` variant, so those controls rendered with no
  variant styling at all — silently, because class-variance-authority falls
  through to base classes rather than throwing. Affected pagination's active
  page, the Document Translator's pagination, the Data Management status badge,
  a Shopping List Builder badge, and three buttons in Find Missing Translations.
  It survived beta.1's utility-by-utility stylesheet diff because that compared
  classes; a prop value never reaches the stylesheet.
- **The backend suite flaked under load** (ISSUES.md #59). The Shopping List
  Builder's `preview-pdf` tests launch Chromium and render a real PDF, taking
  ~5.6s against Vitest's 5000ms default — already over the line in a serial run,
  and pushed over by any extra load. `testTimeout` is now 30s. An earlier
  diagnosis in this release attributed the flakiness to test files sharing one
  database; that was wrong and is corrected in #59.

### Notes

- **Restore is not built.** beta.6 ships the safe half. A sanitized export is
  independently useful, exercises the manifest and exclusion list, and cannot
  destroy anything — and it fixes the artifact format restore has to validate
  against.

## [1.5.0-beta.5] — 2026-08-01

Closes the authorization hole beta.4 built the machinery for, and makes magic
links usable. No schema or migration changes.

### Changed

- **Privileged routes now require administrator authority** (ISSUES.md #50a).
  Until now any authenticated user could roll back procurement imports, restore
  them, author data-shaping rules that change what Analytics counts, or rewrite
  AI provider keys and cost limits. beta.4 deliberately left these open, because
  gating them before the roster was verified risked removing capability the
  pantry depends on with no in-app way to restore it.

  Reads stay open — staff keep visibility into imports, coverage, models, usage,
  and cost. The procurement import itself also stays a staff workflow: it is the
  everyday Data Management task, and it is additive and reversible, whereas
  rollback is the destructive half.

  The UI hides what the server will refuse, so a staff member never meets a
  refusal they could not have predicted. Data-shaping rules stay *visible* to
  everyone with an Active/Paused badge, because a rule changes the totals a
  staff member is reading even though changing it is not theirs to do.

### Fixed

- **Magic links are no longer burned by mail scanning before they reach you**
  (ISSUES.md #57). Microsoft Defender prefetches every link in an inbound
  message; because the callback verified on GET, that scan spent the single-use
  token first, which is why magic links never worked here and OTP became the
  only usable path. Consumption moved to a POST behind a confirmation page: the
  emailed link now opens a page that consumes nothing, and the token is spent
  only when the recipient presses the button. Still single-use, still
  ten-minute, still bound to one address — one extra click, and it survives the
  scanner. Letting a token survive its first use was considered and rejected as
  a replay window.
- **`requireAdmin` now also refuses a revoked account**, not only a non-admin
  one. `jwtAuthMiddleware` ends those sessions upstream so it never fires in the
  mounted app, but a guard whose correctness depends on middleware ordering
  opens silently if that ordering changes. Found by a test asserting the
  property.


## [1.5.0-beta.4] — 2026-07-31

Administrator authority, a user roster, and a sign-in access policy. **Includes
a schema migration** — the first since 1.5.0. Back up `production.db` before
deploying; migrations apply automatically on container start.

### Added

- **Staff and Administrator roles.** Authority is read from the database on
  every authenticated request rather than carried in the JWT. A token lives
  seven days, so a demotion or revocation carried in the claims would not take
  effect until it expired — which would make the access policy advisory rather
  than enforced. The cost is one indexed lookup on a table of a handful of rows,
  which WAL mode (beta.2) keeps off the critical path of a running import.
- **The Admin page at `/admin`**, in three tabs. **Staff** is the roster —
  invite, promote, demote, revoke, restore, remove, and last sign-in.
  **Sign-in** sets the access mode, the message shown to anyone turned away, and
  the contact address. **History** is the privileged-action record.
- **Two sign-in modes.** *Domain* admits any organization address whose access
  is not revoked, which is FEED's existing behaviour and the shipped default.
  *Allowlist* admits only people on the roster, so a colleague whose mailbox is
  compromised cannot reach FEED unless an administrator put them there. The
  modes are strictly nested: switching can never widen access.
- **A durable revoked state**, which blocks sign-in under *both* modes.
  Deleting a departed staff member was never durable on its own — the account is
  recreated on their next successful verification — so revoking is now the
  action that actually holds.
- **`lastLoginAt`**, recorded on every successful sign-in. `emailVerified` marks
  account creation and cannot answer "who has stopped using FEED?", which is the
  question a roster prune actually asks.
- **Invitations.** An administrator can add someone before their first sign-in.
  The email carries **no token** — it links to the sign-in page, where the
  recipient requests their own code. Mail scanners that prefetch links cannot
  consume anything, which is the failure that makes magic links unusable here.
- **An operator CLI** at `dist/cli/admin.js` (`list`, `grant`, `revoke`,
  `reset-access-mode`), for bootstrapping an instance with no administrator and
  for recovering from an Allowlist lockout. It is subject to the same guards as
  the Admin page and records its actions as `operator:cli`.
- **A privileged-action audit log** recording actor, target, action, and
  timestamp, with the actor stored as both id and label so entries stay legible
  after an account is deleted.

### Changed

- **The light/dark sweep is slower and eases symmetrically** — 1200ms on
  `cubic-bezier(0.64, 0, 0.36, 1)`, replacing 600ms on
  `cubic-bezier(0.22, 1, 0.36, 1)`. The old curve was a hard ease-out that
  spent most of its travel in the first few frames, which reads as a jump
  within a 60Hz frame budget. The new one is effectively easeInOutCubic and is
  symmetric about its midpoint, so acceleration in mirrors deceleration out
  across roughly 72 frames. A feel change, not a correctness one.
- **Every pre-existing user was promoted to Administrator by the migration.**
  The approved bootstrap rule — first verified user on a fresh deployment —
  assumes an empty user table, which production does not have. The alternatives
  were worse: promoting the oldest row confers authority by accident of history,
  and arming the bootstrap for the first sign-in after deploy is a race decided
  by whoever opens FEED first on a Monday. Nobody gained meaningful capability,
  because no authority check existed anywhere before this release. Users created
  *after* the migration default to Staff and need an explicit promotion.
- **The sign-in gate now covers all four entry points.** The domain check was
  duplicated across three handlers and absent from the magic-link callback
  entirely, so a link could complete for an address the code path would have
  refused. One service now owns it, and it is re-checked at verify so a code
  issued moments before a revocation does not still resolve.
- Lockout guards scale with the mode: at least one administrator always, and at
  least two who can actually sign in while Allowlist mode is active. A revoked
  administrator holds a role they cannot use and counts toward neither.

### Fixed

- **A refused sign-in no longer claims a code was sent.** Requesting a code for
  a revoked or unauthorised address showed "Code sent to <address>" directly
  above "FEED access is limited to authorized staff", and offered a six-digit
  field for a code that had never been sent. No email was actually sent — the
  backend was right and only the screen was wrong. `OTPTab` had one `error`
  status covering both a failed *request* and a failed *verification*; the
  render guard sent everything that was not `idle`/`requesting` to the code
  step. The two are now distinct, so a refusal stays on the email step, explains
  itself inline, and clears when the address is edited. Regression test in
  `src/test/auth/otp-tab-denied.test.tsx` (ISSUES.md #52).
- **Admin icons follow the project's motion standard.** The roster shipped with
  raw `lucide-react` icons in the action menu, which cannot read
  `AnimateIconContext` and so ignored the menu-open and row-hover triggers
  entirely. Six native animate-ui icons were hand-rolled (`user-round-cog`,
  `user-round-check`, `user-round-plus`, `shield-check`, `shield-minus`, `ban`)
  with geometry taken verbatim from lucide-react. "Change to Staff" and "Revoke
  access" no longer share a glyph: the shield family now means a role change and
  the person/ban family an access change (ISSUES.md #54).
- **The light/dark reveal radiates from the Theme Switcher again in Chrome
  150.** It had been starting from the viewport's top centre there, while
  Safari and Chromium 148 were correct on the same 2× display. `clip-path` on
  `::view-transition-new(root)` resolves against that pseudo-element's own box,
  not the viewport, and the two coincide only while the snapshot is sized in
  CSS pixels. Diagnostics from the affected browser showed FEED requesting the
  button's true centre and Chrome drawing it elsewhere: at `innerWidth` 965 and
  `devicePixelRatio` 2, an origin 92% across a CSS-pixel box lands at 46% of a
  device-pixel one. The reveal is now expressed in percentages, which track the
  button proportionally whatever box the browser uses, with the end radius
  converted through the reference percentage radii resolve against — so the
  geometry is equivalent to the pixel form rather than an approximation of it
  (ISSUES.md #55).
- **A React key-spread warning on every page load is gone.** Lucide's
  `__iconNode` stores its key inside each primitive's attrs, so spreading them
  re-introduced a `key` prop after the explicit one — and the spread won,
  discarding the stable fallback for nodes that have none. Pre-existing for
  every icon in the fallback registry.
- **The Admin page uses `user-round-cog` rather than a shield-with-checkmark**,
  which read as security verification instead of managing people. Animated in
  the sidebar, static in the section header, per Rule 4 of the motion standards
  (ISSUES.md #53).

### Notes

- **Existing privileged routes are deliberately unchanged.** Procurement
  rollback and restore, AI configuration, and data-shaping rules are not yet
  behind an administrator check. Between the migration and a verified roster the
  authorization state is unproven, and gating them in the same release could
  have removed capability the pantry depends on with no in-app way to restore
  it. Tracked as ISSUES.md #50a for beta.5.
- A session-revalidation failure returns `503`, not `401`. A `401` would clear
  the cookie and bounce every signed-in user to a login that fails identically,
  so a database blip would read as a mass revocation.

## [1.5.0-beta.3] — 2026-07-31

Import capacity, deploy safety, and an honest waiting state. No schema or
migration changes.

### Changed

- **Procurement import cap raised from 5MB to 10MB**, with the interactive
  transaction ceiling raised 20s → 30s to match. The 5MB limit was inherited
  from the document translator, whose rationale does not transfer — the
  translator stores uploads, an import holds one buffer and discards it. The
  binding constraint turned out to be transaction time rather than memory:
  measured at ~1.8s per MB on the production Pi, a full 10MB file lands near
  18s, which is 90% of the old ceiling but 60% of the new one. Memory is
  nowhere close (~18MB of RAM per MB of CSV).

### Added

- **A real waiting state on the import dialog** — a spinning indicator, the
  file name, and a live elapsed-seconds counter, reusing the pattern from the
  Shopping List *Translate & Download PDF* modal. Deliberately indeterminate:
  the server performs the import in one atomic transaction and reports nothing
  until it returns, so a percentage would be fabricated. The panel also states
  that existing data is unchanged until the import finishes — a promise only
  made honestly because the import is genuinely atomic.
- **A synthetic OFB export generator** (`scripts/generate-synthetic-ofb-export.ts`)
  for throughput testing at arbitrary scale. Every value is fabricated;
  references are numbered from 9,900,000 so they cannot collide with the real
  corpus (300,365–1,174,032) and silently supersede genuine records.

### Fixed

- **Import timing logs are now greppable.** They passed an object to
  `console.log`, which Node pretty-prints across nine lines, so
  `docker compose logs | grep` returned the header and none of the numbers.
  Both statements are single-line `key=value`; the failure path also flattens
  whitespace, because Prisma's own messages are multi-line and would have
  broken `grep` through the back door.
- **Deployment can no longer silently install an old build.** The guide told
  operators to `export VERSION=…`, but Compose prefers the shell over `.env`
  only while the shell still has it — so a dropped remote session falls back to
  whatever `.env` says. On 2026-07-29 a stale `VERSION=1.0.10` rolled
  production back several versions mid-deploy, and because `pull` had run with
  the exports alive, its output looked correct. The guide now leads with
  editing `.env` and requires `docker compose config | grep image:` as a
  pre-flight.

### Investigated

- **Prisma 6.19.3 does not change SQLite batching.** Evaluated because Prisma,
  not SQLite, is the remaining bottleneck: it batches `createMany` at 999 bind
  parameters where the engine accepts 32,763. Seven minor versions produced
  byte-identical query counts. The upgrade also is not free — `$use` was
  removed *within* the 6.x line, and `db.ts` depends on it — so it was
  reverted and tracked separately. Documented in
  `docs/data-management/import-throughput-evaluation-plan.md`.

## [1.5.0-beta.2] — 2026-07-29

Procurement import throughput. No schema or migration changes.

### Fixed

- **Large OFB imports no longer fail on the production Pi.** A five-year export
  imported cleanly on a developer Mac and failed on the Raspberry Pi against
  identical data. The cause was not compute but query count: the warehouse loop
  issued four round-trips per order plus one upsert per product, and the Fresh
  Alliance loop did the same per pickup. The largest export — 944 orders, 900
  products, 17,814 rows — meant 4,707 queries inside a single transaction. At
  0.23ms per query on an SSD that fits inside the 20-second transaction ceiling;
  the Pi only had to be 4.3× slower per query to exceed it, and SD card against
  NVMe is routinely 10–50×. Each per-row query is now one set-based statement:
  4,707 → 327 queries on the largest export, 3,984 → 304 and 2,687 → 149 on the
  others. Atomicity is unchanged — still one transaction, still all-or-nothing.
- **Undo Import is no longer proportional to import size.** `refreshCurrentOrders`
  asked the database three times per affected order, so rolling back the
  ten-year import cost roughly 2,800 queries. Now 8.
- **One import no longer makes FEED appear frozen to everyone.** SQLite ran in
  the default rollback-journal mode, where a write transaction blocks *readers*,
  not just other writers. The database now runs in WAL mode, so reads proceed
  against the last commit while a write is in flight, with `busy_timeout` so a
  concurrent save waits its turn rather than failing with `SQLITE_BUSY`.
- **Import failures now produce an application message instead of a generic
  one.** nginx's `/api/` block inherited the 60-second default
  `proxy_read_timeout`; when it fired, nginx returned its own HTML error page,
  which the client correctly refuses to show a user, falling back to
  "An unexpected error occurred". The backend never got to write an
  ASK-compliant message. Raised to 300s so the backend's own ceiling is the
  meaningful limit.

### Added

- **Import timing logs** on both success and failure, including byte size, row
  counts, and the Prisma error code, so a production run distinguishes "this
  host is too slow for the ceiling" from a genuine data problem.
- **`scripts/benchmark-procurement-import.ts`**, which measures parse time
  against transaction time and counts queries against a scratch database.
- **`docs/data-management/ingestion-architecture.md`** — the measured account of
  the failure, what changed, and the open atomicity decision.

## [1.5.0-beta.1] — 2026-07-27

Tagged as beta pending verification on the iPad Mini 4 used for day-to-day
inventory updates — see §5/§8 of `docs/tailwind-v4-migration-plan.md`. No
schema or migration changes are included in this release.

### Changed

- **Tailwind CSS v3.4.19 → v4.3.3**, as an app-wide initiative rather than to
  unblock any single component. `@tailwindcss/vite` replaces the PostCSS chain,
  `autoprefixer` and `postcss.config.js` are gone (v4 handles both internally),
  and `tailwind.config.js` is retired in favour of CSS-first configuration in
  `src/index.css`. The theme is declared with `@theme inline` specifically so
  utilities keep inlining `hsl(var(--token))`: that preserves the v3 behaviour
  where a nested element can retheme a subtree by overriding the raw token,
  which the print theme and the shopping-list print page both depend on.
  Custom CSS stays in `@layer components` / `@layer utilities` rather than
  becoming `@utility`, because `@utility` only emits when the class name is
  found in source — classes applied at runtime (the print theme, `.dark`, the
  Recharts tooltip rules) would otherwise have silently disappeared.
- **Modal enter/exit motion** is now a gentle 8px rise with a fade and a
  95%→100% scale, timed by a new `--feed-motion-dialog` token and eased on the
  existing `--feed-motion-ease` so dialogs share the app's curve. Modal pacing
  is tunable without disturbing `--feed-motion-medium`, which card hover,
  sidebar icons, and icon motion share.

### Fixed

- **Dialogs no longer fly in from the upper-left corner.** shadcn's v3 markup
  paired translate-based centring with compensating slide utilities that
  existed only because v3 wrote both the centring and the animation to
  `transform`. v4 centres via the discrete `translate` property, which the
  animation composes with rather than replaces, so the compensation
  double-counted.
- **Two dialogs that skipped their closing animation entirely** — Shopping
  Lists' *Translate & Download PDF* and Document Translator's *Translate*
  (Cancel and Done). Both were rendered behind a `{data && …}` guard while
  clearing that data on close, unmounting the subtree in the same commit and
  denying Radix its `data-state="closed"` pass. Pre-existing, unrelated to the
  Tailwind work.
- **Reduced-motion support now covers every Radix surface.** Dialogs,
  popovers, dropdowns, selects, tooltips, toasts, and sheets previously
  animated regardless of `prefers-reduced-motion`. They now cross-fade without
  moving: only the translate, scale, and rotate channels are neutralized, so
  the fade is kept (a fade is not motion) and the animation stays real, which
  matters because Radix waits on `animationend` before unmounting.
- **Internal failure messages** point at the project's issue tracker instead
  of naming one developer, so a stuck user has a step they can actually take.

## [1.4.0] — 2026-07-25

### Added

- **Service Analytics plan**: documented the future third Analytics lens to the
  right of Operations and Procurement. The plan defines Link2Feed and SIMC as
  standard white-label sources, the WTH Google Sheet as an agency-only sidecar,
  a privacy-minimized dual-grain integration model, source seams, metric
  vocabulary, and phased delivery. No Service UI or ingestion code is included
  yet.
- **Legacy community donation history in Procurement Analytics**: the agency's
  pre-Primarius records (2016–2023) load through an admin "Import Legacy" sidecar
  as a distinct `legacy_community` source at monthly grain. A "Donation History
  From Legacy Data" mix card and a community over-time card present it; the
  Inbound Weight Over Time chart carries it as its own series with a clean seam
  at the 2023-06 Fresh Alliance boundary.
- **Fresh Alliance legacy weave**: legacy sources matching a live Fresh Alliance
  donor (Amazon, Trader Joe's, Fred Meyer, New Seasons, Safeway – Portland SW
  Jefferson) join the Fresh Alliance views — the Procurement Channels bar stacks
  Primarius + legacy-partner history, and Fresh Food Alliance Donations Over Time
  gains a "Show Legacy Data" toggle that extends partner lines back before 2023.
- **Data-shaping rules**: agencies can flag donations in Data Management —
  `pass_through` (relayed to another agency, excluded from supply totals),
  `other_exclusion` (requires a note), and annotations (`at_risk`, `estimated`,
  `program_bound`) — evaluated at read time and disclosed wherever they change a
  number. "Received" and "retained inventory" are now two honest answers.
- **Fresh Food Alliance Category Mix, broken down by donor**: the category
  chart on Procurement Analytics now stacks each reporting category (e.g.,
  "Produce") by donor instead of showing one flat total, using the same
  stacked-bar pattern as "Where Paid Procurement Dollars Went." Donor colors
  are assigned deterministically (no fixed roster, since the donor list is
  open-ended) and stay stable across sessions; the chart respects the same
  donor filter as the Fresh Food Alliance Receipt Categories table below it.
- **Pending Fresh Alliance weight counts equally with confirmed weight**:
  OFB's `Confirmed` flag is an internal audit sign-off on a report the agency
  already made in full, not a data-quality gate, so Procurement Analytics no
  longer distinguishes pending from confirmed weight in any total, chart, or
  donor breakdown. A small, calm note on Inbound Supply Summary and Fresh
  Food Alliance Receipt Categories states how much of the total is still
  awaiting that sign-off and over what date range, so the distinction stays
  visible without being treated as a caveat on the number.
- **Unified OFB export ingestion**: FEED now recognizes the OFB Order CSV
  Exporter v2.0.0 unified export — one sparse 26-column file covering
  Warehouse Completed orders and Fresh Food Alliance Pending and Completed
  pickups for one date range, replacing the two separate legacy exports for
  agencies using the updated extension. FEED splits rows by `Record Type` and
  delegates to the existing, already-tested parsers rather than
  re-implementing row validation, so a Pending pickup's `Confirmed: No`
  becomes an explicit `isConfirmed: false` on the persisted revision, sourced
  from a stated fact rather than inferred. Wired into the existing "drop any
  recognized OFB export" import action. (The two legacy single-channel
  exports this replaced were later retired — see below.)
- **Paired-import indicator**: a unified upload always produces two Import
  History rows — Warehouse and Fresh Food Alliance are permanently separate
  source namespaces — and each now names the other ("Paired with OFB Agency
  Pickups") in the table and the import detail dialog, using a hash of the
  original uploaded file shared by both resulting rows.

### Fixed

- **Custom date-range picker**: faithfully translated ZEV's shared calendar from
  Tailwind v4 to FEED's Tailwind v3. The Analytics picker now has one compact
  calendar, working month/year dropdowns, synced Start/End inputs, keyboard focus
  restoration, and correctly styled range endpoints and middle dates in light
  and dark themes.

### Changed

- **Procurement Analytics polish**: the Paid Products table merged into OFB
  Warehouse Product History as sortable Total Charges / Cost-per-paid-lb columns;
  the low-value acquisition-class filter and the per-product Median Gap column
  were removed; the Fresh Food Alliance Receipt Categories table moved up beside
  the other Fresh Alliance cards; the seasonal legend now reads oldest→newest;
  table dates standardized to MM/DD/YYYY; and numerous card blurbs tightened.

### Removed

- **Legacy single-channel OFB import**: the two exports the unified format
  replaced — a 12-column Completed Orders CSV and a 19-column Agency Pickups
  CSV — are no longer accepted as standalone uploads; only the unified export
  is recognized now. Nothing in this feature had reached production, so there
  was no historical data in either old shape to preserve compatibility for.
  Uploading a raw legacy file now produces a clear "does not match the
  standardized OFB export" error. The underlying parsers for each channel are
  unchanged and undiminished — they remain exactly what the unified importer
  delegates to for each half of a file — only the standalone entry points and
  two now-unreachable schema-compatibility shims (one already known, one
  found and removed in the same pass) were retired.
- **Seasonal channel breakdown**: the Seasonal Inbound Weight card on
  Procurement Analytics can now split each year's monthly trend by OFB
  Warehouse or Fresh Food Alliance. The control only appears when the
  page-level channel filter is "All Channels"; a narrower page filter already
  scopes the data, so the card follows it instead of offering an independent
  choice that could disagree.
- **Sticky Analytics filters**: the Operations/Procurement tab switcher and
  date range control stay pinned beneath the app header while scrolling
  Analytics, so the active range and channel context remain visible across a
  long page of Procurement cards.

- **Fresh Food Alliance pickup normalization**: FEED now parses the OFB Agency
  Pickups export (19 columns, exporter v1.2.0), which reports donor identity for
  Fresh Food Alliance receipts. Donor code and name, pickup reference and ID,
  pickup line IDs, submission timestamps, received quantities and weights,
  reporting category, and donor value per pound are normalized into deterministic
  per-pickup snapshots. Channel classification is file-level: every event in this
  export is a Fresh Alliance receipt because of its source, so reference suffixes
  and product-code prefixes are never consulted. Parsing is normalization only;
  persistence and analytics follow in later increments.
- **Calm Fresh Alliance data-quality warnings**: a `12:00 AM` pickup time is
  recorded as an unknown time rather than an observed midnight collection; a
  `$0.00` donor value is recorded as no valuation on file while the weight is
  fully retained; received values that disagree with requested values retain
  both. Duplicate pickup line IDs, and a pickup reporting two donors, dates,
  or submission times, remain structural failures.
- **Shared OFB parsing primitives**: date, numeric, reference, and product-family
  contracts now live in one module used by both OFB parsers, so the two cannot
  drift apart. The procurement service's public API is unchanged.
- **Fresh Food Alliance imports with donor attribution**: importing an Agency
  Pickups export stores donor identity, pickup provenance, received quantities,
  and recorded donor valuation as organization-wide observations under their own
  source namespace, with the established revision, rollback, and restore
  behavior. Fresh Alliance supply is donated, so its lines carry factual zero
  cost rather than placeholder pricing.
- **Fresh Alliance receipts are counted once**: importing an Agency Pickups
  export supersedes the Completed Orders observations of the same events across
  the dates it covers, so combined inbound weight never doubles. Superseded
  observations are marked rather than deleted, remain in Import History, and
  return in full when the Fresh Alliance import is rolled back. Superseding is
  bounded to the imported window, so a partial export never suppresses a period
  it does not cover, and re-importing Completed Orders cannot reintroduce a
  duplicate.
- **One import action for both OFB exports**: FEED identifies a Completed
  Orders or Agency Pickups CSV from its header row instead of asking staff to
  declare which report they exported. Detection is exact; a file matching
  neither export names both accepted formats rather than guessing. The
  confirmation says which export was recognized, and an Agency Pickups import
  states how many Completed Orders receipts it replaced so weight is counted
  once.
- **Import notes are summarized**: repeated per-row observations — such as an
  absent donor valuation — are reported once per kind with a count, while every
  affected row number is retained. A full-history import returns two notes
  instead of 1,170.
- **Per-channel coverage in Data Management**: a coverage strip shows the
  observed window and event count for OFB Warehouse and Fresh Food Alliance
  separately. The two channels are reported on different schedules — Fresh
  Alliance pickups appear only once they have been entered into the OFB portal
  — so their windows are stated independently and never assumed equal. Coverage
  describes what FEED can currently see; it is never presented as a
  completeness score, a target, or a performance signal.

- **Grocery partner analytics**: Procurement Analytics now reports Fresh Food
  Alliance supply by partner — received pounds, share, pickup count, average
  load per pickup, category count, and observed date range. Partner identity
  comes only from the OFB Agency Pickups export; FEED never infers it. These are
  descriptive observations, not an assessment: FEED does not rank partners,
  score them, or explain why a partner's volume moved.
- **Paid procurement colored by product family**: bars in Where Paid
  Procurement Dollars Went are colored by the product family read from the OFB
  description, so related products read together instead of the color repeating
  a label the axis already shows. The aggregate row's tooltip breaks it down by
  family, answering what the remaining product codes contain — individually they
  are too small to plot, but grouped they are legible. Family is a display
  grouping derived from the description, not a category Oregon Food Bank
  publishes, and a product without a recognizable prefix stays Unclassified.
- **Partner contribution over time**: a monthly line per grocery partner, with
  a partner filter offering select-all and clear-all. Months without a delivery
  render as zero rather than bridging the gap, so the chart never implies a
  delivery that did not happen.
- **Recorded donated value with stated coverage**: in-kind value is summed only
  where Oregon Food Bank recorded a rate, and the card leads with the percentage
  of pounds that covers. Pounds without a recorded rate are shown alongside the
  total and are never assigned an estimated rate.
- **Fresh Alliance revisions record OFB confirmation status**: an
  `isConfirmed` field, sourced directly from Primarius's own review flag
  rather than inferred, reports pickups the agency has already logged but OFB
  has not yet reviewed — populated from the unified export's `Confirmed`
  column (see below); still always `true` when imported through either legacy
  export, which can only ever carry OFB-reviewed data. A live, read-only
  investigation of the Primarius portal found this review queue and confirmed
  it introduces no duplication risk, recorded in
  `docs/data-management/fresh-alliance-pending-pickups.md`.

### Fixed

- **Fresh Alliance re-imports no longer manufacture spurious revisions**:
  every pickup imported before 2026-07-21 had a stored snapshot hash computed
  without the `isConfirmed` field, which did not exist on the hashed identity
  yet. Re-importing an unchanged date range would silently create a new
  revision for every pickup in it, forever, growing the database and
  misreporting "changed" counts in Import History without affecting reported
  weight or donor totals. Fixed the same way the OFB Warehouse parser already
  handles its own historical hash-contract change: a `legacySnapshotHash`,
  accepted as equivalent to the current one on import. Found and verified
  against a copy of the real production database while validating unified
  export ingestion, not from a synthetic test case.
- **"Last Received" columns are sortable**: the three procurement tables that
  had a Last Received date column but no sort control on it — Paid OFB
  Warehouse Products, OFB Warehouse Product History, and Fresh Food Alliance
  Receipt Categories — now sort ascending and descending like every other
  sortable column in those tables.
- **The "Other paid products" bar is now a real stacked bar**: the aggregate
  row's family breakdown was previously visible only in its tooltip; it now
  renders as visually adjacent, proportionally sized, family-colored segments
  directly in the bar, matching an ordinary product row's single segment. A
  custom bar shape draws the segments directly rather than using Recharts'
  native per-series stacking, which renders no geometry at all at this
  series count — a documented Recharts limitation, not something specific to
  this data.
- **Paid procurement family colors are fixed, not rank-based, and explained
  by a legend**: each product family (Meals, Condiment, Meat, Other Protein,
  and the rest of the profiled OFB set) now has one permanent color used
  everywhere it appears — bars, the aggregate row's tooltip breakdown, and a
  new legend beneath the chart — regardless of which families the current
  date range, channel, or search happens to include or how they rank by
  spend. `Unclassified` is pinned to a deliberately muted neutral gray so it
  reads as "not a real category" rather than blending in with real families.
  A description prefix this chart has never seen still gets a stable,
  repeatable color via a deterministic fallback, rather than colliding with
  an existing family's color or the reserved gray.
- **Paid procurement family colors now render**: bars in Where Paid
  Procurement Dollars Went were invisible in one intermediate build (correct
  data, un-painted geometry) because a 14-series stacked chart produced empty
  rectangle groups; switched to one series with a per-row color instead. The
  aggregate row's family breakdown moved from the chart tooltip payload (which
  a single-series chart never populates with more than one entry) onto the
  row data itself, where the tooltip now reads it directly.
- **Error messages no longer expose internal failure detail**: unhandled server
  errors previously reached the browser verbatim, so a database or runtime fault
  could surface a toast containing server file paths, the failing query, and
  schema internals. Internal failures are now logged and replaced with an
  actionable message, while messages FEED deliberately wrote for staff continue
  to appear unchanged. A second guard in the frontend rejects developer-facing
  text from any source.

- **Fresh Food Alliance Receipt Categories now shows donor identity**: the
  table is broken down by donor within each category, sortable by donor,
  category, receipt events, and receiving dates alongside the existing weight
  sort, and filterable to one donor, a combination, or all donors combined.
  A receipt with no donor on file is labeled "Not Reported" rather than
  guessed. The stale claim that partner identity is unavailable in this
  source is corrected — it comes from the OFB Agency Pickups export and is
  still never inferred beyond what that export reports.

### Changed

- **Procurement analytics read the whole OFB corpus**: inbound weight, channel
  mix, seasonal trends, and the staleness prompt now draw on both OFB exports
  and exclude superseded observations, so Fresh Food Alliance supply is reported
  from its donor-attributed source without changing headline totals.
- **Staleness follows the newest observation FEED holds** and is worded as an
  offer to refresh rather than a judgement. A channel whose data entry is behind
  never makes procurement data read as out of date.

- **Procurement Data Management foundation**: a new Data Management destination
  under Information imports standardized Oregon Food Bank CSV exports entirely
  in memory, stores normalized organization-wide source-order revisions and
  provenance, reconciles source versus calculated totals, and discards uploaded
  bytes. Import History follows the standard management-table pattern with
  details, row and bulk rollback, and restoration.
- **Procurement Analytics vertical slice**: Analytics now separates Operations
  and Procurement into Shadcn tabs. The Procurement lens includes inbound
  weight, source-order and receiving-date KPIs; acquisition and channel mix;
  recorded charge reconciliation; monthly and year-over-year seasonal trends;
  paid-product spending; and sortable Warehouse Product History. Shared
  7/30/90-day, YTD, All, and custom-date controls apply to
  Operations and Procurement; procurement-channel and acquisition-class
  filters remain independent, with an empty-state path to Data Management and
  a warning when the latest active delivery is more than 30 calendar days old.
- **Shared authenticated multipart transport**: `BaseApiService` now handles
  FormData requests with the same credentials, 401 behavior, structured
  `ApiError`, logging, and response parsing as JSON requests. Document
  Translator uploads now use this path too.
- **Channel-aware OFB event semantics**: OFB portal imports now distinguish
  OFB Warehouse Orders from Fresh Food Alliance Receipts at the source-reference
  level. Procurement Analytics combines only
  compatible weight totals, keeps Warehouse product observations separate from
  Fresh Food Alliance reporting categories, and never infers grocery-partner
  identity from the OFB export.

- **Organization Operating Hours**: a new Settings page under Information lets
  staff maintain the shared seven-day pantry schedule and IANA timezone using
  the established Shadcn workflow. The backend strictly validates times and
  seeds Tuesday–Thursday, 11:00 a.m.–2:00 p.m. Pacific. Effective-dated,
  append-only revisions preserve the schedule that governed each historical
  service date without adding work to the save flow.
- **Deterministic 90-day operational-history fixture**: development environments
  can now populate Availability & Service Pressure reports from the restored
  production catalog, OFB weekly staple presence, the Tuesday–Thursday service
  schedule, and recurring Trader Joe's/Fred Meyer donation patterns. The
  guarded fixture never invents quantities or consumption and cannot run in
  production.
- **Operational history for service-catalog decisions**: Food Item availability,
  Limited Supply, Clearance, and item-limit changes now write append-only
  snapshots atomically with the live item. Category creation, deletion, and
  limit-policy changes have their own append-only history.
- **Availability and Service Pressure analytics**: the selectively
  reintroduced Analytics workspace shows a literal availability summary,
  available assortment over time, recurring availability, separate
  Limited/Clearance/item/category-rationing series, unavailable episodes, and
  Food Item/Category rationing history. Each validated block has direct CSV
  export, and staff can export the complete atomic event history.
- **Five-minute correction sampling**: rapid edits are retained in raw history
  but collapse to their final effective state for analytics. Lifecycle events
  remain hard boundaries, and exports identify which atomic events contributed
  to sampled results.
- **Dashboard operational shortcuts**: Unavailable Items and Limited Supply
  show current literal counts and link to Analytics.
- **Reports Management placeholder**: a new Reports destination under
  Information establishes the future home for reusable report templates. It
  uses FEED's standard management-table layout but intentionally exposes no
  template or generation actions yet.

### Changed

- **Warehouse product analytics now remain factual**: the arbitrary recurrence
  and continuity visualization cards—and their occasional, recurring, and core
  classifications—have been removed. The supporting table is now Warehouse
  Product History and retains only direct receiving-date, weight, and timing
  observations.
- **Analytics now progresses from observation to detail**: Procurement places
  inbound summary and monthly change before mix, seasonal, and product-pattern
  diagnostics. A new exact-product paid-spending visualization and table show
  where recorded OFB Warehouse product charges went without inferring demand,
  donation shortfalls, or organizational priorities. Operations continues to
  report literal availability, pressure, recurrence, and recovery without an
  added staple-item classification or composite resilience score.
- **Paid-product spending exposes more of the long tail**: the spending chart
  now shows the top 15 OFB Warehouse products, grows to preserve readable row
  spacing, quantifies the remaining product-code count, and reports dollars and
  percentage of paid charges in its tooltip. A product-name and OFB-code search
  replaces the aggregate view with individually ranked matching products while
  preserving each result's share of total paid procurement.
- **Complete seasonal comparison by default**: Seasonal Inbound Weight now
  displays every calendar year in the resolved date range initially, while the
  year menu supports select-all, clear-all, and individual-year filtering.
- **Stable seasonal year colors**: Seasonal Inbound Weight now anchors its
  deterministic Carbon color sequence on the current calendar year, preserves
  each visible year's color while filters change, and emphasizes the current
  year with a wider, token-aware glow.
- **Analytics filters now follow the PRISM quick-range pattern**: visible
  Shadcn preset tabs and an Apply-only custom Calendar replace the hidden range
  dropdown. The range persists across Operations and Procurement and in the
  URL, uses FEED's organization timezone, and defaults to 90 days. The shared
  Calendar wrapper now uses React DayPicker 9 class contracts so month controls,
  weekdays, and range selection remain aligned at phone width.

- **External supply remains a separate analytical domain**: normalized OFB
  procurement observations are not mapped to Food Items and do not alter
  availability, quantity, or operational-history calculations.
- **Direct OFB exports define order identity and channels**: authoritative
  corpus validation replaced the prototype delivery-date boundary with stable
  source-event revisions, treats multiple same-day events as normal, accepts
  observed four-to-six-digit product identifiers, and classifies references
  ending in `AGPCKUP` as Fresh Food Alliance receipts. Product-code prefixes
  remain source catalog metadata and never determine an event's channel.
  Deprecated `DON'T USE` descriptions are retained with provenance warnings.
- **Order-level adjustments remain unallocated**: service fees and grants are
  included in whole-event and channel totals. An acquisition-class filter may
  divide an event, so it shows filtered gross product charges while marking
  fees, grants, and net recorded cost as not attributable.

- **Reports workspace renamed Analytics**: the live availability and
  service-pressure workspace now appears as Analytics under Inventory at
  `/analytics`. Reports now refers to reproducible report artifacts and their
  future management surface under Information.
- **Available assortment now includes Category trends**: the Analytics card
  retains the combined service-window assortment, adds weighted range and
  latest-window averages, and draws every tracked Category as a separate trend.
  A Shadcn selector switches between all Category trends and one isolated
  Category while preserving the combined KPIs; CSV export follows the
  selection.
- **Recurring Availability now exposes the repeat-cycling cohort**: Analytics
  shows recurring-item, repeat-episode, currently-unavailable, and cohort
  restoration metrics with an item ranking; Category Pressure carries the
  separate Category ranking. One-time rotating items remain outside the
  cohort. CSV export contains every matching item and the Category aggregates
  behind the visualization.
- **Category pressure remains comparable without a composite score**:
  Analytics now shows the share of each Category's observed service time with
  Limited Supply, Clearance, a Food Item limit, or a Category limit active.
  Recurring-item and unavailable-entry counts remain in a separate adjacent
  chart, and the same Category rows are available through direct CSV export.
- **Availability analytics now separate assortment from recurrence**: Analytics
  show the average distinct Food Item records available during configured
  service windows without dividing by an ever-growing catalog. A separate
  Recurring Availability lens counts only observed Available → Unavailable
  transitions and identifies items with at least two entries in the selected
  range. Initial/migration states do not count. The top summary now shows
  Repeat Unavailability beside Item Limits, Category Limits, and Median
  Restoration.
- **Logistics is now optional Supply annotation**: the fourth Food Item tab
  contains only Estimated Quantity and Source (Donated, Purchased, or
  Mixed/Other). Both default to Unknown. Price, package size, derived unit cost,
  completeness pressure, burn rate, and projected depletion have been removed.
  Prototype logistics values are cleared by migration.
- **Availability and quantity are independent**: Mark Out of Stock is again a
  one-action workflow. It records only the availability transition, clears
  conflicting Limited/Clearance flags, and never prompts for or changes an
  estimated quantity. Quantity zero likewise makes no automatic stock-status
  claim.
- **Prototype report surfaces narrowed to supported evidence**: price, burn,
  coverage, projected-stockout, replenishment, data-gap, report-template, and
  report-selection UI/routes are disabled. Generic CSV/PDF/ZIP/Chromium and
  selection infrastructure remains isolated for later validated consumers and
  is tracked as auditable technical debt in `AGENTS.md` and `ISSUES.md` #46.

### Fixed

- Animated tab content no longer clips the edge shadows of full-width controls,
  analytics cards, or management tables.
- Report chart colors now use contrast-tested Carbon grades that maintain at
  least 4.5:1 contrast against FEED's actual light and dark card surfaces.
  Documentation no longer makes an unsupported blanket palette claim, and a
  regression test reads the theme tokens to protect future theme changes.
- Operational Pressure now includes a distinct, service-hour-weighted
  Categories with Limits series and matching CSV column. Category policies
  remain counts of categories and are never expanded into implied Food Item
  counts.
- Dashboard inventory distribution now describes its combined In Stock,
  Limited Supply, and Clearance percentage as “available,” rather than the
  inaccurate “fully stocked.”
- Dates before the migration baseline are untracked rather than rendered as
  zero availability, and baseline/deletion snapshots do not inflate
  unavailable-episode counts.
- The active Analytics workspace no longer overflows at phone width: dynamic
  Operational Pressure legends wrap within their card, and the responsive
  regression test now exercises the mounted operational workspace.
- Availability Summary once again owns and displays all eight values exported
  by its CSV. It no longer embeds the independently fetched Dashboard
  distribution card or hides four exported current-state values.

## [1.3.6] — 2026-07-10

Inventory logistics, historical analytics, and downloadable Reports. This
release adds two additive database migrations:
`20260709000000_add_food_item_logistics_ledger` and
`20260710000000_add_report_templates`.

### Added

- **Shared inventory-analytics service** (`POST /api/reports/query`,
  `POST /api/reports/cards/:cardId/csv`): burn rates from ledger history
  (decrease intervals only; replenishments never count as negative burn),
  days of cover, projected stockout dates, and whole-package replenishment
  cost projections, with timezone-validated date ranges.
- **Full Reports workspace**: all five tabs are live — Inventory Outlook,
  Unit Prices, Scarcity & Availability, Replenishment Planning, and Data
  Coverage — 20 selectable blocks in total. Date-range presets default to
  Last 90 Days, planning horizons cover 14/30/60/90 days, and every block
  has a one-click CSV export. Unknown and insufficient-history values remain
  distinct from zero. Deleted items keep contributing to history while they
  existed.
- **Report generation**: "Generate Report" enters a cross-tab selection
  mode (up to 8 blocks; order becomes export order; reduced-motion
  friendly affordances). The confirmation dialog offers reordering, a
  report title, and PDF/CSV options; the download is a ZIP with a
  landscape PDF (server-rendered SVG charts, Page X of Y), numbered
  per-card CSVs, and a manifest. The generic Chromium PDF engine was
  extracted from the Shopping List Builder and is now shared by both
  pipelines.
- **Shared report templates** (`/reports/templates`): organization-wide
  saved report configurations with Apply, Generate, Rename, Duplicate,
  and Delete. Relative date presets resolve fresh on every run; templates
  whose blocks no longer exist are flagged "needs attention" instead of
  being silently altered. New `ReportTemplate` table (additive migration
  `20260710000000_add_report_templates`).
- **Food item logistics fields**: purchase price (Unknown / Donated-Free /
  Purchased, stored as integer cents), units per purchase (1 = "Each"), and
  estimated quantity (blank = Unknown). The Add/Edit Food Item dialog gains a
  fourth **Logistics** tab with a live derived unit-cost line. Currency is
  parsed from its string form straight to cents — no floating-point rounding.
- **Append-only inventory event ledger** (`FoodItemInventoryEvent`): every
  effective change to a food item's quantity, price, status, or identity
  writes a snapshot event atomically with the item. Deletions record a final
  event first, so historical analytics survive item removal. The migration
  seeds one baseline event per existing item; earlier history is treated as
  untracked.
- **Centralized stock/count consistency rules** applied on every mutation
  pathway (edit form, row quick actions, bulk actions, duplicate-name
  recovery, Shopping List Builder inventory actions): Out of Stock or a zero
  count forces quantity 0 and clears Limited/Clearance; a positive count
  restores plain In Stock on a previously-out item; quick "Mark In Stock"
  without a count records the quantity as Unknown.
- **Inventory Reports Help guide**: new in-app workflow guidance for choosing
  report views, generating ordered PDF/CSV packages, exporting one block,
  saving shared report templates, and interpreting Unknown or incomplete
  planning data.

### Fixed

- **Report-selection motion now matches the ZEV reference pace**: selectable
  report cards use rapid 820–1,120 ms wiggle loops, stronger rotation and
  horizontal movement, and compact hash-based staggering instead of the
  previous slow 1.6-second drift. Reduced-motion users continue to receive
  static selection affordances.
- **Inventory analytics no longer count unobserved or lifecycle-only data**:
  Scarcity stops at the report snapshot instead of a future custom-range end,
  and migration/deletion snapshots no longer inflate recording activity.
- **Out-of-stock replenishment urgency stays visible without burn history**:
  these items now remain in the urgency count, priority chart, and plan with
  Unknown numeric projections rather than disappearing.
- **Report export hardening**: Chromium blocks all network/file requests while
  rendering self-contained PDFs, and Docker now runs the backend with an init
  process so Chromium children are reaped after exports.
- **Phone-width Reports layout**: filters, date controls, actions, tabs, and
  the single-month custom calendar now fit narrow screens without horizontal
  overflow.

### Changed

- **Dashboard logistics and report selection**: Projected Stockouts, Quantity
  Coverage, Median Days of Cover, and Known 30-Day Replenishment Cost now use
  the shared analytics service. Eleven authoritative Dashboard cards support
  ordered PDF/CSV report generation; five existing AI cost/performance cards
  remain intentionally non-selectable pending metric repair.
- **Expanded report configuration**: item/category search, category, stock
  status, and price-type filters now persist through templates and manifests.
  Ranking cards support validated Top 5/Top 10 options.

## [1.2.6] — 2026-05-28

Toast notification timing. No database changes.

### Changed

- **Toast messages now stay on screen for a length-aware time** (ISSUES.md
  #44). Instead of a fixed duration per message type, a toast is shown long
  enough to read it through about three times — roughly 3 seconds for a short
  confirmation up to a 12-second cap for a long message. Action toasts (Retry,
  Reload) still persist until you act on them.

### Fixed

- **Toast messages no longer get stuck open when clicked or tapped** (ISSUES.md
  #44). Previously, tapping a toast on a touch device — or resting the cursor
  over one on desktop — paused its dismissal timer and left it on screen
  indefinitely. Toast visibility is now purely time-based: only the timer, the
  (×) close button, or clicking an embedded action button dismisses a toast.
  Clicking an action button now also closes the toast.

## [1.2.5] — 2026-05-28

Shopping List Builder: Want-column checkbox lifted to table level. No database
changes.

### Changed

- **Shopping List Builder: "Checkbox in Want column" is now a table-level
  setting** (ISSUES.md #43). Previously it was per-row, which was tedious to
  apply across a table and didn't reflect the real use case (if you want
  checkboxes, you want them for every row). The toggle now lives next to
  "Show want column" in the section-table Properties panel and applies to
  every row. Older saved templates that carried the legacy per-row value are
  read transparently — no migration needed.

### Fixed

- **Shopping List Builder: Want-column checkboxes now persist across saves and
  PDF downloads** (ISSUES.md #43). The previous per-row setting was wiped on
  every save and every PDF render by the refresh-inventory step that rebuilds
  inventory-backed rows from the database. Moving the setting to the section-
  table itself lets it ride through the refresh untouched, so it sticks.

## [1.2.4] — 2026-05-27

Public inventory feed translation fix. No database changes.

### Fixed

- **Public inventory feed now includes category and item translations that
  appeared to be missing** (ISSUES.md #41). The feed at
  `/api/public/inventory.json` read translated names only from the denormalized
  translation tables, which can lag the app's canonical translation store; some
  categories (e.g. "Canned Goods") therefore showed no translations in the feed
  even though their translations exist and are visible in Translation Management.
  The feed now falls back to the canonical translation store for any
  enabled-language name a denormalized row is missing — matching what the
  Shopping List Builder already does — and uses only completed translations.
  This is a read-side backstop; the underlying two-store translation drift is
  tracked as tech debt (ISSUES.md #42).

## [1.2.3] — 2026-05-26

Shopping List Builder limit handling. No database changes.

### Fixed

- **Shopping List Builder now shows food-item request limits automatically**
  (ISSUES.md #39). Inventory Section tables read each item's limit straight
  from inventory, so a cap set in Food Item Management appears in the Limit
  column without re-entering it in the builder. The limit (a request cap) is
  now fully independent of the "Limited" low-stock status — editing one no
  longer changes the other, in either direction.
- **The Global Limit now caps "No Limit" items by default** (ISSUES.md #39).
  Section-table rows with no per-item limit display the org-wide Global Limit
  value in the Limit column. Previously this was an off-by-default per-table
  toggle; it is now on by default, with an opt-out per table.

### Known issues

- **Builder canvas can wrap long item names in Safari at non-100% browser
  zoom** (ISSUES.md #40). A Safari-only sub-pixel rounding quirk under page
  zoom; the exported PDF and other browsers are unaffected. View the canvas at
  100% zoom in Safari, or use Chrome. Documented as a known limitation.

## [1.2.2] — 2026-05-24

Public inventory feed documentation. No runtime behavior changes.

### Added

- **Public inventory technical notes** in `docs/PUBLIC_INVENTORY.md`, covering
  the endpoint URL, public access model, update behavior, response shape,
  translation behavior, and LOTTO consumer guidance.

## [1.2.1] — 2026-05-24

Public inventory feed for LOTTO. No frontend UI changes.

### Added

- **Public inventory JSON** at `/api/public/inventory.json` for read-only use
  by LOTTO and other external tools.
- The feed includes categories, available food items, category and item limits,
  stock status tags, clearance tags, and dietary flags.
- The feed includes enabled-language translations for category and food item
  names when those translations exist.

### Changed

- Out-of-stock food items are intentionally omitted from the public feed.

## [1.2.0] — 2026-05-24

Help screenshots and release notes. No backend or database changes.

### Added

- **Release notes modal** from the sidebar version label, sourced from
  repo-owned Markdown and written in plain language back to v1.0.0.
- **Help screenshots** for the initial guide set, with matching light and dark
  variants so screenshots match the user's current theme.

### Changed

- **Help guide copy** refined after review for shorter, clearer staff-facing
  guidance.

### Fixed

- **Help search results** now link directly to the matching guide section.
- **Support & Troubleshooting** no longer displays embedded React button code
  inside the Markdown guide.

## [1.1.3] — 2026-05-23

Help, About, and auth-screen polish. No backend or database changes.

### Added

- **Information section** in the sidebar with a searchable, Markdown-sourced
  Help center and a concise About page. Help guides are written for pantry
  staff in plain language and include a screenshot backlog for future visual
  workflow references.

### Changed

- **About** moved from a primary sidebar section to a concise modal opened
  from the sidebar footer, with Temple Consulting branding and project links.
- **Login and logout screens** now use simpler William Temple House branding,
  updated attribution, and solid auth email input backgrounds in light and dark
  mode.

## [1.1.2] — 2026-05-22

More UI motion polish plus a breadcrumb fix. No backend or database changes.

### Changed

- **Alerts bell** now uses an animated bell in the "no new alerts" state that
  rings on hover/tap (no page-load animation). The "new alerts" bell still
  shakes on appearance.
- **Filter inputs** on every data-table page (Categories, Food Items,
  Translations, Shopping Lists, Document Translator, AI Configuration) animate
  their funnel icon on page load + filter-field hover/click.
- **Language Management search** field animates its magnifying-glass icon
  (a hop/nudge) on page load + field hover/click.
- **Translate Document dialog**: added vertical spacing around the
  "Select All" row so it isn't squeezed against the Basic/Advanced tabs.

### Fixed

- **Breadcrumb dead links**: non-route group labels (Inventory, Tools,
  Language & Translation) rendered as buttons with link-hover styling but did
  nothing when clicked. They now render as non-interactive text; routed
  crumbs still navigate.

## [1.1.1] — 2026-05-22

UI motion polish — animated icons throughout the app. No backend or database
changes. Hand-rolled icons that have no upstream animate-ui version are
authored as native animate-ui icons using Lucide v0.522.0 geometry verbatim,
so they're visually identical to the static icons at rest.

### Changed

- **Animated toolbar action icons** across the management pages — the
  Create/Add buttons (Categories, Food Items, Translations, AI Configuration),
  Find Missing Translations, Document Translator's Upload Document and Run
  Storage Check, AI Configuration's Reset to Defaults, and Shopping Lists'
  Export Settings (now a square-arrow-out icon) animate on hover/tap.
- **Animated page-title icons on every page** — Categories, Food Items,
  Translations, Document Translator, Shopping Lists, and Language Management
  now animate their title icon on load + hover, matching the AI Configuration
  page (extracted into a shared `createPageTitleIcon` helper).
- **Sidebar toggle** uses an animated `panel-left-close` icon whose chevron
  nudges on hover.
- **Sidebar Log out** icon animates (arrow slides out) on row hover.
- **Global Limit Settings** button uses a custom animated `globe-lock` icon
  (globe lines trace in, the lock bobs).
- **Alerts bell shakes** when unread alerts are present — on appearance / page
  load and on hover — drawing attention to newly-spawned alerts.

## [1.1.0] — 2026-05-22

The Shopping List Builder gains a batch of layout/printing controls plus an
org-wide Export Settings panel. Every builder change is applied identically
in the canvas preview and the Chromium PDF export (verified by rendered-PDF
parity smokes).

### Added

- **Show/hide the Want column** on section tables (A5). Mirrors the existing
  Limit toggle, so a table can be Item+Limit+Want, Item+Limit, Item+Want, or
  **Item-only** (names with the category in the header). The item column
  widens to fill freed space.
- **Show/hide column dividers and table/cell borders** (A1/A3) on section
  tables **and** form-field groups. Independent toggles, both default on.
- **Limited / Clearance status icons** on section-table rows (A2), shown
  inline with the item name when enabled.
- **Legend base component** (A4) that explains the Limited/Clearance status
  icons, with horizontal/vertical layouts and editable labels. Right-to-left
  target languages flip the legend's alignment and reading order.
- **Per-row checkbox in the Want column** (A6) as an alternative to the
  blank fill-in space.
- **Show Global Limit** option per section table (B3): rows with no
  item-level limit display the current org-wide Global Limit value in the
  Limit column instead of a blank cell. Resolved live at render time.
- **English in the Translate & Download PDF modal** (B2): English is now a
  selectable export target and takes the identity path (skips translation).
- **Export Settings** panel on the Shopping Lists page (B1): org-wide shared
  configuration for exported-PDF filenames — base names for single vs.
  translated downloads, plus optional template-name / language / date-stamp
  tokens and date position, with a live filename preview.

### Changed

- **All Shopping List text and icons render in pure black** (`#000000`) for
  maximum print contrast, aligning the PDF renderer with the canvas.
- **Default builder component width is now 267pt** (was 270).
- **Enhanced the animated Save icon motion.**

### Fixed

- **Builder translation failures now show a specific, actionable message.**
  A transient AI-provider overload (503 "high demand") during shopping-list
  translation previously surfaced as a generic "unexpected error"; it now
  names the language, explains the condition is temporary, and reassures
  that no work was lost. Curated backend messages are no longer masked by a
  generic frontend fallback.
- **Keyboard arrow keys (and Home/End) now work in text fields** (ISSUES.md
  #37). A global sidebar keyboard-navigation listener was intercepting
  those keys app-wide, even while typing, so the caret couldn't be moved by
  keyboard. It now ignores those keys when focus is in an editable element.
- **Editing names mid-string no longer jumps the caret to the end**
  (ISSUES.md #38). Title-Case enforcement on food-item / category names
  moved from per-keystroke reformatting (which reset the caret) to a
  one-time transform at submit. You can type freely; the name is
  Title-Cased when saved.
- **AI Configuration icon hover triggers** (ISSUES.md #35, #36): the AI
  Model card's icon (type chooser) and the Document Text Translation card's
  icon (Prompt Category step) now animate on hover anywhere over the card,
  matching their sibling cards, instead of only on a direct icon hover.

## [1.0.10] — 2026-05-21

(1.0.9 was bumped during development but never deployed; production goes
from 1.0.8 directly to 1.0.10.)

### Fixed

- **Food Items: editing an item with a status filter active no longer
  crashes the page.** The food-item service returned the raw API envelope
  instead of the inner item, so state held an item without `statusFlags`
  and the next render threw `Cannot read properties of undefined (reading
  'isInStock')`. Create/update now unwrap `.foodItem` like the list path.
- **Find Missing Translations modal** (ISSUES.md #30): the results/action
  card is shown first and the tab bodies scroll, so the action buttons are
  no longer clipped on large results.
- **Shopping List Builder row heights** (ISSUES.md #33): section-table rows
  now grow to fit wrapped item names at all font sizes. The wrap estimator
  reserves slack proportional to cell width (matching real Chromium's
  ~3-5% over-width) instead of a flat 6pt that under-cushioned mid-width
  cells even at 12pt.

### Changed

- **Scroll containers standardized on the shadcn `ScrollArea`** for
  fixed-height regions (ISSUES.md #32); grow-to-fit / nested previews keep
  documented native overflow.
- **14pt section tables are now available in Split-page layout**
  (16-18pt remain Full-page-only).
- In-app version label reads "Version x.y.z" (dropped the stale
  "Pre-Release" prefix now that FEED is on public 1.0.x).

## [1.0.8] — 2026-05-21

### Fixed

- **Shopping List Builder templates and saved components are now shared
  org-wide** (ISSUES.md #31). They were previously partitioned per user
  account, so a template created by one user was invisible to others.
  FEED is a single shared-data environment; the per-user `ownerId`
  column has been dropped from `ShoppingListBuilderTemplate` and
  `ShoppingListBuilderComponent`, and all builder routes now read and
  write one shared set. Existing rows are preserved by the migration
  and become visible to every authenticated user. Requires the
  `20260520000000_drop_shopping_list_builder_owner` migration (applied
  automatically on container start via `prisma migrate deploy`).

### Security

- Removed hardcoded credentials (a legacy example encryption key and the
  legacy Basic Auth password) from tracked docs and a test script,
  replacing them with environment-variable placeholders. Production was
  unaffected — Basic Auth is disabled and the active encryption key
  differs from the removed example value.

## [1.0.0] — 2026-05-19

Initial public release.

FEED has been in production use at William Temple House prior to this
release; v1.0.0 marks the first public, open-source publication under
AGPL-3.0-or-later.

### Features

- **Inventory management** — categories and food items with per-item
  and per-category limits, in-stock / out-of-stock / clearance status,
  and dietary flags.
- **Shopping List Builder** — interactive, canvas-based template editor
  producing printable, multi-page, multi-language shopping list PDFs
  from current inventory data. Guided and Freeform layout modes, a 9pt
  grid system, header/footer page anatomy, split-page bodies, and
  flowing section tables that paginate across lanes and pages.
- **AI-powered document translation** — upload English DOCX files and
  receive translations across 59 languages, with a managed translation
  cache and configurable AI providers (Anthropic, OpenAI, Google) under
  per-configuration cost limits.
- **Multilingual rendering** — correct right-to-left ordering, font
  fallback, and Arabic-script shaping for Arabic, Persian, and Hebrew,
  plus CJK support, in both the in-browser preview and exported PDFs.
- **Dashboards** — translation throughput, cost projections, token
  usage by provider, and response-time monitoring, with comprehensive
  empty-state handling for fresh installs.
- **Magic-link OTP authentication** — passwordless email sign-in.
- **Animated icon system** — motion-driven iconography across action
  menus, palettes, section headers, and dialogs.

### Deployment

- Docker multi-architecture images (amd64 + arm64).
- Reference production deployment: Raspberry Pi 5 + Cloudflare Tunnel.

### License

- Released under [AGPL-3.0-or-later](./LICENSE).
