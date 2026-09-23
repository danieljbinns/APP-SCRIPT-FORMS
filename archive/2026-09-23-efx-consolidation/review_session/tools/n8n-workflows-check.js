#!/usr/bin/env node
'use strict';
/**
 * n8n-workflows-check.js — deterministic lint for the n8n workflow JSON files in n8n/ (LOCAL ONLY).
 *
 *   node tools/n8n-workflows-check.js            # table + findings; exit 1 on any error, 0 otherwise
 *   node tools/n8n-workflows-check.js --json     # machine-readable output (same exit codes)
 *   node tools/n8n-workflows-check.js --no-snippets   # skip n8n/snippets/*.json (paste-able fragments)
 *
 * Reads only: n8n/*.json, employee_management_v2_efx/N8n.js (aliases + signatures), FormContracts.js (enums, evaluated in a
 * sandbox exactly like gen-contracts.js) and docs/contracts.lock.json (required/optional keys). No n8n API, no network, no secrets.
 *
 * Per file:
 *   1. structure  valid JSON; unique node names/ids; type, typeVersion, position on every node; every connection references an
 *                 existing node; no orphan non-sticky node; executeWorkflow targets are the Router, a file in n8n/ or a <<PLACEHOLDER>>;
 *                 inputs passed to a resolvable sub-workflow are declared by its trigger; typeVersions match the README pins (warn).
 *   2. fn         every fn handed to the Router (Code-node literal or executeWorkflow parameter) is in N8N_ALIASES and the number of
 *                 args built does not exceed the alias's positional arity (actor is prepended by the Router; trailing args optional).
 *   3. contracts  wrappers that build a form payload: literal REQUIRED/OPTIONAL/DYN lists, built keys, declared inputs and enum
 *                 literals vs the contract. Unknown key / off-enum literal → error; required key nobody provides → warning.
 *                 The E2E test's literal payloads are checked the same way (multi-select values off the UI list → warning).
 *   4. code       every Code node compiles as an async function body (n8n semantics: top-level return/await);
 *                 $('Node') references and Code output keys forwarded to the Router are consistent.
 *   5. secrets    Apps Script deployment ids, private keys, JWTs, literal "password" values, and @team-group.com recipients
 *                 other than dbinns@ / efx-bot@ (warning, with file/node).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'employee_management_v2_efx');
const LOCK = path.join(ROOT, 'docs', 'contracts.lock.json');
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const WITH_SNIPPETS = !argv.includes('--no-snippets');
const dirFlag = argv.indexOf('--dir');   // --dir <folder>: lint another folder of workflow JSON (self-test / a scratch copy)
const N8N_DIR = dirFlag >= 0 && argv[dirFlag + 1] ? path.resolve(argv[dirFlag + 1]) : path.join(ROOT, 'n8n');

const STICKY = 'n8n-nodes-base.stickyNote';
const CODE = 'n8n-nodes-base.code';
const EXEC_WF = 'n8n-nodes-base.executeWorkflow';
const EXEC_TRIGGER = 'n8n-nodes-base.executeWorkflowTrigger';
const ROUTER_FILE = '00_EFX_Router';
// <<PLACEHOLDER>> → file it stands for (README "Placeholders" table). Lets the linter check the inputs passed to that sub-workflow.
const PLACEHOLDER_TARGETS = {
  ROUTER_WORKFLOW_ID: '00_EFX_Router', SUBMIT_ID_SETUP_WORKFLOW_ID: '11_Forms_SubmitIdSetup',
  LIST_TASKS_WORKFLOW_ID: '15_Forms_ListTasks', CLOSE_JR_TASK_WORKFLOW_ID: '12_Forms_CloseJrTask'
};
const ROUTER_INPUTS = ['fn', 'args', 'actor', 'idempotencyKey', 'treatAlreadyClosedAsSuccess'];
const META_INPUTS = new Set(['extra', 'includeRecord', 'allowUnverified', 'actor', 'idempotencyKey', 'treatAlreadyClosedAsSuccess']);
// n8n/README.md: "typeVersions match the team's live exports"
const PINNED_VERSIONS = { httpRequest: 4.2, code: 2, if: 2, set: 3.4, gmail: 2.1, executeWorkflow: 1.1, executeWorkflowTrigger: 1.1, scheduleTrigger: 1.2, switch: 3.2, stickyNote: 1, noOp: 1, manualTrigger: 1 };
const ALLOWED_EMAILS = new Set(['dbinns@team-group.com', 'efx-bot@team-group.com']);
const RECIPIENT_KEYS = new Set(['sendTo', 'ccList', 'bccList', 'toEmail', 'ccEmail', 'bccEmail', 'replyTo', 'recipientOverride']);
const SECRET_PATTERNS = [
  [/AKfycb[\w-]{20,}/, 'Apps Script deployment id'],
  [/BEGIN PRIVATE KEY/, 'private key material'],
  [/eyJ[\w-]{30,}\.[\w-]+\.[\w-]+/, 'JWT / OAuth token'],
  [/"password":\s*"[^<"]/, 'literal "password" value (only <<PLACEHOLDER>> allowed)']
];
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const SEP = '|';   // joiner for comparing string arrays

// ── source-of-truth loaders ─────────────────────────────────────────────────────
function loadAliases() {
  const src = fs.readFileSync(path.join(SRC, 'N8n.js'), 'utf8');
  const block = /var N8N_ALIASES = \[([\s\S]*?)\n\];/.exec(src);
  if (!block) throw new Error('N8N_ALIASES not found in N8n.js');
  const aliases = new Map();
  for (const m of block[1].matchAll(/\{\s*name:\s*'(n8n_\w+)'([^}]*)\}/g)) {
    const form = /form:\s*'(\w+)'/.exec(m[2]);
    aliases.set(m[1], { form: form ? form[1] : null, params: null, maxArgs: null });
  }
  const fns = new Map();
  for (const m of src.matchAll(/^function (n8n_\w+)\s*\(([^)]*)\)/gm)) fns.set(m[1], m[2].split(',').map(s => s.trim()).filter(Boolean));
  const problems = [];
  for (const [name, a] of aliases) {
    if (!fns.has(name)) { problems.push(`N8n.js: alias ${name} has no function definition`); continue; }
    a.params = fns.get(name); a.maxArgs = a.params.length - (a.params[0] === 'actor' ? 1 : 0);
  }
  for (const name of fns.keys()) if (!aliases.has(name)) problems.push(`N8n.js: function ${name} is not listed in N8N_ALIASES`);
  return { aliases, problems };
}

function loadContracts() {
  const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
  const forms = {};
  for (const [form, c] of Object.entries(lock.forms)) forms[form] = { required: c.required.slice(), optional: (c.optional || []).slice(), enums: {}, multi: {}, types: {}, dynamicPrefixes: [] };
  const notes = [];
  let enumSource = 'contracts.lock.json only';
  try {
    // Same stubs as tools/gen-contracts.js — FormContracts.js is plain data + validators, no I/O.
    const ctx = vm.createContext({
      console: { log() {}, warn() {}, error() {} }, Date, JSON, Object, Array, String, Number, Math, RegExp,
      Utilities: { getUuid: () => '00000000-0000-0000-0000-000000000000' },
      PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, getProperties: () => ({}), setProperty() {}, setProperties() {} }) },
      Session: { getActiveUser: () => ({ getEmail: () => '' }) }, Logger: { log() {} }
    });
    ctx.globalThis = ctx;
    for (const f of ['SchemaConstants.js', 'Services/ConfigurationService.js', 'Config.js', 'FormContracts.js']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
    for (const f of ctx.FormContracts.list()) {
      const c = ctx.FormContracts.get(f.form);
      if (!forms[f.form]) { notes.push(`FormContracts.js has form ${f.form} that is not in contracts.lock.json (run tools/n8n-check.js)`); continue; }
      const t = forms[f.form];
      t.enums = c.enums || {}; t.multi = c.multi || {}; t.types = c.types || {}; t.dynamicPrefixes = c.dynamicPrefixes || [];
      if (JSON.stringify(c.required) !== JSON.stringify(t.required) || JSON.stringify(c.optional || []) !== JSON.stringify(t.optional)) notes.push(`${f.form}: contracts.lock.json differs from FormContracts.js (run tools/n8n-check.js) — lint uses the lock`);
    }
    enumSource = 'FormContracts.js ' + ctx.FormContracts.VERSION;
  } catch (e) { notes.push('enums unavailable — FormContracts.js could not be evaluated: ' + e.message); }
  for (const f of Object.values(forms)) {
    f.keys = new Set(f.required.concat(f.optional));
    f.enumLists = {};
    for (const [k, e] of Object.entries(f.enums)) if (Array.isArray(e)) f.enumLists[k] = e;
    for (const [k, t] of Object.entries(f.types)) if (/^YesNo/.test(String(t)) && !f.enumLists[k]) f.enumLists[k] = /empty/.test(t) ? ['Yes', 'No', ''] : ['Yes', 'No'];
    f.isDynamic = k => f.dynamicPrefixes.some(p => k.startsWith(p));
  }
  return { forms, enumSource, notes, apiVersion: lock.apiVersion, contractsVersion: lock.contractsVersion };
}

// ── tiny JS-literal helpers (regex + bracket matching; good enough for the Build-args style used here) ──
function balanced(src, start) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [pairs[src[start]]]; let q = null;
  for (let i = start + 1; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') { i++; continue; } if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); if (nl < 0) return -1; i = nl; continue; }
    if (ch === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) return -1; i = e + 1; continue; }
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === stack[stack.length - 1]) { stack.pop(); if (!stack.length) return i; }
    else if (ch === ')' || ch === ']' || ch === '}') return -1;
  }
  return -1;
}
function splitTop(src) {
  const out = []; let depth = 0, q = null, cur = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { cur += ch; if (ch === '\\') { cur += src[++i] || ''; continue; } if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; cur += ch; continue; }
    if (ch === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); if (nl < 0) break; i = nl; cur += ' '; continue; }
    if (ch === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) break; i = e + 1; cur += ' '; continue; }
    if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const strLit = s => { const m = /^(['"])((?:\\.|(?!\1).)*)\1$/.exec(String(s).trim()); return m ? m[2] : null; };
function strArray(src) {  // "['a', 'b']" → ['a','b'] | null
  const s = String(src).trim(); if (!s.startsWith('[')) return null;
  const end = balanced(s, 0); if (end !== s.length - 1) return null;
  const parts = splitTop(s.slice(1, end)); if (!parts.length) return [];
  const vals = parts.map(strLit); return vals.every(v => v !== null) ? vals : null;
}
function objectEntries(src, start) {  // src[start] === '{' → [{key, value}] top-level, or null
  const end = balanced(src, start); if (end < 0) return null;
  return splitTop(src.slice(start + 1, end)).map(p => {
    const m = /^(['"]?)([\w$]+)\1\s*:\s*([\s\S]*)$/.exec(p);
    if (m) return { key: m[2], value: m[3].trim() };
    const sh = /^([\w$]+)$/.exec(p); return sh ? { key: sh[1], value: sh[1] } : { key: null, value: p };
  });
}
function namedArrays(js) {  // const NAME = [...] → { NAME: [...] } (string arrays only)
  const out = {};
  for (const m of js.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?=\[)/g)) {
    const end = balanced(js, m.index + m[0].length); if (end < 0) continue;
    const arr = strArray(js.slice(m.index + m[0].length, end + 1)); if (arr) out[m[1]] = arr;
  }
  return out;
}
function namedObject(js, name) {
  const m = new RegExp('\\b(?:const|let|var)\\s+' + name.replace(/\$/g, '\\$') + '\\s*=\\s*(?=\\{)').exec(js);
  return m ? objectEntries(js, m.index + m[0].length) : null;
}
function looseStringArrays(js) {
  const out = []; const re = /\[\s*(['"])/g; let m;
  while ((m = re.exec(js))) { const end = balanced(js, m.index); if (end < 0) continue; const a = strArray(js.slice(m.index, end + 1)); if (a && a.length) out.push(a); }
  return out;
}
function exprBody(v) { return typeof v === 'string' ? v.replace(/^=\s*\{\{/, '').replace(/\}\}\s*$/, '').trim() : null; }
function exprArgs(v) {  // "={{ [ a, b ] }}" → ['a','b'] | null
  if (Array.isArray(v)) return v.map(x => JSON.stringify(x));
  const s = exprBody(v); if (s === null || !s.startsWith('[')) return null;
  const end = balanced(s, 0); if (end < 0) return null;
  const parts = splitTop(s.slice(1, end)); return parts.some(p => p.startsWith('...')) ? null : parts;
}
function walkStrings(v, cb, keyPath = []) {
  if (typeof v === 'string') cb(v, keyPath);
  else if (Array.isArray(v)) v.forEach((x, i) => walkStrings(x, cb, keyPath.concat(i)));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walkStrings(x, cb, keyPath.concat(k));
}

// ── load everything ─────────────────────────────────────────────────────────────
const { aliases, problems: aliasProblems } = loadAliases();
const contracts = loadContracts();
const files = fs.readdirSync(N8N_DIR).filter(f => f.endsWith('.json')).sort().map(f => ({ file: f, abs: path.join(N8N_DIR, f), fragment: false }));
if (WITH_SNIPPETS && fs.existsSync(path.join(N8N_DIR, 'snippets'))) {
  for (const f of fs.readdirSync(path.join(N8N_DIR, 'snippets')).filter(f => f.endsWith('.json')).sort()) files.push({ file: 'snippets/' + f, abs: path.join(N8N_DIR, 'snippets', f), fragment: true });
}
const parsed = new Map();   // file → { wf, nodes, byName, trigger, triggerInputs }
for (const f of files) {
  try {
    const wf = JSON.parse(fs.readFileSync(f.abs, 'utf8'));
    const nodes = Array.isArray(wf.nodes) ? wf.nodes : [];
    const trigger = nodes.find(n => n && n.type === EXEC_TRIGGER);
    const triggerInputs = trigger && trigger.parameters && trigger.parameters.workflowInputs && Array.isArray(trigger.parameters.workflowInputs.values) ? trigger.parameters.workflowInputs.values.map(v => v.name) : null;
    parsed.set(f.file, { wf, nodes, trigger, triggerInputs, byName: new Map(nodes.filter(n => n && n.name).map(n => [n.name, n])) });
  } catch (e) { parsed.set(f.file, { parseError: e.message, nodes: [] }); }
}
const base = f => f.replace(/\.json$/, '');
const resolveTarget = value => {
  const ph = /^<<([A-Z0-9_]+)>>$/.exec(String(value || ''));
  if (ph) return PLACEHOLDER_TARGETS[ph[1]] ? parsed.get(PLACEHOLDER_TARGETS[ph[1]] + '.json') || null : null;
  for (const [file, p] of parsed) if (base(file) === value || (p.wf && p.wf.name === value)) return p;
  return null;
};
const routerParsed = parsed.get(ROUTER_FILE + '.json');

// ── lint one file ───────────────────────────────────────────────────────────────
function lintFile(entry) {
  const p = parsed.get(entry.file);
  const R = { file: entry.file, kind: entry.fragment ? 'fragment' : 'workflow', nodes: 0, fns: [], errors: [], warnings: [] };
  const err = (node, msg) => R.errors.push({ node, msg });
  const warn = (node, msg) => R.warnings.push({ node, msg });
  const addFn = fn => { if (!R.fns.includes(fn)) R.fns.push(fn); };
  if (p.parseError) { err('-', 'invalid JSON: ' + p.parseError); return R; }
  const { wf, nodes, byName } = p;
  R.nodes = nodes.length;
  if (!Array.isArray(wf.nodes)) err('-', '"nodes" is not an array');
  if (!wf.connections || typeof wf.connections !== 'object') err('-', '"connections" missing');
  if (!entry.fragment && !wf.name) err('-', 'workflow has no "name"');
  if (wf.pinData && Object.keys(wf.pinData).length) warn('-', 'pinData is not empty (pinned test data would be imported)');

  // 1. structure
  const names = new Set(), ids = new Set();
  for (const n of nodes) {
    const label = (n && n.name) || '<unnamed>';
    if (!n || typeof n.name !== 'string' || !n.name.trim()) err(label, 'node without a name');
    else if (names.has(n.name)) err(label, 'duplicate node name'); else names.add(n.name);
    if (n && n.id !== undefined) { if (ids.has(n.id)) warn(label, `duplicate node id "${n.id}"`); ids.add(n.id); }
    if (!n || typeof n.type !== 'string') { err(label, 'node without "type"'); continue; }
    if (typeof n.typeVersion !== 'number') err(label, 'node without numeric "typeVersion"');
    if (!Array.isArray(n.position) || n.position.length !== 2 || !n.position.every(x => typeof x === 'number')) err(label, 'node without [x, y] "position"');
    const short = n.type.replace(/^n8n-nodes-base\./, '');
    if (PINNED_VERSIONS[short] !== undefined && n.typeVersion !== PINNED_VERSIONS[short]) warn(label, `${short} typeVersion ${n.typeVersion} differs from README pin ${PINNED_VERSIONS[short]}`);
    if (!n.parameters || typeof n.parameters !== 'object') err(label, 'node without "parameters" object');
  }
  const incoming = new Map(), outgoing = new Map();
  for (const [src, outs] of Object.entries(wf.connections || {})) {
    if (!byName.has(src)) { err(src, 'connection source is not a node'); continue; }
    for (const [type, lanes] of Object.entries(outs || {})) {
      if (!Array.isArray(lanes)) { err(src, `connections.${type} is not an array`); continue; }
      lanes.forEach((lane, i) => { for (const c of lane || []) {
        if (!c || !byName.has(c.node)) { err(src, `output ${i} points at unknown node "${c && c.node}"`); continue; }
        outgoing.set(src, (outgoing.get(src) || 0) + 1); incoming.set(c.node, (incoming.get(c.node) || 0) + 1);
      } });
    }
  }
  if (!entry.fragment) {
    for (const n of nodes) if (n && n.type && n.type !== STICKY && !incoming.get(n.name) && !outgoing.get(n.name)) err(n.name, 'orphan node (no connections)');
    if (!nodes.some(n => n && /Trigger$/.test(n.type))) err('-', 'no trigger node');
  }
  // $('Node') references in expressions and Code
  if (!entry.fragment) for (const n of nodes) {
    if (!n || !n.parameters) continue;
    walkStrings(n.parameters, s => { for (const m of s.matchAll(/\$\(\s*(['"])((?:\\.|(?!\1).)+)\1\s*\)/g)) if (!byName.has(m[2])) err(n.name, `references $('${m[2]}') which is not a node in this workflow`); });
  }

  // 2/4. Code nodes: compile, collect fn calls
  const codeCalls = new Map();   // node name → [{fn, argc, args}]
  for (const n of nodes) {
    if (!n || n.type !== CODE) continue;
    const js = n.parameters && n.parameters.jsCode;
    if (typeof js !== 'string' || !js.trim()) { err(n.name, 'Code node without jsCode'); continue; }
    try { new AsyncFunction(js); } catch (e) { err(n.name, 'jsCode does not compile: ' + e.message); }
    if (!/\breturn\b/.test(js)) warn(n.name, 'Code node never returns');
    const calls = [];
    for (const m of js.matchAll(/\bfn\s*[:=]\s*'(n8n_\w+)'/g)) {
      const call = { fn: m[1], argc: null, args: null };
      const after = m.index + m[0].length;
      const am = /^[\s,;]*args\s*[:=]\s*/.exec(js.slice(after, after + 200));
      if (am && js[after + am[0].length] === '[') {
        const s = after + am[0].length, e = balanced(js, s);
        if (e > 0) { const parts = splitTop(js.slice(s + 1, e)); if (!parts.some(x => x.startsWith('...'))) { call.argc = parts.length; call.args = parts; } }
      }
      calls.push(call);
    }
    codeCalls.set(n.name, calls);
  }
  const checkFn = (node, fn, argc) => {
    addFn(fn);
    const a = aliases.get(fn);
    if (!a) { err(node, `fn "${fn}" is not an N8N_ALIASES entry in N8n.js`); return null; }
    if (argc !== null && a.maxArgs !== null && argc > a.maxArgs) err(node, `${fn} takes ${a.maxArgs} positional arg(s) after actor (${a.params.join(', ')}) but ${argc} are built`);
    return a;
  };
  // unknown n8n_* tokens anywhere (typos in stickies / docs strings)
  for (const n of nodes) {
    if (!n || !n.parameters) continue;
    const seen = new Set();
    walkStrings(n.parameters, s => { for (const m of s.matchAll(/\bn8n_[A-Za-z]\w*/g)) if (!aliases.has(m[0]) && !seen.has(m[0])) { seen.add(m[0]); warn(n.name, `mentions "${m[0]}" which is not an alias in N8n.js`); } });
  }

  // executeWorkflow nodes
  const routerNodes = [];
  for (const n of nodes) {
    if (!n || n.type !== EXEC_WF) continue;
    const prm = n.parameters || {};
    const wid = prm.workflowId && typeof prm.workflowId === 'object' ? prm.workflowId : { value: prm.workflowId, mode: 'id' };
    const value = wid.mode === 'list' && wid.cachedResultName ? wid.cachedResultName : wid.value;
    const isPlaceholder = /^<<[A-Z0-9_]+>>$/.test(String(value || ''));
    const target = resolveTarget(value);
    if (!value) err(n.name, 'executeWorkflow without a workflow id');
    else if (!isPlaceholder && !target) err(n.name, `executeWorkflow target "${value}" is neither the Router, a file in n8n/, nor a <<PLACEHOLDER>>`);
    if (!(prm.options && prm.options.waitForSubWorkflow)) warn(n.name, 'options.waitForSubWorkflow is not true — the caller will not receive the sub-workflow output');
    const vals = (prm.workflowInputs && prm.workflowInputs.value) || {};
    const passed = Object.keys(vals);
    if (target && target.triggerInputs) {
      for (const k of passed) if (!target.triggerInputs.includes(k)) err(n.name, `passes input "${k}" which the target trigger does not declare (${target.triggerInputs.join(', ')})`);
      const schemaIds = (prm.workflowInputs && Array.isArray(prm.workflowInputs.schema)) ? prm.workflowInputs.schema.map(s => s.id) : [];
      for (const id of schemaIds) if (!target.triggerInputs.includes(id)) warn(n.name, `schema lists "${id}" which the target trigger does not declare`);
    }
    if (target === routerParsed) {
      routerNodes.push(n);
      if (!('fn' in vals)) err(n.name, 'Router call without "fn"');
      if (!('args' in vals)) err(n.name, 'Router call without "args"');
      const fnLit = typeof vals.fn === 'string' && !vals.fn.startsWith('=') ? vals.fn : null;
      if (fnLit) {
        const argParts = exprArgs(vals.args);
        const a = checkFn(n.name, fnLit, argParts ? argParts.length : null);
        if (a && argParts) checkLiteralPayload(n, a, fnLit, argParts, byName, err, warn);
      } else if (vals.fn !== undefined && !/\$json\.fn|\$\(/.test(String(vals.fn))) warn(n.name, `fn is an expression that could not be resolved statically: ${vals.fn}`);
    }
  }

  // wrapper checks: Code → Router
  for (const rn of routerNodes) {
    const feeders = Object.entries(wf.connections || {}).filter(([, outs]) => (outs.main || []).some(lane => (lane || []).some(c => c && c.node === rn.name))).map(([src]) => src);
    for (const feeder of feeders) {
      const calls = codeCalls.get(feeder); if (!calls) continue;
      const cn = byName.get(feeder), js = cn.parameters.jsCode;
      const rv = (rn.parameters.workflowInputs && rn.parameters.workflowInputs.value) || {};
      const fnFromCode = typeof rv.fn === 'string' && rv.fn.startsWith('=');   // fn: {{ $json.fn }} → the Code node must build it
      if (!calls.length) { if (fnFromCode) warn(feeder, `Code node feeds "${rn.name}" (fn = ${rv.fn}) but builds no literal fn`); continue; }
      const mapped = Object.keys(rv);
      for (const k of ROUTER_INPUTS) if (new RegExp('\\b' + k + '\\s*:').test(js) && !mapped.includes(k)) err(feeder, `builds "${k}" but "${rn.name}" does not forward it to the Router (add ${k}: {{ $json.${k} }})`);
      for (const c of calls) {
        const a = checkFn(feeder, c.fn, c.argc);
        if (a) checkWrapperPayload(cn, a, c, p, err, warn);
      }
      if (p.triggerInputs) {
        const refs = new Set([...js.matchAll(/\binp\.([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
        for (const k of refs) if (!p.triggerInputs.includes(k)) warn(feeder, `reads inp.${k} but "${k}" is not a declared trigger input — callers can never set it`);
        for (const k of p.triggerInputs) if (!refs.has(k) && !new RegExp("['\"]" + k + "['\"]").test(js)) warn(feeder, `declared trigger input "${k}" is never used`);
      }
    }
  }

  // 5. secrets + recipients (per node so the finding names the node)
  const scanUnit = (label, obj) => {
    // Patterns run on the serialised node AND on every raw string value (a JSON body inside a string parameter has escaped quotes).
    const hits = new Set();
    const scanText = text => { for (const [re, what] of SECRET_PATTERNS) if (re.test(text) && !hits.has(what)) { hits.add(what); err(label, `secret scan: ${what} (${re.source})`); } };
    scanText(JSON.stringify(obj));
    walkStrings(obj, (s, kp) => {
      scanText(s);
      for (const m of s.matchAll(/\b(\w*[Pp]assword\w*)\s*[:=]\s*(['"])(?!<<)([^'"]{4,})\2/g)) if (!/test|dummy|example|not.?real|placeholder|changeme/i.test(m[3])) warn(label, `literal value assigned to "${m[1]}" in a string/Code parameter`);
      for (const m of s.matchAll(/[\w.+-]+@team-group\.com/gi)) {
        const addr = m[0].toLowerCase();
        if (ALLOWED_EMAILS.has(addr)) continue;
        const recipient = kp.some(k => RECIPIENT_KEYS.has(String(k)));
        warn(label, `${recipient ? 'recipient' : 'address'} ${addr} is not dbinns@/efx-bot@team-group.com`);
      }
    });
  };
  for (const n of nodes) if (n) scanUnit(n.name || '<unnamed>', n);
  scanUnit('(workflow settings)', { settings: wf.settings, meta: wf.meta, pinData: wf.pinData, staticData: wf.staticData });
  return R;
}

// ── contract checks ─────────────────────────────────────────────────────────────
function formFor(alias, fnName, firstArg) {
  if (alias.form) return alias.form;
  if ((fnName === 'n8n_createWorkflow' || fnName === 'n8n_submitForm') && firstArg) { const s = strLit(firstArg); if (s) return s; }
  return null;
}
function checkEnumLiteral(node, form, key, values, err) {
  const c = contracts.forms[form]; const e = c.enumLists[key]; if (!e) return;
  const bad = values.filter(v => !e.includes(v) && v !== '');
  if (bad.length) err(node, `${form}.${key}: literal value(s) ${bad.map(v => JSON.stringify(v)).join(', ')} not in contract enum [${e.join('|')}]`);
}
function checkWrapperPayload(codeNode, alias, call, p, err, warn) {
  const js = codeNode.parameters.jsCode;
  const form = formFor(alias, call.fn, call.args && call.args[0]);
  if (!form) return;
  const c = contracts.forms[form];
  if (!c) { err(codeNode.name, `form "${form}" is not in contracts.lock.json`); return; }
  const arrays = namedArrays(js);
  const built = new Set();
  const keyLists = [];
  if (arrays.REQUIRED) { keyLists.push(arrays.REQUIRED); arrays.REQUIRED.forEach(k => built.add(k)); }
  if (arrays.OPTIONAL) { keyLists.push(arrays.OPTIONAL); arrays.OPTIONAL.forEach(k => built.add(k)); }
  for (const m of js.matchAll(/\bdata\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) built.add(m[1]);
  for (const m of js.matchAll(/\bpick\(\s*(?=\[)/g)) { const e = balanced(js, m.index + m[0].length); const a = e > 0 ? strArray(js.slice(m.index + m[0].length, e + 1)) : null; if (a) { keyLists.push(a); a.forEach(k => built.add(k)); } }
  for (const m of js.matchAll(/\bdata\s*=\s*(?:Object\.assign\(\s*)?(?=\{)/g)) { const ents = objectEntries(js, m.index + m[0].length); if (ents) for (const en of ents) if (en.key) built.add(en.key); }
  for (const k of built) if (!c.keys.has(k) && !c.isDynamic(k)) err(codeNode.name, `${form}: builds key "${k}" which is not in the contract`);
  if (arrays.REQUIRED) {
    for (const k of arrays.REQUIRED) if (!c.required.includes(k) && c.keys.has(k)) warn(codeNode.name, `${form}: REQUIRED lists "${k}" but the contract has it optional (wrapper is stricter than Forms)`);
    for (const k of c.required) if (!arrays.REQUIRED.includes(k)) warn(codeNode.name, `${form}: contract-required "${k}" missing from the wrapper's REQUIRED list`);
  }
  const inputs = p.triggerInputs || [];
  for (const k of c.required) if (!built.has(k) && !inputs.includes(k)) warn(codeNode.name, `${form}: required "${k}" is neither built by the wrapper nor a declared input (Forms will reject with E_VALIDATION)`);
  if (arrays.DYN !== undefined) {
    for (const d of arrays.DYN) if (!c.dynamicPrefixes.includes(d)) err(codeNode.name, `${form}: DYN prefix "${d}" is not a contract dynamicPrefix`);
    for (const d of c.dynamicPrefixes) if (!arrays.DYN.includes(d)) warn(codeNode.name, `${form}: contract dynamicPrefix "${d}" missing from DYN`);
  }
  for (const k of inputs) if (!META_INPUTS.has(k) && !c.keys.has(k) && !c.isDynamic(k)) warn(codeNode.name, `${form}: trigger input "${k}" is not a contract key — it is dropped before the call`);
  // enum literals: ENUMS = { key: [...] } and loose arrays that overlap a contract enum
  const enumsObj = namedObject(js, 'ENUMS');
  if (enumsObj) for (const en of enumsObj) {
    if (!en.key) continue;
    if (!c.keys.has(en.key)) { err(codeNode.name, `${form}: ENUMS.${en.key} is not a contract key`); continue; }
    const vals = strArray(en.value); if (vals) checkEnumLiteral(codeNode.name, form, en.key, vals, err);
  }
  const listSig = keyLists.map(a => a.join(SEP));
  for (const arr of looseStringArrays(js)) {
    if (listSig.includes(arr.join(SEP)) || arr.every(v => c.keys.has(v))) continue;   // key lists, not values
    for (const [key, e] of Object.entries(c.enumLists)) if (arr.some(v => e.includes(v))) checkEnumLiteral(codeNode.name, form, key, arr, err);
  }
}
function checkLiteralPayload(execNode, alias, fnName, argParts, byName, err, warn) {
  const form = formFor(alias, fnName, argParts[0]);
  const dataArg = alias.form ? argParts[0] : argParts[1];
  if (!form || !dataArg) return;
  const c = contracts.forms[form]; if (!c) { err(execNode.name, `form "${form}" is not in contracts.lock.json`); return; }
  // The data arg is an inline { … }, a $('Code node').first().json.<var> reference to a literal object, or Object.assign(…) of those.
  const arg = dataArg.trim();
  let pieces = [arg];
  if (arg.startsWith('Object.assign(')) { const open = 'Object.assign('.length - 1, end = balanced(arg, open); if (end > 0) pieces = splitTop(arg.slice(open + 1, end)); }
  const sources = []; let allResolved = true;
  for (const piece of pieces) {
    if (piece.startsWith('{')) { const entries = objectEntries(piece, 0); if (entries) sources.push({ entries, where: execNode.name }); else allResolved = false; continue; }
    const ref = /^\$\(\s*'([^']+)'\s*\)\.(?:first|item|last)(?:\(\))?\.json\.([A-Za-z_$][\w$]*)$/.exec(piece);
    const src = ref && byName.get(ref[1]);
    const entries = src && src.type === CODE ? namedObject(src.parameters.jsCode, ref[2]) : null;
    if (entries) sources.push({ entries, where: `${execNode.name} <- ${ref[1]}.${ref[2]}` }); else allResolved = false;
  }
  const union = new Set();
  for (const { entries, where } of sources) {
    for (const en of entries) {
      if (!en.key) continue;
      union.add(en.key);
      if (!c.keys.has(en.key) && !c.isDynamic(en.key)) err(where, `${form}: payload key "${en.key}" is not in the contract`);
      const s = strLit(en.value); if (s !== null) { checkEnumLiteral(where, form, en.key, [s], err); continue; }
      const arr = strArray(en.value);
      if (arr && c.multi[en.key]) { const bad = arr.filter(v => !c.multi[en.key].includes(v)); if (bad.length) warn(where, `${form}.${en.key}: ${bad.map(v => JSON.stringify(v)).join(', ')} not in the UI option list [${c.multi[en.key].join('|')}]`); }
    }
  }
  if (allResolved && sources.length) for (const k of c.required) if (!union.has(k)) warn(execNode.name, `${form}: required "${k}" missing from the literal payload`);
}

// ── run ─────────────────────────────────────────────────────────────────────────
const results = files.map(lintFile);
const global = { errors: aliasProblems.slice(), warnings: contracts.notes.slice() };
const totalErrors = results.reduce((s, r) => s + r.errors.length, 0) + global.errors.length;
const totalWarnings = results.reduce((s, r) => s + r.warnings.length, 0) + global.warnings.length;
const ok = totalErrors === 0;

if (JSON_OUT) {
  console.log(JSON.stringify({ ok, apiVersion: contracts.apiVersion, contractsVersion: contracts.contractsVersion, enumSource: contracts.enumSource, aliases: aliases.size, files: results, global, totals: { errors: totalErrors, warnings: totalWarnings } }, null, 2));
} else {
  const w = Math.max(4, ...results.map(r => r.file.length));
  console.log(`n8n workflow lint — ${results.length} file(s), ${aliases.size} aliases (N8n.js), contracts ${contracts.contractsVersion} / api ${contracts.apiVersion}, enums from ${contracts.enumSource}\n`);
  console.log(`  ${'file'.padEnd(w)}  nodes  fns  errors  warnings`);
  console.log(`  ${'-'.repeat(w)}  -----  ---  ------  --------`);
  for (const r of results) console.log(`  ${r.file.padEnd(w)}  ${String(r.nodes).padStart(5)}  ${String(r.fns.length).padStart(3)}  ${String(r.errors.length).padStart(6)}  ${String(r.warnings.length).padStart(8)}`);
  console.log(`  ${'-'.repeat(w)}  -----  ---  ------  --------`);
  console.log(`  ${'total'.padEnd(w)}  ${String(results.reduce((s, r) => s + r.nodes, 0)).padStart(5)}  ${String(new Set(results.flatMap(r => r.fns)).size).padStart(3)}  ${String(totalErrors).padStart(6)}  ${String(totalWarnings).padStart(8)}`);
  const lines = [];
  for (const r of results) { for (const e of r.errors) lines.push(`  ERROR ${r.file} :: ${e.node} :: ${e.msg}`); for (const x of r.warnings) lines.push(`  warn  ${r.file} :: ${x.node} :: ${x.msg}`); }
  for (const e of global.errors) lines.push(`  ERROR ${e}`);
  for (const x of global.warnings) lines.push(`  warn  ${x}`);
  if (lines.length) console.log('\n' + lines.join('\n'));
  console.log(ok ? `\nOK: ${results.length} workflow file(s) lint clean (${totalWarnings} warning(s))` : `\nFAIL: ${totalErrors} error(s), ${totalWarnings} warning(s)`);
}
process.exit(ok ? 0 : 1);
