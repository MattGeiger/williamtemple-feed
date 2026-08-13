// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { describe, expect, test } from 'vitest';
import { selectCurrentServiceRevisionIds } from '../../../src/services/service';

describe('Service import rollback and restore projection', () => {
  test('selects the newest active candidate in each source-scoped identity', () => {
    expect(selectCurrentServiceRevisionIds([
      { id: 1, source: 'link2feed', key: 'visit:1', revision: 1 },
      { id: 2, source: 'link2feed', key: 'visit:1', revision: 2 },
      { id: 3, source: 'link2feed', key: 'visit:2', revision: 1 },
      { id: 4, source: 'simc', key: 'visit:1', revision: 1 },
    ])).toEqual([2, 3, 4]);
  });

  test('never merges identical record keys across formal source namespaces', () => {
    const winners = selectCurrentServiceRevisionIds([
      { id: 10, source: 'link2feed', key: '123', revision: 2 },
      { id: 11, source: 'simc', key: '123', revision: 1 },
    ]);
    expect(winners).toEqual([10, 11]);
  });
});
