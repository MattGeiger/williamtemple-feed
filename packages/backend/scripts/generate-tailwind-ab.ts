// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// TEMPORARY. Generates the A/B comparison sheet for evaluating a move of the
// built-in appearance onto Tailwind v4 palette references. Delete this script
// and src/styles/tailwind-ab.css once the comparison is decided.
//
//   npx ts-node --transpile-only scripts/generate-tailwind-ab.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { hexToOklch, perceptualDistance, type Oklch } from '../src/services/brand-theme/color';
import { TAILWIND_EXTREMES, TAILWIND_PALETTE } from '../src/services/brand-theme/palettes';

const css = readFileSync('../frontend/src/index.css', 'utf8');

/** Other companies' brand colours. Never re-expressed in our palette. */
const EXCLUDE = /^service-/;

/**
 * Chroma weight for matching. Migration snaps across the *whole* palette rather
 * than splitting neutral from chromatic the way derivation does: that split is
 * right when choosing a family for a role, and wrong when matching an existing
 * colour, because a pale tint has low chroma and was landing on a neutral —
 * turning the pale-green success background grey. Weighting chroma keeps a
 * hue-carrying source on a hue-carrying target.
 */
const CHROMA_WEIGHT = 3;
const POOL = [...TAILWIND_PALETTE, ...TAILWIND_EXTREMES];

const hslToOklch = (h: number, s: number, l: number): Oklch => {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const [r, g, b] = ([[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]] as const)[seg];
  return hexToOklch('#' + [r+m, g+m, b+m].map(v => Math.round(v*255).toString(16).padStart(2,'0')).join(''));
};

const snapTo = (col: Oklch) => {
  const best = POOL
    .map(e => ({ e, d: perceptualDistance(col, { l: e.l, c: e.c, h: e.h }, CHROMA_WEIGHT) }))
    .sort((a, b) => a.d - b.d)[0];
  const name = best.e.stop === 0 ? best.e.family : `${best.e.family}-${best.e.stop}`;
  // Select with the weighted metric, report the plain perceptual distance —
  // the weight is a selection preference, not what an eye sees.
  const visible = perceptualDistance(col, { l: best.e.l, c: best.e.c, h: best.e.h });
  return { ref: `var(--color-${name})`, d: visible, name };
};

const block = (scope: 'light' | 'dark') => {
  const pat = scope === 'light' ? /^  :root \{/ : /^  \.dark \{/;
  const out: Array<[string, string]> = [];
  const seen = new Set<string>();
  let f = false;
  for (const line of css.split('\n')) {
    if (pat.test(line)) { f = true; continue; }
    if (f && /^  \}/.test(line)) break;
    if (!f) continue;
    const m = line.match(/^\s*--([a-z0-9-]+):\s*(.+?);\s*$/);
    if (m && !seen.has(m[1])) { seen.add(m[1]); out.push([m[1], m[2].trim()]); }
  }
  return out;
};

const COLOR = /(oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*(?:\/\s*[\d.]+\s*)?\)|hsl\(\s*[\d.]+\s+[\d.]+%\s+[\d.]+%\s*(?:\/\s*[\d.]+\s*)?\))/g;

const drifts: Array<{ token: string; scope: string; d: number; to: string }> = [];

const convert = (scope: 'light' | 'dark') => {
  const lines: string[] = [];
  for (const [name, value] of block(scope)) {
    if (EXCLUDE.test(name)) continue;
    COLOR.lastIndex = 0;
    if (!COLOR.test(value)) continue;
    COLOR.lastIndex = 0;
    let maxD = 0, to = '';
    const next = value.replace(COLOR, (lit) => {
      let col: Oklch | null = null;
      let alpha = '';
      let m = lit.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/);
      if (m) { col = { l:+m[1], c:+m[2], h:+m[3] }; alpha = m[4] ?? ''; }
      else {
        m = lit.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/\s*([\d.]+)\s*)?\)$/);
        if (m) { col = hslToOklch(+m[1], +m[2], +m[3]); alpha = m[4] ?? ''; }
      }
      if (!col) return lit;
      const s = snapTo(col);
      if (s.d > maxD) { maxD = s.d; to = s.name; }
      // Alpha is preserved by mixing the palette reference toward transparent.
      return alpha
        ? `color-mix(in oklch, ${s.ref} ${(parseFloat(alpha) * 100).toFixed(1)}%, transparent)`
        : s.ref;
    });
    lines.push(`  --${name}: ${next};`);
    drifts.push({ token: name, scope, d: maxD, to });
  }
  return lines.join('\n');
};

const light = convert('light');
const dark = convert('dark');

writeFileSync('../frontend/src/styles/tailwind-ab.css', `/* GENERATED — temporary A/B sheet, not part of the appearance.
   Every colour literal in the built-in appearance snapped to its nearest
   Tailwind v4 palette entry. Alpha is preserved with color-mix; gradient and
   shadow geometry is untouched; third-party --service-* colours are excluded.
   Regenerate: packages/backend $ npx ts-node --transpile-only scripts/generate-tailwind-ab.ts */

html[data-palette="tailwind"] {
${light}
}

html[data-palette="tailwind"].dark {
${dark}
}
`, 'utf8');

drifts.sort((a, b) => b.d - a.d);
console.log(`tokens converted : ${drifts.length}`);
console.log(`drift > 0.05     : ${drifts.filter(d => d.d > 0.05).length}`);
console.log('\nlargest drifts:');
drifts.slice(0, 8).forEach(d => console.log(`  ${d.d.toFixed(4)}  ${d.scope} --${d.token} -> ${d.to}`));
