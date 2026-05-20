# FEED — Known Issues & Future Work

**Last Updated**: May 19, 2026
**Status**: v1.0.0 release prep in progress (see `docs/V1-RELEASE-PLAN.md`)
**Production**: https://feed.williamtemple.app

This file tracks open issues, planned work, and recently-resolved items
during the v1.0.0 release-prep window. Detailed root-cause writeups for
pre-v1.0.0 resolutions have been condensed to one-liners here — the full
discussions are preserved in git history (`git log -p ISSUES.md` before
this sweep).

---

## v1.0.0 Release Triage

### Blockers
None identified. The application is running in production at
https://feed.williamtemple.app; the core flows (OTP auth, document
translation, shopping list builder, AI configuration) are working and
verified.

### Recommended-but-optional cleanups before public flip
- **A11y warnings** — missing `DialogTitle` on several `DialogContent` /
  `SheetContent` usages (~12 dev-time warnings on `/food-items` alone).
  See issue #27b below. Quick to fix with `<VisuallyHidden>`.
- **TypeScript debt** — 697 pre-existing errors documented in
  `docs/TSC-DEBT.md`. The recommended "Option C quick wins" drops the
  count to ~250 in roughly 3 hours of focused work. Doesn't block ship,
  but the count is visible to anyone who clones the public repo.
- **Security review** — see issue #7 below. AGPL-3.0 license + going
  public means external eyes on the auth path. Worth a focused review.

### Deferred to post-launch
Everything else in this file. The application is shippable today.

---

## Open Issues

### #5 — Translation Request Batching for RPM Efficiency
**Priority**: Medium · **Status**: Implementation landed Dec 2025;
Chinese DOCX sub-issue tracked separately as #17
**Bucket**: v1.x backlog (monitoring)

