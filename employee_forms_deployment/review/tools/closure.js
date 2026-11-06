// READ-ONLY. Strict per-entry-point dependency closure.
// A "call" is `name(` or `Namespace.method(` found in a function body AFTER comments and
// string literals are stripped. Answers: what does this entry point actually reach?
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || 'P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_deployment/review/_baseline';

function walk(dir, base) {
  base = base || ''; let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name), rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(walk(p, rel));
    else if (e.name.endsWith('.js')) out.push({ rel, src: fs.readFileSync(p, 'utf8') });
  }
  return out;
}
const files = walk(SRC);

// Comments and string literals can contain braces and identifiers. Strip before any parsing.
function strip(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

const declFile = {}, declBody = {}, fileBytes = {};
for (const f of files) {
  fileBytes[f.rel] = Buffer.byteLength(f.src);
  const lines = strip(f.src).split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(?:function\s+([A-Za-z_$][\w$]*)|(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=)/);
    if (!m) continue;
    const name = m[1] || m[2];
    let depth = 0, j = i, buf = '', started = false;
    do {
      buf += lines[j] + '\n';
      for (const c of lines[j]) {
        if ('{(['.includes(c)) { depth++; started = true; }
        else if ('})]'.includes(c)) depth--;
      }
      j++;
    } while ((!started || depth > 0) && j < lines.length && j - i < 1500);
    declFile[name] = f.rel;
    declBody[name] = buf;
  }
}
const NAMES = Object.keys(declFile);
const NAMESET = new Set(NAMES);

