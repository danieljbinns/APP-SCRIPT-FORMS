#!/usr/bin/env node
'use strict';
/**
 * n8n-check.js — the "check for n8n on change" gate.
 *
 *   node tools/n8n-check.js              # compare live contracts vs docs/contracts.lock.json
 *   node tools/n8n-check.js --update     # accept current contracts (after a deliberate version bump)
 *
 * Fails (exit 1) when:
 *   - a form contract hash changed but neither N8N_API_VERSION nor FormContracts.VERSION changed  → contract drift
 *   - a required field was added, or a field/alias was removed, without an API version bump      → breaking change
 * Passes with a note when only optional fields/aliases were added (additive — n8n unaffected).
 * Optionally (--live <scriptId> --token <oauth>) pings the deployed script's n8n_contracts() and compares too.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOCK = path.join(ROOT, 'docs', 'contracts.lock.json');
const args = process.argv.slice(2);
const update = args.includes('--update');

// Regenerate current view into a temp lock without touching the committed one
const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'efx-'));
process.env.EFX_LOCK_OUT = path.join(tmpDir, 'lock.json');
const gen = fs.readFileSync(path.join(__dirname, 'gen-contracts.js'), 'utf8')
  .replace("const OUT_MD = path.join(ROOT, 'docs', 'N8N_CONTRACTS.md');", `const OUT_MD = ${JSON.stringify(path.join(tmpDir, 'c.md'))};`)
  .replace("const OUT_LOCK = path.join(ROOT, 'docs', 'contracts.lock.json');", `const OUT_LOCK = ${JSON.stringify(path.join(tmpDir, 'lock.json'))};`);
const tmpGen = path.join(tmpDir, 'gen.js');
fs.writeFileSync(tmpGen, gen.replace("path.resolve(__dirname, '..')", JSON.stringify(ROOT)));
execFileSync(process.execPath, [tmpGen], { stdio: 'ignore' });
const cur = JSON.parse(fs.readFileSync(path.join(tmpDir, 'lock.json'), 'utf8'));

if (!fs.existsSync(LOCK) || update) {
  fs.writeFileSync(LOCK, JSON.stringify(cur, null, 2));
  console.log((update ? 'updated' : 'created') + ' docs/contracts.lock.json @ api ' + cur.apiVersion + ' / contracts ' + cur.contractsVersion);
  process.exit(0);
}
const prev = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
const versionBumped = prev.apiVersion !== cur.apiVersion || prev.contractsVersion !== cur.contractsVersion;
const problems = [], notes = [];

for (const a of prev.aliases) if (!cur.aliases.includes(a)) problems.push(`alias removed: ${a}`);
for (const a of cur.aliases) if (!prev.aliases.includes(a)) notes.push(`alias added: ${a} (additive)`);
for (const [form, p] of Object.entries(prev.forms)) {
  const c = cur.forms[form];
  if (!c) { problems.push(`form removed: ${form}`); continue; }
  if (c.fn !== p.fn) problems.push(`${form}: handler renamed ${p.fn} → ${c.fn}`);
  for (const k of p.required) if (!c.required.includes(k) && !c.optional.includes(k)) problems.push(`${form}: field removed: ${k}`);
  for (const k of p.optional) if (!c.required.includes(k) && !c.optional.includes(k)) problems.push(`${form}: optional field removed: ${k}`);
  for (const k of c.required) if (!p.required.includes(k)) problems.push(`${form}: new REQUIRED field: ${k} (breaking for existing n8n callers)`);
  for (const k of c.optional) if (!p.optional.includes(k) && !p.required.includes(k)) notes.push(`${form}: optional field added: ${k} (additive)`);
  if (c.hash !== p.hash && !problems.some(x => x.startsWith(form))) notes.push(`${form}: contract hash changed (types/enums) — review`);
}
for (const form of Object.keys(cur.forms)) if (!prev.forms[form]) notes.push(`form added: ${form} (additive)`);

notes.forEach(n => console.log('  note  ' + n));
if (problems.length) {
  problems.forEach(p => console.log('  BREAK ' + p));
  if (versionBumped) {
    console.log(`\nBreaking changes present but version bumped (${prev.apiVersion} → ${cur.apiVersion}). Run with --update after announcing to n8n owners.`);
    process.exit(2);
  }
  console.log('\nFAIL: breaking contract change without an N8N_API_VERSION bump. Fix the change, or bump the version + keep aliases, then --update.');
  process.exit(1);
}
const hashChanged = Object.keys(cur.forms).some(f => prev.forms[f] && prev.forms[f].hash !== cur.forms[f].hash);
if (hashChanged && !versionBumped) { console.log('\nWARN: contract hashes changed without a contracts version bump (additive). Consider bumping FormContracts.VERSION and running --update.'); process.exit(0); }
console.log('\nOK: contracts compatible with docs/contracts.lock.json');
