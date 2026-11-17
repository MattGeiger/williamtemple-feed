// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { describe, expect, it } from 'vitest';
import {
  createFlowingTablePlan,
  getGridOverflowNames,
} from '@/components/shopping-lists/builder/ShoppingListBuilder';
import {
  BuilderComponent,
  getBodyLaneHalf,
  getComponentGridCell,
  getTemplateBodyLaneBounds,
  getTemplateBodyLaneChains,
  getTemplateCutMarkLines,
  getTemplateEffectiveMaxPages,
  getTemplateGridCellCount,
  getTemplateGridCellRect,
  getTemplateGridRowBounds,
  getTemplateShowCutMarks,
  gridCellIndexOfLane,
  gridCellLane,
  ShoppingListBuilderTemplate,
} from '@/components/shopping-lists/builder/types';

// Grid page layout. The backend mirror of this planner is pinned by
// packages/backend/__tests__/features/shopping-lists/builder-grid-layout.test.ts;
// the two files assert the same numbers on purpose, so a change to one side
// that is not mirrored fails here or there.

const text = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'text',
  name: id,
  x: 18,
  y: 60,
  width: 270,
  height: 18,
  region: 'body',
  content: id,
  fontSize: 10,
  fontWeight: 'normal',
  align: 'left',
  lineHeight: 1.2,
  ...extra,
}) as unknown as BuilderComponent;

const table = (id: string, rowCount: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'section-table',
  name: id,
  title: id,
  x: 18,
  y: 60,
  width: 270,
  height: 0,
  region: 'body',
  flowMode: 'flowing',
  showLimit: true,
  limitWidth: 51,
  wantWidth: 57,
  rowHeight: 15,
  fontSize: 10,
  alternateRows: false,
  rows: Array.from({ length: rowCount }, (_, index) => ({ id: `${id}-${index}`, item: `Item ${index}`, limit: '1' })),
  ...extra,
}) as unknown as BuilderComponent;

const gridTemplate = (overrides: Partial<ShoppingListBuilderTemplate> = {}): ShoppingListBuilderTemplate => ({
  id: 'grid-test',
  name: 'Grid test',
  paper: { size: 'letter', width: 612, height: 792, unit: 'pt' },
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
} as ShoppingListBuilderTemplate);

describe('grid geometry', () => {
  it('counts 4, 6 and 8 squares', () => {
    expect(getTemplateGridCellCount(gridTemplate({ gridLayout: '2x2' }))).toBe(4);
    expect(getTemplateGridCellCount(gridTemplate({ gridLayout: '2x3' }))).toBe(6);
    expect(getTemplateGridCellCount(gridTemplate({ gridLayout: '2x4' }))).toBe(8);
  });

  it('names squares as lanes, row-major, and maps them to a page half', () => {
    const template = gridTemplate({ gridLayout: '2x3' });
    expect(gridCellLane(4)).toBe('cell-4');
    expect(gridCellIndexOfLane('cell-4')).toBe(4);
    expect(gridCellIndexOfLane('left')).toBeNull();
    expect(getBodyLaneHalf(template, 'cell-0')).toBe('left');
    expect(getBodyLaneHalf(template, 'cell-1')).toBe('right');
    expect(getBodyLaneHalf(template, 'cell-4')).toBe('left');
    expect(getBodyLaneHalf(gridTemplate({ bodyLayoutMode: 'full' }), 'cell-1')).toBeNull();
  });

  it('divides the body into equal rows on the placement grid', () => {
    const template = gridTemplate({ gridLayout: '2x4' });
    // Body is 792 - 36 - 36 = 720pt: four rows of 180pt.
    expect(getTemplateGridRowBounds(template, 0)).toMatchObject({ top: 36, bottom: 216 });
    expect(getTemplateGridRowBounds(template, 3)).toMatchObject({ top: 576, bottom: 756 });
    expect(getTemplateGridCellRect(template, 7)).toEqual({ left: 306, right: 612, top: 576, bottom: 756 });
  });

  it('gives the remainder to the last row when the body does not divide evenly', () => {
    const template = gridTemplate({ gridLayout: '2x4', headerHeight: 54 });
    // Body is 702pt; 702 / 4 = 175.5 snaps down to 174, last row takes the rest.
    expect(getTemplateGridRowBounds(template, 0).bottom - getTemplateGridRowBounds(template, 0).top).toBe(174);
    expect(getTemplateGridRowBounds(template, 3).bottom).toBe(756);
  });

  it('insets a square\'s content by half the column gap, top and bottom', () => {
    const bounds = getTemplateBodyLaneBounds(gridTemplate({ gridLayout: '2x2' }), 'cell-3');
    expect(bounds).toMatchObject({ left: 315, right: 612, top: 396 + 9, bottom: 756 - 9 });
  });

  it('clamps a stale gridCell and ignores it in Duplicate All', () => {
    expect(getComponentGridCell({ gridCell: 7 }, gridTemplate({ gridContentMode: 'individual' }))).toBe(3);
    expect(getComponentGridCell({ gridCell: 2 }, gridTemplate({ gridContentMode: 'duplicate' }))).toBe(0);
    expect(getComponentGridCell({}, gridTemplate({ gridContentMode: 'individual' }))).toBe(0);
  });

  it('is always one page, whatever Max pages says', () => {
    const template = gridTemplate({ maxPages: 5, gridContentMode: 'individual' });
    expect(getTemplateEffectiveMaxPages(template)).toBe(1);
    expect(getTemplateBodyLaneChains(template).every((chain) => chain.length === 1)).toBe(true);
    expect(getTemplateBodyLaneChains(template)).toHaveLength(4);
    expect(getTemplateBodyLaneChains(gridTemplate({ maxPages: 5 }))).toHaveLength(1);
    expect(getTemplateEffectiveMaxPages(gridTemplate({ bodyLayoutMode: 'split', maxPages: 3 }))).toBe(3);
  });
});

