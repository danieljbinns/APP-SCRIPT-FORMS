#!/usr/bin/env node
/**
 * list-functions.js
 * Lists every function defined across all .js files in a GAS project folder.
 * Sorted alphabetically by function name. Duplicates shown with all files.
 *
 * Usage:
 *   node tools/list-functions.js ./employee_management_v2_dev
 *   node tools/list-functions.js ./employee_management_v2_dev --dupes-only
 */

const fs   = require('fs');
const path = require('path');

const targetDir  = process.argv[2];
const dupesOnly  = process.argv.includes('--dupes-only');

if (!targetDir) {
  console.error('Usage: node list-functions.js <path-to-gas-folder> [--dupes-only]');
  process.exit(1);
}

const absTarget = path.resolve(targetDir);
if (!fs.existsSync(absTarget)) {
  console.error('Directory not found: ' + absTarget);
  process.exit(1);
}

// ── Collect all .js files (recursive) ────────────────────────────────────────
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const jsFiles = walk(absTarget);

// ── Extract function declarations ─────────────────────────────────────────────
// Matches top-level: function name(  and  async function name(
const FN_RE = /^(?:async\s+)?function\s+(\w+)\s*\(/gm;

// fnMap: name → [relPath, relPath, ...]
const fnMap = {};

for (const f of jsFiles) {
  const src  = fs.readFileSync(f, 'utf8');
  const rel  = path.relative(absTarget, f);
  let m;
  while ((m = FN_RE.exec(src)) !== null) {
    const name = m[1];
    if (!fnMap[name]) fnMap[name] = [];
    fnMap[name].push(rel);
  }
}

// ── Output ────────────────────────────────────────────────────────────────────
const entries = Object.entries(fnMap)
  .filter(([, files]) => !dupesOnly || files.length > 1)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

const totalFns   = Object.keys(fnMap).length;
const totalDupes = Object.values(fnMap).filter(f => f.length > 1).length;

console.log(`\nTarget : ${absTarget}`);
console.log(`JS files: ${jsFiles.length}   Functions: ${totalFns}   Duplicates: ${totalDupes}`);
if (dupesOnly) console.log('(showing duplicates only)\n');
else           console.log('');

// Column widths
const maxName = Math.min(40, Math.max(...entries.map(([n]) => n.length)));
const header  = 'Function'.padEnd(maxName + 2) + 'File(s)';
console.log(header);
console.log('─'.repeat(header.length + 20));

for (const [name, files] of entries) {
  const isDupe = files.length > 1;
  const tag    = isDupe ? ' ⚠ DUPE' : '';
  console.log(name.padEnd(maxName + 2) + files[0] + tag);
  for (let i = 1; i < files.length; i++) {
    console.log(' '.repeat(maxName + 2) + files[i] + tag);
  }
}

console.log('');
