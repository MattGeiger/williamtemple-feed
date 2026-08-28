// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// TEMPORARY. Generates the A/B comparison sheet for evaluating a move of the
// built-in appearance onto Tailwind v4 palette references. Delete this script
// and src/styles/tailwind-ab.css once the comparison is decided.
//
//   npx ts-node --transpile-only scripts/generate-tailwind-ab.ts

import { readFileSync, writeFileSync } from 'node:fs';
import {
  hexToOklch,
  hueDifference,
  perceptualDistance,
  type Oklch,
} from '../src/services/brand-theme/color';
import { TAILWIND_EXTREMES, TAILWIND_PALETTE } from '../src/services/brand-theme/palettes';

const css = readFileSync('../frontend/src/index.css', 'utf8');

/** Other companies' brand colours. Never re-expressed in our palette. */
const EXCLUDE = /^service-/;

/**
 * Matching runs across the *whole* palette rather than splitting neutral from
 * chromatic the way derivation does: that split is right when choosing a family
 * for a role, and wrong when matching an existing colour.
 *
 * Plain OKLab distance is not enough on its own. At extreme lightness — a very
 * pale tint or a very dark one — chroma collapses toward zero, so hue barely
 * moves the distance and the nearest entry is frequently the wrong hue
 * entirely: the pale teal `--muted` landed on a grey `mist-100`, and a dark
 * amber `--status-warning-bg` landed on a green `olive-900`.
 *
 * So hue is penalised in proportion to how much colour the source actually has,
 * and losing saturation is penalised directly. A genuinely achromatic source is
 * unaffected by either term — pure black still matches `black` exactly — while a
 * source that carries a hue is kept near it.
 */
const HUE_WEIGHT = 4;
const CHROMA_LOSS_WEIGHT = 2;
const POOL = [...TAILWIND_PALETTE, ...TAILWIND_EXTREMES];

/** Hand-picked choices that override the automatic match. */
const OVERRIDES: Record<string, string> = require('./tailwind-ab-overrides.json');

const selectionScore = (source: Oklch, target: Oklch): number => {
  const base = perceptualDistance(source, target);
  const hueError = Math.abs(hueDifference(source.h, target.h)) / 180;
  const huePenalty = hueError * source.c * HUE_WEIGHT;
  const chromaLoss = Math.max(0, source.c - target.c) * CHROMA_LOSS_WEIGHT;
  return base + huePenalty + chromaLoss;
};

const hslToOklch = (h: number, s: number, l: number): Oklch => {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const [r, g, b] = ([[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]] as const)[seg];
  return hexToOklch('#' + [r+m, g+m, b+m].map(v => Math.round(v*255).toString(16).padStart(2,'0')).join(''));
};

const nameOf = (e: { family: string; stop: number }) =>
  e.stop === 0 ? e.family : `${e.family}-${e.stop}`;

const snapTo = (col: Oklch, key: string) => {
  const ranked = POOL
    .map(e => ({ e, s: selectionScore(col, { l: e.l, c: e.c, h: e.h }) }))
    .sort((a, b) => a.s - b.s);

  const override = OVERRIDES[key];
  const chosen = override
    ? ranked.find(r => nameOf(r.e) === override)
    : ranked[0];
  if (override && !chosen) {
    throw new Error(`Override "${override}" for ${key} is not a Tailwind palette entry.`);
  }

  const e = chosen!.e;
  // Report the plain perceptual distance: the penalties are a selection
  // preference, not what an eye sees.
  const visible = perceptualDistance(col, { l: e.l, c: e.c, h: e.h });
  // Nearby alternates, so a hand override can be chosen by reading the output.
  const alternates = ranked
    .filter(r => nameOf(r.e) !== nameOf(e))
    .slice(0, 3)
    .map(r => `${nameOf(r.e)} ${perceptualDistance(col, { l: r.e.l, c: r.e.c, h: r.e.h }).toFixed(3)}`);

  return { ref: `var(--color-${nameOf(e)})`, d: visible, name: nameOf(e), alternates, overridden: Boolean(override) };
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
    let note = '';
    let index = 0;
    const next = value.replace(COLOR, (lit) => {
      const key = `${scope} --${name}${index > 0 ? `#${index}` : ''}`;
      index += 1;
      let col: Oklch | null = null;
      let alpha = '';
      let m = lit.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/);
      if (m) { col = { l:+m[1], c:+m[2], h:+m[3] }; alpha = m[4] ?? ''; }
      else {
        m = lit.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/\s*([\d.]+)\s*)?\)$/);
        if (m) { col = hslToOklch(+m[1], +m[2], +m[3]); alpha = m[4] ?? ''; }
      }
      if (!col) return lit;
      const s = snapTo(col, key);
      if (s.d > maxD) { maxD = s.d; to = s.name; }
      if (!note) {
        note = s.overridden
          ? `hand-picked ${s.name}`
          : `${s.d.toFixed(3)} · alt: ${s.alternates.join(', ')}`;
      }
      // Alpha is preserved by mixing the palette reference toward transparent.
      return alpha
        ? `color-mix(in oklch, ${s.ref} ${(parseFloat(alpha) * 100).toFixed(1)}%, transparent)`
        : s.ref;
    });
    lines.push(`  --${name}: ${next};${note ? ` /* ${note} */` : ''}`);
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
console.log(`hand overrides   : ${Object.keys(OVERRIDES).length}`);
console.log(`drift > 0.05     : ${drifts.filter(d => d.d > 0.05).length}`);
console.log('\nlargest drifts:');
drifts.slice(0, 8).forEach(d => console.log(`  ${d.d.toFixed(4)}  ${d.scope} --${d.token} -> ${d.to}`));
