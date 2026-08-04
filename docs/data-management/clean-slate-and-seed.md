# Clean Slate and the Seed

## Status

Designed and approved 2026-08-02. **Not yet implemented.**

**The mechanism it shares now exists and is proven.** Restore shipped in
1.5.0-beta.7, and clean slate is the same machinery with a different source:
build a database, populate it, swap it in, exit to restart
(`services/restore/restore-service.ts`). What remains is specific to this
feature and is content work rather than plumbing:

- decide the three example categories and dozen items;
- build the example builder template against them and render it to PDF, per the
  builder validation rules in AGENTS.md;
- split the seed into the structural / reference / illustrative layers below;
- wire the reset action, with its own confirmation copy — it *discards* rather
  than *recovers*, and the wording must never let those blur;
- offer preserve (default) or clear for the roster.

The mechanism deliberately was not generalised to cover seeding in advance of
that work. `RestoreService.run` takes artifact data and a unit list; a
`resetToSeed` path alongside it will want the same VACUUM-copy, verify,
snapshot, swap, exit sequence with a seeding step in place of the import.

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

- Audit the seed against current migrations — confirm nothing it writes has
  drifted from the schema.
- Decide the three example categories and dozen items. They should be generic
  enough to read as examples and specific enough to demonstrate limits and
  statuses.
- Build the example template against those items and render it to PDF, per the
  builder validation rules in AGENTS.md.
- Update the AGENTS.md "Seeding" note, which currently describes `seed-all` as a
  development tool that resets inventory states — accurate today, incomplete
  once it also backs a user-facing action.