Type-aware batching reduced API calls by 95%+ for Food Item/Category
bulk translations. Validation confirmed Food Item + Category bulk
translations succeed; Custom Text and DOCX paths remain on the new
batched code path. Watch for partial failures (especially Chinese DOCX,
which is #17).

---

### #7 — Security & Authentication Hardening
**Priority**: High · **Status**: Planned
**Bucket**: v1.x backlog (recommended before public flip)

Auth system is functional but needs hardening before a wider audience
sees the source. Areas: OTP rate limiting, session-management review,
CSRF audit, cookie-security flags, JWT rotation strategy, email-attack
mitigation, audit logging for auth events.

---

### #8b — AI Translation System Performance Optimization
**Priority**: Medium · **Status**: Planned
**Bucket**: v2

Optimization targets: batch processing efficiency, caching strategy
refinement, API request pooling, DB query optimization for large
documents, memory usage during multi-document operations. Current
performance is acceptable for production usage.

---

### #9 — Unit Testing Update for Docker Environment
**Priority**: Medium · **Status**: Planned
**Bucket**: v2

Backend service / API endpoint / encryption / DB-operation /
auth-flow tests need restoration. Tests were archived in v0.13.x to
reduce technical debt during rapid development; see `/archived_tests/`
for the historical suite. The Docker test environment needs to be set
up so coverage is meaningful.

---

### #17 — DOCX Batch Translation Partial Failures (Chinese)
**Priority**: Medium · **Status**: Investigating
**Bucket**: v1.x backlog

Document translations to Chinese occasionally fail with partial batch
errors after retries (`Non-retryable error detected, stopping retry
attempts` → `All 3 translation attempts failed for batch` →
`Partial translation failure for Chinese: 15 segments failed`). Other
languages succeed. Position-based docx modification still runs with
missing segments.

Next: capture raw provider error response, decide whether smaller
chunk sizes or stricter JSON/tool output for batch responses fixes it.

---

### #19 — System Prompt Save Does Not Close Modal
**Priority**: Low (UX) · **Status**: Fix implemented, pending verification
**Bucket**: v1.x backlog (verify and close)

Root cause was `BaseAIConfigDialog` expecting a boolean from `onSave`;
`AddSystemPromptDialog` returned `void`. Fix standardized `onSave` to
return `Promise<boolean>`. Manual verification still pending.

---

### #22 — Shopping List Builder Phase 5 Layout Mode
**Priority**: Medium · **Status**: Core work landed (April–May 2026);
remaining scope is optional refinement
**Bucket**: v1.x backlog (incremental enhancements)

Core Phase 5 landed: Guided/Freeform toggle, 9pt grid system, snap-to-
grid for drag/drop/add/duplicate/insert, header/footer page anatomy,
explicit Header/Body/Footer regions, split-page body controls, Guided
collision placement, planner-backed Body sequencing, flowing section
tables that split across lanes/pages, RTL + multilingual + emoji-aware
Chromium PDF export.

Remaining scope (not blocking):
- Pagination UX refinement and continuous-table preview accuracy.
- Alignment controls (Left/Center/Right/Top/Middle/Bottom) and
  distribution controls in Guided mode.
- Additional split-page rules (lane resize, overflow controls,
  multi-page editing affordances).
- RITE-based UX refinement once the above are in place.

---

### #26 — Shopping List Builder Table Vertical Density
**Priority**: Medium · **Status**: 3pt re-base + tagged-header alignment
landed May 15–16 2026; monitoring for stacking edge cases
**Bucket**: v1.x backlog (watchpoint)

Phase 0 prototype validated; Phase 1 + the 3pt re-base + the
category-header icon-overhead fix + the adaptive-row tag-measurement
bump all landed. The user mental model is restored (one coordinate
system at 3pt with 9pt major grid). Watch for new multi-component
stacking regressions; the planner is height-agnostic but tight slack
budgets mean wrap-estimation misses are more expensive than before.

---

### #27a — Animated UI Primitive Theme Token Drift
**Priority**: Medium · **Status**: Partial fix landed (Checkbox, Switch);
ongoing watchpoint
**Bucket**: documented pattern (recurring footgun)

When adopting Animate UI / shadcn primitives, generated styling encodes
hard-coded neutral palette classes (`slate-*`, black/white states) that
ignore FEED theme tokens. Strip these and replace with `primary`,
`background`, `muted`, `ring`, etc. in the local wrapper before
shipping. Verify both light and dark mode plus focus/disabled states.

Guidance is captured in `AGENTS.md` ("Lessons From Recent Work") and
should be checked whenever a new animated primitive is added.

---

### #27b — Radix `DialogContent` Missing `DialogTitle` (A11y Warnings)
**Priority**: Medium (Accessibility) · **Status**: Open
**Bucket**: v1.x backlog (recommended pre-public-flip)

Several pages emit dev-time Radix warnings about missing `DialogTitle`.
~12 warnings on a single load of `/food-items`. Screen-reader users
opening these dialogs don't get an announceable title.

Fix: audit every `DialogContent` / `SheetContent` usage. Add a visible
`<DialogTitle>` or wrap a hidden title in Radix's `<VisuallyHidden>`:

```tsx
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
<DialogContent>
  <VisuallyHidden.Root>
    <DialogTitle>Edit Food Item</DialogTitle>
  </VisuallyHidden.Root>
  …
</DialogContent>
```

Grep for `DialogContent` / `SheetContent`, list dialogs missing a
title, add (visible or visually-hidden) titles, then reload affected
pages and confirm zero warnings.

---

### #29b — Animated-Icon `viewBox` Typo in Registries
**Priority**: Low (recurring footgun) · **Status**: Workaround documented
**Bucket**: documented pattern

Icons from `@lucide-animated/<name>` and `@animate-ui/icons-<name>`
consistently ship with `viewBox="0 24"` instead of `"0 0 24 24"`. The
SVG renders only a slice of the upper-left corner. Reinstalling
reintroduces the bug because the registry sources are themselves wrong.

Workaround: grep `viewBox="0 24"` immediately after every install and
patch in place. Documented in `docs/motion/ICON_ANIMATIONS.md` and
`AGENTS.md`.

Long-term fix: upstream issues / PRs against the registries.

---

### #6 — Shopping List Feature Incomplete (OBSOLETE)
**Status**: Superseded by Shopping List Builder; closed in v1.0.0 release prep

The wizard-based shopping list flow this referred to was removed in
v1.0.0 release prep (commit `da7f060d` — 39 files, ~9.6K lines). The
Shopping List Builder is now the canonical implementation. Leaving this
entry as a tombstone for future readers who find references to the old
flow in git history or older docs.

---

## Recently Resolved

### v1.0.0 release prep (May 18–19, 2026)
- Created `release/v1.0.0` branch off `main`
- Removed wizard-era shopping list subgraph (39 files / ~9,650 lines)
- Obvious-orphan icon files removed (10 files / ~1,500 lines)
- Documentation archived to `docs/archive/` (32 files moved)
- TSC debt diagnosed and triaged in `docs/TSC-DEBT.md` (deferred)
- V1-RELEASE-PLAN.md captures the four-phase plan (Phase 0 + Phase 1
  complete; Phase 2 public-readiness audit and Phase 3 release pending)

### Pre-v1.0.0 resolutions (most-recent first)
- **#29a** (May 18 2026): Radix `ScrollArea` does not scroll with
  `max-h-*` constraint — replaced with `overflow-y-auto` div; guidance
  in `dialogs/translate-and-generate-dialog.tsx`
- **#28** (May 17 2026): `AnimateIcon` `animate` prop leaves
  `localAnimate` stuck — first hover miss; fix is the
  `onOpenChange`-driven state pattern documented in
  `docs/motion/ICON_ANIMATIONS.md`
- **#25**: Shopping List Builder generated translation settings gaps
- **#24**: Shopping List Builder translated inventory table row
  measurement
- **#23**: Shopping List Builder PDF export — category icon parity
- **#21** (April 26 2026): Shopping List Builder Phase 5 readiness
  (inventory sync, saved-components CRUD, drag affordances, scroll
  bounds, template discovery)
- **#20** (April 29 2026): Shared row action resets table pagination
  state — added `preservePageOnDataChange` to `EnhancedDataTable` /
  `DataList`
- **#18** (Dec 30 2025): OpenAI GPT-5 thinking-level mapping; per-config
  `reasoning_effort` overrides
- **#16** (Dec 29 2025): Anthropic max-tokens exceed model limit;
  clamping added
- **#15** (Dec 29 2025): Daily token limit was using request counts;
  now derived from TPM × 1440
- **#14** (Dec 29 2025): OpenAI token-usage metrics mismatch
- **#13** (Dec 29 2025): Google Gemini token-usage tracking used
  estimates; now uses provider-reported tokens
- **#12** (Dec 29 2025): Dashboard usage-summary configuration filter
- **#11** (Dec 29 2025): Gemini 3 thinking-level configuration
- **#10** (Dec 28 2025): AI cost control — per-configuration limits
- **#8a** (Dec 31 2025): Updated default AI models (Claude 4.5,
  Gemini 2.5, GPT-5 family)
