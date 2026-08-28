// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// Rewrites the built-in appearance's colour literals in
// packages/frontend/src/index.css as Tailwind v4 palette references, using the
// exact values the A/B sheet was reviewed with.
//
// Only the :root and .dark blocks are touched. The print blocks are left alone
// on purpose: printed output must not follow the app theme, so its colours are
// not part of the brand vocabulary. Tokens the generator reports as skipped --
// protected operational semiotics and third-party brand colours -- keep their
// authored values.
//
//   npx ts-node --transpile-only scripts/apply-tailwind-tokens.ts [--dry-run]

import { readFileSync, writeFileSync } from 'node:fs';

const CSS = '../frontend/src/index.css';
const AB = '../frontend/src/styles/tailwind-ab.css';
const dryRun = process.argv.includes('--dry-run');

/** Converted declarations from the reviewed A/B sheet, per scope. */
const converted = (): Record<'light' | 'dark', Map<string, string>> => {
  const out = { light: new Map<string, string>(), dark: new Map<string, string>() };
  let scope: 'light' | 'dark' | null = null;
  for (const line of readFileSync(AB, 'utf8').split('\n')) {
    if (line.includes('data-palette="tailwind"].dark {')) { scope = 'dark'; continue; }
    if (line.includes('data-palette="tailwind"] {')) { scope = 'light'; continue; }
    if (line.startsWith('}')) { scope = null; continue; }
    if (!scope) continue;
    const m = line.match(/^\s*--([A-Za-z0-9-]+):\s*(.+?);(?:\s*\/\*.*)?$/);
    if (m && !out[scope].has(m[1])) out[scope].set(m[1], m[2].trim());
  }
  return out;
};

const table = converted();
const lines = readFileSync(CSS, 'utf8').split('\n');
let scope: 'light' | 'dark' | null = null;
let applied = 0;
const changes: string[] = [];

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  const open = line.match(/^  (:root|\.dark)[^{]*\{/);
  if (open) { scope = open[1] === ':root' ? 'light' : 'dark'; continue; }
  if (scope && /^  \}/.test(line)) { scope = null; continue; }
  if (!scope) continue;

  const d = line.match(/^(\s*)--([A-Za-z0-9-]+):\s*(.+?);(\s*)$/);
  if (!d) continue;
  const replacement = table[scope].get(d[2]);
  if (!replacement || replacement === d[3]) continue;

  lines[i] = `${d[1]}--${d[2]}: ${replacement};${d[4]}`;
  applied += 1;
  if (changes.length < 6) changes.push(`  ${scope} --${d[2]}\n      ${d[3]}\n   -> ${replacement}`);
}

console.log(`${dryRun ? 'Would rewrite' : 'Rewrote'} ${applied} declarations.`);
for (const c of changes) console.log(c);
if (applied > 0 && changes.length === 6) console.log('  …');
if (!dryRun) writeFileSync(CSS, lines.join('\n'), 'utf8');
