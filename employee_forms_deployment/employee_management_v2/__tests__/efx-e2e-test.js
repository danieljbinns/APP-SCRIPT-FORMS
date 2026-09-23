'use strict';
/**
 * efx-e2e-test.js — exhaustive end-to-end chains for employee_management_v2_efx on the Node GAS mock runtime.
 *
 * NO real Google calls, NO emails sent (MailApp is the mock; every message is captured and logged), no deploys.
 * Every chain asserts sheet state after EVERY step and records every captured email + sheet write into a markdown
 * log at ../docs/test-logs/efx-e2e-<YYYYMMDD-HHmm>.md.
 *
 *   node __tests__/efx-e2e-test.js          (exit 1 on any real failure; recorded defects are reported, not fatal)
 *   node __tests__/efx-e2e-test.js --strict (also exit 1 on recorded defects)
 *
 * Conventions
 *   • eq/truthy/contains  — normal assertions.
 *   • defect(...)         — an assertion that encodes the INTENDED behaviour but is known to fail because of a real
 *                           bug in the handlers (never "fixed" here). Counted as a failure, listed separately.
 *   • note(...)           — an observation written to the log (no pass/fail).
 *   • Mock gaps are patched on the context in patchMockGaps() and listed in the log.
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { makeRuntime } = require('./gas-runtime');

const SRC = path.resolve(__dirname, '..');
const FORK_ROOT = path.resolve(SRC, '..');
const LOG_DIR = path.join(FORK_ROOT, 'docs', 'test-logs');

const FX = require('./efx-fixtures');           // shared with efx-test.js: LOAD_ORDER, headers, seedBase
const LOAD_ORDER = FX.LOAD_ORDER;

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
let _ctx, _rt;
const MOCK_WORKAROUNDS = [];

function buildContext() {
  _rt  = makeRuntime();
  _ctx = vm.createContext({ ..._rt.globals, console, Date, globalThis: undefined });
  _ctx.globalThis = _ctx;
  let code = '';
  for (const rel of LOAD_ORDER) { const f = path.join(SRC, rel); if (fs.existsSync(f)) code += `\n// == ${rel} ==\n` + fs.readFileSync(f, 'utf8'); }
  vm.runInContext(code, _ctx);
  _ctx.createEmailTemplateV2 = (s, b) => '<html><body><h2>' + (s || '') + '</h2><p>' + (b || '') + '</p></body></html>';
  _ctx.include = () => '';
  const orig = _ctx.sendFormEmail;
  _ctx.sendFormEmail = function (opts) { _rt.captures.pushEmailOptions(opts); try { return orig(opts); } catch (e) { _rt.captures.pushEmailOptions({ __error: e.message }); } };
  patchMockGaps();
}

/** Stubs for GAS features the mock lacks. Each one is listed in the log. */
function patchMockGaps() {
  // 1. Range A1-notation + TextFinder: syncWorkflowState, getRequestDetails, getRequiredSpecialistCats, StateSync all use
  //    sheet.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext(). Without this, Dashboard_View never
  //    syncs, n8n_getWorkflow returns E_NOT_FOUND and the onboarding "required categories" filter fails open.
  _rt.captures.seedSheet('__probe__', [['x']]);
  const SheetProto = Object.getPrototypeOf(_rt.captures.getSheet('__probe__'));
  _rt.captures.reset();
  if (!SheetProto.__e2ePatched) {
    const origGetRange = SheetProto.getRange;
    SheetProto.getRange = function (row, col, numRows, numCols) {
      if (typeof row === 'string') {
        const m = /^([A-Z]+)(\d*):([A-Z]+)(\d*)$/.exec(row);
        const sheet = this;
        const colIdx = m ? (m[1].charCodeAt(0) - 65) : 0;
        const startRow = (m && m[2]) ? parseInt(m[2], 10) : 1;
        return {
          createTextFinder(text) {
            let entire = false;
            return {
              matchEntireCell(v) { entire = (v !== false); return this; },
              findNext() {
                for (let i = startRow - 1; i < sheet._rows.length; i++) {
                  const v = String(sheet._rows[i][colIdx] === undefined ? '' : sheet._rows[i][colIdx]);
                  if (entire ? v === String(text) : v.indexOf(String(text)) !== -1) { const r = i + 1; return { getRow() { return r; }, getValue() { return v; } }; }
                }
                return null;
              }
            };
          },
          getValues() { return sheet._rows.slice(startRow - 1).map(r => [r[colIdx] === undefined ? '' : r[colIdx]]); }
        };
      }
      return origGetRange.call(this, row, col, numRows, numCols);
    };
    SheetProto.__e2ePatched = true;
  }
  MOCK_WORKAROUNDS.push("Sheet.getRange('A:A').createTextFinder(...).matchEntireCell().findNext() — implemented on the mock SheetMock prototype (used by syncWorkflowState, getRequestDetails, getRequiredSpecialistCats).");

  // 2. AdminDirectory (Admin SDK advanced service) — AccessControlService._inGroup calls it inside try/catch; stub it so the
  //    code path is exercised deterministically (no group membership → only exact-match / ADMIN_EMAILS roles).
  _ctx.AdminDirectory = {
    Members: { hasMember() { return { isMember: false }; } },
    Users:   { get() { throw new Error('Not Authorized'); } }
  };
  MOCK_WORKAROUNDS.push('AdminDirectory stub: Members.hasMember → isMember:false, Users.get → throws "Not Authorized" (role checks rely on exact group-address match or CONFIG.ADMIN_EMAILS).');

  // 3. Utilities.formatDate single-letter month token 'M' (fmtDate_ in TerminationHandler uses 'M/d/yyyy').
  const origFmt = _ctx.Utilities.formatDate;
  _ctx.Utilities.formatDate = function (date, tz, format) {
    const out = origFmt(date, tz, format);
    const d = date instanceof Date ? date : new Date(String(date || ''));
    return isNaN(d) ? out : out.replace(/(?<![a-zA-Z])M(?![a-zA-Z])/, String(d.getMonth() + 1));
  };
  MOCK_WORKAROUNDS.push("Utilities.formatDate: added the single 'M' month token (mock only handled MM/MMM).");
}

// ─────────────────────────────────────────────────────────────────────────────
// Assertions + logging
// ─────────────────────────────────────────────────────────────────────────────
let P = 0, F = [];
const pass = l => { P++; console.log('    ✓  ' + l); };
const fail = (l, got, exp) => { F.push({ label: l, got, expected: exp }); console.log('    ✗  ' + l + '\n         got:      ' + JSON.stringify(got) + '\n         expected: ' + JSON.stringify(exp)); };
const eq = (l, got, exp) => (String(got ?? '') === String(exp ?? '') ? pass(l) : fail(l, got, exp));
const truthy = (l, got) => (got ? pass(l) : fail(l, got, 'truthy'));
const contains = (l, got, s) => (String(got || '').includes(s) ? pass(l) : fail(l, got, '(contains) ' + s));
const setEq = (l, got, exp) => { const a = [...got].sort(), b = [...exp].sort(); (JSON.stringify(a) === JSON.stringify(b)) ? pass(l) : fail(l, a, b); };
/** Intended behaviour that a known handler defect breaks. Counted as FAIL, listed under "Defects". */
const defect = (l, cond, got, exp, ref) => {
  if (cond) { pass(l + ' (defect appears fixed: ' + ref + ')'); return; }
  F.push({ label: l, got, expected: exp, defect: true, ref });
  console.log('    ✗  DEFECT ' + l + '  [' + ref + ']\n         got:      ' + JSON.stringify(got) + '\n         expected: ' + JSON.stringify(exp));
};
const note = l => { if (cur) cur.notes.push(l); console.log('    ·  note: ' + l); };

const LOG = { runAt: new Date(), scenarios: [] };
let cur = null;

