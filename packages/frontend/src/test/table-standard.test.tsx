// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

// @vitest-environment jsdom
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, test } from 'vitest';
import fg from 'fast-glob';

/**
 * The table standard, enforced against the source rather than trusted to
 * review.
 *
 * Three defects reached production because each was a convention that nothing
 * checked: column widths computed by hand in seven files and forgotten in nine,
 * a sortable header copy-pasted 37 times with padding that put the label 16px
 * right of the data it labelled, and one table that right-aligned its cells
 * while leaving its header left-aligned.
 *
 * Every one of those is visible in the source. So they are checked here, where
 * a new table trips the wire on the first run rather than on someone's
 * screenshot. See docs/layout/table-standard.md.
 */

const root = join(__dirname, '..', 'components');

const sourceFiles = fg
  .sync(['**/*.tsx'], { cwd: root, absolute: true })
  .filter(file => !file.includes('/ui/sortable-header'));

const read = (file: string) => readFileSync(file, 'utf8');

/**
 * Comments are prose, not code. A file explaining *why* it no longer uses
 * `justify-end` must not be reported as still using it — the first version of
 * this test failed on its own documentation.
 */
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const relative = (file: string) => file.slice(root.length + 1);

describe('table standard', () => {
  test('no table computes its own column widths', () => {
    // Widths come from `size`, resolved by EnhancedDataTable for every
    // viewport. A file doing the arithmetic itself has opted out of the
    // responsive recalculation and will drift from the rest.
    const offenders = sourceFiles
      .filter(file => read(file).includes('calculateColumnWidths'))
      .map(relative);

    expect(
      offenders,
      `These files compute column widths by hand. Delete the block and let the ` +
        `table resolve widths from each column's \`size\`:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  test('no table hand-rolls a sortable header', () => {
    // 37 copies of `<Button variant="ghost" onClick={... toggleSorting ...}>`
    // each inherited the button's px-4, so every sortable label sat 16px right
    // of its column's data. One component now owns that alignment.
    const offenders = sourceFiles
      .filter(file => read(file).includes('toggleSorting'))
      .map(relative);

    expect(
      offenders,
      `These files build a sortable header inline. Use <SortableHeader column={column}> ` +
        `from @/components/ui/sortable-header:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  test('no column aligns one half of itself', () => {
    // Right-aligning a cell without right-aligning its header is what produced
    // the reported Actions offset. Alignment is declared once per column via
    // `meta.align` and applied to both by the table.
    const offenders = sourceFiles
      .filter(file => {
        const source = code(file);
        // Only column definitions are in scope; a justify-end inside ordinary
        // layout markup is unrelated.
        if (!source.includes('ColumnDef<')) return false;
        return /cell:[\s\S]{0,400}?(justify-end|text-right)/.test(source);
      })
      .map(relative);

    expect(
      offenders,
      `These column definitions align a cell directly. Declare ` +
        `meta: { align: 'right' } on the column so the header moves with it:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  test('no table formats a date itself', () => {
    // Five date formats were in use across two libraries, because every call
    // site chose its own options object: bare toLocaleDateString (correct by
    // accident), an explicit 2-digit variant (07/11/2026), an undefined-locale
    // variant (day-first on an en-GB browser), "Jul 11, 2026", and date-fns.
    // Tables use the shared formatter so the answer is the same everywhere.
    //
    // Chart axes are deliberately out of scope — an axis is a scale, not a
    // record — so this only looks at files that define columns.
    const offenders = sourceFiles
      .filter(file => {
        const source = code(file);
        if (!source.includes('ColumnDef<')) return false;
        // Only numeric date patterns. `MMM d` is the chart/prose form and is
        // allowed — these two files hold tables and charts side by side, so a
        // rule that cannot tell them apart flags the wrong thing.
        return (
          source.includes('toLocaleDateString') ||
          /format\([^,]+,\s*'[^']*(?:MM\/dd|M\/d|dd\/MM)[^']*'/.test(source)
        );
      })
      .map(relative);

    expect(
      offenders,
      `These tables format dates directly. Use formatDate / formatDateTime / ` +
        `formatDateRange from @/lib/formatting/date:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  test('the shared header cancels the button padding it sits in', () => {
    // The whole point of the component. `-ml-4` offsets the ghost button's
    // px-4 so the label lands on the cell text; without it every sortable
    // column silently regains its 16px indent.
    const header = readFileSync(
      join(__dirname, '..', 'components', 'ui', 'sortable-header.tsx'),
      'utf8'
    );

    expect(header).toMatch(/-ml-4/);
    expect(header).toMatch(/-mr-4/);
    expect(header).toContain('meta?.align');
  });
});
