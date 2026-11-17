// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { describe, test, expect, vi } from 'vitest';

vi.mock('../../../src/db', () => ({ default: {} }));

import { createFlowingTablePlan } from '../../../src/routes/shopping-list-builder';

// Grid page layout: the body is 2 columns x 2/3/4 rows of squares. These
// tests pin the planner contract the canvas and the PDF both render from.

const paper = { size: 'letter' as const, width: 612, height: 792, unit: 'pt' as const };

const text = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'text' as const,
  name: id,
  x: 18,
  y: 60,
  width: 270,
  height: 18,
  region: 'body' as const,
  content: id,
  fontSize: 10,
  fontWeight: 'normal' as const,
  align: 'left' as const,
  lineHeight: 1.2,
  ...extra,
});

const table = (id: string, rowCount: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'section-table' as const,
  name: id,
  title: id,
  x: 18,
  y: 60,
  width: 270,
  height: 0,
  region: 'body' as const,
  flowMode: 'flowing' as const,
  showLimit: true,
  limitWidth: 51,
  wantWidth: 57,
  rowHeight: 15,
  fontSize: 10,
  alternateRows: false,
  rows: Array.from({ length: rowCount }, (_, index) => ({ id: `${id}-${index}`, item: `Item ${index}`, limit: '1' })),
  ...extra,
});

const gridTemplate = (overrides: Record<string, unknown>) => ({
  id: 'grid-test',
  name: 'Grid test',
  paper,
  layoutMode: 'guided',
  bodyLayoutMode: 'grid',
  gridLayout: '2x2',
  gridContentMode: 'duplicate',
  gridSize: 3,
  headerHeight: 36,
  footerHeight: 36,
  bodyColumnGap: 18,
  maxPages: 1,
  components: [],
  ...overrides,
}) as any;

