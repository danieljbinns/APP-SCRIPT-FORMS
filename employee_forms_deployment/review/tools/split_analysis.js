// READ-ONLY. Would splitting Dashboard and Forms into two Apps Script projects pay?
// Walks the call graph from each side's entry points and attributes every server .js file
// to forms-only / dashboard-only / shared / unreachable.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || 'P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_deployment/employee_management_v2';

function walk(dir, base) {
  base = base || ''; let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name), rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(walk(p, rel));
    else if (/\.(js|html)$/.test(e.name)) out.push({ rel, src: fs.readFileSync(p, 'utf8') });
  }
  return out;
}
const all = walk(SRC);
const js = all.filter(f => f.rel.endsWith('.js'));
const html = all.filter(f => f.rel.endsWith('.html'));

// ── globals: name -> file, and name -> body text ─────────────────────────────
const fileOf = {}, bodyOf = {}, sizeOf = {};
for (const f of js) {
  sizeOf[f.rel] = Buffer.byteLength(f.src);
  const lines = f.src.split('\n');
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
    } while ((!started || depth > 0) && j < lines.length && j - i < 1200);
    fileOf[name] = f.rel;
    bodyOf[name] = buf;
  }
}
const NAMES = Object.keys(fileOf);
const WB = String.fromCharCode(92) + 'b';
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, c => String.fromCharCode(92) + c);

// precompute: which known globals does each body mention?
const callsOf = {};
for (const n of NAMES) {
  const body = bodyOf[n];
  const hits = [];
  for (const m of NAMES) {
    if (m === n) continue;
    if (new RegExp(WB + esc(m) + WB).test(body)) hits.push(m);
  }
  callsOf[n] = hits;
}

// ── entry points ─────────────────────────────────────────────────────────────
const DASH_HTML = ['Dashboard.html', 'WorkflowMap.html', 'RequestDetails.html'];
const DASH_SEED = ['serveDashboard', 'serveWorkflowMap', 'serveRequestDetails', 'doGet'];
const FORM_SEED = ['serveInitialRequest', 'serveEquipmentRequest', 'serveIDSetup', 'serveHRVerification',
  'serveITSetup', 'serveSpecialist', 'serveTerminationRequest', 'servePositionSiteChange',
  'serveTerminationApproval', 'servePositionChangeApproval', 'serveITConfirmation', 'serveLandingPage'];

// add google.script.run targets per side
function runTargets(files) {
  const out = new Set();
  for (const f of files) {
    for (const n of NAMES) {
      if (new RegExp(WB + esc(n) + WB).test(f.src)) out.add(n);
    }
  }
  return [...out];
}
const dashRun = runTargets(html.filter(f => DASH_HTML.includes(f.rel)));
const formRun = runTargets(html.filter(f => !DASH_HTML.includes(f.rel)));

function reach(seeds) {
  const seen = new Set(), q = seeds.filter(n => fileOf[n]);
  while (q.length) {
    const n = q.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    for (const c of callsOf[n] || []) if (!seen.has(c)) q.push(c);
  }
  return seen;
}
const dash = reach([...DASH_SEED, ...dashRun]);
const form = reach([...FORM_SEED, ...formRun]);

// ── attribute files ──────────────────────────────────────────────────────────
const cat = {};
for (const f of js) {
  const names = NAMES.filter(n => fileOf[n] === f.rel);
  const inD = names.some(n => dash.has(n));
  const inF = names.some(n => form.has(n));
  cat[f.rel] = inD && inF ? 'shared' : inD ? 'dashboard-only' : inF ? 'forms-only' : 'unreachable';
}
const tot = c => js.filter(f => cat[f.rel] === c).reduce((a, f) => a + sizeOf[f.rel], 0);
const kb = n => (n / 1024).toFixed(1) + 'kb';
const ALL = js.reduce((a, f) => a + sizeOf[f.rel], 0);

console.log('=== SERVER BUNDLE ATTRIBUTION (every request parses ALL of it today) ===');
for (const c of ['shared', 'forms-only', 'dashboard-only', 'unreachable']) {
  const fl = js.filter(f => cat[f.rel] === c).sort((a, b) => sizeOf[b.rel] - sizeOf[a.rel]);
  console.log('\n-- ' + c.toUpperCase() + '  ' + kb(tot(c)) + '  (' + (tot(c) / ALL * 100).toFixed(1) + '%, ' + fl.length + ' files)');
  fl.slice(0, 14).forEach(f => console.log('     ' + f.rel.padEnd(36) + kb(sizeOf[f.rel]).padStart(9)));
  if (fl.length > 14) console.log('     ... +' + (fl.length - 14) + ' more');
}

console.log('\n\n=== WHAT A SPLIT WOULD COST EACH SIDE ===');
console.log('  today, both sides parse           : ' + kb(ALL));
const sh = tot('shared');
console.log('  Forms project   = shared + forms  : ' + kb(sh + tot('forms-only')) +
            '   (saves ' + kb(ALL - sh - tot('forms-only')) + ')');
console.log('  Dashboard proj  = shared + dash   : ' + kb(sh + tot('dashboard-only')) +
            '   (saves ' + kb(ALL - sh - tot('dashboard-only')) + ')');
console.log('  shared code duplicated into both  : ' + kb(sh));
console.log('  unreachable (dev/admin) removable : ' + kb(tot('unreachable')) + '  <- costs nothing to split, just delete');
