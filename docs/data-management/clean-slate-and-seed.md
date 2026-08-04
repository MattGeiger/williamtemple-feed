# Clean Slate and the Seed

## Status

Designed and approved 2026-08-02. **Partially implemented.**

**Done** — the three layers exist as code under `src/services/seed/`
(`layers.ts`, `seed-service.ts`, `supported-languages.ts`), with the example
inventory approved 2026-08-04 and pinned by tests. `SeedService.apply` takes a
Prisma client rather than the singleton, so it can populate a *scratch*
database — which is what the clean-slate action needs.

It lives under `src/`, not in `scripts/`, because the production image installs
with `--omit=dev` and never copies `scripts/`. Seed content kept there cannot
back a user-facing action; the operator CLI hit the same trap in beta.4.

**The reset action shipped** in 1.5.0-beta.7 as Data Management → Database →
Reset to Clean Slate. `buildAndSwap` was extracted from the restore service so
both features share one proven sequence — VACUUM-copy, mutate, verify foreign
keys, snapshot, maintenance mode, checkpoint, rename, exit — differing only in
how they populate the scratch database. The roster preserve/clear choice
shipped with it.

**Remaining:**

- the example builder template, bound to the example inventory, rendered to PDF
  per the builder validation rules in AGENTS.md;
- retiring the duplicated arrays in `scripts/seed-all.ts`, so the development
  seed and the clean slate share one source.

### What reset clears, and what survives

Cleared: every table a backup covers, plus four derived tables that either hold
foreign keys into them (`UsageRecord`, `ShoppingListInstance`) or describe data
that no longer exists (`ApiUsageLog`, `Alert`).

Preserved deliberately: encryption keys, the audit log (a security record — a
reset must not be a way to erase the history of privileged actions, and the
reset itself is recorded in it), the sign-in policy, and uploaded documents.

The roster is the one choice: preserved by default, cleared only if asked.

**Known consequence:** clearing `ShoppingListInstance` cascades to
`ShoppingListPDF`, whose rows point at generated files under the storage path.
Those files are not deleted and become orphans on disk — bounded and harmless,
but storage reconciliation is the right place to collect them rather than doing
file deletion inside a database swap.

**One implementation note.** The wipe runs with `PRAGMA foreign_keys = OFF`.
Clearing nearly every table means no single ordering satisfies every
constraint, and chasing a topological order by hand is fragile and pointless
when the whole graph is going away. It is safe because `buildAndSwap` turns
foreign keys back on and runs `foreign_key_check` before the file is trusted —
correctness is asserted on the finished database rather than on the order it
was built in.

## The approved example inventory

Three categories, nine items. Small on purpose: its job is to demonstrate
structure, not to look like a stocked pantry.

| Category | Category limit | Items | Item limit |
| --- | --- | --- | --- |
| Produce | No Limit (stored as 100) | Apples, Carrots, Grapes | none |
| Dairy | 3 | Milk, Cheese, Yogurt | 1 |
| Meat | 3 | Chicken, Beef, Pork | 1 |

Status badges are **independent of the numeric limit** — `isLimited` paints a
"Limited" marker on shopping lists, it does not cap anything. Exactly one badge
per category, so each is visibly distinct:

- **Carrots** — out of stock
- **Chicken** — Limited
- **Yogurt** — Clearance

Setting `isLimited` on every item that happens to carry a limit of 1 would put
the badge on six items and demonstrate nothing. That mistake is caught by a
test.

Dietary flags are set accurately, because the flags are what the example
teaches: grapes vegan, cheese vegetarian but not vegan, the meats neither.
Halal and kosher are false across all three meats — for chicken and beef that
depends on provenance an example cannot assert, and for pork it is never true.

## What changed and why

`scripts/seed-all.ts` was built as a development tool: a way to populate a
database so features could be tested. It predates the Shopping List Builder. Its
categories and food items exist so a new deployment does not feel vacant.

Turning it into the source for a user-facing **Reset to clean slate** action
changes what it has to be. A development seed can be approximate; a clean slate
is a state someone deliberately chooses and then works from.