- **#4** (Dec 26 2025): Dashboard state handling complete across all
  cards (Cost Forecast, Cost Comparison, Translation Performance &
  Success, Response Times, Multi-Service AI Usage)
- **#3**: Cost forecast zero-pricing display
- **#2**: Alert system toast errors
- **#1**: Environment variable cleanup — AI model configuration

Full root-cause writeups for each item are preserved in git history.

---

## Completed Milestones

✅ Docker multi-architecture deployment infrastructure
✅ Database-backed encryption setup (browser-driven initialization)
✅ Cloudflare Tunnel integration
✅ Raspberry Pi 5 production deployment
✅ OTP authentication system
✅ AI-powered document translation (core feature)
✅ Multi-language support (59 languages, including RTL Arabic/Farsi and
   Hebrew, plus CJK)
✅ Shopping List Builder (Phase 5 core)
✅ Animated icon system across action menus, palettes, section headers,
   and dialog hero icons
✅ Dashboard UX with comprehensive state handling
✅ Wizard-era prototype code removed; builder is canonical

---

## Development Workflow Notes

**Current environment**: Docker-based development and deployment.
**Testing**: Manual on localhost (Mac) before Pi deployment.
**Deployment**: Multi-arch Docker images pushed to Docker Hub
(`et2geiger/feed-*`); production runs on Raspberry Pi 5 with Cloudflare
Tunnel → `feed.williamtemple.app`.

**Key files**:
- `/docker-compose.yml` — production stack
- `/docker-compose.local.yml` — development overrides
- `/Dockerfile` — multi-stage build
- `/docs/deployment/DOCKER_DEPLOYMENT.md` — complete deployment guide

---

## Contributing

When addressing these issues:
1. Branch from `main` (or `release/v1.0.0` during release prep)
2. Follow established patterns documented in `AGENTS.md`
3. Test locally with Docker compose override
4. Update `CHANGELOG.md`
5. Update this `ISSUES.md` to reflect the new status
6. Submit a PR with a description of intent and verification steps

---

## Support

For deployment issues, see:
- `/docs/deployment/DOCKER_DEPLOYMENT.md`
- `/docs/deployment/troubleshooting.md`
- `/docs/deployment/raspberry-pi-cloudflare-tunnel.md`

For release-prep status: `docs/V1-RELEASE-PLAN.md`.
For tsc error triage: `docs/TSC-DEBT.md`.
