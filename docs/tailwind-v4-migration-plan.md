# Tailwind CSS v3 → v4 Migration Plan

**Status:** Deferred. FEED currently runs Tailwind **3.4.19**. The immediate
calendar need was completed as a Tailwind v3 translation on 2026-07-25.
**Why consider it:** modern CSS-first config, faster builds, and access to the
current shadcn/ui components (e.g. ZEV's v4 calendar). Not worth doing for a
single component — this is an app-wide initiative whose payoff is app-wide.

> **This is a breaking major, not an additive upgrade.** The build won't compile
> until the tooling changes are made, and — more importantly — a set of *silent
> visual* changes (shadow/radius scale renames, default border/ring color and
> width) will shift the look of nearly every component without any error. The
> real cost of this migration is a **full visual QA pass**, not the mechanical
> edits (which are largely automated).

---

## Decision record: Analytics calendar

The ZEV shared calendar was ported faithfully without changing FEED's Tailwind
version. Its Tailwind v4-only utilities were translated to v3 equivalents:

- `[--cell-size:--spacing(8)]` → `[--cell-size:2rem]`
- `size-(--cell-size)` → `h-[var(--cell-size)] w-[var(--cell-size)]`
- `has-focus:*` → `focus-within:*`
- v4 shorthand and data-state styles → explicit v3 arbitrary-value and
  `data-[...]:*` selectors

This preserved ZEV's custom day button, range states, focus behavior, compact
single-month layout, and month/year dropdown captions without changing FEED's
dependencies or build configuration. Tailwind v4 remains a separate whole-app
initiative.

---

## 1. Pre-flight

- **Node 20+** (required by the upgrade codemod).
- A **clean, dedicated branch** — the codemod rewrites config, CSS, and templates
  in place and expects a clean working tree.
- Inventory the surface area first:
  - Custom CSS / `@layer` blocks and any `@apply` usage.
  - Tailwind plugins in `tailwind.config.js` and whether each has a v4 equivalent.
  - Every place that hard-codes a shadow/radius/border/ring utility (these are the
    silent-regression hotspots — pervasive in a shadcn codebase).

## 2. Automated codemod

Run Tailwind's official upgrade tool on the branch:

```bash
npx @tailwindcss/upgrade
```

It handles most of the mechanical churn: JS config → CSS `@theme`, the
`@tailwind` → `@import "tailwindcss"` swap, renamed utilities, and template
class updates. It is good but **not** a guarantee — custom CSS, plugins, and the
default-value changes below still need human review.

## 3. Manual tooling changes (build won't compile without these)

- **Build plugin.** FEED is a Vite app, so adopt **`@tailwindcss/vite`** (preferred)
  or `@tailwindcss/postcss`. `autoprefixer` / `postcss-import` are handled by v4
  internally and should be removed from the PostCSS chain.
- **Entry CSS.** `@tailwind base/components/utilities` → `@import "tailwindcss"`.
- **Config.** The JS config still works via an `@config` directive during
  transition, but the idiomatic v4 path is CSS-first `@theme`. Decide whether to
  fully convert now or bridge with `@config` and convert later.
- **Arbitrary CSS-var syntax.** `bg-[--var]` → `bg-(--var)` (the codemod does this).

## 4. The silent-visual-regression audit (the real work)

These compile cleanly and change rendered output everywhere — budget the bulk of
the effort here:

- **Scale renames:** `shadow-sm`→`shadow-xs`, `shadow`→`shadow-sm`;
  `rounded-sm`→`rounded-xs`, `rounded`→`rounded-sm`; similar for `blur` /
  `drop-shadow`. Cards, buttons, inputs, popovers all shift one step.
- **Default color/width changes:** default border color gray-200 → `currentColor`;
  default ring 3px blue → 1px `currentColor`; placeholder color shifted.
- **Behavior:** `outline-none` → `outline-hidden`; `hover:` applies only on
  hover-capable devices; a few `space-x/y` selector changes.

Plan: a component-by-component visual review (Analytics, Data Management, Shopping
Lists, Reports, Document Translator, dialogs, tables, the calendar) in **both light
and dark themes**, ideally with before/after screenshots.

## 5. Browser & device support — the cutoff

Tailwind v4 targets **Safari 16.4+ / Chrome 111+ / Firefox 128+** and uses native
CSS features (cascade layers, `@property`, `color-mix()`). Older engines are not
polyfilled. What that means by platform:

### Apple (the strict one)

On iOS/iPadOS **every browser uses WebKit**, so the *device's maximum OS version*
determines the engine — installing "Chrome" on an old iPhone does **not** help.
Safari 16.4 shipped in **iOS/iPadOS 16.4 (March 2023)**.

| Device | Runs iOS/iPadOS 16.4+? | Verdict |
|---|---|---|
| iPhone 8 / 8 Plus / X (2017) and newer | Yes | **Supported** |
| iPhone 7 / 7 Plus (2016) and older | No (max iOS 15) | **Excluded** |
| iPhone 6s / SE 1st-gen (2015–16) | No | **Excluded** |
| iPad (5th gen, 2017) and newer; iPad Air 3 / mini 5 (2019)+; all iPad Pro | Yes | **Supported** |
| iPad Air 2 (2014), iPad mini 4 (2015), iPad 4th-gen and older | No (max iPadOS 15) | **Excluded** |

**Practical Apple cutoff: 2017 and newer** (iPhone 8 / iPad 5th-gen era).
*Verify exact per-model OS support against Apple's spec pages before relying on
this — per-model OS eligibility is easy to get slightly wrong.*

### Android

Chrome and Firefox update **independently of the OS** via the Play Store, so device
age matters less than (a) the OS floor the current browser still supports and
(b) whether Google Play Services is present.

- Current Chrome requires roughly **Android 8.0 (Oreo, 2017)+**. Devices on Android
  8+ auto-update well past Chrome 111, so they render faithfully.
- **At risk:** devices stuck on **Android 7 or older**, or devices **without Google
  Play Services** (some budget, kiosk, AOSP, or post-2019 Huawei phones) whose
  browser is frozen at an old version.

**Practical Android cutoff: Android 8.0 (2017)+ with an up-to-date Play-Store
browser.** *Confirm the exact current-Chrome Android minimum before finalizing.*

### Desktop

Auto-updating browsers, so low risk: **Windows 10+** (Chrome dropped Win 7/8.1 in
2023) and **macOS Big Sur 11+** (current Chrome dropped Catalina). Any Mac/PC that
can run a current browser is fine.

### Why this is lower-risk than it looks for FEED

The Analytics dashboard and Data Management are **staff-facing**, internal tools —
the device population is **WTH staff on their work/personal devices**, not the full
client base. That is a small, knowable set: a quick check of what staff actually
use is the whole audience test. The broader "old device" concern would apply to any
**client-facing** surface (intake, public pages); those, if present, need the wider
device sweep. Given a food-pantry audience skews toward older/budget hardware,
**scope the cutoff decision to who actually views each surface** rather than
assuming the worst for internal tools.

## 6. Testing & rollout

1. Codemod + tooling on a branch; get it compiling.
2. Full visual QA (§4) in light and dark.
3. Run the whole test suite (backend + frontend) — behavior tests should be
   unaffected; failures point at DOM/class assumptions to fix.
4. Confirm the actual staff device set can load the dashboard (§5).
5. Merge behind a normal review; keep the branch small enough to revert cleanly.

## 7. Rollback

The migration is a single dependency + config + CSS change set on one branch. If
visual QA surfaces too much regression, the rollback is reverting the branch — no
data or schema involvement. That containment is a reason to do the whole thing at
once on one branch rather than piecemeal.

---

## Recommendation

Do **not** migrate to unblock one date picker. The faithful v3 translation is
complete, including the single-month calendar, month/year dropdown captions,
synced Start/End inputs, and ZEV-style range rendering. Treat v4 as a
**deliberate, whole-app initiative** taken for the build and config benefits,
sized around the §4 visual audit and the §5 device decision — not as a means to
a single component.
