// READ-ONLY. Simulates what Apps Script actually does on each request:
//   A) parses EVERY server .js into one global scope  -> per-request parse cost
//   B) evaluates one HTML template, expanding include() -> delivered payload
// Executes nothing from the app.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || 'P:/Repos/github/danieljbinns/APP SCRIPT FORMS/employee_forms_deployment/employee_management_v2';

const read = p => fs.readFileSync(p, 'utf8');
const kb = n => (n / 1024).toFixed(1) + 'kb';

function walk(dir, base) {
  base = base || '';
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(walk(p, rel));
    else if (/\.(js|html)$/.test(e.name)) out.push({ rel, p, src: read(p) });
  }
  return out;
}
const all = walk(SRC);
const jsFiles = all.filter(f => f.rel.endsWith('.js'));
const htmlByName = {};
for (const f of all) if (f.rel.endsWith('.html')) htmlByName[path.basename(f.rel, '.html')] = f;

// ── A. server bundle ─────────────────────────────────────────────────────────
const totalJsBytes = jsFiles.reduce((a, f) => a + Buffer.byteLength(f.src), 0);

// Top-level statements run on EVERY request (Apps Script re-parses + re-executes
// the global scope per execution). Anything doing work here is a per-request tax.
const TOP = /^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*?);?\s*$/;
const topLevel = [];
for (const f of jsFiles) {
  const lines = f.src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!/^(?:var|let|const)\s/.test(L)) continue;
    const m = L.match(/^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(.*)$/);
    if (!m) continue;
    // measure the whole initialiser by brace/bracket balance
    let depth = 0, j = i, buf = '';
    do {
      buf += lines[j] + '\n';
      for (const c of lines[j]) {
        if ('{(['.includes(c)) depth++;
        else if ('})]'.includes(c)) depth--;
      }
      j++;
    } while (depth > 0 && j < lines.length && j - i < 400);
    const body = m[2] + buf.slice(buf.indexOf('\n') + 1);
    const calls = (body.match(/\b(?:SpreadsheetApp|DriveApp|PropertiesService|CacheService|Session|UrlFetchApp|GmailApp|MailApp|CalendarApp|Logger)\s*\./g) || []);
    topLevel.push({
      file: f.rel, name: m[1], line: i + 1,
      lines: j - i, bytes: Buffer.byteLength(buf),
      services: Array.from(new Set(calls.map(c => c.replace(/\s*\.$/, '')))),
    });
    i = j - 1;
  }
}

console.log('=== A. SERVER BUNDLE (parsed on EVERY request) ===');
console.log('  server .js files      : ' + jsFiles.length);
console.log('  total bytes parsed    : ' + kb(totalJsBytes));
console.log('  top-level initialisers: ' + topLevel.length + '  (re-executed every request)');
const heavy = topLevel.filter(t => t.services.length).sort((a, b) => b.bytes - a.bytes);
console.log('\n  -- top-level work calling a Google service (per-request cost) --');
console.log(heavy.length
  ? heavy.map(t => '    ' + (t.file + ':' + t.line).padEnd(40) + t.name.padEnd(28) + t.services.join(',')).join('\n')
  : '    none');
console.log('\n  -- 12 largest top-level initialisers --');
topLevel.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 12)
  .forEach(t => console.log('    ' + (t.file + ':' + t.line).padEnd(40) + t.name.padEnd(30) + String(t.lines).padStart(4) + ' lines  ' + kb(t.bytes)));
console.log('\n  -- heaviest files by bytes parsed --');
jsFiles.slice().sort((a, b) => Buffer.byteLength(b.src) - Buffer.byteLength(a.src)).slice(0, 10)
  .forEach(f => console.log('    ' + f.rel.padEnd(40) + kb(Buffer.byteLength(f.src))));

