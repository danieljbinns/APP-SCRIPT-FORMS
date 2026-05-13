#!/usr/bin/env node
/**
 * predeploy-check.js
 * Pre-deployment validation for Google Apps Script projects.
 *
 * Usage:
 *   node tools/predeploy-check.js ./employee_management_v2_dev
 *   node tools/predeploy-check.js ./employee_management_v2
 *
 * Exits 0 if all checks pass.
 * Exits 1 and prints a full error report if any check fails.
 *
 * Checks performed:
 *   1. Duplicate function names across .js files
 *   2. Functions called via google.script.run in .html files but not defined
 *   3. Functions called in Router.js switch cases but not defined
 *   4. HTML includes (<?!= include('X') ?>) where X.html does not exist
 *   5. createTemplateFromFile('X') calls where X.html does not exist
 *   6. Function-to-file map printed for visual audit
 */

const fs   = require('fs');
const path = require('path');

// ─── Args ────────────────────────────────────────────────────────────────────

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Usage: node predeploy-check.js <path-to-gas-folder>');
  process.exit(1);
}

const absTarget = path.resolve(targetDir);
if (!fs.existsSync(absTarget)) {
  console.error('Directory not found: ' + absTarget);
  process.exit(1);
}

// ─── File collection ─────────────────────────────────────────────────────────

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

const allFiles  = walk(absTarget);
const jsFiles   = allFiles.filter(f => f.endsWith('.js'));
const htmlFiles = allFiles.filter(f => f.endsWith('.html'));

// HTML file names available (basename without .html, for include lookups)
const htmlNames = new Set(htmlFiles.map(f => path.basename(f, '.html')));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function read(f) { return fs.readFileSync(f, 'utf8'); }
function rel(f)  { return path.relative(absTarget, f); }

// ─── Check 1: Duplicate function definitions ─────────────────────────────────

// Map: functionName → [file, file, ...]
const fnMap = {};

for (const f of jsFiles) {
  const src = read(f);
  // Match: function name( or const name = function( or const name = (
  const re = /^(?:async\s+)?function\s+(\w+)\s*\(/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    if (!fnMap[name]) fnMap[name] = [];
    fnMap[name].push(rel(f));
  }
}

const allDefinedFns = new Set(Object.keys(fnMap));

const duplicates = Object.entries(fnMap).filter(([, files]) => files.length > 1);

// ─── Check 2: google.script.run calls in HTML ─────────────────────────────────

// GAS chaining methods on google.script.run — client-side only, never server functions
const GAS_CHAIN_METHODS = new Set([
  'withSuccessHandler', 'withFailureHandler', 'withUserObject', 'withLogger'
]);

// Collect all google.script.run.fnName() calls from html files
const scriptRunCalls = new Map(); // fnName → [htmlFile, ...]

for (const f of htmlFiles) {
  const src = read(f);
  const re = /google\.script\.run\s*(?:\.\w+\([^)]*\)\s*)*\.(\w+)\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    if (GAS_CHAIN_METHODS.has(name)) continue; // skip chaining helpers
    if (!scriptRunCalls.has(name)) scriptRunCalls.set(name, []);
    scriptRunCalls.get(name).push(rel(f));
  }
}

const missingScriptRun = [...scriptRunCalls.entries()]
  .filter(([name]) => !allDefinedFns.has(name));

// ─── Check 3: Router.js function calls ───────────────────────────────────────

const routerFile = jsFiles.find(f => path.basename(f) === 'Router.js');
const missingRouterCalls = [];

if (routerFile) {
  const src = read(routerFile);
  // Match: return fnName( or return fnName.method(
  const re = /return\s+([A-Za-z_]\w*)(?:\.\w+)?\s*\(/g;
  // GAS globals, built-in services, and JS built-ins — not user-defined functions
  const skip = new Set([
    'HtmlService', 'SpreadsheetApp', 'ScriptApp', 'Session', 'Logger',
    'CacheService', 'PropertiesService', 'MailApp', 'GmailApp', 'DriveApp',
    'Utilities', 'ContentService', 'LockService', 'CalendarApp',
    'AccessControlService', 'ActionItemService', 'ConfigurationService',
    'Object', 'String', 'Array', 'Math', 'Date', 'JSON', 'Boolean', 'Number',
    'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent', 'Error'
  ]);
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    if (skip.has(name)) continue;
    if (!allDefinedFns.has(name)) {
      missingRouterCalls.push({ name, file: rel(routerFile) });
    }
  }
}

