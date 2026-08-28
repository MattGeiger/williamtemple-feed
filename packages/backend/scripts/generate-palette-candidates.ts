// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// Generates the candidate slate the palette calibration panel reads.
//
// It began as an A/B generator, emitting a whole alternative stylesheet so the
// migrated appearance could be compared against the authored one. That
// comparison is settled -- index.css now holds the palette references -- so the
// stylesheet is gone and only the candidates remain, which is what calibration
// actually needs.
//
// Values in index.css are now `var(--color-*)` references rather than literals,
// so resolving a reference back to its colour is the normal path, not an edge
// case: without it this reads 69 of 204 tokens and silently loses the rest.
//
//   npx ts-node --transpile-only scripts/generate-palette-candidates.ts

import { readFileSync, writeFileSync } from 'node:fs';
import {
  hexToOklch,
  hueDifference,
  oklchToHex,
  perceptualDistance,
  type Oklch,
} from '../src/services/brand-theme/color';
import { TAILWIND_EXTREMES, TAILWIND_PALETTE } from '../src/services/brand-theme/palettes';
import { isProtectedToken } from '../src/services/brand-theme/tokens';

const css = readFileSync('../frontend/src/index.css', 'utf8');

/** Other companies' brand colours. Never re-expressed in our palette. */
const EXCLUDE = /^service-/;

/**
 * Tokens this migration must not touch, and why each is skipped.
 *
 * The four inventory status flags were previously excluded only because the
 * token pattern could not match camelCase and the colour pattern could not
 * match comma-separated hsl(). That is protection by accident: fixing either
 * regex — as this change does — would have started converting protected
 * operational semiotics silently. The exclusion is now stated.
 */
const skipReason = (name: string): string | null => {
  if (EXCLUDE.test(name)) return 'third-party brand colour';
  if (isProtectedToken(name)) return 'protected operational semiotic';
  return null;
};

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

  // Wider slate for the calibration panel, auto-pick first then nearest by eye.
  const autoName = nameOf(ranked[0].e);
  const candidates = [
    ranked[0],
    ...ranked.slice(1).sort((a, b) =>
      perceptualDistance(col, { l: a.e.l, c: a.e.c, h: a.e.h }) -
      perceptualDistance(col, { l: b.e.l, c: b.e.c, h: b.e.h })),
  ]
    .filter((r, i, arr) => arr.findIndex(x => nameOf(x.e) === nameOf(r.e)) === i)
    .slice(0, 8)
    .map(r => ({
      name: nameOf(r.e),
      hex: oklchToHex({ l: r.e.l, c: r.e.c, h: r.e.h }),
      drift: Number(perceptualDistance(col, { l: r.e.l, c: r.e.c, h: r.e.h }).toFixed(4)),
      auto: nameOf(r.e) === autoName,
    }));

  return {
    ref: `var(--color-${nameOf(e)})`, d: visible, name: nameOf(e), alternates,
    overridden: Boolean(override), candidates, authoredHex: oklchToHex(col),
  };
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
    // Token names are not all kebab-case: --color-inStock, --color-outOfStock
    // and --color-categoryLabel are camelCase, and a [a-z0-9-]+ pattern skipped
    // them silently — including two of the four protected status flags.
    const m = line.match(/^\s*--([A-Za-z0-9-]+):\s*(.+?);\s*$/);
    if (m && !seen.has(m[1])) { seen.add(m[1]); out.push([m[1], m[2].trim()]); }
  }
  return out;
};

// Both CSS colour syntaxes appear in index.css: modern space-separated and the
// older comma-separated form. Matching only the former skipped six tokens
// without reporting anything, which is the worst way for a migration to be
// incomplete.
const PALETTE_REF = /var\(--color-([A-Za-z0-9-]+)\)/g;

const COLOR = /(var\(--color-[A-Za-z0-9-]+\)|oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+\s*(?:\/\s*[\d.]+\s*)?\)|hsl\(\s*[\d.]+\s*[, ]\s*[\d.]+%\s*[, ]\s*[\d.]+%\s*(?:\/\s*[\d.]+\s*)?\))/g;

const drifts: Array<{ token: string; scope: string; d: number; to: string }> = [];

type CalibrationRow = {
  key: string;
  scope: 'light' | 'dark';
  token: string;
  alpha: number | null;
  authoredHex: string;
  chosen: string;
  overridden: boolean;
  candidates: Array<{ name: string; hex: string; drift: number; auto: boolean }>;
};
const calibration: CalibrationRow[] = [];
/** Reported at the end, so nothing is left behind quietly. */
const skipped: string[] = [];

const convert = (scope: 'light' | 'dark') => {
  const lines: string[] = [];
  for (const [name, value] of block(scope)) {
    const skip = skipReason(name);
    if (skip) { skipped.push(`${scope} --${name} (${skip})`); continue; }
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
      const ref = lit.match(/^var\(--color-([A-Za-z0-9-]+)\)$/);
      if (ref) {
        const entry = [...TAILWIND_PALETTE, ...TAILWIND_EXTREMES]
          .find(e => (e.stop === 0 ? e.family : `${e.family}-${e.stop}`) === ref[1]);
        if (entry) { col = { l: entry.l, c: entry.c, h: entry.h }; alpha = ''; }
      }
      let m = col ? null : lit.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/);
      // Tailwind writes lightness as a percentage; index.css writes 0..1.
      if (m) { col = { l: m[2] ? +m[1] / 100 : +m[1], c:+m[3], h:+m[4] }; alpha = m[5] ?? ''; }
      else if (!col) {
        m = lit.match(/^hsl\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*(?:\/\s*([\d.]+)\s*)?\)$/);
        if (m) { col = hslToOklch(+m[1], +m[2], +m[3]); alpha = m[4] ?? ''; }
      }
      if (!col) return lit;
      const s = snapTo(col, key);
      calibration.push({
        key,
        scope,
        token: name,
        alpha: alpha ? Number(alpha) : null,
        authoredHex: s.authoredHex,
        chosen: s.name,
        overridden: s.overridden,
        candidates: s.candidates,
      });
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

convert('light');
convert('dark');

// The complete palette, so the calibration panel can validate a hand-typed
// entry and preview it without guessing which names exist.
const palette = POOL
  .map(e => ({ name: nameOf(e), hex: oklchToHex({ l: e.l, c: e.c, h: e.h }) }))
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(
  '../frontend/src/styles/tailwind-ab-candidates.json',
  JSON.stringify(
    { generatedAt: new Date().toISOString(), overrides: OVERRIDES, palette, rows: calibration },
    null,
    2,
  ),
  'utf8',
);

drifts.sort((a, b) => b.d - a.d);
console.log(`tokens converted : ${drifts.length}`);
console.log(`deliberately skipped: ${skipped.length}`);
for (const entry of skipped) console.log(`  ${entry}`);
console.log(`hand overrides   : ${Object.keys(OVERRIDES).length}`);
console.log(`drift > 0.05     : ${drifts.filter(d => d.d > 0.05).length}`);
console.log('\nlargest drifts:');
drifts.slice(0, 8).forEach(d => console.log(`  ${d.d.toFixed(4)}  ${d.scope} --${d.token} -> ${d.to}`));