// ── B. per-route delivered payload ───────────────────────────────────────────
const deptSrc = (htmlByName.__none || { src: '' }).src;
let deptMap = {};
try {
  const sp = read(path.join(SRC, 'Specialist.js'));
  const blk = sp.slice(sp.indexOf('const deptMap'));
  const body = blk.slice(blk.indexOf('{'), blk.indexOf('}') + 1);
  body.replace(/['"]?([\w]+)['"]?\s*:\s*['"]([^'"]+)['"]/g, (_, k, v) => { deptMap[k] = v; return ''; });
} catch (e) { console.log('(deptMap parse failed: ' + e.message + ')'); }

const ROUTES = {
  '(landing)': 'LandingPage', initial_request: 'InitialRequest', equipment_request: 'InitialRequest',
  dashboard: 'Dashboard', workflow_map: 'WorkflowMap', request_details: 'RequestDetails',
  id_setup: 'EmployeeIDSetup', hr_verification: 'HRVerification', it_setup: 'ITSetup',
  termination_request: 'TerminationRequest', position_site_change: 'PositionSiteChangeRequest',
  termination_approval: 'TerminationApproval', position_change_approval: 'StatusChangeApproval',
  it_confirmation: 'InitialRequest', action_item_view: 'ActionItemForm',
  ref_deck: 'Employee-Portal-Training-Deck', ref_new_hire: 'new-hire-submitter',
  ref_equipment: 'equipment-request-submitter', ref_termination: 'termination-submitter',
  ref_status_change: 'status-change-submitter', '(maintenance)': 'MaintenancePage',
};
for (const d of Object.keys(deptMap)) ROUTES['specialist?dept=' + d] = deptMap[d];

const INC = /(?:safeInclude|includeWithData|include)\(\s*['"]([^'"]+)['"]/g;
function expand(name, seen) {
  seen = seen || new Set();
  const f = htmlByName[name];
  if (!f) return { bytes: 0, parts: ['<MISSING ' + name + '>'], missing: [name] };
  if (seen.has(name)) return { bytes: 0, parts: [], missing: [] };
  seen.add(name);
  let bytes = Buffer.byteLength(f.src), parts = [name], missing = [];
  INC.lastIndex = 0;
  let m;
  const kids = [];
  while ((m = INC.exec(f.src))) kids.push(m[1]);
  for (const k of kids) {
    const r = expand(k, seen);
    bytes += r.bytes; parts = parts.concat(r.parts); missing = missing.concat(r.missing);
  }
  return { bytes, parts, missing };
}

console.log('\n\n=== B. DELIVERED HTML PAYLOAD PER ROUTE (template + includes) ===');
const rows = [];
for (const [route, tpl] of Object.entries(ROUTES)) {
  const r = expand(tpl);
  const f = htmlByName[tpl];
  const scripts = f ? (f.src.match(/<script\b/g) || []).length : 0;
  const styles = f ? (f.src.match(/<style\b/g) || []).length : 0;
  const runs = f ? (f.src.match(/google\.script\.run/g) || []).length : 0;
  rows.push({ route, tpl, bytes: r.bytes, parts: r.parts.length, scripts, styles, runs, missing: r.missing });
}
rows.sort((a, b) => b.bytes - a.bytes);
console.log('route'.padEnd(30) + 'template'.padEnd(32) + 'payload'.padStart(9) + 'files'.padStart(7) + 'script'.padStart(8) + 'style'.padStart(7) + 'run()'.padStart(7));
for (const r of rows) {
  console.log(r.route.padEnd(30) + r.tpl.padEnd(32) + kb(r.bytes).padStart(9) +
    String(r.parts).padStart(7) + String(r.scripts).padStart(8) + String(r.styles).padStart(7) + String(r.runs).padStart(7) +
    (r.missing.length ? '   MISSING: ' + r.missing.join(',') : ''));
}

// reachability
const reached = new Set();
for (const r of rows) expand(r.tpl).parts.forEach(p => reached.add(p));
const unreached = Object.keys(htmlByName).filter(n => !reached.has(n));
console.log('\n=== HTML NOT REACHABLE FROM ANY ROUTE ===');
console.log(unreached.length ? unreached.map(n => '  ' + n + '.html  ' + kb(Buffer.byteLength(htmlByName[n].src))).join('\n') : '  none');