// Dedupe
const missingRouterUniq = [...new Map(missingRouterCalls.map(x => [x.name, x])).values()];

// ─── Check 4: Orphaned HTML includes <?!= include('X') ?> ────────────────────

const orphanedIncludes = [];

for (const f of htmlFiles) {
  const src = read(f);
  const re = /include\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    if (!htmlNames.has(name)) {
      orphanedIncludes.push({ include: name, file: rel(f) });
    }
  }
}

// ─── Check 5: createTemplateFromFile / createHtmlOutputFromFile ──────────────

const missingTemplates = [];

for (const f of jsFiles) {
  const src = read(f);
  const re = /createTemplateFromFile\s*\(\s*['"]([^'"]+)['"]\s*\)|createHtmlOutputFromFile\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1] || m[2];
    if (!htmlNames.has(name)) {
      missingTemplates.push({ template: name, file: rel(f) });
    }
  }
}

// ─── Check 6: Function-to-file map (always printed) ──────────────────────────

function printFnMap() {
  const col1 = 42;
  console.log('\n' + '─'.repeat(70));
  console.log('FUNCTION → FILE MAP');
  console.log('─'.repeat(70));
  // Group by file for readability
  const byFile = {};
  for (const [fn, files] of Object.entries(fnMap)) {
    const key = files[0];
    if (!byFile[key]) byFile[key] = [];
    byFile[key].push(fn);
  }
  for (const [file, fns] of Object.entries(byFile).sort()) {
    console.log('\n  ' + file);
    for (const fn of fns.sort()) {
      console.log('    ' + fn);
    }
  }
  console.log('');
}

// ─── Report ──────────────────────────────────────────────────────────────────

const errors = [];

if (duplicates.length) {
  errors.push('');
  errors.push('❌  DUPLICATE FUNCTION NAMES (last definition wins in GAS — silent bug risk)');
  for (const [name, files] of duplicates) {
    errors.push(`    ${name}`);
    for (const f of files) errors.push(`      → ${f}`);
  }
}

if (missingScriptRun.length) {
  errors.push('');
  errors.push('❌  UNDEFINED FUNCTIONS called via google.script.run');
  for (const [name, files] of missingScriptRun) {
    errors.push(`    ${name}()`);
    for (const f of files) errors.push(`      called in: ${f}`);
  }
}

if (missingRouterUniq.length) {
  errors.push('');
  errors.push('❌  UNDEFINED FUNCTIONS called in Router.js');
  for (const { name } of missingRouterUniq) {
    errors.push(`    ${name}()`);
  }
}

if (orphanedIncludes.length) {
  errors.push('');
  errors.push('❌  ORPHANED HTML INCLUDES  (<?!= include(\'X\') ?> where X.html does not exist)');
  for (const { include, file } of orphanedIncludes) {
    errors.push(`    include('${include}')  in  ${file}`);
  }
}

if (missingTemplates.length) {
  errors.push('');
  errors.push('❌  MISSING HTML TEMPLATES  (createTemplateFromFile(\'X\') where X.html does not exist)');
  for (const { template, file } of missingTemplates) {
    errors.push(`    '${template}'  referenced in  ${file}`);
  }
}

// ─── Output ──────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(70));
console.log('  GAS PRE-DEPLOY CHECK');
console.log('  Target: ' + absTarget);
console.log('  JS files : ' + jsFiles.length + '   HTML files: ' + htmlFiles.length +
            '   Functions defined: ' + allDefinedFns.size);
console.log('═'.repeat(70));

printFnMap();

if (errors.length === 0) {
  console.log('✅  All checks passed. Safe to clasp push.\n');
  process.exit(0);
} else {
  console.log('─'.repeat(70));
  console.log('ERRORS FOUND — fix before deploying');
  console.log('─'.repeat(70));
  for (const line of errors) console.log(line);
  console.log('\n' + errors.filter(l => l.startsWith('❌')).length + ' check(s) failed.\n');
  process.exit(1);
}