describe('Shopping List Builder grid layout planner', () => {
  test('Duplicate All repeats the first square in every square of the grid', () => {
    for (const [gridLayout, cellCount] of [['2x2', 4], ['2x3', 6], ['2x4', 8]] as const) {
      const plan = createFlowingTablePlan(gridTemplate({
        gridLayout,
        components: [text('a'), text('b')],
      }));

      expect(plan.bodyPlacements).toHaveLength(2 * cellCount);
      expect(plan.bodyPlacements.filter((placement) => !placement.isDuplicate)).toHaveLength(2);
      expect(new Set(plan.bodyPlacements.map((placement) => placement.lane)).size).toBe(cellCount);
      expect(plan.pageCount).toBe(1);
    }
  });

  test('a duplicate is the original moved by whole columns and rows', () => {
    const plan = createFlowingTablePlan(gridTemplate({ gridLayout: '2x4', components: [text('a')] }));
    const byLane = Object.fromEntries(plan.bodyPlacements.map((placement) => [placement.lane, placement]));

    // Body is 792 - 36 - 36 = 720pt, so each of 4 rows is 180pt; the right
    // column is half a Letter page (306pt) across.
    expect(byLane['cell-1'].x - byLane['cell-0'].x).toBe(306);
    expect(byLane['cell-1'].y).toBe(byLane['cell-0'].y);
    expect(byLane['cell-2'].x).toBe(byLane['cell-0'].x);
    expect(byLane['cell-2'].y - byLane['cell-0'].y).toBe(180);
    expect(byLane['cell-7'].y - byLane['cell-0'].y).toBe(540);
    // Content starts half a column gap inside the square's top edge.
    expect(byLane['cell-0'].y).toBe(36 + 9);
  });

  test('Individual places each component in its own square and never copies', () => {
    const plan = createFlowingTablePlan(gridTemplate({
      gridLayout: '2x3',
      gridContentMode: 'individual',
      components: [text('first'), text('fourth', { gridCell: 3 }), text('alsoFirst', { gridCell: 0 })],
    }));

    expect(plan.bodyPlacements.some((placement) => placement.isDuplicate)).toBe(false);
    expect(plan.bodyPlacements.map((placement) => [placement.componentId, placement.lane])).toEqual([
      ['first', 'cell-0'],
      ['alsoFirst', 'cell-0'],
      ['fourth', 'cell-3'],
    ]);
    const first = plan.bodyPlacements.find((placement) => placement.componentId === 'first')!;
    const alsoFirst = plan.bodyPlacements.find((placement) => placement.componentId === 'alsoFirst')!;
    expect(alsoFirst.y).toBeGreaterThan(first.y);
  });

  test('a square clamps an out-of-range gridCell instead of dropping the component', () => {
    const plan = createFlowingTablePlan(gridTemplate({
      gridLayout: '2x2',
      gridContentMode: 'individual',
      components: [text('stale', { gridCell: 7 })],
    }));

    expect(plan.bodyPlacements.map((placement) => placement.lane)).toEqual(['cell-3']);
  });

  test('a grid is one page: Max pages is ignored and overflow is never carried to another page', () => {
    const plan = createFlowingTablePlan(gridTemplate({
      gridLayout: '2x4',
      gridContentMode: 'individual',
      maxPages: 5,
      components: [table('long', 14, { gridCell: 5 })],
    }));

    expect(plan.pageCount).toBe(1);
    expect(plan.segments.every((segment) => segment.pageIndex === 0 && segment.lane === 'cell-5')).toBe(true);
    // The rows that do not fit are reported, not moved to a second page or
    // into a neighbouring square.
    expect(plan.overflowRowCount).toBeGreaterThan(0);
  });

  test('a grid has no header or footer: every component is planned as body content', () => {
    const plan = createFlowingTablePlan(gridTemplate({
      components: [text('title', { region: 'header', y: 6 }), text('note', { region: 'footer', y: 770 })],
    }));

    expect(plan.plannedBodyComponentIds.has('title')).toBe(true);
    expect(plan.plannedBodyComponentIds.has('note')).toBe(true);
    expect(plan.bodyPlacements.filter((placement) => !placement.isDuplicate).map((placement) => placement.lane))
      .toEqual(['cell-0', 'cell-0']);
  });

  test('Freeform keeps a component where it was put, inside its own square', () => {
    const plan = createFlowingTablePlan(gridTemplate({
      layoutMode: 'freeform',
      gridLayout: '2x2',
      gridContentMode: 'individual',
      components: [
        // Inside square 0 (x 0-306, y 36-396): untouched, and not snapped.
        text('inside', { x: 20.5, y: 101.25, width: 100 }),
        // Asked for a spot outside square 3 (x 306-612, y 396-756): pulled in.
        text('outside', { gridCell: 3, x: 10, y: 10, width: 100 }),
        text('pastEdge', { gridCell: 3, x: 900, y: 900, width: 100 }),
      ],
    }));
    const at = (id: string) => plan.bodyPlacements.find((placement) => placement.componentId === id)!;

    expect([at('inside').x, at('inside').y]).toEqual([20.5, 101.25]);
    expect([at('outside').x, at('outside').y]).toEqual([306, 396]);
    expect(at('pastEdge').x).toBe(612 - 100);
    expect(at('pastEdge').y).toBe(756 - at('pastEdge').height);
  });

  test('Freeform Duplicate All repeats the freely placed square', () => {
    const plan = createFlowingTablePlan(gridTemplate({
      layoutMode: 'freeform',
      gridLayout: '2x2',
      components: [text('a', { x: 40, y: 120, width: 100 }), table('t', 3, { x: 30, y: 200 })],
    }));

    // Tables are placed whole in Freeform: no flowing segments.
    expect(plan.segments).toHaveLength(0);
    expect(plan.bodyPlacements).toHaveLength(2 * 4);
    const copies = plan.bodyPlacements.filter((placement) => placement.componentId === 'a');
    expect(copies.map((placement) => [placement.x, placement.y])).toEqual([
      [40, 120], [346, 120], [40, 480], [346, 480],
    ]);
  });

  test('rows that do not fit the square on any page are reported as overflow', () => {
    const plan = createFlowingTablePlan(gridTemplate({
      gridLayout: '2x4',
      maxPages: 1,
      components: [table('long', 30)],
    }));

    expect(plan.overflowRowCount).toBeGreaterThan(0);
    // Every square shows the same truncated table.
    expect(plan.segments).toHaveLength(8);
    expect(new Set(plan.segments.map((segment) => segment.rows.length)).size).toBe(1);
  });

  test('full and split pages are unaffected by the grid fields', () => {
    const components = [text('a'), text('b')];
    const split = createFlowingTablePlan(gridTemplate({ bodyLayoutMode: 'split', components }));
    const full = createFlowingTablePlan(gridTemplate({ bodyLayoutMode: 'full', components }));

    expect(split.bodyPlacements.map((placement) => placement.lane)).toEqual(['left', 'left']);
    expect(full.bodyPlacements.map((placement) => placement.lane)).toEqual(['full', 'full']);
    expect(split.bodyPlacements[0].y).toBe(36);
  });
});
