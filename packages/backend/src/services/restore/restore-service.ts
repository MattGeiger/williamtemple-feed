// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync, rmSync, renameSync } from 'fs';
import { dirname, join, resolve } from 'path';

import prisma from '../../db';
import { MaintenanceMode } from './maintenance-mode';
import { tablesFor, type UnitId } from './restore-units';

/**
 * Restore by **building a new database and swapping it in**, never by mutating
 * the live one.
 *
 * A single interactive transaction cannot do this: the largest procurement
 * import already lands near 18s against the 30s ceiling in `db.ts`, and a full
 * restore is an order of magnitude larger. Raising the ceiling would mean
 * holding a multi-minute write lock and, if it failed at minute four, having
 * blocked the pantry for nothing.
 *
 * ## How the new file is built
 *
 * The design called for `migrate deploy` against an empty file. This uses
 * `VACUUM INTO` to take a consistent copy of the live database instead, which
 * reaches the same place with fewer moving parts:
 *
 * - the schema is necessarily current, because it *is* the live schema — no
 *   dependency on the Prisma CLI being present and no second migration run;
 * - everything a partial restore is not replacing is already there, correct,
 *   and consistent, rather than needing a carry-across pass per table;
 * - `VACUUM INTO` is WAL-safe by construction: it writes a clean database with
 *   no sidecar journals, so there is no window where the copy disagrees with
 *   the source.
 *
 * Only the selected units are then cleared and repopulated from the artifact.
 *
 * ## Why the live file is safe
 *
 * Nothing touches `production.db` until a single `rename(2)`, which is atomic
 * on the same filesystem — and the scratch file is deliberately placed beside
 * it on the same bind mount so that guarantee holds. Rollback is renaming the
 * pre-swap snapshot back.
 */

/**
 * Exit code used to hand the process back to its supervisor for a restart.
 *
 * 75 is EX_TEMPFAIL — "temporary failure, the user is invited to retry" — which
 * is as close as the sysexits list gets to "going away on purpose, expecting to
 * come back". Docker restarts on any code, so this is for the logs, not for the
 * supervisor.
 *
 * **It does not make `npm run dev` recover.** `ts-node-dev --respawn` means
 * "keep watching for changes after the script exits", not "restart when it
 * exits" — it waits for a file to change. Measured, after a false start: the
 * dev backend stayed down following a reset at exit 0, appeared to be fixed by
 * a non-zero code, and then stayed down again at 75 when no file had been
 * edited. The earlier recovery was the file edit tripping the watcher, not the
 * exit code.
 */
export const RESTART_EXIT_CODE = 75;

/** Deleting children before parents; inserting parents before children. */
const deletionOrder = (tables: string[]): string[] => [...tables].reverse();

export interface RestorePlan {
  units: UnitId[];
  tables: string[];
}

export interface RestoreOutcome {
  restoredTables: string[];
  rowsWritten: Record<string, number>;
  snapshotPath: string;
  /** Set when the caller should exit the process to complete the swap. */
  swapped: boolean;
}

/**
 * Resolve the live database file from DATABASE_URL.
 *
 * The URL is `file:` plus a path that Prisma resolves relative to
 * `prisma/schema.prisma`, not to the process cwd — getting this wrong would put
 * the scratch file on a different filesystem and silently cost us `rename`'s
 * atomicity, so it is derived once, here.
 */
export const resolveDatabasePath = (): string => {
  const url = process.env.DATABASE_URL ?? '';
  const raw = url.replace(/^file:/, '');
  if (!raw) throw new Error('DATABASE_URL is not set; cannot locate the database file.');
  if (raw.startsWith('/')) return raw;
  return resolve(join(__dirname, '../../../prisma'), raw);
};

const clientFor = (path: string): PrismaClient =>
  new PrismaClient({ datasources: { db: { url: `file:${path}` } } });