describe('cut marks', () => {
  it('are on by default for Split and Grid and never apply to Full', () => {
    expect(getTemplateShowCutMarks(gridTemplate())).toBe(true);
    expect(getTemplateShowCutMarks(gridTemplate({ bodyLayoutMode: 'split' }))).toBe(true);
    expect(getTemplateShowCutMarks(gridTemplate({ bodyLayoutMode: 'full' }))).toBe(false);
    expect(getTemplateShowCutMarks(gridTemplate({ showCutMarks: false }))).toBe(false);
    expect(getTemplateCutMarkLines(gridTemplate({ showCutMarks: false }))).toEqual([]);
  });

  it('run through the body on a Split page', () => {
    expect(getTemplateCutMarkLines(gridTemplate({ bodyLayoutMode: 'split' }))).toEqual([
      { x1: 306, y1: 36, x2: 306, y2: 756 },
    ]);
  });

  it('run edge to edge on every square boundary of a Grid page', () => {
    expect(getTemplateCutMarkLines(gridTemplate({ gridLayout: '2x3' }))).toEqual([
      { x1: 306, y1: 0, x2: 306, y2: 792 },
      { x1: 0, y1: 276, x2: 612, y2: 276 },
      { x1: 0, y1: 516, x2: 612, y2: 516 },
    ]);
  });
});

describe('grid planner', () => {
  it('Duplicate All repeats the first square in every square', () => {
    const plan = createFlowingTablePlan(gridTemplate({ gridLayout: '2x4', components: [text('a'), text('b')] }));
    expect(plan.bodyPlacements).toHaveLength(2 * 8);
    expect(plan.bodyPlacements.filter((placement) => !placement.isDuplicate)).toHaveLength(2);
    const byLane = Object.fromEntries(
      plan.bodyPlacements.filter((placement) => placement.componentId === 'a').map((placement) => [placement.lane, placement]),
    );
    expect(byLane['cell-1'].x - byLane['cell-0'].x).toBe(306);
    expect(byLane['cell-2'].y - byLane['cell-0'].y).toBe(180);
    expect(byLane['cell-0'].y).toBe(36 + 9);
  });

  it('Individual places each component in its own square and never copies', () => {
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
  });

  it('plans header and footer components as body content', () => {
    const plan = createFlowingTablePlan(gridTemplate({
      components: [text('title', { region: 'header', y: 6 }), text('note', { region: 'footer', y: 770 })],
    }));
    expect(plan.plannedBodyComponentIds.has('title')).toBe(true);
    expect(plan.plannedBodyComponentIds.has('note')).toBe(true);
  });

  it('Freeform keeps a component where it was put, inside its own square', () => {
    const plan = createFlowingTablePlan(gridTemplate({
      layoutMode: 'freeform',
      gridContentMode: 'individual',
      components: [
        text('inside', { x: 20.5, y: 101.25, width: 100 }),
        text('outside', { gridCell: 3, x: 10, y: 10, width: 100 }),
      ],
    }));
    const at = (id: string) => plan.bodyPlacements.find((placement) => placement.componentId === id)!;
    expect([at('inside').x, at('inside').y]).toEqual([20.5, 101.25]);
    expect([at('outside').x, at('outside').y]).toEqual([306, 396]);
  });

  it('leaves Full and Split pages as they were', () => {
    const components = [text('a'), text('b')];
    const split = createFlowingTablePlan(gridTemplate({ bodyLayoutMode: 'split', components }));
    const full = createFlowingTablePlan(gridTemplate({ bodyLayoutMode: 'full', components }));
    expect(split.bodyPlacements.map((placement) => placement.lane)).toEqual(['left', 'left']);
    expect(full.bodyPlacements.map((placement) => placement.lane)).toEqual(['full', 'full']);
    expect(split.bodyPlacements[0].y).toBe(36);
  });
});

describe('grid overflow detection', () => {
  const overflowOf = (template: ShoppingListBuilderTemplate) => (
    getGridOverflowNames(template, createFlowingTablePlan(template))
  );

  it('reports nothing when everything fits', () => {
    expect(overflowOf(gridTemplate({ components: [text('a'), table('t', 3)] }))).toEqual([]);
  });

  it('names a table with more rows than its square can hold', () => {
    expect(overflowOf(gridTemplate({ gridLayout: '2x4', components: [table('long', 30)] }))).toEqual(['long']);
  });

  it('names the component that no longer fits once the square is full', () => {
    const components = Array.from({ length: 12 }, (_, index) => text(`t${index}`));
    // A 2x4 square has 180 - 18 = 162pt of content height; 18pt blocks with a
    // 9pt gap fit six, so the rest overflow.
    const names = overflowOf(gridTemplate({ gridLayout: '2x4', components }));
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('t0');
    expect(names).toContain('t11');
  });

  it('names a component wider than a square', () => {
    expect(overflowOf(gridTemplate({ components: [text('wide', { width: 400 })] }))).toEqual(['wide']);
  });

  it('judges Freeform against the whole square', () => {
    const template = gridTemplate({ layoutMode: 'freeform', gridLayout: '2x4', components: [table('long', 30)] });
    expect(overflowOf(template)).toEqual(['long']);
    expect(overflowOf(gridTemplate({ layoutMode: 'freeform', components: [text('a', { x: 500, y: 700 })] }))).toEqual([]);
  });

  it('never applies outside a grid', () => {
    expect(overflowOf(gridTemplate({ bodyLayoutMode: 'split', components: [table('long', 300)] }))).toEqual([]);
  });
});
