'use strict';
/**
 * efx-test.js — EFX (n8n integration) tests for employee_management_v2_efx, on the Node GAS mock runtime.
 * Covers: alias envelope, Internal Employee ID minted at submit, contract validation, ID Setup with the
 * pre-assigned id (+ admin override), human path unchanged (emails untouched), JR close via alias,
 * Safety alias, events feed, and the SAFETY_TRAINING_AT_SUBMIT flag.
 *
 *   node __tests__/efx-test.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { makeRuntime } = require('./gas-runtime');

const SRC = path.resolve(__dirname, '..');
const FX = require('./efx-fixtures');           // shared with efx-e2e-test.js: LOAD_ORDER, headers, seedBase
const LOAD_ORDER = FX.LOAD_ORDER;

let _ctx, _rt;
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
}

// ── assertions ──────────────────────────────────────────────────────────────
let P = 0, F = [];
const pass = l => { P++; console.log('    ✓  ' + l); };
const fail = (l, got, exp) => { F.push(l); console.log('    ✗  ' + l + '\n         got:      ' + JSON.stringify(got) + '\n         expected: ' + JSON.stringify(exp)); };
const eq = (l, got, exp) => (String(got ?? '') === String(exp ?? '') ? pass(l) : fail(l, got, exp));
const truthy = (l, got) => (got ? pass(l) : fail(l, got, 'truthy'));
const contains = (l, got, s) => (String(got || '').includes(s) ? pass(l) : fail(l, got, '(contains) ' + s));

// ── seeds ───────────────────────────────────────────────────────────────────
const seedBase = () => FX.seedBase(_rt);
const rows = name => (_rt.captures.getSheet(name) || { _rows: [] })._rows;
const ACTOR = { id: 'n8n:efx-test', email: 'efx-bot@team-group.com', display: 'EFX test (n8n)' };
const ADMIN = { id: 'n8n:admin-test', email: 'dbinns@team-group.com', display: 'admin' };
const newHire = (over) => Object.assign({
  requesterName: 'EFX Tester', requesterEmail: 'dbinns@team-group.com', dateRequested: '2026-09-16', hireDate: '2026-10-01',
  newHireOrRehire: 'New Hire', employeeType: 'Direct Hire', employmentType: 'Salary', firstName: 'Ada', lastName: 'Lovelace',
  positionTitle: 'Site Supervisor', siteName: 'Aurora', jobSiteNumber: 'INDIRECT - Aurora', reportingManagerName: 'Mgr One',
  reportingManagerEmail: 'mgr@team-group.com', systemAccess: 'Yes', systems: ['BOSS', 'SiteDocs'], equipment: [], plan306090: 'Yes',
  jrRequired: 'Yes', jrAssignment: 'Site Supervisor'
}, over || {});

function scenario(name, fn) {
  console.log('\n' + '─'.repeat(72) + '\n  ' + name + '\n' + '─'.repeat(72));
  _rt.captures.reset(); P = 0; F = [];
  try { fn(); } catch (e) { fail('Unhandled exception: ' + e.message, e.stack.split('\n').slice(0, 3).join(' | '), 'none'); }
  console.log('  ' + (F.length ? '❌' : '✅') + ' ' + P + '/' + (P + F.length));
  return { name, passed: P, failed: F.length, failures: [...F] };
}

buildContext();
const results = [];

results.push(scenario('ALIAS ENVELOPE — ping / info / contracts', () => {
  seedBase();
  const ping = _ctx.n8n_ping();
  truthy('ping ok', ping.ok); truthy('ping apiVersion', ping.result.apiVersion); truthy('ping spreadsheetId', ping.result.spreadsheetId);
  const info = _ctx.n8n_info();
  eq('info lists 27 aliases', info.result.aliases.length, 27);
  truthy('every alias is a defined function', info.result.aliases.every(a => typeof _ctx[a.name] === 'function'));
  const c = _ctx.n8n_contracts();
  truthy('contracts ok', c.ok);
  const forms = c.result.forms.map(f => f.form);
  truthy('contracts include new_hire + id_setup', forms.includes('new_hire') && forms.includes('id_setup'));
  truthy('new_hire contract verified', c.result.forms.find(f => f.form === 'new_hire').verified === true);
}));

results.push(scenario('HELPERS — n8nMapHandlerError_ message→code table (refactor R1)', () => {
  seedBase();
  const map = (msg, codes) => _ctx.n8nMapHandlerError_({ success: false, message: msg }, 'E_UPSTREAM', { codes }).error.code;
  eq('"Permission denied. …" → E_FORBIDDEN (cancel/bump/hireDate wording)', map('Permission denied. HR, IT, Admin, the requester, or the manager can cancel requests.'), 'E_FORBIDDEN');
  eq('"Access denied." → E_FORBIDDEN (submit handler wording)', map('Access denied.'), 'E_FORBIDDEN');
  eq('"not authorised" → E_FORBIDDEN', map('User not authorised'), 'E_FORBIDDEN');
  eq('"Forbidden" → E_FORBIDDEN', map('Forbidden'), 'E_FORBIDDEN');
  eq('"Workflow not found." with E_NOT_FOUND opted in (cancel) → E_NOT_FOUND', map('Workflow not found.', ['E_NOT_FOUND']), 'E_NOT_FOUND');
  eq('"Workflow not found." without opt-in (submits, bump, hireDate) → E_UPSTREAM (unchanged semantics)', map('Workflow not found.'), 'E_UPSTREAM');
  eq('"already sent" with E_RATE_LIMITED opted in (bump) → E_RATE_LIMITED', map('A reminder was already sent recently for this step.', ['E_RATE_LIMITED']), 'E_RATE_LIMITED');
  eq('"already sent" without opt-in → E_UPSTREAM', map('A reminder was already sent recently for this step.'), 'E_UPSTREAM');
  eq('anything else → fallback code', map('Internal Employee ID is pre-assigned (30412) and cannot be changed here.'), 'E_UPSTREAM');
  eq('forbidden wins over not-found when both match', map('Permission denied: workflow not found', ['E_NOT_FOUND']), 'E_FORBIDDEN');
  const nul = _ctx.n8nMapHandlerError_(null, 'E_UPSTREAM', { message: 'cancelRequest failed' });
  eq('null handler result → fallback message', nul.error.message, 'cancelRequest failed');
  eq('… upstream carried as null', nul.error.upstream, null);
  const forb = _ctx.n8nMapHandlerError_({ success: false, message: 'Access denied.' }, 'E_UPSTREAM');
  eq('E_FORBIDDEN carries the real session principal', forb.error.principal, _ctx.Session.getActiveUser().getEmail());
  truthy('non-forbidden errors carry no principal key', !('principal' in _ctx.n8nMapHandlerError_({ success: false, message: 'x' }, 'E_UPSTREAM').error));
  truthy('envelope shape ok:false + apiVersion + REQ- id', forb.ok === false && forb.apiVersion === _ctx.N8N_API_VERSION && /^REQ-/.test(forb.requestId));
  // R6: N8N_ERROR_CODES is the source of truth — every E_* literal the alias/primitive layer can return must be documented there
  const documented = new Set(_ctx.N8N_ERROR_CODES.map(e => e.code));
  const literals = new Set();
  for (const f of ['N8n.js', 'N8nEnvelope.js', 'EfxApi.js']) for (const m of fs.readFileSync(path.join(SRC, f), 'utf8').matchAll(/'(E_[A-Z_]+)'/g)) literals.add(m[1]);
  const undocumented = [...literals].filter(c => !documented.has(c));
  eq('every E_* literal in N8n.js / N8nEnvelope.js / EfxApi.js is in N8N_ERROR_CODES (' + literals.size + ' codes)', undocumented.join(','), '');
  truthy('N8N_ERROR_CODES rows have code/meaning/n8n and unique codes', _ctx.N8N_ERROR_CODES.every(e => e.code && e.meaning && e.n8n) && documented.size === _ctx.N8N_ERROR_CODES.length);
  truthy('N8N_ERROR_CODES covers the documented set', ['E_VALIDATION', 'E_UNKNOWN_FORM', 'E_UNVERIFIED_FORM', 'E_UPSTREAM', 'E_FORBIDDEN', 'E_NOT_FOUND', 'E_ALREADY_CLOSED', 'E_TASK_NOT_OPEN', 'E_RATE_LIMITED', 'E_INTERNAL'].every(c => documented.has(c)));
  // R7: shared fixtures must agree with SchemaConstants (would have caught a drifted header list — review F15)
  eq('fixtures: Initial Requests col 56 is Internal Employee ID at SCHEMA.INITIAL_REQUESTS.INTERNAL_EMP_ID', FX.IR_HEADERS[vm.runInContext('SCHEMA.INITIAL_REQUESTS.INTERNAL_EMP_ID', _ctx)], 'Internal Employee ID');
  eq('fixtures: Action Items has exactly the SCHEMA.ACTION_ITEMS columns', FX.AI_HEADERS.length, vm.runInContext('Object.keys(SCHEMA.ACTION_ITEMS).length', _ctx));
  eq('fixtures: Workflows has exactly the SCHEMA.WORKFLOWS columns', FX.WF_HEADERS.length, vm.runInContext('Object.keys(SCHEMA.WORKFLOWS).length', _ctx));
  eq('fixtures: LOAD_ORDER ends with EfxApi → N8nEnvelope → N8n', FX.LOAD_ORDER.slice(-3).join(','), 'EfxApi.js,N8nEnvelope.js,N8n.js');
  // R8: efxRowToRecord_ — the one header→value mapping behind efxReadRecord / efxListWorkflows
  const d0 = new Date('2026-09-16T12:00:00Z');
  const rec = _ctx.efxRowToRecord_(['Workflow ID', '', 'When', 'N'], ['NEW_EMP_1', 'skipped', d0, 3]);
  eq('efxRowToRecord_ keys by header, skips blank headers', Object.keys(rec).join(), 'Workflow ID,When,N');
  eq('efxRowToRecord_ Date → ISO string', rec.When, '2026-09-16T12:00:00.000Z');
  eq('efxRowToRecord_ primitives untouched', rec.N, 3);
  eq('efxRowToRecord_ does not redact (that is efxReadRecord\'s job)', _ctx.efxRowToRecord_(['DSS Password'], ['p'])['DSS Password'], 'p');
  eq('efxReadRecord redacts on top of the mapping', _ctx.efxReadRecord('ID Setup Results', 'NEW_EMP_OLD1')['DSS Password'], '[REDACTED]');
  eq('efxReadRecord ISO date via the shared mapping', typeof _ctx.efxReadRecord('ID Setup Results', 'NEW_EMP_OLD1')['Submission Timestamp'], 'string');
  // R2: n8nParse_ — string | object | nothing, identical to the eleven inline ternaries it replaced
  eq('n8nParse_ JSON string → object', JSON.stringify(_ctx.n8nParse_('{"a":1}', {})), '{"a":1}');
  eq('n8nParse_ object → same object', (() => { const o = { b: 2 }; return _ctx.n8nParse_(o, {}) === o; })(), true);
  eq('n8nParse_ undefined → fallback', JSON.stringify(_ctx.n8nParse_(undefined, {})), '{}');
  eq('n8nParse_ null → fallback', JSON.stringify(_ctx.n8nParse_(null, [])), '[]');
  eq('n8nParse_ "" → fallback', JSON.stringify(_ctx.n8nParse_('', {})), '{}');
  truthy('n8nParse_ malformed JSON still throws (→ E_INTERNAL under n8nGuard_)', (() => { try { _ctx.n8nParse_('{nope', {}); return false; } catch (e) { return /JSON/.test(e.message); } })());
  eq('alias accepts a JSON-string filter', _ctx.n8n_listTasks(ACTOR, '{"status":"Open"}').ok, true);
  eq('alias with malformed JSON filter → E_INTERNAL (unchanged)', _ctx.n8n_listTasks(ACTOR, '{nope').error.code, 'E_INTERNAL');
  eq('alias with "" data → E_VALIDATION (fallback {} fails the contract)', _ctx.n8n_createInitialRequest(ACTOR, '').error.code, 'E_VALIDATION');
  // R3: efxParseDraft_ — one parser for the {items} draft shape, shared by efxTaskClose and n8n_saveTaskDraft
  const pd = v => JSON.stringify(_ctx.efxParseDraft_(v));
  eq('efxParseDraft_ empty cell → {items:{}}', pd(''), '{"items":{}}');
  eq('efxParseDraft_ undefined → {items:{}}', pd(undefined), '{"items":{}}');
  eq('efxParseDraft_ {items} string kept', pd('{"items":{"A":{"status":"Complete"}}}'), '{"items":{"A":{"status":"Complete"}}}');
  eq('efxParseDraft_ {items} object deep-copied', (() => { const o = { items: { A: { status: 'Pending' } } }; const d = _ctx.efxParseDraft_(o); return d.items !== o.items && d.items.A.status; })(), 'Pending');
  eq('efxParseDraft_ legacy checkedItems → Collected', pd('{"checkedItems":["Laptop","Badge"]}'), '{"items":{"Laptop":{"status":"Collected"},"Badge":{"status":"Collected"}}}');
  eq('efxParseDraft_ legacy flat map lifted to items', pd('{"A":{"status":"Complete"}}'), '{"items":{"A":{"status":"Complete"}}}');
  eq('efxParseDraft_ garbage → {items:{}}', pd('{nope'), '{"items":{}}');
  eq('efxParseDraft_ non-object JSON → {items:{}}', pd('"x"'), '{"items":{}}');
}));

let createdWf = null;
results.push(scenario('CREATE — n8n_createInitialRequest mints the Internal Employee ID at submit', () => {
  seedBase();
  const r = _ctx.n8n_createInitialRequest(JSON.stringify(ACTOR), newHire(), ['record']);
  truthy('ok', r.ok); truthy('requestId', /^REQ-/.test(r.requestId));
  createdWf = r.result.workflowId;
  truthy('workflowId NEW_EMP_', /^NEW_EMP_/.test(createdWf));
  eq('internalEmployeeId continues from ID Setup Results max (30410 → 30411)', r.result.internalEmployeeId, '30411');
  const ir = rows('Initial Requests');
  eq('Initial Requests row has 56 columns', ir[1].length, 56);
  eq('col 56 = Internal Employee ID', ir[1][55], '30411');
  eq('record read-back carries Internal Employee ID', r.record && r.record['Internal Employee ID'], '30411');
  const reg = rows('Employee IDs');
  eq('Employee IDs registry row for workflow', reg[1] && reg[1][1], createdWf);
  eq('Allocated By = actor email', reg[1] && reg[1][4], ACTOR.email);
  const raw = rows('Raw Log');
  const kinds = raw.slice(1).map(x => x[6]);
  truthy('Raw Log has submit + result events', kinds.includes('submit') && kinds.includes('result'));
  const res = raw.slice(1).find(x => x[6] === 'result' && x[1] === 'submitInitialRequest');
  truthy('result event payload has internalEmployeeId', res && JSON.parse(res[4]).internalEmployeeId === '30411');
  truthy('event ids stamped', raw.slice(1).every(x => /^EVT-/.test(x[5])));
  eq('Raw Log User = actor email', raw[1][3], ACTOR.email);
  const subjects = _rt.captures.getEmailOptions().map(o => o.subject);
  truthy('same emails as before: Request Submitted + ID Setup Required', subjects.includes('Request Submitted') && subjects.includes('ID Setup Required'));
  const idSetupMail = _rt.captures.getEmailOptions().find(o => o.subject === 'ID Setup Required');
  eq('emails unchanged: internalEmployeeId NOT in context (hasId stays false until ID Setup)', idSetupMail.contextData.internalEmployeeId === undefined, true);
  eq('idempotent: second allocate for same workflow returns same id', _ctx.EmployeeIdRegistry.allocate(createdWf, {}), '30411');
}));

results.push(scenario('VALIDATION — contract errors before any write', () => {
  seedBase();
  const r1 = _ctx.n8n_createInitialRequest(ACTOR, newHire({ lastName: '' }));
  eq('missing required → E_VALIDATION', r1.error && r1.error.code, 'E_VALIDATION');
  truthy('fields[] names lastName', r1.error.fields.some(f => f.field === 'lastName'));
  const r2 = _ctx.n8n_createInitialRequest(ACTOR, newHire({ bogus: 1 }));
  truthy('unknown field rejected', r2.error && r2.error.fields.some(f => f.field === 'bogus'));
  eq('no Initial Requests row written', rows('Initial Requests').length, 1);
  eq('no Employee IDs row written', rows('Employee IDs').length, 0);
  const r3 = _ctx.n8n_submitIdSetup(ACTOR, { workflowId: 'X' });
  eq('id_setup missing required → E_VALIDATION', r3.error && r3.error.code, 'E_VALIDATION');
}));

results.push(scenario('ID SETUP — uses the pre-assigned id; non-admin cannot change it; admin can', () => {
  seedBase();
  const c = _ctx.n8n_createInitialRequest(ACTOR, newHire());
  const wf = c.result.workflowId;
  const r = _ctx.n8n_submitIdSetup(ACTOR, { workflowId: wf, siteDocsWorkerId: 'W-1', siteDocsJobCode: 'Hourly 1', dssUsername: 'ada.lovelace', dssPassword: 'x' }, ['record']);
  truthy('include record → row read back', r.record && r.record['Workflow ID'] === wf);
  // requestId audit (pass-3 skill eval gap): mutating call → Raw Log kind 'alias' row carrying the same REQ id
  const audit = rows('Raw Log').slice(1).filter(x => x[6] === 'alias');
  truthy('mutating alias call wrote an alias audit row with its requestId', audit.some(x => x[1] === 'n8n_submitIdSetup' && JSON.parse(x[4]).requestId === r.requestId && JSON.parse(x[4]).ok === true));
  const pingBefore = audit.length; _ctx.n8n_ping();
  eq('successful read alias (ping) writes no audit row', rows('Raw Log').slice(1).filter(x => x[6] === 'alias').length, pingBefore);
  const badRead = _ctx.n8n_getWorkflow(ACTOR, 'NEW_EMP_NOPE');
  truthy('failed read alias writes an audit row with code + requestId', rows('Raw Log').slice(1).some(x => x[6] === 'alias' && x[1] === 'n8n_getWorkflow' && JSON.parse(x[4]).requestId === badRead.requestId && JSON.parse(x[4]).code === badRead.error.code));
  eq('alias audit rows are hidden from n8n_events by default', _ctx.n8n_events(ACTOR, { kinds: [] }).result.events.filter(e => e.kind === 'alias').length, 0);
  truthy('… but visible when asked for', _ctx.n8n_events(ACTOR, { kinds: ['alias'] }).result.events.length > 0);
  eq('record: DSS Password is redacted (review pass 2 H1)', r.record && r.record['DSS Password'], '[REDACTED]');
  eq('record: DSS Username is visible', r.record && r.record['DSS Username'], 'ada.lovelace');
  truthy('record: no raw password anywhere in the envelope', !/"x"/.test(JSON.stringify(r.record)));
  truthy('submitIdSetup ok', r.ok);
  const id = rows('ID Setup Results');
  const row = id.find(x => x[0] === wf);
  eq('ID Setup Results uses pre-assigned 30411', row && row[3], '30411');
  eq('Submitted By = actor email', row && row[11], ACTOR.email);
  const wfRow = rows('Workflows').find(x => x[0] === wf);
  eq('workflow advanced to HR Verification Needed', wfRow && wfRow[7], 'HR Verification Needed');
  truthy('HR Verification Required email sent', _rt.captures.getEmailOptions().some(o => o.subject === 'HR Verification Required'));
  const res = rows('Raw Log').slice(1).find(x => x[6] === 'result' && x[1] === 'submitEmployeeIDSetup');
  truthy('result event for ID Setup (no passwords)', res && JSON.parse(res[4]).internalEmployeeId === '30411' && !/dssPassword/.test(res[4]));

  // createWorkflow() 30-second idempotency guard: for Initial Requests it keys on (type, requester, employee+hireDate)
  // (review pass 2 H2) — a double-submit of the SAME hire dedupes, a DIFFERENT hire from the same automation requester does not.
  const same = _ctx.n8n_createInitialRequest(ACTOR, newHire());
  eq('same requester + same employee within 30 s → same workflowId (double-submit guard)', same.result.workflowId, wf);
  eq('… and the same internalEmployeeId', same.result.internalEmployeeId, '30411');
  const other = _ctx.n8n_createInitialRequest(ACTOR, newHire({ firstName: 'Dup', lastName: 'Licate' }));
  truthy('same requester, DIFFERENT employee → new workflow (no merge under a constant n8n requester)', other.result.workflowId && other.result.workflowId !== wf);
  eq('… with its own Internal Employee ID', other.result.internalEmployeeId, '30412');
  const c2 = _ctx.n8n_createInitialRequest(ACTOR, newHire({ firstName: 'Bob', lastName: 'Builder', requesterEmail: 'other@team-group.com' }));
  const wf2 = c2.result.workflowId;
  truthy('different requester → new workflow', wf2 && wf2 !== wf);
  eq('third workflow gets 30413', c2.result.internalEmployeeId, '30413');
  const badCarry = _ctx.n8n_createInitialRequest(ACTOR, newHire({ firstName: 'Ty', lastName: 'Po', newHireOrRehire: 'Rehire', existingInternalEmployeeId: 'EMP-1234567890', requesterEmail: 'typo@team-group.com' }));
  eq('carried id that is not 4-6 digits is rejected before anything is written (M4)', badCarry.error && badCarry.error.code, 'E_UPSTREAM');
  contains('… with a clear message', badCarry.error && badCarry.error.message, 'must be a 4-6 digit number');
  eq('… no Workflows row for the typo requester', rows('Workflows').filter(r => r[3] === 'typo@team-group.com').length, 0);
  // Authorization uses the REAL session (Actor.principal), not the caller-asserted actor (review F3).
  const realSession = _ctx.Session;
  const asSession = email => { _ctx.Session = { getActiveUser: () => ({ getEmail: () => email }), getScriptTimeZone: () => 'America/New_York' }; };
  asSession('hr.person@team-group.com');                      // non-admin principal
  const bad = _ctx.n8n_submitIdSetup(ACTOR, { workflowId: wf2, internalEmployeeId: '99999', siteDocsWorkerId: 'W', siteDocsJobCode: 'Hourly 1', dssUsername: 'b', dssPassword: 'x' });
  eq('non-admin session mismatch → E_UPSTREAM', bad.error && bad.error.code, 'E_UPSTREAM');
  contains('message explains pre-assigned', bad.error && bad.error.message, 'pre-assigned');
  const spoof = _ctx.n8n_submitIdSetup(ADMIN, { workflowId: wf2, internalEmployeeId: '99999', siteDocsWorkerId: 'W', siteDocsJobCode: 'Hourly 1', dssUsername: 'b', dssPassword: 'x' });
  eq('SECURITY: admin actor.email with non-admin session does NOT grant override', spoof.error && spoof.error.code, 'E_UPSTREAM');
  asSession('dbinns@team-group.com');                          // admin principal
  const ok = _ctx.n8n_submitIdSetup(ACTOR, { workflowId: wf2, internalEmployeeId: '99999', siteDocsWorkerId: 'W', siteDocsJobCode: 'Hourly 1', dssUsername: 'b', dssPassword: 'x' });
  truthy('admin session override accepted (actor irrelevant)', ok.ok);
  eq('override value stored', rows('ID Setup Results').filter(x => x[0] === wf2).pop()[3], '99999');
  eq('registry synced to override (review F6)', _ctx.EmployeeIdRegistry.get(wf2), '99999');
  _ctx.Session = realSession;
}));

results.push(scenario('HUMAN PATH — direct submitInitialRequest unchanged except the id exists', () => {
  seedBase();
  const r = _ctx.submitInitialRequest(newHire());
  truthy('success', r.success);
  eq('response carries internalEmployeeId', r.internalEmployeeId, '30411');
  eq('registry get()', _ctx.EmployeeIdRegistry.get(r.workflowId), '30411');
  const ctx = _ctx.getWorkflowContext(r.workflowId);
  eq('context.preassignedEmployeeId exposed for automation', ctx.preassignedEmployeeId, '30411');
  eq('context.internalEmployeeId still undefined (templates unchanged)', ctx.internalEmployeeId === undefined || ctx.internalEmployeeId === '', true);
  eq('Raw Log User falls back to Session for humans', rows('Raw Log')[1][3], _ctx.Session.getActiveUser().getEmail());
  truthy('IDSetup page value = pre-assigned id', _ctx.EmployeeIdRegistry.get(r.workflowId) === '30411');
}));

results.push(scenario('JR — n8n_closeJrTask by TK- id and by workflowId; already-closed is explicit', () => {
  seedBase();
  const c = _ctx.n8n_createInitialRequest(ACTOR, newHire());
  const wf = c.result.workflowId;
  _rt.captures.seedSheet('Action Items', [
    [wf, 'TK-EFX00001', 'JR Title', 'JR Assignment — Ada Lovelace', JSON.stringify(['Verify and assign JR title']), 'grp.forms.jrtitle@team-group.com', 'Open', new Date(), '', '', '', '', 'jr_title', ''],
    [wf, 'TK-EFX00002', 'WIS', 'WIS Assignment — Ada Lovelace', JSON.stringify(['Assign WIS']), 'mgr@team-group.com', 'Open', new Date(), '', '', '', '', 'wis', '']
  ]);
  const dry = _ctx.n8n_closeTask(ACTOR, { taskId: 'TK-EFX00001', dryRun: true });
  truthy('dryRun ok and does not close', dry.ok && dry.result.dryRun && rows('Action Items').find(x => x[1] === 'TK-EFX00001')[6] === 'Open');
  const r = _ctx.n8n_closeJrTask(ACTOR, 'TK-EFX00001', 'assigned in BOSS');
  truthy('close by TK- ok', r.ok);
  const row = rows('Action Items').find(x => x[1] === 'TK-EFX00001');
  eq('status Closed', row[6], 'Closed');
  eq('closedBy = actor email', row[10], ACTOR.email);
  truthy('draft marks item Complete', /Complete/.test(String(row[11])));
  const again = _ctx.n8n_closeJrTask(ACTOR, 'TK-EFX00001');
  eq('second close → E_ALREADY_CLOSED', again.error && again.error.code, 'E_ALREADY_CLOSED');
  const byWf = _ctx.n8n_closeJrTask(ACTOR, wf);
  eq('by workflowId after closed → E_ALREADY_CLOSED (no other open jr_title)', byWf.error && byWf.error.code, 'E_ALREADY_CLOSED');
  const nf = _ctx.n8n_closeJrTask(ACTOR, 'TK-NOPE');
  eq('unknown → E_NOT_FOUND', nf.error && nf.error.code, 'E_NOT_FOUND');
  const wrongType = _ctx.n8n_closeJrTask(ACTOR, 'TK-EFX00002');
  eq('JR closer refuses a non-jr_title task by TK- id (review F7)', wrongType.error && wrongType.error.code, 'E_VALIDATION');
  truthy('other task untouched', rows('Action Items').find(x => x[1] === 'TK-EFX00002')[6] === 'Open');
  // Review pass 2 L4: n8n often sends booleans as strings — "true" must dry-run, "false" must really close
  const dryStr = _ctx.n8n_closeTask(ACTOR, { taskId: 'TK-EFX00002', dryRun: 'true' });
  truthy('dryRun:"true" (string) is a dry run — task stays Open', dryStr.ok && dryStr.result.dryRun === true && rows('Action Items').find(x => x[1] === 'TK-EFX00002')[6] === 'Open');
  const realStr = _ctx.n8n_closeTask(ACTOR, { taskId: 'TK-EFX00002', dryRun: 'false', notes: 'wis done' });
  truthy('dryRun:"false" (string) really closes', realStr.ok && !realStr.result.dryRun && rows('Action Items').find(x => x[1] === 'TK-EFX00002')[6] === 'Closed');
  truthy('n8nBool_ truth table (true/"true"/"yes"/"1" only)', ['true', 'TRUE', ' yes ', '1', true].every(v => _ctx.n8nBool_(v) === true) && [false, 'false', '0', '', 'no', null, undefined, 0, 1, {}].every(v => _ctx.n8nBool_(v) === false));
  _rt.captures.seedSheet('Action Items', [[wf, 'TK-EFX00003', 'Fleet', 'Fleetio Access — Ada', JSON.stringify(['x']), 'grp.forms.fleetio@team-group.com', 'Cancelled', new Date(), '', '', '', '', 'fleetio', '']]);
  eq('Cancelled task cannot be closed → E_TASK_NOT_OPEN', _ctx.n8n_closeTask(ACTOR, { taskId: 'TK-EFX00003' }).error.code, 'E_TASK_NOT_OPEN');
  // Review pass 2 L3: by workflowId+formType a Cancelled task is E_TASK_NOT_OPEN (was E_ALREADY_CLOSED, which George treats as success)
  eq('by workflowId+formType when the only task is Cancelled → E_TASK_NOT_OPEN, not E_ALREADY_CLOSED', _ctx.n8n_closeTask(ACTOR, { workflowId: wf, formType: 'fleetio' }).error.code, 'E_TASK_NOT_OPEN');
  // … and an Open task on a CANCELLED workflow is not closable either — by workflowId, by TK- id, nor as a dry run
  _rt.captures.seedSheet('Workflows', [['NEW_EMP_CANC1', 'Onboarding', 'New Hire: Can Celled', 'req@team-group.com', 'Cancelled', new Date(), new Date(), 'Request Cancelled', 'Can Celled']]);
  _rt.captures.seedSheet('Action Items', [['NEW_EMP_CANC1', 'TK-EFX00004', 'JR Title', 'JR Assignment — Can Celled', JSON.stringify(['Verify and assign JR title']), 'grp.forms.jrtitle@team-group.com', 'Open', new Date(), '', '', '', '', 'jr_title', '']]);
  const cw = _ctx.n8n_closeJrTask(ACTOR, 'NEW_EMP_CANC1');
  eq('Open jr_title on a Cancelled workflow, by workflowId → E_TASK_NOT_OPEN', cw.error && cw.error.code, 'E_TASK_NOT_OPEN');
  contains('… message names the cancelled workflow', cw.error && cw.error.message, 'NEW_EMP_CANC1 is Cancelled');
  eq('… by TK- id → E_TASK_NOT_OPEN', _ctx.n8n_closeTask(ACTOR, { taskId: 'TK-EFX00004' }).error.code, 'E_TASK_NOT_OPEN');
  eq('… even as a dry run', _ctx.n8n_closeTask(ACTOR, { taskId: 'TK-EFX00004', dryRun: true }).error.code, 'E_TASK_NOT_OPEN');
  eq('… task left Open', rows('Action Items').find(x => x[1] === 'TK-EFX00004')[6], 'Open');
  // Draft shape is what the UI reads (review / mapping defect #11)
  const draftObj = JSON.parse(String(row[11]));
  truthy('draft saved as {items:{…}}', draftObj.items && draftObj.items['Verify and assign JR title'] && draftObj.items['Verify and assign JR title'].status === 'Complete');
  const ev = _ctx.n8n_events(ACTOR, { kinds: ['task.closed'] });
  truthy('task.closed event emitted with taskId', ev.result.events.some(e => e.payload && e.payload.taskId === 'TK-EFX00001'));
}));

results.push(scenario('SAFETY — n8n_assignSafetyTraining closes safety_onboarding with confirmations', () => {
  seedBase();
  const c = _ctx.n8n_createInitialRequest(ACTOR, newHire({ employmentType: 'Hourly', employeeType: 'Direct Hire', systemAccess: 'No' }));
  const wf = c.result.workflowId;
  const nf = _ctx.n8n_assignSafetyTraining(ACTOR, wf, { siteDocsConfirmed: 'Yes', dssConfirmed: 'Yes' });
  eq('no safety task yet (flag off) → E_NOT_FOUND', nf.error && nf.error.code, 'E_NOT_FOUND');
  _rt.captures.seedSheet('Action Items', [[wf, 'TK-SAFE0001', 'Safety', 'Safety Onboarding — Ada Lovelace', JSON.stringify(['Assign SiteDocs locations for employee', 'Assign DSS learning paths']), 'grp.forms.safety@team-group.com', 'Open', new Date(), '', '', '', '', 'safety_onboarding', '']]);
  const no = _ctx.n8n_assignSafetyTraining(ACTOR, wf, { siteDocsConfirmed: 'Yes', dssConfirmed: 'No' });
  eq('a "No" confirmation refuses to close → E_VALIDATION', no.error && no.error.code, 'E_VALIDATION');
  eq('task still Open after refused close', rows('Action Items').find(x => x[1] === 'TK-SAFE0001')[6], 'Open');
  const noStr = _ctx.n8n_assignSafetyTraining(ACTOR, wf, { siteDocsConfirmed: 'Yes', dssConfirmed: 'No', force: 'false' });
  eq('force:"false" (string) does not force → E_VALIDATION (pass 2 L4)', noStr.error && noStr.error.code, 'E_VALIDATION');
  const dryStr = _ctx.n8n_assignSafetyTraining(ACTOR, wf, { siteDocsConfirmed: 'Yes', dssConfirmed: 'Yes', dryRun: 'true' });
  truthy('dryRun:"true" (string) leaves the Safety task Open', dryStr.ok && dryStr.result.dryRun === true && rows('Action Items').find(x => x[1] === 'TK-SAFE0001')[6] === 'Open');
  const r = _ctx.n8n_assignSafetyTraining(ACTOR, wf, { siteDocsConfirmed: 'Yes', dssConfirmed: 'Yes', notes: 'via n8n' });
  truthy('closes ok', r.ok);
  const row = rows('Action Items').find(x => x[1] === 'TK-SAFE0001');
  eq('Closed', row[6], 'Closed');
  truthy('formData saved with confirmations', /siteDocsConfirmed/.test(String(row[13])));
}));

results.push(scenario('EVENTS — n8n_events feed and cursor', () => {
  seedBase();
  _ctx.n8n_createInitialRequest(ACTOR, newHire());
  const ev = _ctx.n8n_events(ACTOR, {});
  truthy('ok', ev.ok);
  truthy('>= 2 events', ev.result.events.length >= 2);
  truthy('has result event with internalEmployeeId', ev.result.events.some(e => e.kind === 'result' && e.payload && e.payload.internalEmployeeId));
  const ev2 = _ctx.n8n_events(ACTOR, { afterEventId: ev.result.events[0].eventId });
  eq('cursor excludes earlier events', ev2.result.events.length, ev.result.events.length - 1);
  const ev3 = _ctx.n8n_events(ACTOR, { kinds: ['result'] });
  truthy('kind filter', ev3.result.events.every(e => e.kind === 'result'));
  truthy('nextAfterTs provided', !!ev.result.nextAfterTs);
  // Password redaction on the API surface (review F2): submit event of an ID Setup carries dssPassword in the sheet, never via the API
  _ctx.n8n_submitIdSetup(ACTOR, { workflowId: rows('Workflows')[1][0], siteDocsWorkerId: 'W', siteDocsJobCode: 'Hourly 1', dssUsername: 'u', dssPassword: 'SuperSecret!' });
  const all = _ctx.n8n_events(ACTOR, { sources: ['submitEmployeeIDSetup'] }).result.events;
  const sub = all.find(e => e.kind === 'submit');
  eq('dssPassword redacted in events API', sub && sub.payload.dssPassword, '[REDACTED]');
  truthy('sheet still holds the raw payload (recovery net unchanged)', rows('Raw Log').some(r => String(r[4]).includes('SuperSecret!')));
}));

results.push(scenario('FLAG — SAFETY_TRAINING_AT_SUBMIT creates the Safety task at submit', () => {
  seedBase();
  let supported = true;
  try { _ctx.PropertiesService.getScriptProperties().setProperty('SAFETY_TRAINING_AT_SUBMIT', 'true'); } catch (e) { supported = false; }
  const flagOn = supported && vm.runInContext('CONFIG.SAFETY_TRAINING_AT_SUBMIT', _ctx);
  if (!flagOn) {
    console.log('    (skipped — mock ConfigurationService does not read PropertiesService; verify in the TEST deployment: setSafetyTrainingAtSubmit(true))');
    pass('flag test skipped on mock (documented)');
    return;
  }
  const c = _ctx.n8n_createInitialRequest(ACTOR, newHire());
  const task = rows('Action Items').find(x => x[0] === c.result.workflowId && x[12] === 'safety_onboarding');
  truthy('safety_onboarding task created at submit', !!task);
  const r = _ctx.n8n_assignSafetyTraining(ACTOR, c.result.workflowId, { siteDocsConfirmed: 'Yes', dssConfirmed: 'Yes' });
  truthy('closable via alias', r.ok);
  _ctx.PropertiesService.getScriptProperties().setProperty('SAFETY_TRAINING_AT_SUBMIT', 'false');
}));

results.push(scenario('OTHER FORMS — equipment, termination(+approval), status change(+approval), IT setup, actions, list, context', () => {
  seedBase();
  // Equipment
  const eq1 = _ctx.n8n_createEquipmentRequest(ACTOR, { reqName: 'Req', reqEmail: 'req1@team-group.com', firstName: 'Eve', lastName: 'Quip', siteName: 'Aurora', managerEmail: 'mgr@team-group.com', managerName: 'Mgr', position: 'Technician', systems: ['BOSS'], equipment: ['Laptop'] });
  truthy('equipment create ok', eq1.ok); truthy('EQUIP_REQ_ id', /^EQUIP_REQ_/.test(eq1.result.workflowId));
  eq('equipment step', rows('Workflows').find(x => x[0] === eq1.result.workflowId)[7], 'IT Confirmation Needed');
  // Termination + approval
  const term = _ctx.n8n_createTerminationRequest(ACTOR, { reqName: 'David Binns', reqEmail: 'req2@team-group.com', empName: 'Sam Leaving', empWorkEmail: 'sleaving@team-group.com', empPhone: '', managerName: 'Bob Manager', managerEmail: 'mgr@team-group.com', siteName: 'Ottawa Main', empType: 'Salary', termDate: '2026-07-31', lastDayWorked: '2026-07-31', reason: 'Resigned', hr_approved: 'No', has_reports: 'No', reports_to_new: '', systems: ['Google Account', 'BOSS'], equip: ['Computer/Laptop'], google_forward: 'mgr@team-group.com', google_files: 'mgr@team-group.com', google_delegate: '', google_duration: 'Default 1 Month then delete', google_vacation: 'Gone.', comments: 'ok' });
  eq('termination create ok', term.ok ? 'ok' : JSON.stringify(term.error).slice(0, 400), 'ok'); const termWf = term.result.workflowId; truthy('TERM_ id', /^TERM_/.test(termWf));
  eq('termination step', rows('Workflows').find(x => x[0] === termWf)[7], 'HR Approval Needed');
  const tApprove = _ctx.n8n_submitTerminationApproval(ACTOR, { workflowId: termWf, decision: 'Approved', notes: 'approved via n8n' });
  truthy('termination approval ok (admin session)', tApprove.ok);
  const termTasks = _ctx.n8n_listTasks(ACTOR, { workflowId: termWf, status: 'Open' }).result;
  truthy('offboarding action items created', termTasks.count >= 3);
  const closeOne = _ctx.n8n_closeTask(ACTOR, { taskId: termTasks.tasks[0].taskId, notes: 'done via n8n' });
  truthy('generic closeTask on an offboarding item ok', closeOne.ok);
  const tAgain = _ctx.n8n_submitTerminationApproval(ACTOR, { workflowId: termWf, decision: 'Approved' });
  truthy('duplicate approval is a safe no-op (success)', tAgain.ok);
  // Position change + approval
  const pc = _ctx.n8n_createPositionChangeRequest(ACTOR, { reqName: 'Req', reqEmail: 'req3@team-group.com', firstName: 'Pat', lastName: 'Move', currentClass: 'Salary', effDate: '2026-10-15', siteName: 'Aurora', changeType: ['Site Transfer'], siteOld: 'Aurora', siteNew: 'Ottawa Main', currentTitle: 'Analyst', currentManagerEmail: 'mgr@team-group.com', currentManagerName: 'Mgr' });
  truthy('position change create ok', pc.ok); const pcWf = pc.result.workflowId; truthy('CHANGE_ id', /^CHANGE_/.test(pcWf));
  const pcApprove = _ctx.n8n_submitPositionChangeApproval(ACTOR, { workflowId: pcWf, decision: 'Approved', notes: 'ok', confirmedTitle: 'Analyst' });
  truthy('position change approval ok', pcApprove.ok);
  // IT setup via alias on a new hire that went through ID Setup + HR Verification
  const nh = _ctx.n8n_createInitialRequest(ACTOR, newHire({ requesterEmail: 'req4@team-group.com' }));
  const nhWf = nh.result.workflowId;
  truthy('id setup', _ctx.n8n_submitIdSetup(ACTOR, { workflowId: nhWf, siteDocsWorkerId: 'W', siteDocsJobCode: 'Salary 1', dssUsername: 'a.l', dssPassword: 'x' }).ok);
  const hr = _ctx.n8n_submitHrVerification(ACTOR, { workflowId: nhWf, firstName: 'Ada', lastName: 'Lovelace', managerName: 'Mgr One', managerEmail: 'mgr@team-group.com', jobTitle: 'Site Supervisor', adpAssociateId: 'ADP-1', hireDate: '2026-10-01', siteName: 'Aurora' });
  truthy('hr verification via alias ok (admin session)', hr.ok);
  const it = _ctx.n8n_submitItSetup(ACTOR, { workflowId: nhWf, Email_Created: 'Yes', Email_Username: 'ada.lovelace', Email_Domain: '@team-group.com', Email_Temp_Password: 'Tmp!Pass1', Computer_Assigned: 'No', Phone_Assigned: 'No', BOSS_Access: 'Yes' });
  truthy('IT setup via alias ok', it.ok);
  const jr = _ctx.n8n_listTasks(ACTOR, { workflowId: nhWf, formType: 'jr_title' }).result;
  eq('JR task created by IT setup', jr.count, 1);
  const draft = _ctx.n8n_saveTaskDraft(ACTOR, jr.tasks[0].taskId, 'in progress', { 'Verify and assign JR title': { status: 'Pending', comments: 'waiting on BOSS' } });
  truthy('saveTaskDraft ok', draft.ok);
  truthy('draft stored in UI shape', /"items"/.test(String(rows('Action Items').find(x => x[1] === jr.tasks[0].taskId)[11])));
  // R3: a legacy-shaped draft (checkedItems) is lifted, not dropped, when n8n merges into it — same lift efxTaskClose applies
  _rt.captures.seedSheet('Action Items', [[nhWf, 'TK-LEGACY01', 'Assets', 'Equipment Return — Ada', JSON.stringify(['Laptop', 'Badge']), 'grp.forms.it@team-group.com', 'Open', new Date(), '', '', '', JSON.stringify({ checkedItems: ['Laptop'] }), 'equipment_return', '']]);
  truthy('saveTaskDraft onto a legacy checkedItems draft ok', _ctx.n8n_saveTaskDraft(ACTOR, 'TK-LEGACY01', 'badge pending', { Badge: { status: 'Pending' } }).ok);
  const legacyDraft = JSON.parse(String(rows('Action Items').find(x => x[1] === 'TK-LEGACY01')[11]));
  eq('legacy Collected item survives the merge', legacyDraft.items.Laptop && legacyDraft.items.Laptop.status, 'Collected');
  eq('new item merged in', legacyDraft.items.Badge && legacyDraft.items.Badge.status, 'Pending');
  truthy('closeJrTask by workflowId after IT setup', _ctx.n8n_closeJrTask(ACTOR, nhWf, 'BOSS done').ok);
  const ctx = _ctx.n8n_getContext(ACTOR, nhWf);
  truthy('getContext ok', ctx.ok);
  truthy('context redacted (no password values)', JSON.stringify(ctx.result).indexOf('Tmp!Pass1') === -1 && JSON.stringify(ctx.result).indexOf('"x"') === -1);
  truthy('context JSON-safe (no Date objects)', JSON.stringify(ctx.result).indexOf('[object') === -1);
  // Actions
  const toCancel = _ctx.n8n_createInitialRequest(ACTOR, newHire({ requesterEmail: 'req5@team-group.com', firstName: 'Can', lastName: 'Cel' }));
  const cancel = _ctx.n8n_cancelWorkflow(ACTOR, toCancel.result.workflowId);
  truthy('cancelWorkflow ok (admin session)', cancel.ok);
  eq('status Cancelled', rows('Workflows').find(x => x[0] === toCancel.result.workflowId)[4], 'Cancelled');
  const hd = _ctx.n8n_updateHireDate(ACTOR, nhWf, '2026-10-15');
  truthy('updateHireDate ok', hd.ok);
  const bump = _ctx.n8n_bumpWorkflow(ACTOR, eq1.result.workflowId);
  truthy('bumpWorkflow ok or rate-limited', bump.ok || (bump.error && ['E_RATE_LIMITED', 'E_UPSTREAM'].includes(bump.error.code)));
  eq('cancel forbidden for non-privileged session → E_FORBIDDEN', (() => { const s = _ctx.Session; _ctx.Session = { getActiveUser: () => ({ getEmail: () => 'random@team-group.com' }), getScriptTimeZone: () => 'America/New_York' }; const r = _ctx.n8n_cancelWorkflow(ACTOR, termWf); _ctx.Session = s; return r.error && r.error.code; })(), 'E_FORBIDDEN');
  // List — Dashboard_View is a materialised view written by StateSync.syncWorkflowState; the mock's TextFinder/lookup
  // sheets do not exercise that writer (verified live in the TEST deployment), so seed the view rows here and test the reader.
  _rt.captures.seedSheet('Dashboard_View', [
    [nhWf, 'Ada Lovelace', 'In Progress', 'Specialist Forms Needed', 'EFX Tester', 'req4@team-group.com', 'req4@team-group.com', '2026-09-16', new Date(), 'mgr@team-group.com', '{}', '2026-10-01', 'Aurora', 'Salary'],
    [termWf, 'Sam Leaving', 'In Progress', 'Action Items Pending', 'David Binns', 'req2@team-group.com', 'req2@team-group.com', '2026-09-16', new Date(), 'mgr@team-group.com', '{}', '2026-07-31', 'Ottawa Main', 'Salary'],
    [pcWf, 'Pat Move', 'In Progress', 'Action Items Pending', 'Req', 'req3@team-group.com', 'req3@team-group.com', '2026-09-16', new Date(), 'mgr@team-group.com', '{}', '2026-10-15', 'Aurora', 'Salary'],
    [toCancel.result.workflowId, 'Can Cel', 'Cancelled', 'Request Cancelled', 'EFX Tester', 'req5@team-group.com', 'req5@team-group.com', '2026-09-16', new Date(), 'mgr@team-group.com', '{}', '2026-10-01', 'Aurora', 'Salary']
  ]);
  const list = _ctx.n8n_listWorkflows(ACTOR, {});
  truthy('listWorkflows ok', list.ok); truthy('lists ≥ 4 workflows', list.result.count >= 4);
  truthy('rows are header-keyed + typed', list.result.workflows[0]['Employee Name'] && list.result.workflows[0].type);
  eq('limit/offset paging', _ctx.n8n_listWorkflows(ACTOR, { limit: 2, offset: 1 }).result.count, 2);
  truthy('Last Updated serialised as ISO string (JSON-safe)', typeof list.result.workflows[0]['Last Updated'] === 'string');
  truthy('type filter End of Employment', _ctx.n8n_listWorkflows(ACTOR, { type: 'End of Employment' }).result.workflows.every(w => /^TERM_/.test(w.workflowId)));
  truthy('status filter Cancelled', _ctx.n8n_listWorkflows(ACTOR, { status: 'Cancelled' }).result.count >= 1);
  // Unverified forms
  eq('unverified form refused → E_UNVERIFIED_FORM', _ctx.n8n_submitForm(ACTOR, 'it_confirmation', { workflowId: nhWf }).error.code, 'E_UNVERIFIED_FORM');
  truthy('allowUnverified passes the gate', _ctx.n8n_submitForm(ACTOR, 'it_confirmation', { workflowId: nhWf }, { allowUnverified: true }).error?.code !== 'E_UNVERIFIED_FORM');
  truthy('allowUnverified:"true" (string) passes the gate too (pass 2 L4)', _ctx.n8n_submitForm(ACTOR, 'it_confirmation', { workflowId: nhWf }, { allowUnverified: 'true' }).error?.code !== 'E_UNVERIFIED_FORM');
  eq('generic createWorkflow on a step form → E_VALIDATION', _ctx.n8n_createWorkflow(ACTOR, 'id_setup', {}).error.code, 'E_VALIDATION');
  eq('unknown form → E_UNKNOWN_FORM', _ctx.n8n_submitForm(ACTOR, 'nope', {}).error.code, 'E_UNKNOWN_FORM');
  // Events carry the whole trail
  const kinds = new Set(_ctx.n8n_events(ACTOR, { limit: 500 }).result.events.map(e => e.kind));
  truthy('events include submit, result, task.created, task.closed', ['submit', 'result', 'task.created', 'task.closed'].every(k => kinds.has(k)));
}));

results.push(scenario('KILL SWITCH - EFX_ALIASES_OFF / EFX_ALIASES_ON refuse disabled aliases and forms (admin control, Apps Script side)', () => {
  seedBase();
  const props = _ctx.PropertiesService.getScriptProperties();
  const setSwitch = (off, on) => {
    props.setProperty('EFX_ALIASES_OFF', off || '');
    props.setProperty('EFX_ALIASES_ON',  on  || '');
    _ctx.n8nSwitchReset_();                    // per-execution cache; a real admin edit lands on the next execution
  };
  const termPayload = () => ({ reqName: 'David Binns', reqEmail: 'req2@team-group.com', empName: 'Sam Leaving', empWorkEmail: 'sleaving@team-group.com', empPhone: '', managerName: 'Bob Manager', managerEmail: 'mgr@team-group.com', siteName: 'Ottawa Main', empType: 'Salary', termDate: '2026-07-31', lastDayWorked: '2026-07-31', reason: 'Resigned', hr_approved: 'No', has_reports: 'No', reports_to_new: '', systems: ['Google Account', 'BOSS'], equip: ['Computer/Laptop'], google_forward: 'mgr@team-group.com', google_files: 'mgr@team-group.com', google_delegate: '', google_duration: 'Default 1 Month then delete', google_vacation: 'Gone.', comments: 'ok' });
  const mkTerm = () => _ctx.n8n_createTerminationRequest(ACTOR, termPayload());

  // -- baseline: nothing switched off --
  setSwitch('', '');
  truthy('switch unset -> termination create works', mkTerm().ok);
  truthy('switch unset -> n8n_ping works', _ctx.n8n_ping().ok);

  // -- the headline case: turn the termination FORM off --
  setSwitch('termination_request', '');
  const offTerm = mkTerm();
  eq('form off -> n8n_createTerminationRequest refused', offTerm.error && offTerm.error.code, 'E_DISABLED');
  eq('... error.disabled names the entry that matched', offTerm.error && offTerm.error.disabled, 'termination_request');
  contains('... message tells an admin where to re-enable it', offTerm.error && offTerm.error.message, 'Script Properties');
  // the generic route must be blocked too, or the switch is trivially bypassed
  eq('form off -> generic n8n_createWorkflow(termination_request) ALSO refused',
     _ctx.n8n_createWorkflow(ACTOR, 'termination_request', termPayload()).error.code, 'E_DISABLED');
  truthy('... an unrelated form still works (new_hire)', _ctx.n8n_createInitialRequest(ACTOR, newHire()).ok);
  truthy('... an unrelated read still works (ping)', _ctx.n8n_ping().ok);

  // -- naming an alias instead of a form --
  setSwitch('n8n_cancelWorkflow', '');
  eq('alias off (with n8n_ prefix) -> refused', _ctx.n8n_cancelWorkflow(ACTOR, 'NEW_EMP_NOPE').error.code, 'E_DISABLED');
  setSwitch('cancelWorkflow', '');
  eq('alias off (bare name, no prefix) -> refused', _ctx.n8n_cancelWorkflow(ACTOR, 'NEW_EMP_NOPE').error.code, 'E_DISABLED');
  setSwitch('  CANCELWORKFLOW ,, ', '');
  eq('entries are case/whitespace tolerant and skip blanks', _ctx.n8n_cancelWorkflow(ACTOR, 'NEW_EMP_NOPE').error.code, 'E_DISABLED');
  truthy('... a different alias is unaffected', _ctx.n8n_listWorkflows(ACTOR, {}).ok);

  // -- delegating wrappers: the gate must see the OUTER frame, not just the inner one --
  setSwitch('n8n_submitItSetup', '');
  const wf = _ctx.n8n_createInitialRequest(ACTOR, newHire({ firstName: 'Kill', lastName: 'Switch' })).result.workflowId;
  eq('wrapper off -> n8n_submitItSetup refused even though it delegates to n8n_submitForm',
     _ctx.n8n_submitItSetup(ACTOR, { workflowId: wf }).error.code, 'E_DISABLED');
  setSwitch('it_setup', '');
  eq('... naming the FORM blocks the same call', _ctx.n8n_submitItSetup(ACTOR, { workflowId: wf }).error.code, 'E_DISABLED');

  // -- allow-list mode (authoritative when non-empty) --
  setSwitch('', 'ping, info');
  truthy('allow-list set -> a listed alias still works', _ctx.n8n_ping().ok);
  eq('allow-list set -> an UNlisted alias is refused', _ctx.n8n_listWorkflows(ACTOR, {}).error.code, 'E_DISABLED');
  eq('allow-list set -> an unlisted form is refused', mkTerm().error.code, 'E_DISABLED');
  setSwitch('ping', 'ping, info');
  eq('deny-list beats allow-list for the same entry', _ctx.n8n_ping().error.code, 'E_DISABLED');

  // -- admin visibility --
  setSwitch('termination_request, specialist', '');
  const ks = _ctx.n8n_info().result.killSwitch;
  eq('n8n_info reports the deny-list', (ks.off || []).sort().join(','), 'specialist,termination_request');
  eq('n8n_info reports an empty allow-list as []', (ks.onlyOn || []).length, 0);
  truthy('n8n_info reports the switch as readable', ks.readable === true);

  // -- fail-open: an unreadable property store must not break automation --
  const realProps = _ctx.PropertiesService.getScriptProperties;
  _ctx.PropertiesService.getScriptProperties = () => { throw new Error('simulated PropertiesService outage'); };
  _ctx.n8nSwitchReset_();
  truthy('properties unreadable -> FAILS OPEN, calls still succeed', _ctx.n8n_ping().ok);
  _ctx.PropertiesService.getScriptProperties = realProps;
  _ctx.n8nSwitchReset_();

  // -- restore, so later runs/scenarios are unaffected --
  setSwitch('', '');
  truthy('switch cleared -> termination create works again', mkTerm().ok);
}));

console.log('\n' + '═'.repeat(72) + '\n  EFX RESULTS\n' + '═'.repeat(72));
let tp = 0, tf = 0;
results.forEach(r => { tp += r.passed; tf += r.failed; console.log('  ' + (r.failed ? '❌' : '✅') + '  ' + r.name.padEnd(70) + r.passed + ' passed / ' + r.failed + ' failed'); });
console.log('\n  TOTAL: ' + tp + ' passed, ' + tf + ' failed');
process.exit(tf ? 1 : 0);