const delegateFor = (client: PrismaClient, table: string) => {
  const key = table.charAt(0).toLowerCase() + table.slice(1);
  return (client as unknown as Record<string, {
    deleteMany: (args?: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
    count: () => Promise<number>;
  }>)[key];
};

export class RestoreService {
  /**
   * Build the replacement database and swap it in.
   *
   * Returns only if the swap did **not** happen; on success the caller exits so
   * that `restart: unless-stopped` brings the app back against the new file.
   */
  static async run(options: {
    data: Record<string, unknown[]>;
    units: UnitId[];
    /** Label for the audit trail and the maintenance-mode message. */
    actor: string;
    reason: string;
    /** Injected in tests so the suite never calls process.exit. */
    exit?: (code: number) => void;
  }): Promise<RestoreOutcome> {
    const { data, units } = options;
    const tables = tablesFor(units);
    const rowsWritten: Record<string, number> = {};

    const { snapshotPath } = await buildAndSwap(
      async scratch => {
        // Replace, never merge — within the selected units only.
        //
        // Merging would have to reconcile two autoincrement id-spaces:
        // FoodItemTranslation and the inventory events reference FoodItem and
        // Category by id, so a name-based merge must rewrite every incoming
        // foreign key. Getting that wrong binds a translation to the wrong food
        // item — invisible on screen, and it survives physical reconciliation
        // because staff verify stock, not foreign keys.
        for (const table of deletionOrder(tables)) {
          await delegateFor(scratch, table).deleteMany({});
        }

        for (const table of tables) {
          const rows = data[table] ?? [];
          if (rows.length) {
            // createMany rather than a create per row: this is a bulk load into
            // a file nobody is reading yet.
            await delegateFor(scratch, table).createMany({ data: rows });
          }
          rowsWritten[table] = rows.length;
        }

        // Verify the new file says what the artifact said before trusting it.
        for (const table of tables) {
          const actual = await delegateFor(scratch, table).count();
          if (actual !== rowsWritten[table]) {
            throw new Error(
              `Restore verification failed: ${table} holds ${actual} rows, expected ${rowsWritten[table]}. ` +
                'The live database has not been touched.'
            );
          }
        }
      },
      options
    );

    return { restoredTables: tables, rowsWritten, snapshotPath, swapped: true };
  }
}

/**
 * The dangerous sequence, in one place.
 *
 * Restore and clean slate differ only in how they populate the scratch
 * database; everything around that — the consistent copy, foreign-key
 * verification, the pre-swap snapshot, maintenance mode, the WAL checkpoint,
 * the rename, and the exit — is identical and must not be reimplemented twice.
 * Sharing it means the parts that can destroy data are exercised by both
 * features and only have to be proven once.
 *
 * `mutate` receives a client bound to the scratch file. It may take as long as
 * it needs: nothing is live, so there is no transaction clock and no lock on
 * the pantry.
 */
export const buildAndSwap = async (
  mutate: (scratch: PrismaClient) => Promise<void>,
  options: {
    actor: string;
    reason: string;
    exit?: (code: number) => void;
  }
): Promise<{ snapshotPath: string }> => {
  const { actor, reason } = options;
  const livePath = resolveDatabasePath();
  const dir = dirname(livePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const scratchPath = join(dir, `rebuild-${stamp}.db`);
  const snapshotPath = join(dir, `pre-change-${stamp}.db`);

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  {
    // 1. Consistent copy of the live database. Nothing is live in it, so from
    //    here until the swap there is no clock and no lock on the pantry.
    await prisma.$executeRawUnsafe(`VACUUM INTO '${scratchPath.replace(/'/g, "''")}'`);

    const scratch = clientFor(scratchPath);

    try {
      // 2. Whatever this operation actually does — import an artifact, or wipe
      //    and seed. Nothing here is live yet.
      await mutate(scratch);

      // 3. Referential integrity, checked before the file is trusted. This
      //    catches a partial selection that left rows pointing at rows that
      //    were never written.
      await scratch.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
      const violations = await scratch.$queryRawUnsafe<unknown[]>('PRAGMA foreign_key_check;');
      if (Array.isArray(violations) && violations.length) {
        throw new Error(
          `Restore verification failed: the rebuilt database has ${violations.length} broken ` +
            'reference(s). The live database has not been touched.'
        );
      }
    } catch (error) {
      await scratch.$disconnect().catch(() => undefined);
      rmSync(scratchPath, { force: true });
      throw error;
    }

    await scratch.$disconnect();

    // 4. Snapshot the live database before replacing it. This is the rollback,
    //    and it matters most for clean slate, where there is no artifact to
    //    recover from if someone chose it by mistake.
    await prisma.$executeRawUnsafe(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);

    // 5. Stop writes, then let go of the file.
    MaintenanceMode.enter(reason, actor);

    try {
      // `$queryRawUnsafe`, not `$executeRawUnsafe`: wal_checkpoint returns a
      // row, and Prisma rejects that result shape from the execute path with
      // "Execute returned results, which is not allowed in SQLite" — the same
      // trap as the PRAGMAs in db.ts and database-summary.ts.
      await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
      await prisma.$disconnect();

      // Stale sidecars would leave SQLite reading a journal that disagrees with
      // the database it is now paired with. This step is not optional.
      rmSync(`${livePath}-wal`, { force: true });
      rmSync(`${livePath}-shm`, { force: true });

      // 6. One syscall. Before it, the live database is untouched; after it,
      //    the swap is complete.
      renameSync(scratchPath, livePath);
    } catch (error) {
      // Anything failing between entering maintenance and the rename leaves the
      // live database untouched, so the instance is still usable — it must not
      // be left refusing writes, and the half-built file must not be left
      // behind to be mistaken for a snapshot.
      MaintenanceMode.exit();
      rmSync(scratchPath, { force: true });
      throw error;
    }

    const exit = options.exit ?? ((code: number) => process.exit(code));

    // 7. Exit so the supervisor restarts the process against the new file.
    //    `restart: unless-stopped` is already set on every service, so this
    //    needs no Docker socket, no privileged access, and no host agent.
    //
    //    In development this leaves the backend down: `ts-node-dev --respawn`
    //    waits for a file change rather than restarting on exit, whatever the
    //    code. Restart `npm run dev`, or touch a source file, after a restore
    //    or reset. Production is unaffected — see RESTART_EXIT_CODE.
    setTimeout(() => exit(RESTART_EXIT_CODE), 250);

    return { snapshotPath };
  }
};