const CALL = /([A-Za-z_$][\w$]*)\s*(?:\.\s*[A-Za-z_$][\w$]*\s*)?\(/g;
const DATA_GLOBALS = ['CONFIG', 'SCHEMA', 'FormContracts'];
const edges = {};
for (const n of NAMES) {
  const body = declBody[n];
  const out = new Set();
  CALL.lastIndex = 0;
  let m;
  while ((m = CALL.exec(body))) if (NAMESET.has(m[1]) && m[1] !== n) out.add(m[1]);
  for (const g of DATA_GLOBALS) {
    if (g !== n && declFile[g] && new RegExp('\\b' + g + '\\s*\\.').test(body)) out.add(g);
  }
  edges[n] = Array.from(out);
}

function closure(seeds) {
  const seen = new Set(), q = seeds.filter(s => NAMESET.has(s));
  const missing = seeds.filter(s => !NAMESET.has(s));
  while (q.length) {
    const n = q.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    for (const c of edges[n] || []) if (!seen.has(c)) q.push(c);
  }
  return { set: seen, missing };
}
const filesOf = set => new Set(Array.from(set).map(n => declFile[n]).filter(Boolean));
const sum = arr => arr.reduce((a, f) => a + (fileBytes[f] || 0), 0);
const kb = n => (n / 1024).toFixed(1) + 'kb';

const ENTRIES = {
  'VIEW hr_verification':   ['serveHRVerification'],
  'SUBMIT hr_verification': ['submitHRVerification', 'getHRVerificationData'],
  'VIEW initial_request':   ['serveInitialRequest'],
  'VIEW it_setup':          ['serveITSetup'],
  'VIEW dashboard':         ['serveDashboard'],
  'DATA dashboard':         ['getDashboardData', 'getMyTaskCounts'],
  'VIEW request_details':   ['serveRequestDetails'],
  'doGet (whole router)':   ['doGet'],
};

console.log('=== STRICT CLOSURE PER ENTRY POINT ===');
console.log('entry'.padEnd(26) + 'globals'.padStart(9) + 'files'.padStart(7) + 'bytes'.padStart(10));
for (const [k, seeds] of Object.entries(ENTRIES)) {
  const c = closure(seeds);
  const fl = Array.from(filesOf(c.set));
  console.log(k.padEnd(26) + String(c.set.size).padStart(9) + String(fl.length).padStart(7) + kb(sum(fl)).padStart(10) +
    (c.missing.length ? '   [seed not found: ' + c.missing.join(',') + ']' : ''));
}

const ALLB = files.reduce((a, f) => a + fileBytes[f.rel], 0);
console.log('\nwhole project parsed per request: ' + kb(ALLB) + ' across ' + files.length + ' files');

// Seeds verified against real declarations and real google.script.run targets in the HTML.
const FORM_SEEDS = ['serveInitialRequest', 'serveEquipmentRequest', 'serveIDSetup', 'serveHRVerification',
  'serveITSetup', 'serveSpecialist', 'serveTerminationRequest', 'servePositionSiteChange',
  'serveTerminationApproval', 'servePositionChangeApproval', 'serveITConfirmation', 'serveLandingPage',
  'serveRefPage', 'serveAccessDenied',
  'submitInitialRequest', 'submitEquipmentRequest', 'submitEmployeeIDSetup', 'submitHRVerification',
  'submitITSetup', 'submitITConfirmation', 'submitSpecialistForm', 'submitTerminationRequest',
  'submitPositionChangeRequest', 'submitTerminationApproval', 'submitPositionChangeApproval',
  'getHRVerificationData', 'getSitesList', 'getJRsList', 'getInitialFormData',
  'getCurrentUserDetails', 'searchDirectoryUsers'];
const DASH_SEEDS = ['serveDashboard', 'serveWorkflowMap', 'serveRequestDetails', 'getDashboardData',
  'getMyTaskCounts', 'adminDeleteWorkflows', 'bumpRequest', 'cancelRequest',
  'getEquipmentRequestDetails', 'getRequestDetails', 'getStepResultData', 'getTerminationDetails',
  'getWorkflowMapStats', 'updateHireDate'];
const N8N_SEEDS = ['doPost'].concat(NAMES.filter(n => /^n8n_/.test(n)));

const F = closure(FORM_SEEDS), D = closure(DASH_SEEDS), N = closure(N8N_SEEDS);
for (const [lbl, c] of [['form', F], ['dash', D], ['n8n', N]]) {
  if (c.missing.length) console.log('\n[' + lbl + ' seeds not found: ' + c.missing.join(', ') + ']');
}
const fF = filesOf(F.set), fD = filesOf(D.set), fN = filesOf(N.set);

const bucket = {};
for (const f of files) {
  const k = (fF.has(f.rel) ? 'F' : '') + (fD.has(f.rel) ? 'D' : '') + (fN.has(f.rel) ? 'N' : '');
  (bucket[k || 'none'] = bucket[k || 'none'] || []).push(f.rel);
}
const LABEL = {
  F: 'FORMS only', D: 'DASHBOARD only', N: 'N8N only',
  FD: 'forms + dashboard', FN: 'forms + n8n', DN: 'dashboard + n8n',
  FDN: 'all three (true core)', none: 'REACHED BY NOTHING',
};
function show(k) {
  const arr = bucket[k] || [];
  if (!arr.length) return;
  console.log('\n-- ' + LABEL[k] + '  ' + kb(sum(arr)) + '  (' + arr.length + ' files)');
  arr.slice().sort((a, b) => fileBytes[b] - fileBytes[a]).forEach(f => console.log('     ' + f.padEnd(34) + kb(fileBytes[f])));
}
console.log('\n\n=== FILE ATTRIBUTION (strict call sites, three consumers) ===');
['FDN', 'FD', 'FN', 'DN', 'F', 'D', 'N', 'none'].forEach(show);

const B = k => sum(bucket[k] || []);
console.log('\n=== SPLIT SCENARIOS ===');
console.log('  today: every request parses      ' + kb(ALLB));
console.log('');
console.log('  Forms project     = F+FD+FN+FDN  ' + kb(B('F') + B('FD') + B('FN') + B('FDN')));
console.log('  Dashboard project = D+FD+DN+FDN  ' + kb(B('D') + B('FD') + B('DN') + B('FDN')));
console.log('  n8n project       = N+FN+DN+FDN  ' + kb(B('N') + B('FN') + B('DN') + B('FDN')));
console.log('  true core duplicated into all    ' + kb(B('FDN')));
console.log('  deletable from prod entirely     ' + kb(B('none')));
