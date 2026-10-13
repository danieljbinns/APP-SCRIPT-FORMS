'use strict';
/**
 * dashboard-test.js — badge counts, derived onboarding step, and count↔filter reconciliation.
 *
 * WHY THIS EXISTS: DashboardDataHandler.js had no test coverage at all, so the whole suite could be
 * green while the dashboard lied to the user. Three real bugs lived here:
 *   1. badges counted TASKS while the table listed WORKFLOWS, so the numbers never matched
 *   2. open tasks on Cancelled/Inactive workflows were counted but could never be shown
 *   3. ID Setup vanished from the badge and filter whenever HR Verification completed first,
 *      because both are step-only and share the one overwritable 'Current Step' slot
 *
 * The client filter predicate is NOT re-implemented here — it is extracted verbatim from
 * Dashboard.html and executed, so server counts are reconciled against the real client code and the
 * two cannot drift apart silently.
 *
 * Run:  node __tests__/dashboard-test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.resolve(__dirname, '..');
const { makeRuntime } = require('./gas-runtime');
const FX = require('./efx-fixtures');

// ── harness ───────────────────────────────────────────────────────────────────
const rt = makeRuntime();
const ctx = vm.createContext({ ...rt.globals, console, Date, Set, Object, String, Array, JSON, Math, globalThis: undefined });
ctx.globalThis = ctx;
let code = '';
for (const rel of FX.LOAD_ORDER.concat(['DashboardDataHandler.js'])) {
  const f = path.join(SRC, rel);
  if (fs.existsSync(f)) code += `\n// == ${rel} ==\n` + fs.readFileSync(f, 'utf8');
}
vm.runInContext(code, ctx);

// ── extract the REAL client predicate from Dashboard.html ─────────────────────
const html = fs.readFileSync(path.join(SRC, 'Dashboard.html'), 'utf8');
function grab(startMarker, endMarker) {
  const a = html.indexOf(startMarker);
  if (a < 0) throw new Error('Dashboard.html changed — could not find: ' + startMarker);
  const b = html.indexOf(endMarker, a);
  if (b < 0) throw new Error('Dashboard.html changed — no end marker after: ' + startMarker);
  return html.slice(a, b + endMarker.length);
}
const stepTermsSrc = grab('const STEP_CATEGORY_TERMS = {', '};');
const predicateSrc = grab('function matchesActiveCategory() {', '\n                const inActiveCategory')
  .replace(/\n\s*const inActiveCategory[\s\S]*$/, '');
const clientMatches = new Function('wf', 'activeCategoryFilter',
  stepTermsSrc + '\n' + predicateSrc + '\n return matchesActiveCategory();');

// ── assertions ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];
function eq(label, got, want) {
  if (String(got) === String(want)) { passed++; console.log('    ✓  ' + label); }
  else { failed++; failures.push(label + '  got=' + got + ' want=' + want); console.log('    ✗  ' + label + '   got=' + got + ' want=' + want); }
}
function section(t) { console.log('\n  ▶ ' + t); }

// ── seed ──────────────────────────────────────────────────────────────────────
const seed = rt.captures.seedSheet.bind(rt.captures);
const { AI_HEADERS: AI, WF_HEADERS: WF, IR_HEADERS: IR, ID_HEADERS: ID, HR_HEADERS: HR, IT_HEADERS: IT, DASH_HEADERS: DASH } = FX;
function row(headers, pairs) {
  const r = new Array(headers.length).fill('');
  Object.keys(pairs).forEach(k => { const i = headers.indexOf(k); if (i >= 0) r[i] = pairs[k]; });
  return r;
}

// W1: HR completed BEFORE ID Setup — the reported bug. Step string no longer mentions ID Setup.
// W2: nothing done yet.
// W3: ID + HR done, IT outstanding.
// W4: Hourly with no system access — IT is skipped entirely.
// W5: Cancelled — must not count and must not appear.
seed('Workflows', [WF,
  row(WF, { 'Workflow ID': 'NEW_EMP_W1', 'Status': 'In Progress', 'Current Step': 'HR Verification Complete' }),
  row(WF, { 'Workflow ID': 'NEW_EMP_W2', 'Status': 'In Progress', 'Current Step': 'ID Setup Needed' }),
  row(WF, { 'Workflow ID': 'NEW_EMP_W3', 'Status': 'In Progress', 'Current Step': 'IT Setup Needed' }),
  row(WF, { 'Workflow ID': 'NEW_EMP_W4', 'Status': 'In Progress', 'Current Step': 'Specialist Forms Needed' }),
  row(WF, { 'Workflow ID': 'NEW_EMP_W5', 'Status': 'Cancelled',   'Current Step': 'ID Setup Needed' }),
]);
seed('Initial Requests', [IR,
  row(IR, { 'Workflow ID': 'NEW_EMP_W1', 'Employment Type': 'Salary', 'System Access': 'Yes' }),
  row(IR, { 'Workflow ID': 'NEW_EMP_W2', 'Employment Type': 'Salary', 'System Access': 'Yes' }),
  row(IR, { 'Workflow ID': 'NEW_EMP_W3', 'Employment Type': 'Salary', 'System Access': 'Yes' }),
  row(IR, { 'Workflow ID': 'NEW_EMP_W4', 'Employment Type': 'Hourly', 'System Access': 'No'  }),
  row(IR, { 'Workflow ID': 'NEW_EMP_W5', 'Employment Type': 'Salary', 'System Access': 'Yes' }),
]);
seed('ID Setup Results', [ID,
  row(ID, { 'Workflow ID': 'NEW_EMP_W3', 'Internal Employee ID': '900003' }),
  row(ID, { 'Workflow ID': 'NEW_EMP_W4', 'Internal Employee ID': '900004' }),
]);
seed('HR Verification Results', [HR,
  row(HR, { 'Workflow ID': 'NEW_EMP_W1', 'ADP Associate ID': 'A1' }),   // HR before ID — the bug case
  row(HR, { 'Workflow ID': 'NEW_EMP_W3', 'ADP Associate ID': 'A3' }),
  row(HR, { 'Workflow ID': 'NEW_EMP_W4', 'ADP Associate ID': 'A4' }),
]);
seed('IT Results', [IT]);
seed('Action Items', [AI,
  row(AI, { 'Workflow ID': 'NEW_EMP_W2', 'Category': 'Safety', 'Status': 'Open', 'Task ID': 'TK-1', 'Task Name': 'Safety Onboarding' }),
  row(AI, { 'Workflow ID': 'NEW_EMP_W2', 'Category': 'Safety', 'Status': 'Open', 'Task ID': 'TK-2', 'Task Name': 'Safety Extra' }),
  row(AI, { 'Workflow ID': 'NEW_EMP_W5', 'Category': 'Fleet',  'Status': 'Open', 'Task ID': 'TK-3', 'Task Name': 'Fleetio' }),
  row(AI, { 'Workflow ID': 'NEW_EMP_W3', 'Category': 'HR',      'Status': 'Open', 'Task ID': 'TK-4', 'Task Name': 'HR thing' }),
  row(AI, { 'Workflow ID': 'NEW_EMP_W3', 'Category': 'Payroll', 'Status': 'Open', 'Task ID': 'TK-5', 'Task Name': 'Payroll thing' }),
  row(AI, { 'Workflow ID': 'NEW_EMP_W2', 'Category': 'Safety', 'Status': 'Closed', 'Task ID': 'TK-6', 'Task Name': 'done' }),
]);
seed('Dashboard_View', [DASH,
  row(DASH, { 'Workflow ID': 'NEW_EMP_W1', 'Employee Name': 'W One',   'Global Status': 'In Progress', 'Granular Step Details': 'HR Verification Complete' }),
  row(DASH, { 'Workflow ID': 'NEW_EMP_W2', 'Employee Name': 'W Two',   'Global Status': 'In Progress', 'Granular Step Details': 'ID Setup Needed' }),
  row(DASH, { 'Workflow ID': 'NEW_EMP_W3', 'Employee Name': 'W Three', 'Global Status': 'In Progress', 'Granular Step Details': 'IT Setup Needed' }),
  row(DASH, { 'Workflow ID': 'NEW_EMP_W4', 'Employee Name': 'W Four',  'Global Status': 'In Progress', 'Granular Step Details': 'Specialist Forms Needed' }),
  row(DASH, { 'Workflow ID': 'NEW_EMP_W5', 'Employee Name': 'W Five',  'Global Status': 'Cancelled',   'Granular Step Details': 'ID Setup Needed' }),
]);

// ── run ───────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(78));
console.log('  DASHBOARD — counts, derived step, count↔filter reconciliation');
console.log('='.repeat(78));

const res = ctx.getMyTaskCounts();
if (!res || res.success !== true) { console.error('getMyTaskCounts failed'); process.exit(1); }
const counts = res.counts;

let dash = ctx.getDashboardData();            // returns a JSON string (called via google.script.run)
if (typeof dash === 'string') dash = JSON.parse(dash);
if (!dash || !dash.workflows) { console.error('getDashboardData returned no workflows'); process.exit(1); }
const byId = {};
dash.workflows.forEach(w => { byId[w.id] = w; });

section('derived onboarding step (data-based, not the Current Step string)');
eq('W1: HR done first, ID never done → ID Setup still pending', byId['NEW_EMP_W1'] && byId['NEW_EMP_W1'].pendingStep, 'ID Setup');
eq('W2: nothing done → ID Setup pending',                        byId['NEW_EMP_W2'] && byId['NEW_EMP_W2'].pendingStep, 'ID Setup');
eq('W3: ID + HR done → IT pending',                              byId['NEW_EMP_W3'] && byId['NEW_EMP_W3'].pendingStep, 'IT');
eq('W4: Hourly, no system access → IT skipped, nothing pending', byId['NEW_EMP_W4'] && byId['NEW_EMP_W4'].pendingStep, '');
eq('W5: Cancelled → absent from the table',                      dash.workflows.some(w => w.id === 'NEW_EMP_W5'), false);

section('the reported bug: a later step must not hide an earlier one');
eq('W1 matches the ID Setup filter despite the step string', clientMatches(byId['NEW_EMP_W1'], 'ID Setup'), true);
eq('W1 does NOT match ADP/HR (HR is already done)',          clientMatches(byId['NEW_EMP_W1'], '__ADPHR__'), false);
eq('W3 matches ADP/HR via its open HR task',                 clientMatches(byId['NEW_EMP_W3'], '__ADPHR__'), true);

section('badge counts equal the rows the table would show');
['Safety', 'Fleet', 'IT', 'ID Setup', 'Business Cards', 'Purchasing', 'Finance', 'Assets', 'WIS', 'Manager'].forEach(cat => {
  eq('badge "' + cat + '" = filtered rows', counts[cat], dash.workflows.filter(w => clientMatches(w, cat)).length);
});
eq('badge "ADP/HR" = filtered rows', counts['ADP/HR'], dash.workflows.filter(w => clientMatches(w, '__ADPHR__')).length);

section('counting rules');
eq('Safety = 1 — two open tasks on one workflow is one row',  counts['Safety'], 1);
eq('Safety ignores the Closed task',                               counts['Safety'], 1);
eq('Fleet = 0 — its only task is on a Cancelled workflow',    counts['Fleet'], 0);
eq('ID Setup = 2 — W1 (was lost) + W2',                       counts['ID Setup'], 2);
eq('IT = 1 — W3 only; W4 skips IT',                           counts['IT'], 1);
eq('ADP/HR = 1 — HR + Payroll on one workflow is one row',    counts['ADP/HR'], 1);
eq('per-type bucket agrees with the total (Onboarding/ID Setup)',  res.countsByType['Onboarding']['ID Setup'], 2);

section('cache');
const first  = JSON.stringify(ctx.computeOnboardingPendingStep_(ctx.SpreadsheetApp.openById('x')));
const second = JSON.stringify(ctx.computeOnboardingPendingStep_(ctx.SpreadsheetApp.openById('x')));
eq('repeat call returns an identical map (cache round-trips cleanly)', second, first);

// ── summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(78));
console.log('  TOTAL: ' + passed + ' passed, ' + failed + ' failed');
if (failed) { console.log('\n  Failures:'); failures.forEach(f => console.log('   • ' + f)); }
console.log('─'.repeat(78) + '\n');
process.exit(failed === 0 ? 0 : 1);