function ids(res, extra) {
  const o = {};
  if (res && typeof res === 'object') {
    const r = res.result || {};
    if (res.workflowId || r.workflowId) o.workflowId = res.workflowId || r.workflowId;
    if (res.taskId || r.taskId) o.taskId = res.taskId || r.taskId;
    if (res.internalEmployeeId || r.internalEmployeeId) o.internalEmployeeId = res.internalEmployeeId || r.internalEmployeeId;
    if (res.requestId) o.requestId = res.requestId;
    if (res.error && res.error.code) o.error = res.error.code;
    if (res.success === false && res.message) o.message = String(res.message).slice(0, 60);
    if (r.count !== undefined) o.count = r.count;
    if (r.dryRun) o.dryRun = true;
  }
  return Object.assign(o, extra || {});
}
/** Run a step, record it (ok / ids / emails captured during it). okFn overrides the default ok test. */
function step(label, fnName, run, opts) {
  opts = opts || {};
  const e0 = _rt.captures.getEmailOptions().length;
  let res, threw = null;
  try { res = run(); } catch (e) { threw = e; res = { success: false, message: 'THREW: ' + e.message }; }
  const defaultOk = r => !!(r && (r.ok === true || r.success === true));
  const okFn = opts.okFn || (opts.expectFail ? (r => !defaultOk(r)) : defaultOk);
  const ok = !threw && okFn(res);
  const rec = { step: label, fn: fnName, ok, ids: ids(res, opts.ids), emails: _rt.captures.getEmailOptions().length - e0, actor: _ctx.Actor.current() ? 'LEAKED' : 'none' };
  cur.steps.push(rec);
  console.log('  ▶ ' + label + '  →  ' + (ok ? 'ok' : 'NOT OK') + '  ' + JSON.stringify(rec.ids));
  if (!ok && !opts.expectFail) fail('step ok: ' + label, res && (res.error || res.message || res), 'ok');
  if (ok && opts.expectFail) pass('step failed as expected: ' + label);
  return res;
}
function sheetSummary() {
  const out = {};
  _rt.captures.getAllWrites().forEach(w => {
    if (w.sheet === '__probe__') return;
    out[w.sheet] = out[w.sheet] || { appends: 0, updates: 0 };
    if (w.op === 'appendRow') out[w.sheet].appends++; else out[w.sheet].updates++;
  });
  return out;
}
function scenario(name, fn) {
  console.log('\n' + '─'.repeat(78) + '\n  ' + name + '\n' + '─'.repeat(78));
  _rt.captures.reset(); P = 0; F = [];
  cur = { name, steps: [], notes: [], emails: [], mail: [], sheets: {}, passed: 0, failed: 0, failures: [], defects: [] };
  try { fn(); } catch (e) { fail('Unhandled exception: ' + e.message, e.stack.split('\n').slice(0, 4).join(' | '), 'none'); }
  cur.emails = _rt.captures.getEmailOptions().map(o => ({ ...o }));
  cur.mail   = _rt.captures.getEmails().map(m => ({ to: m.to, subject: m.subject }));
  cur.sheets = sheetSummary();
  cur.passed = P; cur.failed = F.length; cur.failures = [...F]; cur.defects = F.filter(f => f.defect);
  console.log('  ' + (F.length ? '❌' : '✅') + ' ' + P + '/' + (P + F.length) + '   emails captured: ' + cur.emails.length);
  LOG.scenarios.push(cur);
  const done = cur; cur = null;
  return done;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seeds — one shared copy in efx-fixtures.js (headers must match Setup.js; the e2e and efx suites seed the same base)
// ─────────────────────────────────────────────────────────────────────────────
const seedBase = () => FX.seedBase(_rt);

// ── row helpers ──────────────────────────────────────────────────────────────
const rows   = name => (_rt.captures.getSheet(name) || { _rows: [] })._rows;
const wfRow  = wf => rows('Workflows').find(r => r[0] === wf);
const aiFor  = wf => rows('Action Items').filter(r => r[0] === wf);
const openAi = wf => aiFor(wf).filter(r => r[6] === 'Open');
const aiBy   = (wf, formType, category) => aiFor(wf).find(r => (formType == null || String(r[12]) === formType) && (category == null || String(r[2]) === category));
const catFt  = r => String(r[2]) + '/' + String(r[12] || '');
const mails  = () => _rt.captures.getEmailOptions();
const mailsSince = n => mails().slice(n);
const subjectsSince = n => mailsSince(n).map(m => m.subject);
const rawLog = () => rows('Raw Log').slice(1).map(r => ({ ts: r[0], source: r[1], wf: r[2], user: r[3], json: r[4], eventId: r[5], kind: r[6] }));
const dash   = wf => rows('Dashboard_View').find(r => r[0] === wf);

// ── actors ───────────────────────────────────────────────────────────────────
// Role checks (HR Verification, IT Setup, both approvals) resolve via AccessControlService: exact match on the group
// address or CONFIG.ADMIN_EMAILS (the AdminDirectory group lookup is stubbed → false). So automation acting for a
// team uses that team's group address as its actor email; a generic bot gets 'Access denied.' (asserted in scenario 9).
const ACTOR    = { id: 'n8n:efx-e2e',          email: 'efx-bot@team-group.com',         display: 'EFX e2e (n8n)' };
const HR_ACTOR = { id: 'n8n:hr-verification',  email: 'grp.forms.hr@team-group.com',    display: 'HR automation (n8n)' };
const IT_ACTOR = { id: 'n8n:it-setup',         email: 'grp.forms.it@team-group.com',    display: 'IT automation (n8n)' };
const DAVE     = { id: 'n8n:it-confirmation',  email: 'davelangohr@team-group.com',     display: 'IT Confirmation (n8n)' };
const ADMIN    = { id: 'n8n:admin',            email: 'dbinns@team-group.com',          display: 'admin' };
const REQ = 'dbinns@team-group.com', MGR = 'mgr@team-group.com';
const E = { HR: 'grp.forms.hr@team-group.com', IT: 'grp.forms.it@team-group.com', IDSETUP: 'grp.forms.idsetup@team-group.com', FLEET: 'grp.forms.fleetio@team-group.com', CC: 'grp.forms.creditcard@team-group.com', BC: 'davelangohr@team-group.com', REVIEW: 'grp.forms.review306090@team-group.com', JR: 'grp.forms.jrtitle@team-group.com', JONAS: 'grp.forms.jonas@team-group.com', SAFETY: 'grp.forms.safety@team-group.com', PAYROLL: 'payroll@team-group.com', DAVE: 'davelangohr@team-group.com' };

// ── payloads (new_hire contract r2: employeeType ∈ Direct Hire|Agency; employmentType ∈ Hourly|Salary) ───────────
const newHire = (over) => Object.assign({
  requesterName: 'David Binns', requesterEmail: REQ, dateRequested: '2026-09-16', hireDate: '2026-10-01',
  newHireOrRehire: 'New Hire', employeeType: 'Direct Hire', employmentType: 'Salary', firstName: 'Ada', lastName: 'Lovelace',
  positionTitle: 'Site Supervisor', siteName: 'Aurora', jobSiteNumber: 'INDIRECT - Aurora', reportingManagerName: 'Mgr One',
  reportingManagerEmail: MGR, systemAccess: 'Yes', systems: ['BOSS', 'SiteDocs Supervisor'], equipment: [], plan306090: 'Yes',
  jrRequired: 'Yes', jrAssignment: 'Site Supervisor'
}, over || {});

const FULL_SYSTEMS = ['BOSS', 'Google Account', 'SiteDocs Supervisor', 'Fleetio', 'Central Purchasing/Jonas'];
const FULL_EQUIP   = ['Business Cards', 'Computer', 'Vehicle', 'Credit Card'];
const salaryFull = () => newHire({
  systems: FULL_SYSTEMS, equipment: FULL_EQUIP, googleEmail: 'ada.lovelace', googleDomain: 'team-group.com',
  computerRequestType: 'New', computerType: 'Chromebook', phoneRequestType: 'New',
  creditCardUSA: 'Yes', creditCardLimitUSA: '2000', creditCardCanada: '', creditCardHomeDepot: '',
  bossJobSites: '1001', bossCostSheet: 'Yes', bossCostSheetJobs: '1001', bossTripReports: 'Yes', bossGrievances: 'No',
  jonasJobNumbers: 'J-100, J-200', purchasingSites: '1001', adpSites: '1001', adpSalaryAccess: 'Yes', department: 'Operations',
  comments: 'E2E scenario 1 — salary, full systems'
});
const hrPayload = (wf, over) => Object.assign({
  workflowId: wf, formId: '', firstName: 'Ada', lastName: 'Lovelace', managerName: 'Mgr One', managerEmail: MGR,
  jobTitle: 'Site Supervisor', jrTitle: 'Site Supervisor', adpAssociateId: 'ADP-100001', notes: 'Verified by HR automation',
  siteName: 'Aurora', department: 'Operations', hireDate: '2026-10-01'
}, over || {});
const itConfPayload = (wf, over) => Object.assign({
  workflowId: wf, notes: 'Confirmed by Dave', hireType: 'New Hire', employeeType: 'Direct Hire', employmentType: 'Salary',
  firstName: 'Ada', middleName: '', lastName: 'Lovelace', preferredName: '', positionTitle: 'Site Supervisor', siteName: 'Aurora',
  jobSiteNumber: 'INDIRECT - Aurora', reportingManagerEmail: MGR, reportingManagerName: 'Mgr One', systemAccess: 'Yes',
  systems: FULL_SYSTEMS, equipment: FULL_EQUIP, googleEmail: 'ada.lovelace', googleDomain: 'team-group.com',
  computerRequestType: 'New', computerType: 'Chromebook', phoneRequestType: 'New', bossJobSites: '1001', bossCostSheet: 'Yes',
  bossCostSheetJobs: '1001', bossTripReports: 'Yes', bossGrievances: 'No', jonasJobNumbers: 'J-100, J-200', adpSites: ['1001'],
  department: 'Operations', purchasingSites: ['1001']   // arrays: the IT-confirmation change-diff treats a CSV string here as "cleared" (false "Information Updated")
}, over || {});
const itSetupPayload = (wf, over) => Object.assign({
  workflowId: wf, Email_Created: 'Yes', Email_Username: 'ada.lovelace', Email_Domain: '@team-group.com', Email_Temp_Password: 'Temp#2026!',
  Computer_Assigned: 'Yes', Computer_Serial: 'SN-E2E-001', Computer_Model: 'Chromebook C736', Computer_Type: 'Chromebook',
  Phone_Assigned: 'Yes', Phone_Carrier: 'Rogers', Phone_Model: 'Pixel 8', Phone_Number: '555-0100', Phone_VM_Password: '1234',
  BOSS_Access: 'Yes', BOSS_Cmte_1001: 'Confirmed', BOSS_CostSheet_1001: 'Confirmed', BOSS_TripReports: 'Confirmed',
  Incidents_Access: 'No', CAA_Access: 'No', Delivery_App_Access: 'No', Net_Promoter_Score_Access: 'No', IT_Notes: 'E2E IT setup'
}, over || {});
const idSetupPayload = (wf, over) => Object.assign({
  workflowId: wf, siteDocsWorkerId: 'W-1001', siteDocsJobCode: 'Salary 1', siteDocsUsername: 'ada.lovelace@team-group.com',
  siteDocsPassword: 'Sd#2026', dssUsername: 'ada.lovelace', dssPassword: 'Dss#2026', bossWisCreated: 'Yes', siteDocsBadgeCreated: 'Yes', setupNotes: 'via n8n'
}, over || {});

/** Close every Open task in `tasks` (rows) via n8n_closeTask; assert workflow stays In Progress until the last one. */
function closeAll(wf, taskRows, label, opts) {
  opts = opts || {};
  taskRows.forEach((t, i) => {
    const last = i === taskRows.length - 1;
    const r = step(label + ': close ' + catFt(t) + ' (' + t[1] + ')', 'n8n_closeTask', () => _ctx.n8n_closeTask(ACTOR, { taskId: String(t[1]), notes: 'closed via n8n e2e' }));
    eq(label + ': ' + catFt(t) + ' row Closed', rows('Action Items').find(x => x[1] === t[1])[6], 'Closed');
    eq(label + ': ' + catFt(t) + ' closedBy = actor', rows('Action Items').find(x => x[1] === t[1])[10], ACTOR.email);
    if (!last && !opts.noProgressCheck) eq(label + ': workflow still In Progress after ' + catFt(t), wfRow(wf)[4], 'In Progress');
    void r;
  });
}

// ═════════════════════════════════════════════════════════════════════════════
buildContext();
console.log('EFX E2E — contracts ' + _ctx.FormContracts.VERSION + ' / api ' + _ctx.N8N_API_VERSION + ' / node ' + process.version);

// ─────────────────────────────────────────────────────────────────────────────
// 1. NEW HIRE — Salary, full systems (n8n aliases where they exist, real handlers under Actor.run where not)
// ─────────────────────────────────────────────────────────────────────────────
scenario('1. NEW HIRE — Salary, full systems: create → ID Setup → HR → IT Confirmation → IT Setup → specialists → Complete', () => {
  seedBase();

  // ── create ──
  const c = step('n8n_createInitialRequest (actor as JSON string, include=[record])', 'n8n_createInitialRequest',
    () => _ctx.n8n_createInitialRequest(JSON.stringify(ACTOR), salaryFull(), ['record']));
  const wf = c.result && c.result.workflowId;
  truthy('requestId REQ-', /^REQ-/.test(c.requestId || ''));
  truthy('workflowId NEW_EMP_', /^NEW_EMP_/.test(wf || ''));
  eq('internalEmployeeId continues from ID Setup Results max (30410 → 30411)', c.result.internalEmployeeId, '30411');
  const ir = rows('Initial Requests').find(r => r[0] === wf);
  eq('Initial Requests row has 56 columns', ir.length, 56);
  eq('IR[55] Internal Employee ID', ir[55], '30411');
  eq('IR[20] systems csv', ir[20], FULL_SYSTEMS.join(', '));
  eq('IR[47] 30/60/90 = Yes', ir[47], 'Yes');
  eq('IR[46] JR Assign', ir[46], 'Site Supervisor');
  eq('IR[30] CC USA = Yes', ir[30], 'Yes');
  eq('record read-back carries Internal Employee ID', c.record && c.record['Internal Employee ID'], '30411');
  const reg = rows('Employee IDs').find(r => r[1] === wf);
  truthy('Employee IDs registry row exists', !!reg);
  eq('registry Allocated By = actor email', reg && reg[4], ACTOR.email);
  eq('registry Source = submitInitialRequest', reg && reg[5], 'submitInitialRequest');
  let w = wfRow(wf);
  eq('Workflows Status In Progress', w[4], 'In Progress');
  eq('Workflows step ID Setup Needed', w[7], 'ID Setup Needed');
  eq('Workflows Employee Name', w[8], 'Ada Lovelace');
  const d0 = dash(wf);
  truthy('Dashboard_View row synced', !!d0);
  eq('Dashboard granular = Pending: ID Setup', d0 && d0[3], 'Pending: ID Setup');
  const rl = rawLog().filter(e => e.source === 'submitInitialRequest');
  truthy('Raw Log submit + result events for submitInitialRequest', rl.some(e => e.kind === 'submit') && rl.some(e => e.kind === 'result'));
  eq('Raw Log "submit" event of a create carries NO workflowId (id minted after rawLog) — correlate via the "result" event', rl.find(e => e.kind === 'submit').wf, '');
  eq('Raw Log "result" event carries the workflowId', rl.find(e => e.kind === 'result').wf, wf);
  truthy('Raw Log user = actor on both', rl.every(e => e.user === ACTOR.email));
  const res0 = rl.find(e => e.kind === 'result');
  truthy('result event carries internalEmployeeId + plan306090 + jrAssignment', res0 && JSON.parse(res0.json).internalEmployeeId === '30411' && JSON.parse(res0.json).plan306090 === 'Yes' && JSON.parse(res0.json).jrAssignment === 'Site Supervisor');
  setEq('emails: Request Submitted + ID Setup Required', subjectsSince(0), ['Request Submitted', 'ID Setup Required']);
  eq('ID Setup Required → ID Setup group', mails().find(m => m.subject === 'ID Setup Required').to, E.IDSETUP);
  eq('Request Submitted → requester', mails().find(m => m.subject === 'Request Submitted').to, REQ);
  contains('ID Setup email formUrl points at id_setup for wf', mails().find(m => m.subject === 'ID Setup Required').formUrl, 'form=id_setup&wf=' + wf);
  eq('no action items yet', aiFor(wf).length, 0);
  eq('Actor isolation after alias', _ctx.Actor.current(), null);

  // ── ID Setup ──
  let m0 = mails().length;
  const idr = step('n8n_submitIdSetup (no internalEmployeeId → pre-assigned used)', 'n8n_submitIdSetup', () => _ctx.n8n_submitIdSetup(ACTOR, idSetupPayload(wf)));
  void idr;
  const idRow = rows('ID Setup Results').find(r => r[0] === wf);
  eq('ID Setup Results uses pre-assigned 30411', idRow && idRow[3], '30411');
  eq('ID Setup Results Submitted By = actor', idRow && idRow[11], ACTOR.email);
  eq('ID Setup Results BOSS WIS Created', idRow && idRow[12], 'Yes');
  eq('step → HR Verification Needed', wfRow(wf)[7], 'HR Verification Needed');
  eq('Dashboard granular = Pending: HR Verification', dash(wf)[3], 'Pending: HR Verification');
  setEq('emails: HR Verification Required only (salary path — no Credentials Ready)', subjectsSince(m0), ['HR Verification Required']);
  eq('HR Verification Required → HR + Payroll', mailsSince(m0)[0].to, E.HR + ',' + E.PAYROLL);
  const idRes = rawLog().find(e => e.wf === wf && e.kind === 'result' && e.source === 'submitEmployeeIDSetup');
  truthy('Raw Log result event for ID Setup has id and no passwords', idRes && JSON.parse(idRes.json).internalEmployeeId === '30411' && !/Dss#2026|Sd#2026/.test(idRes.json));
  eq('no Safety task yet (salary path creates it after HR)', aiBy(wf, 'safety_onboarding') ? 1 : 0, 0);

  // ── HR Verification (alias exists: n8n_submitHrVerification; authorization = Actor.principal() = session, attribution = actor) ──
  m0 = mails().length;
  const hr = step('n8n_submitHrVerification (HR actor for attribution; principal = session admin)', 'n8n_submitHrVerification', () => _ctx.n8n_submitHrVerification(HR_ACTOR, hrPayload(wf)));
  void hr;
  const hrRow = rows('HR Verification Results').find(r => r[0] === wf);
  eq('HR row ADP id', hrRow && hrRow[3], 'ADP-100001');
  eq('HR row Verified JR Title = "job / jr"', hrRow && hrRow[7], 'Site Supervisor / Site Supervisor');
  eq('HR row Submitted By = HR actor', hrRow && hrRow[9], HR_ACTOR.email);
  eq('salary + BOSS → step IT Confirmation Needed', wfRow(wf)[7], 'IT Confirmation Needed');
  const itc = aiBy(wf, '', 'IT Confirmation');
  truthy('IT Confirmation action item created (assignee Dave)', itc && itc[5] === E.DAVE);
  const safety = aiBy(wf, 'safety_onboarding', 'Safety');
  truthy('Safety Onboarding task created on salary path after HR', !!safety);
  eq('Safety task assignee', safety && safety[5], E.SAFETY);
  setEq('emails: IT Confirmation Required + HR Verified (salary access) + Safety Onboarding', subjectsSince(m0),
    ['IT Confirmation Required — Ada Lovelace', 'HR Verified — Salary Access Required', 'Safety Onboarding Required — Ada Lovelace']);
  eq('IT Confirmation email → Dave', mailsSince(m0).find(m => /IT Confirmation/.test(m.subject)).to, E.DAVE);
  eq('HR Verified email → Payroll', mailsSince(m0).find(m => /HR Verified/.test(m.subject)).to, E.PAYROLL);
  eq('Safety email → Safety group', mailsSince(m0).find(m => /Safety/.test(m.subject)).to, E.SAFETY);
  eq('Safety email contextData.adpAssociateId', mailsSince(m0).find(m => /Safety/.test(m.subject)).contextData.adpAssociateId, 'ADP-100001');
  truthy('Raw Log submit event for HR verification attributed to HR actor', rawLog().some(e => e.wf === wf && e.source === 'submitHRVerification' && e.user === HR_ACTOR.email));
  eq('Raw Log task.created events so far = 2 (IT Confirmation, Safety)', rawLog().filter(e => e.wf === wf && e.kind === 'task.created').length, 2);

  // ── IT Confirmation (Dave) ──
  m0 = mails().length;
  step('submitITConfirmation via Actor.run(DAVE)', 'submitITConfirmation', () => _ctx.Actor.run(DAVE, () => _ctx.submitITConfirmation(itConfPayload(wf))));
  const itcRow = rows('IT Confirmation Results').find(r => r[0] === wf);
  truthy('IT Confirmation Results row appended', !!itcRow);
  eq('IT Confirmation Submitted By = Dave', itcRow && itcRow[12], DAVE.email);
  eq('step → IT Setup Needed', wfRow(wf)[7], 'IT Setup Needed');
  const irAfter = rows('Initial Requests').find(r => r[0] === wf);
  eq('IR row systems preserved after write-back', irAfter[20], FULL_SYSTEMS.join(', '));
  eq('IR row New Hire/Rehire preserved (hireType sent)', irAfter[7], 'New Hire');
  eq('IR row 30/60/90 untouched', irAfter[47], 'Yes');
  truthy('IT Setup Required email → IT group', mailsSince(m0).some(m => m.subject === 'IT Setup Required — Ada Lovelace' && m.to === E.IT));
  const infoUpd = mailsSince(m0).filter(m => m.subject === 'Information Updated');
  if (infoUpd.length) note('IT Confirmation posted with IDENTICAL data still emitted ' + infoUpd.length + ' "Information Updated" change notification(s) to ' + infoUpd.map(m => m.to).join(' / ') + ' — body: ' + String(infoUpd[0].body).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));
  contains('IT Setup email formUrl → it_setup', mailsSince(m0).find(m => /IT Setup Required/.test(m.subject)).formUrl, 'form=it_setup&wf=' + wf);
  eq('IT Confirmation action item is NOT closed by submitITConfirmation (stays Open)', aiBy(wf, '', 'IT Confirmation')[6], 'Open');
  note('submitITConfirmation never closes the "IT Confirmation" action item (ITConfirmationHandler.js:44-266); it stays Open and is only non-blocking because getRequiredSpecialistCats excludes it.');

  // ── IT Setup (IT actor) ──
  m0 = mails().length;
  const ai0 = rows('Action Items').length;
  step('n8n_submitItSetup (IT actor; dynamic BOSS_Cmte_/BOSS_CostSheet_ keys accepted)', 'n8n_submitItSetup', () => _ctx.n8n_submitItSetup(IT_ACTOR, itSetupPayload(wf)));
  const itRow = rows('IT Results').find(r => r[0] === wf);
  truthy('IT Results row appended', !!itRow);
  eq('IT Results assigned email', itRow && itRow[4], 'ada.lovelace@team-group.com');
  eq('IT Results Submitted By = IT actor', itRow && itRow[21], IT_ACTOR.email);
  const bd = itRow && JSON.parse(itRow[22]);
  truthy('IT Results BOSS Details committees/costSheets/tripReports', bd && bd.committees[0] === '1001' && bd.costSheets[0] === '1001' && bd.tripReports === 'Yes');
  eq('step → Specialist Forms Needed', wfRow(wf)[7], 'Specialist Forms Needed');
  const created = rows('Action Items').slice(ai0);
  setEq('specialist action items created = exactly the set derived from the payload',
    created.map(catFt), ['Finance/creditcard', 'Business Cards/businesscards', 'Fleet/fleetio', '30/60/90 Review/review_306090', 'JR Title/jr_title', 'Purchasing/jonas', 'WIS/wis']);
  const ccLine = JSON.parse(created.find(r => r[2] === 'Finance')[4])[0];
  defect('Finance checklist carries the requested USA limit (2000)', /2000/.test(ccLine), ccLine, 'Apply for USA card — Requested limit: 2000',
    'getWorkflowContext (EmailUtils.js ~:175-330) never maps IR cols 31/33/35 (Limit USA/CAN/HD) → triggerSpecialists (ITSetupHandler.js:483-485) always prints "Standard"');
  contains('Fleet checklist includes vehicle assignment', created.find(r => r[2] === 'Fleet')[4], 'Assign company vehicle');
  contains('Purchasing checklist has Central Purchasing site', created.find(r => r[2] === 'Purchasing')[4], 'Central Purchasing: Set up access — 1001');
  contains('Purchasing checklist has Jonas job', created.find(r => r[2] === 'Purchasing')[4], 'Jonas: Provision access — J-100');
  eq('JR Title assignee', created.find(r => r[2] === 'JR Title')[5], E.JR);
  eq('WIS assignee = manager', created.find(r => r[2] === 'WIS')[5], MGR);
  eq('emails in IT Setup step = 7 specialist + IT Setup Complete', mailsSince(m0).length, 8);
  eq('IT Setup Complete → requester + manager', mailsSince(m0).find(m => m.subject === 'IT Setup Complete').to, REQ + ',' + MGR);
  truthy('IT Setup Complete carries temp password to requester/manager', mailsSince(m0).find(m => m.subject === 'IT Setup Complete').contextData.emailTempPassword === 'Temp#2026!');
  const jrMail = mailsSince(m0).find(m => m.to === E.JR);
  truthy('JR email subject contains "JR Assignment — Ada Lovelace" (george\'s Gmail trigger)', jrMail && /JR Assignment — Ada Lovelace/.test(jrMail.subject));
  truthy('specialist emails have credentials stripped', mailsSince(m0).filter(m => m.to !== REQ + ',' + MGR).every(m => m.contextData.emailTempPassword === undefined && m.contextData.dssPassword === undefined));
  eq('Raw Log task.created events during IT Setup = 7', rawLog().filter(e => e.wf === wf && e.kind === 'task.created').length - 2, 7);
  const tcJr = rawLog().find(e => e.wf === wf && e.kind === 'task.created' && JSON.parse(e.json).formType === 'jr_title');
  truthy('task.created payload has taskId/category/formType/assignedTo', tcJr && JSON.parse(tcJr.json).taskId && JSON.parse(tcJr.json).category === 'JR Title' && JSON.parse(tcJr.json).assignedTo === E.JR);

  // ── list ──
  const lt = step('n8n_listTasks({workflowId})', 'n8n_listTasks', () => _ctx.n8n_listTasks(ACTOR, { workflowId: wf }));
  eq('9 tasks listed (7 specialists + IT Confirmation + Safety)', lt.result.count, 9);
  truthy('all Open', lt.result.tasks.every(t => t.status === 'Open'));
  eq('filter formType=jr_title → 1', _ctx.n8n_listTasks(ACTOR, { workflowId: wf, formType: 'jr_title' }).result.count, 1);
  eq('filter assignedTo JR group + Open → 1', _ctx.n8n_listTasks(ACTOR, JSON.stringify({ workflowId: wf, assignedTo: E.JR, status: 'Open' })).result.count, 1);
  const jrTid = lt.result.tasks.find(t => t.formType === 'jr_title').taskId;

  // ── JR ──
  m0 = mails().length;
  const jr = step('n8n_closeJrTask(workflowId)', 'n8n_closeJrTask', () => _ctx.n8n_closeJrTask(ACTOR, wf, 'assigned in BOSS'));
  eq('closed the jr_title task', jr.result.taskId, jrTid);
  const jrRow = rows('Action Items').find(r => r[1] === jrTid);
  eq('JR row Closed', jrRow[6], 'Closed');
  eq('JR closedBy = actor', jrRow[10], ACTOR.email);
  eq('JR notes', jrRow[9], 'assigned in BOSS');
  truthy('JR draft marks checklist Complete by actor', /"Verify and assign JR title":\{"status":"Complete","by":"efx-bot@team-group.com"/.test(String(jrRow[11])));
  eq('workflow still In Progress (others open)', wfRow(wf)[4], 'In Progress');
  eq('closing JR sends no email by itself', mailsSince(m0).length, 0);
  const again = step('n8n_closeJrTask again → E_ALREADY_CLOSED', 'n8n_closeJrTask', () => _ctx.n8n_closeJrTask(ACTOR, wf), { expectFail: true });
  eq('second close code', again.error && again.error.code, 'E_ALREADY_CLOSED');
  const tcl = rawLog().find(e => e.wf === wf && e.kind === 'task.closed');
  truthy('Raw Log task.closed for JR with closedBy actor', tcl && JSON.parse(tcl.json).taskId === jrTid && JSON.parse(tcl.json).closedBy === ACTOR.email && tcl.user === ACTOR.email);

  // ── remaining tasks ──
  const finance = aiBy(wf, 'creditcard');
  const dry = step('n8n_closeTask dryRun (Finance)', 'n8n_closeTask', () => _ctx.n8n_closeTask(ACTOR, { taskId: finance[1], dryRun: true }));
  truthy('dryRun reports wouldClose and leaves row Open', dry.result.dryRun && dry.result.wouldClose && rows('Action Items').find(r => r[1] === finance[1])[6] === 'Open');
  step('n8n_assignSafetyTraining (Yes/Yes)', 'n8n_assignSafetyTraining', () => _ctx.n8n_assignSafetyTraining(ACTOR, wf, { siteDocsConfirmed: 'Yes', dssConfirmed: 'Yes', notes: 'training assigned' }));
  const safetyRow = rows('Action Items').find(r => r[1] === safety[1]);
  eq('Safety Closed', safetyRow[6], 'Closed');
  truthy('Safety formData saved', /"siteDocsConfirmed":"Yes"/.test(String(safetyRow[13])));
  eq('workflow still In Progress after Safety', wfRow(wf)[4], 'In Progress');

  m0 = mails().length;
  const required = ['creditcard', 'businesscards', 'fleetio', 'review_306090', 'jonas'].map(ft => aiBy(wf, ft));
  closeAll(wf, required, 'specialists');
  w = wfRow(wf);
  eq('Workflows Status = Complete after last required specialist', w[4], 'Complete');
  eq('Workflows step = All Action Items Closed', w[7], 'All Action Items Closed');
  eq('IR Status column synced to Complete', rows('Initial Requests').find(r => r[0] === wf)[52], 'Complete');
  eq('Dashboard_View Global Status = Complete', dash(wf)[2], 'Complete');
  setEq('still Open at completion: IT Confirmation + WIS (non-blocking)', openAi(wf).map(r => r[2]), ['IT Confirmation', 'WIS']);
  const done = mailsSince(m0).filter(m => m.subject === 'Workflow Completed: New Employee Onboarding (' + wf + ')');
  eq('two Workflow Completed emails (HR; initiator+manager)', done.length, 2);
  setEq('Workflow Completed recipients', done.map(m => m.to), [E.HR, REQ + ',' + MGR]);
  truthy('completion email context is fully populated (adp, id, assignedEmail)', done[0].contextData.adpAssociateId === 'ADP-100001' && done[0].contextData.internalEmployeeId === '30411' && done[0].contextData.assignedEmail === 'ada.lovelace@team-group.com');

  m0 = mails().length;
  closeAll(wf, [aiBy(wf, 'wis'), aiBy(wf, '', 'IT Confirmation')], 'non-blocking leftovers', { noProgressCheck: true });
  eq('status remains Complete', wfRow(wf)[4], 'Complete');
  eq('no extra Workflow Completed emails', mailsSince(m0).filter(m => /Workflow Completed/.test(m.subject)).length, 0);
  eq('no Open tasks remain', openAi(wf).length, 0);

  // ── read-back ──
  const gw = step('n8n_getWorkflow', 'n8n_getWorkflow', () => _ctx.n8n_getWorkflow(ACTOR, wf));
  const cl = gw.result.checklist;
  const item = n => cl.find(x => x.name === n);
  eq('checklist ID Setup Complete', item('ID Setup') && item('ID Setup').status, 'Complete');
  eq('checklist HR Verification Complete', item('HR Verification') && item('HR Verification').status, 'Complete');
  eq('checklist IT Setup Complete', item('IT Setup') && item('IT Setup').status, 'Complete');
  truthy('checklist has every specialist Complete', ['Finance', 'Business Cards', 'Fleet', '30/60/90 Review', 'JR Title', 'Purchasing', 'Safety', 'WIS', 'IT Confirmation'].every(n => item(n) && item(n).status === 'Complete'));
  eq('checklist JR Title closed by actor', item('JR Title').by, ACTOR.email);
  eq('getWorkflow.status Complete', gw.result.status, 'Complete');
  eq('getWorkflow requestData Internal Employee ID', gw.result.requestData['Internal Employee ID'], '30411');
  eq('envelope employeeId.internalEmployeeId', gw.employeeId && gw.employeeId.internalEmployeeId, '30411');
  eq('n8n_getEmployeeId', _ctx.n8n_getEmployeeId(ACTOR, wf).result.internalEmployeeId, '30411');

  // ── events ──
  const ev = step('n8n_events (whole trail)', 'n8n_events', () => _ctx.n8n_events(ACTOR, { limit: 500 }));
  const evs = ev.result.events.filter(e => e.workflowId === wf || (e.kind === 'submit' && e.source === 'submitInitialRequest'));
  truthy('every event has an EVT- id', evs.every(e => /^EVT-/.test(e.eventId)));
  eq('submit sources in chain order', evs.filter(e => e.kind === 'submit').map(e => e.source).join(' > '),
    'submitInitialRequest > submitEmployeeIDSetup > submitHRVerification > submitITConfirmation > submitITSetup');
  const idSubmitEv = evs.find(e => e.kind === 'submit' && e.source === 'submitEmployeeIDSetup');
  eq('n8n_events redacts passwords in submit payloads (dssPassword → [REDACTED])', idSubmitEv.payload.dssPassword, '[REDACTED]');
  eq('… and Email_Temp_Password in the IT Setup submit payload', evs.find(e => e.kind === 'submit' && e.source === 'submitITSetup').payload.Email_Temp_Password, '[REDACTED]');
  truthy('… while the Raw Log sheet itself keeps the full payload (recovery net)', /Dss#2026/.test(rawLog().find(e => e.source === 'submitEmployeeIDSetup' && e.kind === 'submit').json));
  truthy('nextAfterEventId / nextAfterTs cursors returned', /^EVT-/.test(ev.result.nextAfterEventId) && !!ev.result.nextAfterTs);
  eq('result events: initial request + ID setup', evs.filter(e => e.kind === 'result').map(e => e.source).join(','), 'submitInitialRequest,submitEmployeeIDSetup');
  eq('task.created = 9', evs.filter(e => e.kind === 'task.created').length, 9);
  eq('task.closed = 9', evs.filter(e => e.kind === 'task.closed').length, 9);
  truthy('all task.created precede the first task.closed', evs.findIndex(e => e.kind === 'task.closed') > evs.map(e => e.kind).lastIndexOf('task.created'));
  truthy('task.closed actors = closing bot', evs.filter(e => e.kind === 'task.closed').every(e => e.actor === ACTOR.email && e.payload.closedBy === ACTOR.email));
  eq('HR submit actor', evs.find(e => e.source === 'submitHRVerification').actor, HR_ACTOR.email);
  eq('IT submit actor', evs.find(e => e.source === 'submitITSetup').actor, IT_ACTOR.email);
  const cursor = _ctx.n8n_events(ACTOR, { afterEventId: evs[0].eventId, limit: 500 }).result.events.filter(e => e.workflowId === wf);
  eq('cursor pagination excludes the first event', cursor.length, evs.length - 1);
  eq('Actor isolation at end', _ctx.Actor.current(), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. NEW HIRE — Hourly, systemAccess No
// ─────────────────────────────────────────────────────────────────────────────
scenario('2. NEW HIRE — Hourly / no system access: create → ID Setup (Safety task) → n8n_assignSafetyTraining → HR completes (no IT)', () => {
  seedBase();
  const c = step('n8n_createInitialRequest (Hourly, No)', 'n8n_createInitialRequest', () => _ctx.n8n_createInitialRequest(ACTOR,
    newHire({ firstName: 'Tom', lastName: 'Brown', employmentType: 'Hourly', systemAccess: 'No', systems: [], equipment: [], positionTitle: 'Labourer', jrRequired: 'No', jrAssignment: '', plan306090: '' })));
  const wf = c.result.workflowId;
  eq('internalEmployeeId 30411', c.result.internalEmployeeId, '30411');
  eq('step ID Setup Needed', wfRow(wf)[7], 'ID Setup Needed');
  setEq('create emails', subjectsSince(0), ['Request Submitted', 'ID Setup Required']);

  let m0 = mails().length;
  step('n8n_submitIdSetup (Hourly 1, no SiteDocs creds)', 'n8n_submitIdSetup', () => _ctx.n8n_submitIdSetup(ACTOR, { workflowId: wf, siteDocsWorkerId: 'W-2002', siteDocsJobCode: 'Hourly 1', dssUsername: 'tom.brown', dssPassword: 'Dss#Tom' }));
  const idRow = rows('ID Setup Results').find(r => r[0] === wf);
  eq('ID Setup Results id 30411', idRow[3], '30411');
  eq('SiteDocs username defaults to N/A', idRow[6], 'N/A');
  eq('step → HR Verification Needed', wfRow(wf)[7], 'HR Verification Needed');
  const safety = aiBy(wf, 'safety_onboarding', 'Safety');
  truthy('Safety Onboarding task created by the ID Setup (hourly) path', !!safety);
  eq('Safety assignee', safety[5], E.SAFETY);
  setEq('emails: Credentials Ready + HR Verification Required + Safety Onboarding', subjectsSince(m0), ['Credentials Ready', 'HR Verification Required', 'Safety Onboarding Required — Tom Brown']);
  eq('Credentials Ready → requester + manager', mailsSince(m0).find(m => m.subject === 'Credentials Ready').to, REQ + ',' + MGR);
  eq('Credentials Ready context has DSS username', mailsSince(m0).find(m => m.subject === 'Credentials Ready').contextData.dssUsername, 'tom.brown');
  eq('HR Verification Required → HR + Payroll', mailsSince(m0).find(m => m.subject === 'HR Verification Required').to, E.HR + ',' + E.PAYROLL);
  truthy('task.created event for Safety', rawLog().some(e => e.wf === wf && e.kind === 'task.created' && JSON.parse(e.json).formType === 'safety_onboarding'));

  const no = step('n8n_assignSafetyTraining with dssConfirmed=No (no force) → E_VALIDATION', 'n8n_assignSafetyTraining', () => _ctx.n8n_assignSafetyTraining(ACTOR, wf, { siteDocsConfirmed: 'Yes', dssConfirmed: 'No' }), { expectFail: true });
  eq('code E_VALIDATION', no.error && no.error.code, 'E_VALIDATION');
  eq('task still Open', rows('Action Items').find(r => r[1] === safety[1])[6], 'Open');
  m0 = mails().length;
  step('n8n_assignSafetyTraining Yes/Yes', 'n8n_assignSafetyTraining', () => _ctx.n8n_assignSafetyTraining(ACTOR, wf, { siteDocsConfirmed: 'Yes', dssConfirmed: 'Yes', notes: 'assigned' }));
  const sRow = rows('Action Items').find(r => r[1] === safety[1]);
  eq('Safety Closed', sRow[6], 'Closed');
  eq('Safety closedBy actor', sRow[10], ACTOR.email);
  eq('workflow still In Progress (HR pending; completion check not at this step)', wfRow(wf)[4], 'In Progress');
  eq('no emails from Safety close', mailsSince(m0).length, 0);

  m0 = mails().length;
  step('submitHRVerification via Actor.run(HR_ACTOR)', 'submitHRVerification', () => _ctx.Actor.run(HR_ACTOR, () => _ctx.submitHRVerification(
    hrPayload(wf, { firstName: 'Tom', lastName: 'Brown', jobTitle: 'Labourer', jrTitle: '', adpAssociateId: 'ADP-200002', notes: '', department: '' }))));
  const w = wfRow(wf);
  eq('Workflows Status Complete', w[4], 'Complete');
  eq('Workflows step HR Verification Complete', w[7], 'HR Verification Complete');
  eq('Employee Name updated to verified name', w[8], 'Tom Brown');
  setEq('emails: Onboarding Complete only', subjectsSince(m0), ['Onboarding Complete']);
  eq('Onboarding Complete → requester + manager', mailsSince(m0)[0].to, REQ + ',' + MGR);
  eq('HR Verification Results Verified JR Title = job title only', rows('HR Verification Results').find(r => r[0] === wf)[7], 'Labourer');
  eq('no IT Results row', rows('IT Results').filter(r => r[0] === wf).length, 0);
  eq('no email to IT', mails().filter(m => m.to === E.IT).length, 0);
  eq('Dashboard_View Complete', dash(wf)[2], 'Complete');
  const gw = step('n8n_getWorkflow', 'n8n_getWorkflow', () => _ctx.n8n_getWorkflow(ACTOR, wf));
  eq('checklist IT Setup = N/A for hourly/no-access', gw.result.checklist.find(x => x.name === 'IT Setup').status, 'N/A');
  eq('checklist Safety Complete by actor', gw.result.checklist.find(x => x.name === 'Safety').by, ACTOR.email);
  eq('Actor isolation', _ctx.Actor.current(), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Rehire carrying an existing id
// ─────────────────────────────────────────────────────────────────────────────
scenario('3. NEW HIRE — Rehire carrying existingInternalEmployeeId → registry source rehire-carry', () => {
  seedBase();
  const c = step('n8n_createInitialRequest (Rehire, existingInternalEmployeeId=30250)', 'n8n_createInitialRequest', () => _ctx.n8n_createInitialRequest(ACTOR,
    newHire({ firstName: 'Rita', lastName: 'Returns', newHireOrRehire: 'Rehire', existingInternalEmployeeId: '30250' })));
  const wf = c.result.workflowId;
  eq('internalEmployeeId = carried id', c.result.internalEmployeeId, '30250');
  const reg = rows('Employee IDs').find(r => r[1] === wf);
  eq('registry id', reg[0], '30250');
  eq('registry source = rehire-carry', reg[5], 'rehire-carry');
  eq('registry Allocated By = actor', reg[4], ACTOR.email);
  eq('IR[7] Rehire', rows('Initial Requests').find(r => r[0] === wf)[7], 'Rehire');
  eq('IR[55] carried id', rows('Initial Requests').find(r => r[0] === wf)[55], '30250');
  const info = step('n8n_getEmployeeId', 'n8n_getEmployeeId', () => _ctx.n8n_getEmployeeId(ACTOR, wf));
  eq('getEmployeeId source', info.result.source, 'rehire-carry');
  truthy('result event carries the carried id', rawLog().some(e => e.wf === wf && e.kind === 'result' && JSON.parse(e.json).internalEmployeeId === '30250'));
  step('n8n_submitIdSetup uses the carried id', 'n8n_submitIdSetup', () => _ctx.n8n_submitIdSetup(ACTOR, idSetupPayload(wf, { siteDocsUsername: 'rita.returns@team-group.com', dssUsername: 'rita.returns' })));
  eq('ID Setup Results id = 30250', rows('ID Setup Results').find(r => r[0] === wf)[3], '30250');
  const c2 = step('second new hire (different requester) still allocates from the global max', 'n8n_createInitialRequest', () => _ctx.n8n_createInitialRequest(ACTOR,
    newHire({ firstName: 'Bob', lastName: 'Builder', requesterEmail: 'other@team-group.com' })));
  eq('next id = 30411 (max over registry 30250 and ID Setup Results 30410)', c2.result.internalEmployeeId, '30411');
  const c3 = step('rehire with an id above the max moves the high-water mark', 'n8n_createInitialRequest', () => _ctx.n8n_createInitialRequest(ACTOR,
    newHire({ firstName: 'Hi', lastName: 'Water', newHireOrRehire: 'Rehire', existingInternalEmployeeId: '30900', requesterEmail: 'third@team-group.com' })));
  eq('carried 30900', c3.result.internalEmployeeId, '30900');
  const c4 = _ctx.n8n_createInitialRequest(ACTOR, newHire({ firstName: 'Next', lastName: 'One', requesterEmail: 'fourth@team-group.com' }));
  eq('allocation after a high carried id → 30901', c4.result.internalEmployeeId, '30901');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Human UI path then n8n finishes ID Setup — attribution
// ─────────────────────────────────────────────────────────────────────────────
scenario('4. NEW HIRE — human submitInitialRequest (Session) then n8n_submitIdSetup (actor) then human HR: attribution per row', () => {
  seedBase();
  const r = step('submitInitialRequest directly (no Actor)', 'submitInitialRequest', () => _ctx.submitInitialRequest(newHire({ firstName: 'Hugh', lastName: 'Human' })));
  const wf = r.workflowId;
  eq('response internalEmployeeId', r.internalEmployeeId, '30411');
  eq('Employee IDs Allocated By = Session user', rows('Employee IDs').find(x => x[1] === wf)[4], 'dbinns@team-group.com');
  truthy('Raw Log submit/result user = Session user', rawLog().filter(e => e.source === 'submitInitialRequest').every(e => e.user === 'dbinns@team-group.com'));
  eq('Actor.current() null (human)', _ctx.Actor.current(), null);
  eq('getWorkflowContext.preassignedEmployeeId', _ctx.getWorkflowContext(wf).preassignedEmployeeId, '30411');

  step('n8n_submitIdSetup (actor)', 'n8n_submitIdSetup', () => _ctx.n8n_submitIdSetup(ACTOR, idSetupPayload(wf, { siteDocsUsername: 'hugh.human@team-group.com', dssUsername: 'hugh.human' })));
  const idRow = rows('ID Setup Results').find(x => x[0] === wf);
  eq('ID Setup Results Submitted By = actor', idRow[11], ACTOR.email);
  eq('ID Setup Results id = pre-assigned', idRow[3], '30411');
  truthy('Raw Log rows for ID Setup attributed to actor', rawLog().filter(e => e.wf === wf && e.source === 'submitEmployeeIDSetup').every(e => e.user === ACTOR.email));
  eq('Actor isolation after alias', _ctx.Actor.current(), null);

  step('submitHRVerification directly (Session admin)', 'submitHRVerification', () => _ctx.submitHRVerification(hrPayload(wf, { firstName: 'Hugh', lastName: 'Human', jrTitle: '', department: '' })));
  eq('HR row Submitted By = Session user', rows('HR Verification Results').find(x => x[0] === wf)[9], 'dbinns@team-group.com');
  eq('step → IT Confirmation Needed (BOSS requested)', wfRow(wf)[7], 'IT Confirmation Needed');
  const actors = rawLog().filter(e => e.kind === 'submit' && (e.wf === wf || e.source === 'submitInitialRequest')).map(e => e.source + '=' + e.user);
  setEq('Raw Log attribution per step (Session vs actor)', actors, ['submitInitialRequest=dbinns@team-group.com', 'submitEmployeeIDSetup=' + ACTOR.email, 'submitHRVerification=dbinns@team-group.com']);
  const ev = _ctx.n8n_events(ACTOR, { sources: ['submitEmployeeIDSetup'] }).result.events;
  truthy('n8n_events source filter returns only ID Setup events, actor-attributed', ev.length === 2 && ev.every(e => e.actor === ACTOR.email));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. JR isolated — last task completion via alias
// ─────────────────────────────────────────────────────────────────────────────
scenario('5. JR isolated — seeded workflow with only jr_title Open; n8n_closeJrTask(TK-) completes the workflow', () => {
  seedBase();
  const wf = 'NEW_EMP_20260916-090000_777';
  _rt.captures.seedSheet('Workflows', [[wf, 'NEW_EMP', 'New Employee Onboarding', REQ, 'In Progress', new Date(), new Date(), 'Specialist Forms Needed', 'Jamie Review']]);
  const irSeed = _ctx.formatInitialRequestData(Object.assign(newHire({ firstName: 'Jamie', lastName: 'Review', systems: ['BOSS'] }), { workflowId: wf, formId: 'INIT_JR', timestamp: new Date(), internalEmployeeId: '30300' }));
  _rt.captures.seedSheet('Initial Requests', [irSeed]);
  _rt.captures.seedSheet('ID Setup Results', [[wf, 'ID_JR', new Date(), '30300', 'W', 'Salary 1', 'u', 'p', 'd', 'p', '', E.IDSETUP, 'Yes', 'No']]);
  _rt.captures.seedSheet('HR Verification Results', [[wf, 'HR_JR', new Date(), 'ADP-777', 'Jamie Review', 'Mgr One', MGR, 'Site Supervisor / Site Supervisor', '', E.HR]]);
  _rt.captures.seedSheet('IT Results', [[wf, 'IT_JR', new Date(), 'Yes', 'jamie.review@team-group.com', 'N/A', 'No', 'N/A', 'N/A', 'N/A', 'No', 'N/A', 'N/A', 'N/A', 'N/A', 'Yes', 'No', 'No', 'No', 'No', '', E.IT, '{}']]);
  _rt.captures.seedSheet('Action Items', [
    [wf, 'TK-JR000001', 'JR Title', 'JR Assignment — Jamie Review', JSON.stringify(['Verify and assign JR title']), E.JR, 'Open', new Date(), '', '', '', '', 'jr_title', ''],
    [wf, 'TK-JR000002', '30/60/90 Review', '30/60/90 Review Plan — Jamie Review', JSON.stringify(['Create 30/60/90 day review plan', 'Schedule review meetings with manager']), E.REVIEW, 'Closed', new Date(), new Date(), 'done', 'dan.anger@team-group.com', '', 'review_306090', ''],
    [wf, 'TK-JR000003', 'Safety', 'Safety Onboarding — Jamie Review', JSON.stringify(['Assign SiteDocs locations for employee', 'Assign DSS learning paths']), E.SAFETY, 'Closed', new Date(), new Date(), '', E.SAFETY, '', 'safety_onboarding', '']
  ]);
  eq('precondition: exactly one Open task (JR)', openAi(wf).map(r => r[12]).join(), 'jr_title');
  const nf = step('n8n_closeJrTask(TK-NOPE) → E_NOT_FOUND', 'n8n_closeJrTask', () => _ctx.n8n_closeJrTask(ACTOR, 'TK-NOPE'), { expectFail: true });
  eq('E_NOT_FOUND', nf.error && nf.error.code, 'E_NOT_FOUND');
  const m0 = mails().length;
  const r = step('n8n_closeJrTask(TK-JR000001)', 'n8n_closeJrTask', () => _ctx.n8n_closeJrTask(ACTOR, 'TK-JR000001', 'JR verified via n8n'));
  eq('result taskId', r.result.taskId, 'TK-JR000001');
  eq('result workflowId', r.result.workflowId, wf);
  eq('row Closed', rows('Action Items').find(x => x[1] === 'TK-JR000001')[6], 'Closed');
  eq('closedBy actor', rows('Action Items').find(x => x[1] === 'TK-JR000001')[10], ACTOR.email);
  eq('Workflows Status Complete', wfRow(wf)[4], 'Complete');
  eq('Workflows step All Action Items Closed', wfRow(wf)[7], 'All Action Items Closed');
  eq('Dashboard_View row appended and Complete', dash(wf) && dash(wf)[2], 'Complete');
  const done = mailsSince(m0).filter(m => /^Workflow Completed: New Employee Onboarding/.test(m.subject));
  eq('two completion emails', done.length, 2);
  setEq('completion recipients', done.map(m => m.to), [E.HR, REQ + ',' + MGR]);
  contains('completion body carries audit table with JR closed by actor', done[0].body, ACTOR.email);
  const lt = _ctx.n8n_listTasks(ACTOR, { workflowId: wf });
  truthy('n8n_listTasks: all Closed', lt.result.tasks.every(t => t.status === 'Closed'));
  const again = step('close again → E_ALREADY_CLOSED', 'n8n_closeJrTask', () => _ctx.n8n_closeJrTask(ACTOR, 'TK-JR000001'), { expectFail: true });
  eq('E_ALREADY_CLOSED', again.error && again.error.code, 'E_ALREADY_CLOSED');
  eq('by workflowId when only closed exists → E_ALREADY_CLOSED', _ctx.n8n_closeJrTask(ACTOR, wf).error.code, 'E_ALREADY_CLOSED');
  note('JR Title is NOT in getRequiredSpecialistCats (ActionItemService.js:479-486), so an Open jr_title task never blocks completion — documented in docs/mapping/JR.md §2. Here the JR close simply triggered the (already satisfiable) completion check.');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. EQUIPMENT REQUEST
// ─────────────────────────────────────────────────────────────────────────────
scenario('6. EQUIPMENT REQUEST — submit → IT Confirmation → IT Setup → wis_user close with SiteDocs creds → Complete', () => {
  seedBase();
  const payload = { reqName: 'David Binns', reqEmail: REQ, requesterEmail: REQ, requesterName: 'David Binns', firstName: 'Eve', lastName: 'Clark',
    position: 'Field Supervisor', positionTitle: 'Field Supervisor', siteName: 'Aurora', jobSiteNumber: 'INDIRECT - Aurora', managerEmail: MGR, managerName: 'Mgr One',
    systems: ['BOSS', 'SiteDocs', 'Fleetio'], equipment: ['Vehicle'], department: 'Field Ops', comments: 'Vehicle needed for new role' };
  truthy('payload validates against FormContracts.equipment_request', _ctx.FormContracts.validate('equipment_request', payload).ok);
  const r = step('n8n_createEquipmentRequest (alias; include record)', 'n8n_createEquipmentRequest', () => _ctx.n8n_createEquipmentRequest(ACTOR, payload, { include: ['record'] }));
  const wf = r.result && r.result.workflowId;
  truthy('EQUIP_REQ_ workflow', /^EQUIP_REQ_/.test(wf || ''));
  eq('record read-back is the Initial Requests row', r.record && r.record['First Name'], 'Eve');
  const ir = rows('Initial Requests').find(x => x[0] === wf);
  eq('IR row written to Initial Requests (56 cols)', ir.length, 56);
  eq('IR systemAccess forced Yes', ir[19], 'Yes');
  eq('IR systems csv', ir[20], 'BOSS, SiteDocs, Fleetio');
  eq('IR no Internal Employee ID for equipment', ir[55], '');
  eq('no Employee IDs row (no allocation for equipment)', rows('Employee IDs').filter(x => x[1] === wf).length, 0);
  eq('step IT Confirmation Needed', wfRow(wf)[7], 'IT Confirmation Needed');
  setEq('emails: Request Submitted + IT Confirmation Required', subjectsSince(0), ['Request Submitted', 'IT Confirmation Required']);
  eq('IT Confirmation Required → Dave', mails().find(m => m.subject === 'IT Confirmation Required').to, E.DAVE);
  eq('Raw Log submit attributed to actor (workflowId empty on creates)', (rawLog().find(e => e.source === 'submitEquipmentRequest') || {}).user, ACTOR.email);
  eq('no rawLogResult for equipment (documented in contract notes)', rawLog().filter(e => e.source === 'submitEquipmentRequest' && e.kind === 'result').length, 0);
  truthy('Dashboard_View isEquip flag', dash(wf) && /"isEquip":true/.test(String(dash(wf)[10])));

  let m0 = mails().length;
  const itcPayload = { workflowId: wf, notes: 'ok', firstName: 'Eve', lastName: 'Clark', positionTitle: 'Field Supervisor', siteName: 'Aurora', jobSiteNumber: 'INDIRECT - Aurora',
    reportingManagerEmail: MGR, reportingManagerName: 'Mgr One', systemAccess: 'Yes', systems: ['BOSS', 'SiteDocs', 'Fleetio'], equipment: ['Vehicle'], department: 'Field Ops' };
  const unv = step('n8n_submitForm(it_confirmation) without allowUnverified → E_UNVERIFIED_FORM', 'n8n_submitForm', () => _ctx.n8n_submitForm(DAVE, 'it_confirmation', itcPayload), { expectFail: true });
  eq('code E_UNVERIFIED_FORM', unv.error && unv.error.code, 'E_UNVERIFIED_FORM');
  eq('nothing written by the refused call', rows('IT Confirmation Results').length, 1);
  step('n8n_submitForm(it_confirmation, allowUnverified:true) as Dave', 'n8n_submitForm', () => _ctx.n8n_submitForm(DAVE, 'it_confirmation', itcPayload, { allowUnverified: true }));
  eq('step → IT Setup Needed', wfRow(wf)[7], 'IT Setup Needed');
  truthy('IT Setup Required — Eve Clark → IT', mailsSince(m0).some(m => m.subject === 'IT Setup Required — Eve Clark' && m.to === E.IT));
  eq('IT Confirmation Results row Submitted By', rows('IT Confirmation Results').find(x => x[0] === wf)[12], DAVE.email);

  m0 = mails().length;
  const ai0 = rows('Action Items').length;
  step('n8n_submitItSetup (IT actor; no email account)', 'n8n_submitItSetup', () => _ctx.n8n_submitItSetup(IT_ACTOR, { workflowId: wf, Email_Created: 'No', Email_Username: '', Email_Domain: '', Email_Temp_Password: '',
    Computer_Assigned: 'No', Phone_Assigned: 'No', BOSS_Access: 'Yes', Incidents_Access: 'No', CAA_Access: 'No', Delivery_App_Access: 'No', Net_Promoter_Score_Access: 'No', IT_Notes: 'Equipment IT' }));
  const itRow = rows('IT Results').find(x => x[0] === wf);
  eq('IT Results assigned email empty when not created', itRow[4], '');
  eq('step → Specialist Forms Needed', wfRow(wf)[7], 'Specialist Forms Needed');
  const created = rows('Action Items').slice(ai0);
  setEq('EQUIP_ specialists = Fleet + ID Setup/wis_user only (no WIS, no 30/60/90)', created.map(catFt), ['Fleet/fleetio', 'ID Setup/wis_user']);
  eq('wis_user assignee = ID Setup group', created.find(x => x[12] === 'wis_user')[5], E.IDSETUP);
  contains('Fleet includes vehicle', created.find(x => x[2] === 'Fleet')[4], 'Assign company vehicle');
  setEq('emails: Fleetio + SiteDocs Account Setup + IT Setup Complete', subjectsSince(m0), ['Fleetio Access — Eve Clark Required', 'SiteDocs Account Setup — Eve Clark Required', 'IT Setup Complete']);
  eq('IT Setup Complete → requester + manager', mailsSince(m0).find(m => m.subject === 'IT Setup Complete').to, REQ + ',' + MGR);

  const lt = _ctx.n8n_listTasks(ACTOR, { workflowId: wf, status: 'Open' });
  eq('2 open tasks', lt.result.count, 2);
  m0 = mails().length;
  const cl = step('n8n_closeTask(workflowId+formType=wis_user) with SiteDocs creds in formData', 'n8n_closeTask', () => _ctx.n8n_closeTask(ACTOR, { workflowId: wf, formType: 'wis_user', notes: 'SiteDocs account created',
    formData: { siteDocsUsername: 'eve.clark@team-group.com', siteDocsPassword: 'Sd#Eve1', bossWisCreated: 'Yes' } }));
  const wisRow = rows('Action Items').find(x => x[1] === cl.result.taskId);
  eq('wis_user Closed', wisRow[6], 'Closed');
  truthy('Form Data persisted on the task', /eve\.clark@team-group\.com/.test(String(wisRow[13])));
  const idRow = rows('ID Setup Results').find(x => x[0] === wf);
  truthy('ID Setup Results row written by the EQUIP_ special case', !!idRow);
  eq('ID Setup Results SiteDocs Username', idRow && idRow[6], 'eve.clark@team-group.com');
  eq('ID Setup Results SiteDocs Password', idRow && idRow[7], 'Sd#Eve1');
  eq('ID Setup Results BOSS WIS Created', idRow && idRow[12], 'Yes');
  eq('ID Setup Results Submitted By = actor', idRow && idRow[11], ACTOR.email);
  eq('ID Setup Results Internal Employee ID empty for equipment', idRow && idRow[3], '');
  eq('workflow still In Progress', wfRow(wf)[4], 'In Progress');
  eq('no emails on wis_user close', mailsSince(m0).length, 0);
  eq('re-close → E_ALREADY_CLOSED', _ctx.n8n_closeTask(ACTOR, { workflowId: wf, formType: 'wis_user' }).error.code, 'E_ALREADY_CLOSED');

  m0 = mails().length;
  closeAll(wf, [aiBy(wf, 'fleetio')], 'fleet');
  eq('Workflows Complete', wfRow(wf)[4], 'Complete');
  eq('step All Action Items Closed', wfRow(wf)[7], 'All Action Items Closed');
  const done = mailsSince(m0).filter(m => m.subject === 'Workflow Completed: System & Equipment Request (' + wf + ')');
  eq('two completion emails', done.length, 2);
  setEq('completion recipients', done.map(m => m.to), [E.HR, REQ + ',' + MGR]);
  eq('completion context carries SiteDocs username (ENRICH 3)', done[0].contextData.siteDocsUsername, 'eve.clark@team-group.com');
  eq('completion context workflowType', done[0].contextData.workflowType, 'Equipment Request');
  const gw = step('n8n_getWorkflow (equipment details)', 'n8n_getWorkflow', () => _ctx.n8n_getWorkflow(ACTOR, wf));
  truthy('equipment details returned', gw.result.success === true);
  eq('events: task.created 2 / task.closed 2', rawLog().filter(e => e.wf === wf && e.kind === 'task.created').length + '/' + rawLog().filter(e => e.wf === wf && e.kind === 'task.closed').length, '2/2');
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. TERMINATION — approved + rejected
// ─────────────────────────────────────────────────────────────────────────────
scenario('7. TERMINATION — request → HR approval (Approved) → 8 action items → close all → Complete; Rejected variant', () => {
  seedBase();
  // factory: a fresh object per submit (also proves below that the alias layer no longer mutates the caller's copy)
  const termPayload = () => ({ reqName: 'David Binns', reqEmail: REQ, empName: 'Sam Leaving', empWorkEmail: 'sleaving@team-group.com', empPhone: '555-0199', managerName: 'Mgr One', managerEmail: MGR,
    siteName: 'Aurora', empType: 'Salary', termDate: '2026-10-31', lastDayWorked: '2026-10-30', reason: 'Resigned', hr_approved: 'No', has_reports: 'Yes', reports_to_new: 'newlead@team-group.com',
    systems: ['Google Account', 'BOSS', 'ADP Supervisor Access', 'Fleetio', 'Central Purchasing/Jonas'], equip: ['Computer/Laptop', 'Mobile Phone', 'Building Access Card/Keys'],
    google_forward: MGR, google_files: MGR, google_delegate: '', google_duration: 'Default 1 Month then delete', google_vacation: 'Sam Leaving is no longer with TEAM Group.', comments: 'Good terms' });
  const payload = termPayload();
  truthy('payload validates against FormContracts.termination_request', _ctx.FormContracts.validate('termination_request', payload).ok);
  const r = step('n8n_createTerminationRequest (alias)', 'n8n_createTerminationRequest', () => _ctx.n8n_createTerminationRequest(ACTOR, payload));
  const wf = r.result && r.result.workflowId;
  truthy('TERM_ workflow', /^TERM_/.test(wf || ''));
  eq('Raw Log submit attributed to actor', (rawLog().find(e => e.source === 'submitTerminationRequest') || {}).user, ACTOR.email);
  const t = rows('Terminations').find(x => x[0] === wf);
  eq('Terminations row 29 cols', t.length, 29);
  eq('TERM[5] employee', t[5], 'Sam Leaving');
  eq('TERM[10] Computer Serial reserved N/A', t[10], 'N/A');
  eq('TERM[19] systems csv', t[19], payload.systems.join(', '));
  eq('TERM[25] equipment csv', t[25], payload.equip.join(', '));
  eq('TERM[27] last day', t[27], '2026-10-30');
  eq('step HR Approval Needed', wfRow(wf)[7], 'HR Approval Needed');
  eq('Employee Name', wfRow(wf)[8], 'Sam Leaving');
  setEq('emails: HR Approval Required + Payroll advance notice', subjectsSince(0), ['HR Approval Required', 'Termination Submitted — Pending HR Approval']);
  eq('HR Approval Required → HR', mails()[0].to, E.HR);
  contains('HR approval formUrl', mails()[0].formUrl, 'form=termination_approval&wf=' + wf);
  eq('Payroll notice → payroll', mails()[1].to, E.PAYROLL);
  truthy('Dashboard_View isTerm', dash(wf) && /"isTerm":true/.test(String(dash(wf)[10])));

  const badDec = step('n8n_submitTerminationApproval decision=Maybe → E_VALIDATION (enum)', 'n8n_submitTerminationApproval', () => _ctx.n8n_submitTerminationApproval(HR_ACTOR, { workflowId: wf, decision: 'Maybe' }), { expectFail: true });
  truthy('enum problem names decision', badDec.error && badDec.error.fields.some(f => f.field === 'decision'));
  eq('no approval row written by the refused call', rows('Termination Approval Results').length, 1);

  let m0 = mails().length;
  const ai0 = rows('Action Items').length;
  const ap = step('n8n_submitTerminationApproval Approved (HR actor)', 'n8n_submitTerminationApproval', () => _ctx.n8n_submitTerminationApproval(HR_ACTOR, { workflowId: wf, decision: 'Approved', notes: 'Approved — exit interview done' }));
  contains('8 checklists generated', ap.result && ap.result.message, '8 checklists generated');
  const apRow = rows('Termination Approval Results').find(x => x[0] === wf);
  eq('approval row decision', apRow[3], 'Approved');
  eq('approval row follow-up literal YES', apRow[5], 'YES');
  eq('approval row Submitted By = HR actor', apRow[6], HR_ACTOR.email);
  const created = rows('Action Items').slice(ai0);
  setEq('action items = IT, HR, Payroll, Fleet, Purchasing, Deactivation, EOE, Assets', created.map(x => String(x[2])), ['IT', 'HR', 'Payroll', 'Fleet', 'Purchasing', 'Deactivation', 'EOE', 'Assets']);
  const itDesc = JSON.parse(created.find(x => x[2] === 'IT')[4]);
  truthy('IT checklist: Delete BOSS account + Deactivate Google Account', itDesc.includes('Delete BOSS account') && itDesc.includes('Deactivate Google Account'));
  truthy('IT checklist: forwarding + files + vacation', itDesc.includes('Email Forwarding to ' + MGR) && itDesc.includes('Drive Files Transfer to ' + MGR) && itDesc.some(i => /^Set Vacation Responder/.test(i)));
  truthy('IT checklist: calendar marker', itDesc.some(i => i === '__CAL__Default 1 Month then delete__' + MGR));
  truthy('IT checklist: phone suspension with number', itDesc.includes('Suspend/Cancel Mobile Phone — 555-0199'));
  truthy('IT checklist: reassign Google + BOSS direct reports', itDesc.includes('Reassign Google direct reports to: newlead@team-group.com') && itDesc.includes('Reassign BOSS direct reports to: newlead@team-group.com'));
  truthy('HR checklist has ADP reassignment lines', /Direct reports to be reassigned to: newlead@team-group.com/.test(created.find(x => x[2] === 'HR')[4]));
  eq('Assets assignee = requester', created.find(x => x[2] === 'Assets')[5], REQ);
  eq('Deactivation assignee = ID Setup', created.find(x => x[2] === 'Deactivation')[5], E.IDSETUP);
  eq('EOE assignee = HR', created.find(x => x[2] === 'EOE')[5], E.HR);
  eq('step → Action Items Pending', wfRow(wf)[7], 'Action Items Pending');
  setEq('approval emails', subjectsSince(m0), ['IT Action Required', 'HR Action Required', 'Payroll Action Required', 'Fleet Action Required', 'Purchasing Action Required',
    'Employee Deactivation Required', 'EOE Process Required', 'FYI — Employee Offboarding: Sam Leaving', 'Asset Collection Required', 'Termination Approved']);
  eq('Asset Collection → requester + manager', mailsSince(m0).find(m => m.subject === 'Asset Collection Required').to, REQ + ',' + MGR);
  eq('FYI → Safety', mailsSince(m0).find(m => /FYI/.test(m.subject)).to, E.SAFETY);
  eq('Termination Approved → Payroll', mailsSince(m0).find(m => m.subject === 'Termination Approved').to, E.PAYROLL);
  eq('Raw Log task.created = 8', rawLog().filter(e => e.wf === wf && e.kind === 'task.created').length, 8);
  truthy('Dashboard granular lists pending categories', /^Pending: /.test(String(dash(wf)[3])));

  m0 = mails().length;
  const dup = step('duplicate approval → ok, already processed, no new tasks', 'n8n_submitTerminationApproval', () => _ctx.n8n_submitTerminationApproval(HR_ACTOR, { workflowId: wf, decision: 'Approved', notes: 'again' }));
  contains('already processed', dup.result && dup.result.message, 'already processed');
  eq('still 8 tasks', aiFor(wf).length, 8);
  eq('no emails on duplicate approval', mailsSince(m0).length, 0);

  m0 = mails().length;
  const order = ['IT', 'HR', 'Payroll', 'Fleet', 'Purchasing', 'Deactivation', 'EOE'].map(c => aiBy(wf, null, c));
  closeAll(wf, order, 'termination', { noProgressCheck: true });
  eq('workflow still In Progress with only Assets open', wfRow(wf)[4], 'In Progress');
  const assets = aiBy(wf, null, 'Assets');
  const mA = mails().length;
  step('n8n_closeTask(Assets) with checklist statuses Collected', 'n8n_closeTask', () => _ctx.n8n_closeTask(ACTOR, { taskId: assets[1], notes: 'all collected',
    checklist: { 'Computer/Laptop': { status: 'Collected', comments: 'S/N ABC123' }, 'Mobile Phone': { status: 'Collected' }, 'Building Access Card/Keys': { status: 'Collected' } } }));
  const aRow = rows('Action Items').find(x => x[1] === assets[1]);
  truthy('Assets draft saved in the UI shape {items:{…}} with Collected statuses', /"items":\{"Computer\/Laptop":\{"status":"Collected"/.test(String(aRow[11])));
  const ret = mailsSince(mA).find(m => m.subject === 'Assets Returned: IT Equipment');
  truthy('"Assets Returned: IT Equipment" → IT fired from the Collected draft', ret && ret.to === E.IT);
  contains('IT asset-return body lists the phone number', ret && ret.body, 'Mobile Phone (Number: 555-0199)');
  eq('Workflows Complete', wfRow(wf)[4], 'Complete');
  eq('step All Action Items Closed', wfRow(wf)[7], 'All Action Items Closed');
  eq('Terminations HR Approved Status column synced to Complete', rows('Terminations').find(x => x[0] === wf)[16], 'Complete');
  const done = mailsSince(m0).filter(m => m.subject === 'Workflow Completed: End of Employment Request (' + wf + ')');
  eq('two completion emails', done.length, 2);
  setEq('completion recipients', done.map(m => m.to), [E.HR, REQ + ',' + MGR]);
  eq('completion context hrDecision Approved', done[0].contextData.hrDecision, 'Approved');
  eq('exactly one Assets Returned email in the close-out (IT equipment only; no credit card / vehicle collected)', mailsSince(m0).filter(m => /Assets Returned/.test(m.subject)).length, 1);
  eq('events task.closed = 8, actors = bot', rawLog().filter(e => e.wf === wf && e.kind === 'task.closed' && e.user === ACTOR.email).length, 8);

  // rejected variant
  m0 = mails().length;
  truthy('alias layer did NOT mutate the caller payload (n8nSubmit_ hands the handler a copy)', payload.workflowId === undefined && payload.formId === undefined && payload.timestamp === undefined);
  truthy('the same payload object still validates after the call (safe to retry)', _ctx.FormContracts.validate('termination_request', payload).ok);
  note('Prod handlers (submitTerminationRequest / submitPositionChangeRequest / submitInitialRequest) mutate the object they receive (workflowId, formId, timestamp). The EFX alias layer copies the payload first, so an n8n retry with the same item is safe; only direct handler calls (UI path) still see the mutation.');
  const r2 = step('second termination (other requester) → to be Rejected', 'n8n_createTerminationRequest', () => _ctx.n8n_createTerminationRequest(ACTOR, Object.assign(termPayload(), { reqEmail: 'other@team-group.com', empName: 'Rej Ected', systems: ['BOSS'], equip: [] })));
  const wf2 = r2.result && r2.result.workflowId;
  truthy('distinct workflow', wf2 && wf2 !== wf);
  m0 = mails().length;
  step('n8n_submitTerminationApproval Rejected (HR actor)', 'n8n_submitTerminationApproval', () => _ctx.n8n_submitTerminationApproval(HR_ACTOR, { workflowId: wf2, decision: 'Rejected', notes: 'Not authorised' }));
  eq('Workflows Status Rejected', wfRow(wf2)[4], 'Rejected');
  eq('Workflows step Rejected by HR', wfRow(wf2)[7], 'Rejected by HR');
  eq('no action items for rejected', aiFor(wf2).length, 0);
  setEq('emails: Termination Rejected only', subjectsSince(m0), ['Termination Rejected']);
  eq('rejection → requester + manager', mailsSince(m0)[0].to, 'other@team-group.com,' + MGR);
  eq('rejection context hrDecision', mailsSince(m0)[0].contextData.hrDecision, 'Rejected');
  eq('Terminations status column synced Rejected', rows('Terminations').find(x => x[0] === wf2)[16], 'Rejected');
  const gw = step('n8n_getWorkflow (termination details)', 'n8n_getWorkflow', () => _ctx.n8n_getWorkflow(ACTOR, wf));
  truthy('termination details returned', gw.result.success === true);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. STATUS / POSITION CHANGE
// ─────────────────────────────────────────────────────────────────────────────
scenario('8. STATUS CHANGE — request → HR approval → 11 action items → boss_wis_update close launches WIS → IT Setup closes IT → close all → Complete; 8b Fleetio add+remove', () => {
  seedBase();
  const pcPayload = () => ({ reqName: 'David Binns', reqEmail: REQ, reqDate: '2026-09-16', firstName: 'Grace', lastName: 'Hopper', currentTitle: 'Analyst', currentClass: 'Hourly',
    currentManagerEmail: 'oldmgr@team-group.com', currentManagerName: 'Old Manager', effDate: '2026-10-15', siteName: 'Aurora',
    changeType: ['Site Transfer', 'Position Change', 'Manager Change'], siteOld: 'Aurora', siteNew: 'Ottawa Main', titleOld: 'Analyst', titleNew: 'Senior Analyst',
    classOld: 'Hourly', classNew: 'Salary', mgrOldEmail: 'oldmgr@team-group.com', mgrOldName: 'Old Manager', mgrNewEmail: 'newmgr@team-group.com', mgrNewName: 'New Manager',
    receivingManagerEmail: 'newmgr@team-group.com', department: 'Finance', sys: ['BOSS', 'SiteDocs'], equip: ['Business Cards', 'Computer'], rem: ['SiteDocs'], equipRem: ['Vehicle'],
    purchasingSites: '1001', bossComm: '1001', bossCost: 'Yes', bossCostJobs: '1001', computerRequestType: 'New', computerType: 'Windows', office365Required: 'Yes', comments: 'E2E status change' });
  const payload = pcPayload();
  truthy('payload validates against FormContracts.position_change_request', _ctx.FormContracts.validate('position_change_request', payload).ok);
  const r = step('n8n_createPositionChangeRequest (alias)', 'n8n_createPositionChangeRequest', () => _ctx.n8n_createPositionChangeRequest(ACTOR, payload));
  const wf = r.result && r.result.workflowId;
  truthy('CHANGE_ workflow', /^CHANGE_/.test(wf || ''));
  eq('Raw Log submit attributed to actor', (rawLog().find(e => e.source === 'submitPositionChangeRequest') || {}).user, ACTOR.email);
  const pc = rows('Position Changes').find(x => x[0] === wf);
  eq('Position Changes row 61 cols', pc.length, 61);
  eq('PC[9] change types', pc[9], 'Site Transfer, Position Change, Manager Change');
  eq('PC[10] site transfer', pc[10], 'Aurora -> Ottawa Main');
  eq('PC[13] manager change', pc[13], 'Old Manager (oldmgr@team-group.com) -> New Manager (newmgr@team-group.com)');
  eq('PC[17] systems', pc[17], 'BOSS, SiteDocs');
  eq('PC[58] equipment return', pc[58], 'Vehicle');
  eq('PC[59] status', pc[59], 'In Progress');
  eq('step HR Approval Needed', wfRow(wf)[7], 'HR Approval Needed');
  setEq('emails: HR Approval Required ×2 + Status Change Initiated', subjectsSince(0), ['HR Approval Required', 'HR Approval Required', 'Status Change Initiated']);
  eq('Status Change Initiated → old manager', mails().find(m => m.subject === 'Status Change Initiated').to, 'oldmgr@team-group.com');
  truthy('Dashboard_View isChange', dash(wf) && /"isChange":true/.test(String(dash(wf)[10])));

  const badDec = step('n8n_submitPositionChangeApproval decision=Maybe → E_VALIDATION (enum)', 'n8n_submitPositionChangeApproval', () => _ctx.n8n_submitPositionChangeApproval(HR_ACTOR, { workflowId: wf, decision: 'Maybe' }), { expectFail: true });
  eq('code E_VALIDATION', badDec.error && badDec.error.code, 'E_VALIDATION');

  let m0 = mails().length;
  const ai0 = rows('Action Items').length;
  const ap = step('n8n_submitPositionChangeApproval Approved (HR actor; confirmedTitle + confirmedNewManager)', 'n8n_submitPositionChangeApproval', () => _ctx.n8n_submitPositionChangeApproval(HR_ACTOR,
    { workflowId: wf, decision: 'Approved', notes: 'Approved by HR', confirmedTitle: 'Senior Analyst', confirmedNewManager: 'newmgr@team-group.com' }));
  contains('11 action items generated', ap.result && ap.result.message, '11 action items generated');
  const pca = rows('Position Change Approval Result').find(x => x[0] === wf);
  eq('approval row decision/title/manager', [pca[3], pca[5], pca[6]].join('|'), 'Approved|Senior Analyst|newmgr@team-group.com');
  eq('approval Submitted By = HR actor', pca[7], HR_ACTOR.email);
  const created = rows('Action Items').slice(ai0);
  setEq('action items (category/formType)', created.map(catFt), ['Manager/', 'Business Cards/businesscards', 'Purchasing/jonas', 'IT/it_setup', 'Assets/fleetio', 'Assets/', 'ID Setup/safety_change', 'ID Setup/boss_wis_update', 'ID Setup/', 'Safety/safety_change', 'HR/adp_update']);
  eq('Manager task → receiving manager', created.find(x => x[2] === 'Manager')[5], 'newmgr@team-group.com');
  eq('Asset Collection task → old manager', created.find(x => x[2] === 'Assets' && x[12] === '')[5], 'oldmgr@team-group.com');
  eq('Vehicle Return task → Fleetio', created.find(x => x[2] === 'Assets' && x[12] === 'fleetio')[5], E.FLEET);
  eq('ADP task → HR + Payroll', created.find(x => x[12] === 'adp_update')[5], E.HR + ',' + E.PAYROLL);
  truthy('IT checklist has BOSS provisioning with committee + cost sheet', /Provision BOSS access — Committees: 1001 — Cost Sheet: YES Jobs: 1001/.test(created.find(x => x[2] === 'IT')[4]));
  truthy('IT checklist has computer (New — Windows — Office 365)', /Provision computer \(New — Windows — Office 365 required\)/.test(created.find(x => x[2] === 'IT')[4]));
  eq('no WIS task yet (sequenced behind boss_wis_update)', aiBy(wf, 'wis_assignment') ? 1 : 0, 0);
  eq('step → Action Items Pending', wfRow(wf)[7], 'Action Items Pending');
  setEq('approval emails', subjectsSince(m0), ['Incoming Transfer Action Required', 'Status Change Approved', 'Business Cards Action Required', 'Vehicle Return Required', 'Central Purchasing/Jonas Action Required', 'IT Action Required',
    'Asset Collection Required', 'SiteDocs Access Removal Required', 'BOSS WIS Account Update Required', 'SiteDocs Account Setup Required', 'Safety System Updates Required', 'ADP Update Required — Grace Hopper', 'Status Change Approved']);
  eq('Incoming Transfer → new manager', mailsSince(m0)[0].to, 'newmgr@team-group.com');
  contains('IT Action Required formUrl → it_setup form', mailsSince(m0).find(m => m.subject === 'IT Action Required').formUrl, 'form=it_setup&wf=' + wf);
  const finalApproved = mailsSince(m0).filter(m => m.subject === 'Status Change Approved').pop();
  defect('final "Status Change Approved" goes to requester + NEW manager', /newmgr@team-group\.com/.test(finalApproved.to), finalApproved.to, REQ + ',newmgr@team-group.com',
    "PositionChangeHandler.js:426 tests changeType for 'Reporting Manager Change' but the UI/contract send 'Manager Change' → mgrNewEmail falls back to the OLD manager");
  eq('Raw Log task.created = 11', rawLog().filter(e => e.wf === wf && e.kind === 'task.created').length, 11);

  // sequencing hook
  m0 = mails().length;
  const bw = step('n8n_closeTask(boss_wis_update) → launches WIS assignment', 'n8n_closeTask', () => _ctx.n8n_closeTask(ACTOR, { workflowId: wf, formType: 'boss_wis_update', notes: 'BOSS account moved to Ottawa Main' }));
  eq('boss_wis_update Closed', rows('Action Items').find(x => x[1] === bw.result.taskId)[6], 'Closed');
  const wis = aiBy(wf, 'wis_assignment', 'WIS');
  truthy('WIS/wis_assignment task created by the post-close hook', !!wis);
  eq('WIS assignee = receiving manager', wis && wis[5], 'newmgr@team-group.com');
  setEq('emails: BOSS WIS Assignment Required → new manager', mailsSince(m0).map(m => m.to + '|' + m.subject), ['newmgr@team-group.com|BOSS WIS Assignment Required — Grace Hopper']);
  const evSeq = rawLog().filter(e => e.wf === wf && (e.kind === 'task.closed' || e.kind === 'task.created'));
  truthy('events: task.closed(boss_wis_update) precedes task.created(wis_assignment)', evSeq.findIndex(e => e.kind === 'task.closed') < evSeq.findIndex(e => e.kind === 'task.created' && JSON.parse(e.json).formType === 'wis_assignment'));
  eq('workflow still In Progress', wfRow(wf)[4], 'In Progress');

  // IT via the real IT Setup form
  m0 = mails().length;
  const itTask = aiBy(wf, 'it_setup', 'IT');
  step('n8n_submitItSetup for CHANGE_ closes the IT action item', 'n8n_submitItSetup', () => _ctx.n8n_submitItSetup(IT_ACTOR, { workflowId: wf, Email_Created: 'No', Email_Username: '', Email_Domain: '', Email_Temp_Password: '',
    Computer_Assigned: 'Yes', Computer_Serial: 'SN-CHG-1', Computer_Model: 'ThinkPad T14', Computer_Type: 'Windows', Phone_Assigned: 'No', BOSS_Access: 'Yes', BOSS_Cmte_1001: 'Confirmed', BOSS_CostSheet_1001: 'Confirmed',
    Incidents_Access: 'No', CAA_Access: 'No', Delivery_App_Access: 'No', Net_Promoter_Score_Access: 'No', IT_Notes: 'Status change IT' }));
  const itRowAi = rows('Action Items').find(x => x[1] === itTask[1]);
  eq('IT action item Closed by IT actor', itRowAi[6] + '|' + itRowAi[10], 'Closed|' + IT_ACTOR.email);
  truthy('IT action item Form Data carries bossDetails', /"bossDetails"/.test(String(itRowAi[13])));
  const itRows = rows('IT Results').filter(x => x[0] === wf);
  truthy('IT Results written for CHANGE_', itRows.length >= 1);
  eq('IT Results computer serial', itRows[0][7], 'SN-CHG-1');
  note('CHANGE_ IT Setup writes IT Results twice (submitITSetup appendRow ITSetupHandler.js:312 + closeActionItem special case 1 ActionItemService.js:250) → ' + itRows.length + ' rows for one workflow. Documented as intentional belt-and-suspenders; duplicates the row.');
  eq('no new specialist tasks from CHANGE_ IT Setup (11 + WIS)', aiFor(wf).length, 12);
  setEq('emails: IT Setup Complete only', subjectsSince(m0), ['IT Setup Complete']);
  eq('IT Setup Complete → requester + new manager (context from manager-change string)', mailsSince(m0)[0].to, REQ + ',newmgr@team-group.com');
  eq('workflow still In Progress', wfRow(wf)[4], 'In Progress');

  // close everything blocking; Manager + WIS stay Open
  m0 = mails().length;
  const blocking = ['businesscards', 'jonas'].map(ft => aiBy(wf, ft)).concat([aiBy(wf, 'fleetio', 'Assets'), aiBy(wf, '', 'Assets'), aiBy(wf, 'safety_change', 'ID Setup'), aiBy(wf, '', 'ID Setup'), aiBy(wf, 'safety_change', 'Safety'), aiBy(wf, 'adp_update')]);
  closeAll(wf, blocking, 'status-change');
  eq('Workflows Complete with Manager + WIS still Open', wfRow(wf)[4], 'Complete');
  setEq('open leftovers = Manager + WIS (non-blocking categories)', openAi(wf).map(x => x[2]), ['Manager', 'WIS']);
  eq('Position Changes status synced Complete', rows('Position Changes').find(x => x[0] === wf)[59], 'Complete');
  const done = mailsSince(m0).filter(m => m.subject === 'Workflow Completed: Position/Site Change Request (' + wf + ')');
  eq('two completion emails', done.length, 2);
  setEq('completion recipients (HR; initiator + manager)', done.map(m => m.to), [E.HR, REQ + ',newmgr@team-group.com']);
  truthy('completion context enriched: hrDecision/hrNotes/confirmedTitle/computerSerial', done[0].contextData.hrDecision === 'Approved' && done[0].contextData.hrNotes === 'Approved by HR' && done[0].contextData.confirmedTitle === 'Senior Analyst' && done[0].contextData.computerSerial === 'SN-CHG-1');
  m0 = mails().length;
  closeAll(wf, [aiBy(wf, '', 'Manager'), aiBy(wf, 'wis_assignment')], 'non-blocking', { noProgressCheck: true });
  eq('status remains Complete', wfRow(wf)[4], 'Complete');
  eq('no extra completion emails', mailsSince(m0).filter(m => /Workflow Completed/.test(m.subject)).length, 0);
  const gw = step('n8n_getWorkflow (change details)', 'n8n_getWorkflow', () => _ctx.n8n_getWorkflow(ACTOR, wf));
  truthy('change details returned', gw.result.success === true && gw.result.type === 'Status Change');
  eq('events: task.closed = 12', rawLog().filter(e => e.wf === wf && e.kind === 'task.closed').length, 12);

  // 8b — Fleetio add + remove collide in createActionItem's idempotency guard
  const p2 = Object.assign(pcPayload(), { reqEmail: 'other@team-group.com', firstName: 'Fleet', lastName: 'Dup', changeType: ['Position Change'], sys: ['Fleetio'], equip: [], rem: ['Fleetio'], equipRem: ['Vehicle'], purchasingSites: '', receivingManagerEmail: '' });
  const r2 = step('8b: status change with Fleetio access ADD + REMOVE + vehicle return', 'n8n_createPositionChangeRequest', () => _ctx.n8n_createPositionChangeRequest(ACTOR, p2));
  const wf2 = r2.result && r2.result.workflowId;
  const aiB = rows('Action Items').length;
  m0 = mails().length;
  step('8b: approve', 'n8n_submitPositionChangeApproval', () => _ctx.n8n_submitPositionChangeApproval(HR_ACTOR, { workflowId: wf2, decision: 'Approved', notes: '' }));
  const c2 = rows('Action Items').slice(aiB);
  const fleet = c2.filter(x => x[2] === 'Fleet');
  defect('two distinct Fleet tasks (Fleetio Access Update + Fleetio Access Removal)', fleet.length === 2, fleet.map(x => x[3]), ['Fleetio Access Update', 'Fleetio Access Removal'],
    'ActionItemService.js:64-80 idempotency guard keys on workflowId+category+formType; PositionChangeHandler.js:235 and :273 both create Fleet/fleetio → the removal task is silently dropped');
  eq('both Fleetio emails still sent (pointing at the same task)', mailsSince(m0).filter(m => /Fleetio/.test(m.subject)).length, 2);
  truthy('Assets/fleetio Vehicle Return created (distinct formType)', c2.some(x => x[2] === 'Assets' && x[12] === 'fleetio'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. NEGATIVE / GUARDS / CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────
scenario('9. NEGATIVE / GUARDS — validation writes nothing, error codes, idempotency, Actor isolation, contract integrity', () => {
  seedBase();
  const v1 = step('missing lastName → E_VALIDATION', 'n8n_createInitialRequest', () => _ctx.n8n_createInitialRequest(ACTOR, newHire({ lastName: '' })), { expectFail: true });
  eq('code', v1.error && v1.error.code, 'E_VALIDATION');
  truthy('fields names lastName', v1.error.fields.some(f => f.field === 'lastName'));
  const v2 = step('employeeType=Salary (enum violation, r2) → E_VALIDATION', 'n8n_createInitialRequest', () => _ctx.n8n_createInitialRequest(ACTOR, newHire({ employeeType: 'Salary' })), { expectFail: true });
  truthy('fields names employeeType', v2.error && v2.error.fields.some(f => f.field === 'employeeType' && /Direct Hire\|Agency/.test(f.problem)));
  const v3 = step('unknown key → E_VALIDATION', 'n8n_createInitialRequest', () => _ctx.n8n_createInitialRequest(ACTOR, newHire({ bogus: 1 })), { expectFail: true });
  truthy('fields names bogus', v3.error.fields.some(f => f.field === 'bogus'));
  const v4 = step('formula-injection first char (=) → rejected by handler', 'n8n_createInitialRequest', () => _ctx.n8n_createInitialRequest(ACTOR, newHire({ firstName: '=HYPERLINK("x")' })), { expectFail: true });
  truthy('rejected with E_VALIDATION or E_UPSTREAM', v4.error && /^E_(VALIDATION|UPSTREAM)$/.test(v4.error.code));
  note('Formula-injection guard fires in the handler (validateRequiredFields) → code ' + (v4.error && v4.error.code) + ': ' + (v4.error && v4.error.message));
  eq('no Initial Requests rows written by any rejected create', rows('Initial Requests').length, 1);
  eq('no Workflows rows written (new_hire validates before createWorkflow)', rows('Workflows').length, 1);
  eq('no Employee IDs rows written', rows('Employee IDs').length, 0);
  eq('no emails sent by rejected creates', mails().length, 0);
  const v5 = step('id_setup missing required → E_VALIDATION', 'n8n_submitIdSetup', () => _ctx.n8n_submitIdSetup(ACTOR, { workflowId: 'X' }), { expectFail: true });
  eq('code', v5.error && v5.error.code, 'E_VALIDATION');
  const v6 = step('id_setup bad siteDocsJobCode enum → E_VALIDATION', 'n8n_submitIdSetup', () => _ctx.n8n_submitIdSetup(ACTOR, idSetupPayload('X', { siteDocsJobCode: 'Boss' })), { expectFail: true });
  truthy('fields names siteDocsJobCode', v6.error && v6.error.fields.some(f => f.field === 'siteDocsJobCode'));
  const v7 = step('id_setup on non-existent workflow → E_UPSTREAM', 'n8n_submitIdSetup', () => _ctx.n8n_submitIdSetup(ACTOR, idSetupPayload('NEW_EMP_NOPE')), { expectFail: true });
  eq('code E_UPSTREAM', v7.error && v7.error.code, 'E_UPSTREAM');
  contains('message names the workflow', v7.error.message, 'NEW_EMP_NOPE');
  eq('no ID Setup Results row written', rows('ID Setup Results').length, 2);
  const g1 = step('n8n_getWorkflow unknown → E_NOT_FOUND', 'n8n_getWorkflow', () => _ctx.n8n_getWorkflow(ACTOR, 'NEW_EMP_NOPE'), { expectFail: true });
  eq('code', g1.error && g1.error.code, 'E_NOT_FOUND');
  eq('n8n_getWorkflow empty → E_VALIDATION', _ctx.n8n_getWorkflow(ACTOR, '').error.code, 'E_VALIDATION');
  eq('n8n_closeTask({}) → E_VALIDATION', _ctx.n8n_closeTask(ACTOR, {}).error.code, 'E_VALIDATION');
  eq('n8n_closeTask unknown taskId → E_NOT_FOUND', _ctx.n8n_closeTask(ACTOR, { taskId: 'TK-NOPE' }).error.code, 'E_NOT_FOUND');
  eq('n8n_closeJrTask("") → E_VALIDATION', _ctx.n8n_closeJrTask(ACTOR, '').error.code, 'E_VALIDATION');
  eq('n8n_assignSafetyTraining no task → E_NOT_FOUND', _ctx.n8n_assignSafetyTraining(ACTOR, 'NEW_EMP_NOPE', {}).error.code, 'E_NOT_FOUND');
  eq('n8n_listTasks unknown workflow → ok, count 0', _ctx.n8n_listTasks(ACTOR, { workflowId: 'NEW_EMP_NOPE' }).result.count, 0);

  // closed task guards + forced safety close
  const wfS = 'NEW_EMP_20260916-100000_555';
  _rt.captures.seedSheet('Action Items', [
    [wfS, 'TK-CLOSED01', 'Finance', 'Credit Card Setup — X', '["Apply for USA card"]', E.CC, 'Closed', new Date(), new Date(), '', 'someone', '', 'creditcard', ''],
    [wfS, 'TK-SAFE0001', 'Safety', 'Safety Onboarding — X', JSON.stringify(['Assign SiteDocs locations for employee', 'Assign DSS learning paths']), E.SAFETY, 'Open', new Date(), '', '', '', '', 'safety_onboarding', ''],
    [wfS, 'TK-WIS00001', 'WIS', 'WIS Assignment — X', JSON.stringify(['Assign WIS']), MGR, 'Open', new Date(), '', '', '', '', 'wis', '']
  ]);
  eq('n8n_closeJrTask on a non-JR TK- id → E_VALIDATION (formType enforced)', _ctx.n8n_closeJrTask(ACTOR, 'TK-WIS00001').error.code, 'E_VALIDATION');
  eq('… and the WIS task is untouched', rows('Action Items').find(x => x[1] === 'TK-WIS00001')[6], 'Open');
  eq('closing a Closed task by id → E_ALREADY_CLOSED', _ctx.n8n_closeTask(ACTOR, { taskId: 'TK-CLOSED01' }).error.code, 'E_ALREADY_CLOSED');
  eq('closing by workflowId+formType when only a Closed one exists → E_ALREADY_CLOSED', _ctx.n8n_closeTask(ACTOR, { workflowId: wfS, formType: 'creditcard' }).error.code, 'E_ALREADY_CLOSED');
  const forced = step('n8n_assignSafetyTraining dssConfirmed=No + force:true closes and audits', 'n8n_assignSafetyTraining', () => _ctx.n8n_assignSafetyTraining(ACTOR, wfS, { siteDocsConfirmed: 'Yes', dssConfirmed: 'No', force: true, notes: 'ops override' }));
  const fRow = rows('Action Items').find(x => x[1] === forced.result.taskId);
  eq('forced: task Closed', fRow[6], 'Closed');
  contains('forced: notes carry FORCED marker', fRow[9], 'FORCED close with unconfirmed items via n8n');
  truthy('forced: DSS checklist item left Open in draft', /"Assign DSS learning paths":\{"status":"Open"/.test(String(fRow[11])));
  eq('createActionItem idempotency: same wf/category/formType twice → same task id', _ctx.ActionItemService.createActionItem(wfS, 'Fleet', 'A', '["a"]', E.FLEET, 'fleetio'), _ctx.ActionItemService.createActionItem(wfS, 'Fleet', 'B', '["b"]', E.FLEET, 'fleetio'));

  // 30-second idempotency guard — keyed on (type, requester, employee|hireDate) for Initial Requests (review pass 2 H2)
  _rt.captures.reset(); seedBase();
  const a = _ctx.n8n_createInitialRequest(ACTOR, newHire()); const b = _ctx.n8n_createInitialRequest(ACTOR, newHire({ firstName: 'Dup', lastName: 'Licate' }));
  truthy('same requester, different employee within 30 s → DIFFERENT workflowId (no merge under automation)', b.result.workflowId !== a.result.workflowId);
  truthy('… and a different internalEmployeeId', b.result.internalEmployeeId !== a.result.internalEmployeeId);
  const a2 = _ctx.n8n_createInitialRequest(ACTOR, newHire());
  eq('same requester + same employee within 30 s → same workflowId (double-submit guard held)', a2.result.workflowId, a.result.workflowId);
  eq('… and the same internalEmployeeId (allocate is idempotent per workflow)', a2.result.internalEmployeeId, a.result.internalEmployeeId);
  eq('Workflows rows = 2 (one per distinct hire)', rows('Workflows').length, 3);
  eq('Initial Requests rows for the deduped workflow = 2 (guard does not stop the second data row)', rows('Initial Requests').filter(x => x[0] === a.result.workflowId).length, 2);
  eq('emails sent per submit (guard does not stop the email pair)', mails().length, 6);
  note('createWorkflow 30 s idempotency guard (WorkflowManager.js:91-104) returns the same workflowId but submitInitialRequest still appends a second Initial Requests row and re-sends both emails (InitialRequestHandler.js:55-113).');
  const c2 = _ctx.n8n_createInitialRequest(ACTOR, newHire({ requesterEmail: 'other@team-group.com', firstName: 'New', lastName: 'Req' }));
  truthy('different requester → new workflow', c2.result.workflowId !== a.result.workflowId);

  // Actor isolation
  eq('Actor.current() null after alias calls', _ctx.Actor.current(), null);
  eq('Actor.email() falls back to Session when no actor', _ctx.Actor.email(), 'dbinns@team-group.com');
  const nested = _ctx.Actor.run(ACTOR, () => { const inner = _ctx.Actor.run(HR_ACTOR, () => _ctx.Actor.email()); return inner + '|' + _ctx.Actor.email() + '|' + _ctx.Actor.isAutomation(); });
  eq('nested Actor.run restores the outer actor', nested, HR_ACTOR.email + '|' + ACTOR.email + '|true');
  let thrown = false; try { _ctx.Actor.run(ACTOR, () => { throw new Error('boom'); }); } catch (e) { thrown = true; }
  truthy('Actor.run releases the override even when fn throws', thrown && _ctx.Actor.current() === null);
  eq('Actor.principal() is the session, never the actor', _ctx.Actor.run(ACTOR, () => _ctx.Actor.principal() + '|' + _ctx.Actor.email()), 'dbinns@team-group.com|' + ACTOR.email);
  eq('Actor.canOverrideEmployeeId follows the principal (admin session) even under a bot actor', _ctx.Actor.run(ACTOR, () => _ctx.Actor.canOverrideEmployeeId()), true);

  // authorization = Actor.principal() (the real Google session); the caller-asserted actor cannot elevate.
  // Swap the mock session to a non-privileged user and prove every role-gated path denies, then restore.
  const origGetActiveUser = _ctx.Session.getActiveUser;
  _ctx.Session.getActiveUser = () => ({ getEmail: () => 'nobody@team-group.com' });
  try {
    eq('principal nobody: Actor.principal()', _ctx.Actor.principal(), 'nobody@team-group.com');
    const hrDen = _ctx.n8n_submitHrVerification(HR_ACTOR, hrPayload(a.result.workflowId, { adpAssociateId: 'ADP-X' }));
    eq('principal nobody + HR-group actor: n8n_submitHrVerification → E_FORBIDDEN "Access denied." (actor cannot elevate; M1)', hrDen.error && (hrDen.error.code + '|' + hrDen.error.message), 'E_FORBIDDEN|Access denied.');
    eq('… E_FORBIDDEN names the principal that was checked', hrDen.error && hrDen.error.principal, 'nobody@team-group.com');
    eq('principal nobody: n8n_submitItSetup → Access denied.', _ctx.n8n_submitItSetup(IT_ACTOR, itSetupPayload(a.result.workflowId)).error.message, 'Access denied.');
    eq('principal nobody: n8n_submitTerminationApproval → Access denied.', _ctx.n8n_submitTerminationApproval(HR_ACTOR, { workflowId: 'TERM_X', decision: 'Approved' }).error.message, 'Access denied.');
    eq('principal nobody: n8n_submitPositionChangeApproval → Access denied.', _ctx.n8n_submitPositionChangeApproval(HR_ACTOR, { workflowId: 'CHANGE_X', decision: 'Approved' }).error.message, 'Access denied.');
    eq('principal nobody: n8n_cancelWorkflow → E_FORBIDDEN', _ctx.n8n_cancelWorkflow(ACTOR, a.result.workflowId).error.code, 'E_FORBIDDEN');
    eq('principal nobody: n8n_updateHireDate → E_FORBIDDEN', _ctx.n8n_updateHireDate(ACTOR, a.result.workflowId, '2026-11-01').error.code, 'E_FORBIDDEN');
    eq('principal nobody: id override refused even with an admin actor object', _ctx.Actor.run(ADMIN, () => _ctx.Actor.canOverrideEmployeeId()), false);
    const ovr = _ctx.n8n_submitIdSetup(ADMIN, idSetupPayload(a.result.workflowId, { internalEmployeeId: '99999' }));
    contains('principal nobody: n8n_submitIdSetup with a different id → pre-assigned message', ovr.error && ovr.error.message, 'pre-assigned');
    eq('nothing written under the denied principal (HR rows)', rows('HR Verification Results').filter(x => x[0] === a.result.workflowId).length, 0);
    eq('nothing written under the denied principal (IT rows)', rows('IT Results').filter(x => x[0] === a.result.workflowId).length, 0);
    eq('Workflows row untouched by the denied cancel', wfRow(a.result.workflowId)[4], 'In Progress');
  } finally { _ctx.Session.getActiveUser = origGetActiveUser; }
  eq('principal restored', _ctx.Actor.principal(), 'dbinns@team-group.com');
  eq('role payload: HR group address / IT group address / bot', JSON.stringify([_ctx.AccessControlService.getUserRolePayload(E.HR).isHR, _ctx.AccessControlService.getUserRolePayload(E.IT).isIT, _ctx.AccessControlService.getUserRolePayload(ACTOR.email).isHR]), '[true,true,false]');
  note('Authorization uses Actor.principal() = the real Google session (under the Execution API: the impersonated bot); the actor object is attribution only. The mock session is dbinns (admin) so every role-gated step passes in the chains; verify live that the Execution-API principal is in grp.forms.hr / grp.forms.it or CONFIG.ADMIN_EMAILS.');

  // contracts / surface
  const aliases = _ctx.N8N_ALIASES;
  truthy('every alias in N8N_ALIASES exists as a function (' + aliases.length + ')', aliases.every(x => typeof _ctx[x.name] === 'function'));
  eq('n8n_info alias count = N8N_ALIASES.length', _ctx.n8n_info().result.aliases.length, aliases.length);
  truthy('every alias with a form points at a FormContracts entry', aliases.filter(x => x.form).every(x => !!_ctx.FormContracts.get(x.form)));
  truthy('every form-bound alias points at a verified contract', aliases.filter(x => x.form).every(x => _ctx.FormContracts.get(x.form).verified === true));
  eq('n8n_createWorkflow with a step form → E_VALIDATION (wrong alias)', _ctx.n8n_createWorkflow(ACTOR, 'id_setup', {}).error.code, 'E_VALIDATION');
  eq('n8n_submitForm with a workflow-creating form → E_VALIDATION (wrong alias)', _ctx.n8n_submitForm(ACTOR, 'new_hire', {}).error.code, 'E_VALIDATION');
  eq('unknown form → E_UNKNOWN_FORM', _ctx.n8n_createWorkflow(ACTOR, 'nope', {}).error.code, 'E_UNKNOWN_FORM');
  eq('unverified form (specialist) refused → E_UNVERIFIED_FORM', _ctx.n8n_submitForm(ACTOR, 'specialist', { workflowId: 'X', department: 'safety' }).error.code, 'E_UNVERIFIED_FORM');
  eq('n8n_submitForm copies options.workflowId into the payload', _ctx.n8n_submitForm(ACTOR, 'id_setup', { siteDocsWorkerId: 'W', siteDocsJobCode: 'Hourly 1', dssUsername: 'u', dssPassword: 'p' }, { workflowId: 'NEW_EMP_NOPE' }).error.code, 'E_UPSTREAM');
  const forms = _ctx.FormContracts.list();
  const notLoaded = forms.filter(f => typeof _ctx[f.fn] !== 'function').map(f => f.fn);
  const srcFiles = fs.readdirSync(SRC).filter(f => /\.js$/.test(f)).concat(fs.readdirSync(path.join(SRC, 'Services')).map(f => 'Services/' + f)).filter(f => /\.js$/.test(f));
  const definedIn = fn => srcFiles.filter(f => new RegExp('^function\\s+' + fn + '\\s*\\(', 'm').test(fs.readFileSync(path.join(SRC, f), 'utf8')));
  truthy('every FormContracts fn is defined in the project (loaded: ' + (forms.length - notLoaded.length) + '/' + forms.length + '; not in LOAD_ORDER: ' + notLoaded.map(fn => fn + '→' + definedIn(fn).join('+')).join(', ') + ')',
    notLoaded.every(fn => definedIn(fn).length > 0));
  eq('submitITConfirmation is defined twice in the project (known dup: BOSSReviewHandler.js + ITConfirmationHandler.js)', definedIn('submitITConfirmation').length, 2);
  truthy('every FormContracts fn is efxRunAs-callable', forms.every(f => _ctx.FormContracts.isCallable(f.fn)));
  const k1 = _ctx.n8n_contracts(), k2 = _ctx.n8n_contracts();
  eq('n8n_contracts hashes stable across two calls', k1.result.forms.map(f => f.form + ':' + f.hash).join(','), k2.result.forms.map(f => f.form + ':' + f.hash).join(','));
  eq('contractsVersion matches FormContracts.VERSION', k1.result.contractsVersion, _ctx.FormContracts.VERSION);
  eq('apiVersion matches N8N_API_VERSION', k1.result.apiVersion, _ctx.N8N_API_VERSION);
  truthy('verified forms include the aliased ones (new_hire, id_setup, hr_verification)', ['new_hire', 'id_setup', 'hr_verification'].every(f => k1.result.forms.find(x => x.form === f).verified === true));
  eq('n8n_ping ok with spreadsheetId', _ctx.n8n_ping().result.spreadsheetId, 'TEST_SS_ID');
  let threw = false; try { _ctx.efxRunAs(JSON.stringify(ACTOR), 'adminPurgeWorkflows', '[]'); } catch (e) { threw = /not exposed/.test(e.message); }
  truthy('efxRunAs refuses non-allow-listed functions', threw);
  eq('efxRunAs runs allow-listed reads under the actor', _ctx.efxRunAs(JSON.stringify(ACTOR), 'getWorkflow', JSON.stringify([a.result.workflowId]))['Workflow ID'], a.result.workflowId);
  // Review pass 2 L8: efxRunAs is an Execution-API surface — allow-listed reads must not hand back credentials
  const rWf = _ctx.n8n_createInitialRequest(ACTOR, newHire({ firstName: 'Red', lastName: 'Acted', requesterEmail: 'redact@team-group.com' })).result.workflowId;
  truthy('setup: ID Setup with known passwords', _ctx.n8n_submitIdSetup(ACTOR, idSetupPayload(rWf)).ok);
  const stepData = _ctx.efxRunAs(JSON.stringify(ACTOR), 'getStepResultData', JSON.stringify([rWf, 'id_setup']));
  eq('efxRunAs(getStepResultData, id_setup): DSS Password redacted', stepData && stepData['DSS Password'], '[REDACTED]');
  eq('… SiteDocs Password redacted', stepData && stepData['SiteDocs Password'], '[REDACTED]');
  eq('… DSS Username still visible', stepData && stepData['DSS Username'], 'ada.lovelace');
  truthy('… no plaintext credential anywhere in the return', !/Dss#2026|Sd#2026/.test(JSON.stringify(stepData)));
  truthy('… getWorkflow via efxRunAs keeps dates as ISO strings (efxJsonSafe before redaction)', typeof _ctx.efxRunAs(JSON.stringify(ACTOR), 'getWorkflow', JSON.stringify([rWf]))['Created Date'] === 'string');
  eq('n8n_submitHrVerification alias exists and validates (missing adpAssociateId)', _ctx.n8n_submitHrVerification(HR_ACTOR, { workflowId: a.result.workflowId, firstName: 'A', lastName: 'B', managerName: 'M', managerEmail: MGR, jobTitle: 'T' }).error.code, 'E_VALIDATION');
  const hrAlias = _ctx.n8n_submitHrVerification(HR_ACTOR, { workflowId: a.result.workflowId, firstName: 'Ada', lastName: 'Lovelace', managerName: 'Mgr One', managerEmail: MGR, jobTitle: 'Site Supervisor', jrTitle: 'Site Supervisor', adpAssociateId: 'ADP-9', hireDate: '2026-10-01', siteName: 'Aurora' });
  truthy('n8n_submitHrVerification alias runs the real handler under the HR actor', hrAlias.ok === true && rows('HR Verification Results').find(x => x[0] === a.result.workflowId)[9] === HR_ACTOR.email);
});

// ─────────────────────────────────────────────────────────────────────────────
// 9b. NEW ALIASES (2026.09.17-1) — listWorkflows / getContext / saveTaskDraft / bumpWorkflow / updateHireDate / cancelWorkflow
// ─────────────────────────────────────────────────────────────────────────────
scenario('9b. NEW ALIASES — n8n_listWorkflows / n8n_getContext (redacted) / n8n_saveTaskDraft / n8n_bumpWorkflow / n8n_updateHireDate / n8n_cancelWorkflow', () => {
  seedBase();
  const c = step('create + ID Setup (setup)', 'n8n_createInitialRequest', () => { const r = _ctx.n8n_createInitialRequest(ACTOR, salaryFull()); _ctx.n8n_submitIdSetup(ACTOR, idSetupPayload(r.result.workflowId)); return r; });
  const wf = c.result.workflowId;
  const lw = step('n8n_listWorkflows({type:Onboarding})', 'n8n_listWorkflows', () => _ctx.n8n_listWorkflows(ACTOR, { type: 'Onboarding' }));
  eq('lists the workflow from Dashboard_View', lw.result.workflows.map(w => w.workflowId).join(), wf);
  eq('type / Global Status / granular step', [lw.result.workflows[0].type, lw.result.workflows[0]['Global Status'], lw.result.workflows[0]['Granular Step Details']].join('|'), 'Onboarding|In Progress|Pending: HR Verification');
  eq('filter status=Complete → 0', _ctx.n8n_listWorkflows(ACTOR, { status: 'Complete' }).result.count, 0);
  eq('filter employeeName substring (case-insensitive)', _ctx.n8n_listWorkflows(ACTOR, { employeeName: 'LOVEL' }).result.count, 1);
  eq('filter by prefix', _ctx.n8n_listWorkflows(ACTOR, { type: 'TERM_' }).result.count, 0);
  const gc = step('n8n_getContext', 'n8n_getContext', () => _ctx.n8n_getContext(ACTOR, wf));
  eq('context employeeName', gc.result.employeeName, 'Ada Lovelace');
  eq('context internalEmployeeId (ID Setup done)', gc.result.internalEmployeeId, '30411');
  eq('context passwords redacted', gc.result.dssPassword + '|' + gc.result.siteDocsPassword, '[REDACTED]|[REDACTED]');
  eq('context usernames kept', gc.result.dssUsername, 'ada.lovelace');
  eq('getContext unknown → E_NOT_FOUND', _ctx.n8n_getContext(ACTOR, 'NEW_EMP_NOPE').error.code, 'E_NOT_FOUND');

  let m0 = mails().length;
  const b1 = step('n8n_bumpWorkflow(hr_verification)', 'n8n_bumpWorkflow', () => _ctx.n8n_bumpWorkflow(ACTOR, wf, 'hr_verification'));
  eq('reminder recipient = HR', b1.result.recipient, E.HR);
  truthy('reminder email captured → HR', mailsSince(m0).some(m => m.to === E.HR && /HR Verification Required/.test(m.subject)));
  const b2 = step('second bump within the hour → E_RATE_LIMITED', 'n8n_bumpWorkflow', () => _ctx.n8n_bumpWorkflow(ACTOR, wf, 'hr_verification'), { expectFail: true });
  eq('code', b2.error && b2.error.code, 'E_RATE_LIMITED');
  truthy('Audit Log BUMP row (user = principal, not actor)', rows('Audit Log').some(r => r[2] === 'BUMP' && r[3] === wf && r[1] === 'dbinns@team-group.com'));

  const hd = step('n8n_updateHireDate → 2026-10-05', 'n8n_updateHireDate', () => _ctx.n8n_updateHireDate(ACTOR, wf, '2026-10-05'));
  contains('message shows old → new', hd.result.message, '2026-10-01 to 2026-10-05');
  eq('getContext hireDate updated', _ctx.n8n_getContext(ACTOR, wf).result.hireDate, '2026-10-05');
  eq('Dashboard_View Hire Date updated', dash(wf)[11], '2026-10-05');
  eq('missing date → E_VALIDATION', _ctx.n8n_updateHireDate(ACTOR, wf, '').error.code, 'E_VALIDATION');
  truthy('Audit Log UPDATE_HIRE_DATE row', rows('Audit Log').some(r => r[2] === 'UPDATE_HIRE_DATE' && r[3] === wf && /2026-10-01 → 2026-10-05/.test(String(r[4]))));

  step('HR verification (setup for tasks)', 'n8n_submitHrVerification', () => _ctx.n8n_submitHrVerification(HR_ACTOR, hrPayload(wf, { hireDate: '2026-10-05' })));
  const safety = aiBy(wf, 'safety_onboarding');
  step('n8n_saveTaskDraft (partial checklist, no close)', 'n8n_saveTaskDraft', () => _ctx.n8n_saveTaskDraft(ACTOR, safety[1], 'locations done, DSS pending', { 'Assign SiteDocs locations for employee': { status: 'Complete', comments: 'Aurora' } }));
  const sRow = rows('Action Items').find(x => x[1] === safety[1]);
  eq('task still Open', sRow[6], 'Open');
  eq('notes saved', sRow[9], 'locations done, DSS pending');
  truthy('draft saved in the UI {items:{…}} shape, by actor', /"items":\{"Assign SiteDocs locations for employee":\{"status":"Complete","by":"efx-bot@team-group.com"/.test(String(sRow[11])));
  eq('n8n_listTasks exposes the draft', _ctx.n8n_listTasks(ACTOR, { taskId: safety[1] }).result.tasks[0].draft.items['Assign SiteDocs locations for employee'].comments, 'Aurora');
  eq('saveTaskDraft unknown task → E_NOT_FOUND', _ctx.n8n_saveTaskDraft(ACTOR, 'TK-NOPE', '', {}).error.code, 'E_NOT_FOUND');
  // M2: a second partial draft MERGES (human autosave / earlier items survive; notes kept when omitted)
  step('n8n_saveTaskDraft (second partial item, notes omitted)', 'n8n_saveTaskDraft', () => _ctx.n8n_saveTaskDraft(ACTOR, safety[1], undefined, { 'Assign DSS learning paths': { status: 'Pending', comments: 'queued' } }));
  const sRow2 = rows('Action Items').find(x => x[1] === safety[1]);
  eq('notes preserved when omitted', sRow2[9], 'locations done, DSS pending');
  truthy('earlier item still in the draft', /"Assign SiteDocs locations for employee":\{"status":"Complete"/.test(String(sRow2[11])));
  truthy('new item merged in', /"Assign DSS learning paths":\{"status":"Pending"/.test(String(sRow2[11])));
  step('n8n_assignSafetyTraining after the draft', 'n8n_assignSafetyTraining', () => _ctx.n8n_assignSafetyTraining(ACTOR, wf, { siteDocsConfirmed: 'Yes', dssConfirmed: 'Yes' }));
  const sDraft = JSON.parse(String(rows('Action Items').find(x => x[1] === safety[1])[11]));
  truthy('close merged onto the saved draft (both items Complete, first keeps its comment)', sDraft.items['Assign SiteDocs locations for employee'].status === 'Complete' && sDraft.items['Assign DSS learning paths'].status === 'Complete');

  m0 = mails().length;
  step('n8n_cancelWorkflow (principal = admin session)', 'n8n_cancelWorkflow', () => _ctx.n8n_cancelWorkflow(ACTOR, wf));
  eq('Workflows Status Cancelled', wfRow(wf)[4], 'Cancelled');
  eq('Workflows step Request Cancelled', wfRow(wf)[7], 'Request Cancelled');
  setEq('remaining Open tasks flipped to Cancelled', aiFor(wf).filter(x => x[6] === 'Cancelled').map(x => x[2]), ['IT Confirmation']);
  eq('closing a Cancelled task → E_TASK_NOT_OPEN', _ctx.n8n_closeTask(ACTOR, { taskId: aiBy(wf, '', 'IT Confirmation')[1] }).error.code, 'E_TASK_NOT_OPEN');
  eq('no emails on cancel', mailsSince(m0).length, 0);
  truthy('Audit Log CANCEL row', rows('Audit Log').some(r => r[2] === 'CANCEL' && r[3] === wf));
  eq('Dashboard_View Cancelled', dash(wf)[2], 'Cancelled');
  eq('IR Status column synced Cancelled', rows('Initial Requests').find(x => x[0] === wf)[52], 'Cancelled');
  eq('cancel unknown → E_NOT_FOUND', _ctx.n8n_cancelWorkflow(ACTOR, 'NEW_EMP_NOPE').error.code, 'E_NOT_FOUND');
  eq('listWorkflows status=Cancelled → 1', _ctx.n8n_listWorkflows(ACTOR, { status: 'Cancelled' }).result.count, 1);
  eq('Actor isolation', _ctx.Actor.current(), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. EMAIL SAFETY — over everything captured above
// ─────────────────────────────────────────────────────────────────────────────
scenario('10. EMAIL SAFETY — every message captured by the mock, none sent; recipients non-empty; redirect honoured', () => {
  const all = LOG.scenarios.flatMap(s => s.emails.map(e => Object.assign({ scenario: s.name }, e)));
  const mail = LOG.scenarios.flatMap(s => s.mail);
  truthy('emails were captured (' + all.length + ')', all.length > 0);
  eq('no sendFormEmail call threw', all.filter(e => e.__error).length, 0);
  eq('no empty recipient list', all.filter(e => !e.to || !String(e.to).trim()).length, 0);
  eq('no recipient token is undefined/null/N/A/empty', all.flatMap(e => String(e.to).split(',')).filter(t => !/^[^@\s]+@[^@\s]+$/.test(t.trim())).length, 0);
  eq('no empty subject', all.filter(e => !e.subject).length, 0);
  eq('MailApp captured exactly as many messages as sendFormEmail produced', mail.length, all.length);
  truthy('mock ConfigurationService EMAIL_REDIRECT_ALL is honoured: every MailApp "to" = dbinns@team-group.com', mail.every(m => m.to === 'dbinns@team-group.com'));
  truthy('every redirected subject carries [TEST]', mail.every(m => /^\[TEST\] /.test(m.subject)));
  const byScenario = LOG.scenarios.map(s => s.name.split('.')[0] + ': ' + s.emails.length);
  note('emails per scenario → ' + byScenario.join(' | '));
  const perRole = {};
  all.forEach(e => String(e.to).split(',').forEach(t => { const r = roleOf(t.trim()); perRole[r] = (perRole[r] || 0) + 1; }));
  note('recipients by role → ' + JSON.stringify(perRole));
  truthy('no email was addressed to a non-team-group.com domain', all.flatMap(e => String(e.to).split(',')).every(t => /@team-group\.com$/.test(t.trim())));
});

function roleOf(addr) {
  const m = { [E.HR]: 'HR', [E.IT]: 'IT', [E.IDSETUP]: 'ID Setup', [E.FLEET]: 'Fleet', [E.CC]: 'Finance (Credit Card)', [E.DAVE]: 'Dave Langohr (IT Confirmation / Business Cards)',
    [E.REVIEW]: '30/60/90 Review', [E.JR]: 'JR Title', [E.JONAS]: 'Purchasing / Jonas', [E.SAFETY]: 'Safety', [E.PAYROLL]: 'Payroll', [REQ]: 'Requester (dbinns)', [MGR]: 'Manager' };
  if (m[addr]) return m[addr];
  if (/mgr@|manager@|lead@/.test(addr)) return 'Manager (other)';
  if (/^other@|^third@|^fourth@/.test(addr)) return 'Requester (other)';
  return 'Other (' + addr + ')';
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown log + console summary
// ─────────────────────────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, '0'); }
function stamp(d) { return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()); }
function md(s) { return String(s === undefined || s === null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' '); }
const CTX_KEYS = ['workflowId', 'employeeName', 'hireDate', 'siteName', 'managerEmail', 'adpAssociateId', 'internalEmployeeId', 'assignedEmail', 'siteDocsUsername', 'hrDecision', 'workflowType'];

function writeLog() {
  const totals = LOG.scenarios.reduce((a, s) => ({ p: a.p + s.passed, f: a.f + s.failed, d: a.d + s.defects.length, e: a.e + s.emails.length }), { p: 0, f: 0, d: 0, e: 0 });
  const L = [];
  L.push('# EFX E2E test log — ' + LOG.runAt.toISOString());
  L.push('');
  L.push('Runtime: Node ' + process.version + ' · mock `__tests__/gas-runtime.js` (no Google calls; every email captured by the MailApp mock, none sent) · contracts `' + _ctx.FormContracts.VERSION + '` · api `' + _ctx.N8N_API_VERSION + '`');
  L.push('');
  var realFails = totals.f - totals.d;
  L.push('**Result: ' + (realFails ? 'FAIL' : (totals.d ? 'PASS (' + totals.d + ' recorded prod defects, see KNOWN_DEFECTS_PROD.md)' : 'PASS')) + '** — ' + totals.p + ' passed / ' + realFails + ' real failures / ' + totals.d + ' recorded defects · ' + totals.e + ' emails captured (0 sent)');
  L.push('');
  L.push('| # | Scenario | Passed | Failed | Defects | Emails | Result |');
  L.push('|---|---|---|---|---|---|---|');
  LOG.scenarios.forEach((s, i) => L.push('| ' + (i + 1) + ' | ' + md(s.name) + ' | ' + s.passed + ' | ' + s.failed + ' | ' + s.defects.length + ' | ' + s.emails.length + ' | ' + (s.failed ? '❌ FAIL' : '✅ PASS') + ' |'));
  L.push('');
  L.push('## Mock workarounds (stubbed on the context — not production code)');
  MOCK_WORKAROUNDS.forEach(w => L.push('- ' + w));
  L.push('');
  const defects = LOG.scenarios.flatMap(s => s.defects.map(d => Object.assign({ scenario: s.name }, d)));
  L.push('## Defects found (assertions that encode the intended behaviour and fail)');
  if (!defects.length) L.push('- none'); else defects.forEach(d => L.push('- **' + md(d.label) + '** — got `' + md(JSON.stringify(d.got)) + '`, expected `' + md(JSON.stringify(d.expected)) + '` — ' + md(d.ref) + ' _(' + md(d.scenario.split(' — ')[0]) + ')_'));
  L.push('');
  const otherFails = LOG.scenarios.flatMap(s => s.failures.filter(f => !f.defect).map(f => Object.assign({ scenario: s.name }, f)));
  L.push('## Other failures');
  if (!otherFails.length) L.push('- none'); else otherFails.forEach(f => L.push('- ' + md(f.scenario.split(' — ')[0]) + ': **' + md(f.label) + '** — got `' + md(JSON.stringify(f.got)) + '`, expected `' + md(JSON.stringify(f.expected)) + '`'));
  L.push('');
  L.push('## Notes / oddities observed');
  LOG.scenarios.forEach(s => s.notes.forEach(n => L.push('- ' + md(s.name.split(' — ')[0]) + ': ' + md(n))));
  L.push('');
  // email inventory
  const all = LOG.scenarios.flatMap(s => s.emails.map(e => Object.assign({ scenario: s.name.split('.')[0] }, e)));
  const bySubject = {};
  all.forEach(e => { const k = e.subject.replace(/\((NEW_EMP|TERM|CHANGE|EQUIP_REQ)_[^)]+\)/, '(<wf>)'); bySubject[k] = bySubject[k] || { n: 0, sc: new Set(), to: new Set() }; bySubject[k].n++; bySubject[k].sc.add(e.scenario); String(e.to).split(',').forEach(t => bySubject[k].to.add(roleOf(t.trim()))); });
  L.push('## Email inventory (all scenarios — captured, never sent)');
  L.push('');
  L.push('| Subject | Count | Scenarios | Recipient roles |');
  L.push('|---|---|---|---|');
  Object.keys(bySubject).sort().forEach(k => L.push('| ' + md(k) + ' | ' + bySubject[k].n + ' | ' + [...bySubject[k].sc].sort((x, y) => Number(x) - Number(y)).join(', ') + ' | ' + [...bySubject[k].to].sort().join('; ') + ' |'));
  L.push('');
  const perRole = {};
  all.forEach(e => String(e.to).split(',').forEach(t => { const r = roleOf(t.trim()); perRole[r] = (perRole[r] || 0) + 1; }));
  L.push('| Recipient role | Messages |'); L.push('|---|---|');
  Object.keys(perRole).sort().forEach(r => L.push('| ' + md(r) + ' | ' + perRole[r] + ' |'));
  L.push('');
  // per scenario
  LOG.scenarios.forEach((s, i) => {
    L.push('---'); L.push('## ' + (i + 1) + '. ' + md(s.name)); L.push('');
    L.push('**' + (s.failed ? 'FAIL' : 'PASS') + '** — ' + s.passed + ' passed / ' + s.failed + ' failed · ' + s.emails.length + ' emails · ' + s.steps.length + ' steps'); L.push('');
    L.push('### Steps'); L.push(''); L.push('| # | Step | Function | ok | Key ids | Emails | Actor leak |'); L.push('|---|---|---|---|---|---|---|');
    s.steps.forEach((t, j) => L.push('| ' + (j + 1) + ' | ' + md(t.step) + ' | `' + md(t.fn) + '` | ' + (t.ok ? '✅' : '❌') + ' | ' + md(JSON.stringify(t.ids)) + ' | ' + t.emails + ' | ' + t.actor + ' |'));
    L.push('');
    L.push('### Emails captured (' + s.emails.length + ')'); L.push('');
    if (s.emails.length) {
      L.push('| # | To | Subject | formUrl | contextData (key fields) |'); L.push('|---|---|---|---|---|');
      s.emails.forEach((e, j) => {
        const cd = e.contextData || {}; const kv = CTX_KEYS.filter(k => cd[k] !== undefined && cd[k] !== '').map(k => k + '=' + JSON.stringify(cd[k]).slice(0, 40)).join(', ');
        L.push('| ' + (j + 1) + ' | ' + md(e.to) + ' | ' + md(e.subject) + ' | ' + md(e.formUrl ? e.formUrl.replace('https://script.google.com/macros/s/TEST_DEV_DEPLOY/exec?', '?') : '') + ' | ' + md(kv) + ' |');
      });
    } else L.push('_none_');
    L.push('');
    L.push('### Sheet writes'); L.push(''); L.push('| Sheet | appendRow | setValue/setValues |'); L.push('|---|---|---|');
    Object.keys(s.sheets).sort().forEach(n => L.push('| ' + md(n) + ' | ' + s.sheets[n].appends + ' | ' + s.sheets[n].updates + ' |'));
    L.push('');
    if (s.failures.length) { L.push('### Failed assertions'); L.push(''); s.failures.forEach(f => L.push('- ' + (f.defect ? '**DEFECT** ' : '') + md(f.label) + ' — got `' + md(JSON.stringify(f.got)) + '`, expected `' + md(JSON.stringify(f.expected)) + '`' + (f.ref ? ' — ' + md(f.ref) : ''))); L.push(''); }
    if (s.notes.length) { L.push('### Notes'); L.push(''); s.notes.forEach(n => L.push('- ' + md(n))); L.push(''); }
  });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const file = path.join(LOG_DIR, 'efx-e2e-' + stamp(LOG.runAt) + '.md');
  fs.writeFileSync(file, L.join('\n'), 'utf8');
  return { file, totals };
}

const { file, totals } = writeLog();
console.log('\n' + '═'.repeat(78) + '\n  EFX E2E RESULTS\n' + '═'.repeat(78));
LOG.scenarios.forEach(s => console.log('  ' + (s.failed ? '❌' : '✅') + '  ' + s.name.split(' — ')[0].padEnd(34) + s.passed + ' passed / ' + s.failed + ' failed' + (s.defects.length ? ' (' + s.defects.length + ' defect' + (s.defects.length > 1 ? 's' : '') + ')' : '') + ' · ' + s.emails.length + ' emails'));
console.log('\n  TOTAL: ' + totals.p + ' passed, ' + totals.f + ' failed (' + totals.d + ' recorded defects), ' + totals.e + ' emails captured (0 sent)');
const defects = LOG.scenarios.flatMap(s => s.defects);
if (defects.length) { console.log('\n  DEFECTS:'); defects.forEach(d => console.log('   • ' + d.label + '  [' + d.ref + ']')); }
const other = LOG.scenarios.flatMap(s => s.failures.filter(f => !f.defect));
if (other.length) { console.log('\n  OTHER FAILURES:'); other.forEach(f => console.log('   • ' + f.label + '  got=' + JSON.stringify(f.got) + ' expected=' + JSON.stringify(f.expected))); }
console.log('\n  log: ' + file + '\n');
// Exit policy: recorded defects (pre-existing prod behaviour, tracked in docs/review/KNOWN_DEFECTS_PROD.md) are
// reported but do not fail the run, so the suite is a usable gate. Pass --strict to fail on defects too
// (use before promoting a defect fix, so the flipped assertion is noticed).
const strict = process.argv.includes('--strict');
const realFailures = totals.f - totals.d;
if (realFailures > 0) console.log('\n  ❌ ' + realFailures + ' real failure(s)');
else if (totals.d) console.log('\n  ✅ green apart from ' + totals.d + ' recorded defect(s)' + (strict ? ' — failing because --strict' : ''));
process.exit(realFailures > 0 || (strict && totals.f) ? 1 : 0);