## What the seed covers today

Five models: `Category`, `FoodItem`, `GlobalLimit`, `Language`, `SystemPrompt`.

Most of the apparent gap is benign, and this is worth stating so nobody
"fixes" it unnecessarily:

- `AccessPolicy` creates itself on first read (`AccessPolicyService.get`);
- operating hours fall back to documented defaults when no revision exists;
- `ExportSettings` follows the same singleton-on-demand pattern;
- empty procurement, empty saved components, and empty data rules are *correct*
  for a fresh instance.

The real gap is that nothing demonstrates the Shopping List Builder, which is
the hardest feature to discover and the one least served by documentation.

## Three layers

A clean slate is not one thing. These layers have different owners and different
lifetimes, and separating them is what makes the "with or without examples"
choice coherent.

**Structural** — what makes FEED work rather than merely be empty. `GlobalLimit`,
English enabled, the singletons. No opinions about any particular pantry.
Always present.

**Reference** — facts rather than choices. The 59 supported languages as
*available* (not enabled), and the system prompts, which are FEED's AI
behaviour rather than an agency's content. Always present.

**Illustrative** — opinions about a pantry that may not be this one. Example
categories, food items, and a shopping list template. **Optional.**

## The choice

Reset offers two options:

| Option | Contains | For |
| --- | --- | --- |
| **With examples** (default) | Structural + Reference + Illustrative | A new deployment. An empty builder teaches nothing |
| **Structure only** | Structural + Reference | An established pantry resetting its own instance — it knows its categories, and seeded ones are work to delete |

"With examples" is the default because a first-run instance is the case where
the choice matters most, and because example data is easy to clear once someone
has their feet wet — `Delete` is a bulk action.

## Sizing the illustrative layer

**Roughly three categories, a dozen food items, and one shopping list
template** — materially smaller than today's eight categories and ~70 items.

Its job is to demonstrate structure, not to look like a stocked pantry. A large
seeded inventory invites two failures: someone mistakes it for real data, or
someone spends their first hour deleting it.

**The template ships with the example inventory, not separately.** A template
demonstrating a real inventory-backed section table teaches far more than one
built from base components alone — and it needs categories and items to bind to.
They are one unit: choosing examples gets both, choosing structure-only gets
neither.

The example template should exercise the parts of the builder that are hardest
to discover: a header, at least one inventory-backed section table showing
category limits, and a footer. It is documentation that runs.

## The roster on reset

Reset offers **preserve (default)** or **clear**.

Preserve carries the live roster into the new database before the swap, so an
administrator resetting their instance does not lock themselves and their
colleagues out of it.

Clear wipes it, which arms the fresh-instance bootstrap — the next verified
sign-in becomes the administrator. That is coherent and sometimes what you want
(handing a fresh instance to another agency), but it must be **chosen, not
discovered**.

## Mechanism

Identical to restore — build a fresh database, run migrations, populate it, swap
it in atomically, exit to restart. The only difference is the source: a seed
rather than an artifact.

Sharing the mechanism means the dangerous parts get exercised by both features
and only have to be proven once.

## It is not a restore

The confirmation must read differently. Restore *recovers* data; reset
*discards* it. Same machinery, opposite intent, and the copy should never let
those blur.

The pre-swap snapshot applies here too — arguably more so, since there is no
artifact to recover from if someone resets by mistake.

## Before implementing

Struck through as they land.

- ~~Audit the seed against current migrations~~ — done; `SeedService` was
  written against the current schema and verified against a freshly migrated
  database. Two fields did not match the assumption: `GlobalLimit` stores
  `value`, not `limit`, and a category's "No Limit" is stored as `100`.
- ~~Decide the example categories and items~~ — approved 2026-08-04, above.
  Nine items rather than the dozen originally sketched; three per category
  reads as a pattern without becoming a list to maintain.
- Build the example template against those items and render it to PDF, per the
  builder validation rules in AGENTS.md.
- Update the AGENTS.md "Seeding" note, which currently describes `seed-all` as a
  development tool that resets inventory states — accurate today, incomplete
  once it also backs a user-facing action.
