// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

/**
 * The exhaustive contrast proof.
 *
 * A theme is two family choices plus a fixed stop map, so the configurable space
 * is finite: 17 chromatic × 9 neutral = 153. This walks all of it. Every theme
 * an operator can produce is therefore verified before anyone produces it —
 * a stronger guarantee than validating each configuration at save time.
 */

import { describe, expect, it } from 'vitest';

import {
  allThemeCombinations,
  auditAllCombinations,
  CHROMATIC_FAMILIES,
} from '../validate';
import { NEUTRAL_FAMILIES } from '../palettes';

describe('the configurable theme space', () => {
  it('is finite and fully enumerated', () => {
    expect(CHROMATIC_FAMILIES).toHaveLength(17);
    expect(NEUTRAL_FAMILIES).toHaveLength(9);
    expect(allThemeCombinations()).toHaveLength(153);
  });

  it('holds its contrast floors in every theme an operator can reach', () => {
    const failing = auditAllCombinations().filter(
      (report) => report.findings.length > 0
    );

    // Report the specific pairings rather than a bare count — a failure here is
    // a stop-map decision to revisit, and the message should say which one.
    const detail = failing
      .slice(0, 12)
      .map(
        (report) =>
          `${report.accentFamily}/${report.neutralFamily}: ` +
          report.findings
            .map(
              (finding) =>
                `${finding.scope} ${finding.foreground} on ${finding.background} ` +
                `${finding.ratio.toFixed(2)}:1 < ${finding.floor}`
            )
            .join('; ')
      )
      .join('\n');

    expect(failing, `\n${detail}\n(${failing.length} of 153 themes failing)`).toEqual([]);
  });

  it('keeps every Carbon chart series legible on every card surface', () => {
    const failing = auditAllCombinations().filter(
      (report) => report.chartFindings.length > 0
    );

    const detail = failing
      .slice(0, 12)
      .map(
        (report) =>
          `${report.accentFamily}/${report.neutralFamily}: ` +
          report.chartFindings
            .map(
              (finding) =>
                `${finding.scope} ${finding.foreground} ${finding.ratio.toFixed(2)}:1`
            )
            .join('; ')
      )
      .join('\n');

    expect(failing, `\n${detail}\n(${failing.length} of 153 themes failing)`).toEqual([]);
  });
});
