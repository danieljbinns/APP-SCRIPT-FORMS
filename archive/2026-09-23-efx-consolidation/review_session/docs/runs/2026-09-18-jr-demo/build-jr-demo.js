'use strict';
const fs = require('fs');
const IDS = JSON.parse(fs.readFileSync('jr-test-ids.json', 'utf8'));
const API = 'https://n8n-staging.team-group.com/api/v1';
const KEY = fs.readFileSync('D:/Credentials/n8n/api-key-staging.txt', 'utf8').trim();
const H = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };

const PROD = {
  tracker:  '18prwB6phOIGIjI9V92h_hEXz4fpfwdramri1ziIiAC0',
  index:    '1SDicVzLEcynHTRFX-3TK4GaHA8aGsRE46vHhoOBpPLc',
  template: '1GDnsjxAHAIj3q0X_1Enk32faXO0SkdYi_K4WKiqPxT0',
  approved: '1h8JvISJCnqK6_i9MlghsYmS-4SKMUNbn'
};
const MAP = { [PROD.tracker]: IDS.tracker, [PROD.index]: IDS.index, [PROD.template]: IDS.template, [PROD.approved]: IDS.approved };
const ME = 'dbinns@team-group.com';
const CLOSE_JR_WRAPPER = 'RoSlpUv8xIBfbgiV';

// Literals that must NOT survive into a test copy.
// George's live nodes carry two plaintext shared secrets (the BOSS Lambda's x-boss-secret header and
// the Apps Script portal password). They are deliberately NOT written down here -- they are harvested
// from the source workflows at run time, so this file can live in the repo without carrying them.
const FORBIDDEN = [
  PROD.tracker, PROD.index, PROD.template, PROD.approved,
  'george.anthony@team-group.com',
  'ik2ur9kika.execute-api'
];
function harvestSecrets(sources) {
  const found = new Set();
  for (const w of sources) {
    const s = JSON.stringify(w);
    // x-boss-secret header values
    for (const m of s.matchAll(/"name"\s*:\s*"x-boss-secret"\s*,\s*"value"\s*:\s*"([^"]{16,})"/g)) found.add(m[1]);
    // the portal shared password embedded in the Mark Portal JR Complete body
    for (const m of s.matchAll(/secret:\s*\\?'([A-Za-z0-9]{32,})\\?'/g)) found.add(m[1]);
    // the production Apps Script /exec deployment id
    for (const m of s.matchAll(/script\.google\.com\/macros\/s\/(AKfycb[\w-]{20,})/g)) found.add(m[1]);
  }
  return [...found];
}

function rewrite(s) {
  if (typeof s !== 'string') return s;
  for (const [from, to] of Object.entries(MAP)) s = s.split(from).join(to);
  s = s.split('george.anthony@team-group.com').join(ME);
  s = s.split('dbinns@robinsonsolutions.com').join(ME);
  s = s.split('/webhook/boss-assign').join('/webhook/boss-assign-efxtest');
  s = s.split('/webhook/jr-manager-response').join('/webhook/jr-manager-response-efxtest');
  return s;
}
const deepRewrite = o => {
  if (typeof o === 'string') return rewrite(o);
  if (Array.isArray(o)) return o.map(deepRewrite);
  if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) r[k] = deepRewrite(o[k]); return r; }
  return o;
};
const node = (name, type, typeVersion, position, parameters = {}) => ({ name, type, typeVersion, position, parameters });
const connect = (c, from, to, idx = 0) => {
  c[from] = c[from] || { main: [] };
  while (c[from].main.length <= idx) c[from].main.push([]);
  c[from].main[idx] = [{ node: to, type: 'main', index: 0 }];
};

function prep(w, name) {
  const out = { name, nodes: deepRewrite(w.nodes), connections: deepRewrite(w.connections), settings: { executionOrder: 'v1' } };
  for (const n of out.nodes) {
    if (n.type.endsWith('.webhook') && n.parameters.path && !/-efxtest$/.test(n.parameters.path)) n.parameters.path += '-efxtest';
    if (n.type.includes('gmail') && n.parameters.sendTo !== undefined) n.parameters.sendTo = ME;
    if (n.parameters && typeof n.parameters.subject === 'string' && !n.parameters.subject.includes('[EFX TEST]')) {
      const s = n.parameters.subject;
      n.parameters.subject = s.startsWith('=') ? '=[EFX TEST] ' + s.slice(1) : '[EFX TEST] ' + s;
    }
  }
  return out;
}

// ─── WF1 ──────────────────────────────────────────────────────────────────────
function buildWF1(src) {
  const w = prep(src, 'DEMO \u00b7 JR 1 \u00b7 Assignment Automation (EFX TEST)');
  const get = n => w.nodes.find(x => x.name === n);

  // Gmail trigger -> manual trigger. Node NAMES are kept so every $('...') reference downstream still resolves.
  const t = get('Watch for JR Email');
  t.type = 'n8n-nodes-base.manualTrigger'; t.typeVersion = 1; t.parameters = {};
  delete t.credentials; delete t.webhookId;

  const f = get('Fetch Full Email Body');
  f.type = 'n8n-nodes-base.code'; f.typeVersion = 2; delete f.credentials;
  f.parameters = { jsCode: "// EFX TEST: the real node fetched the Gmail message body. Nothing to fetch in a fixture run.\nreturn [{ json: { payload: {} } }];" };

  const p = get('Parse Email Data');
  p.type = 'n8n-nodes-base.code'; p.typeVersion = 2;
  p.parameters = { jsCode: [
    "// EFX TEST FIXTURE - stands in for the JR request email George's Gmail trigger would have parsed.",
    "// Edit these to match the test employee you created. Same output shape as the real parser.",
    "const EMPLOYEE_NAME = 'EfxJr Demo';",
    "const JOB_TITLE     = 'Maintenance Technician';   // must match a JR Template Name / Alias in the Index sheet",
    "const SITE          = 'Ottawa Main';",
    "const START_DATE    = '2026-10-06';",
    "const MANAGER_EMAIL = 'dbinns@team-group.com';    // the approval gate email lands here",
    "const PORTAL_TICKET = '';                          // EFX workflowId (NEW_EMP_...) or task id (TK-...)",
    "",
    "if (!PORTAL_TICKET) {",
    "  throw new Error('EFX TEST: set PORTAL_TICKET in the \"Parse Email Data\" node to the EFX workflowId ' +",
    "                  '(NEW_EMP_...) of a hire that has an OPEN jr_title task, or JR 3 will have nothing to close.');",
    "}",
    "return [{ json: {",
    "  employeeName: EMPLOYEE_NAME, employeeType: 'Direct Hire', site: SITE, startDate: START_DATE,",
    "  managerEmail: MANAGER_EMAIL, jobTitle: JOB_TITLE,",
    "  originalSubject: '[EFX TEST] JR request for ' + EMPLOYEE_NAME, portalTicketId: PORTAL_TICKET",
    "} }];"
  ].join('\n') };

  // manual trigger feeds the fixture directly; the fetch node stays present but unconnected, for reference
  w.connections['Watch for JR Email'] = { main: [[{ node: 'Parse Email Data', type: 'main', index: 0 }]] };
  delete w.connections['Fetch Full Email Body'];

  // George's own TEST_MODE stays off - the fixture already routes the manager email to us
  const pd = get('Parse Duties');
  pd.parameters.jsCode = pd.parameters.jsCode.replace('const TEST_MODE = true;', 'const TEST_MODE = false;');

  w.nodes.push(node('EFX TEST note', 'n8n-nodes-base.stickyNote', 1, [-460, -40], { width: 440, height: 280, content: [
    '## DEMO \u00b7 JR 1 (EFX TEST)', '',
    "Copy of George's **JR Assignment Automation**, fully isolated:", '',
    '* Gmail trigger replaced by a **manual trigger + fixture** in `Parse Email Data` \u2014 it never touches a live mailbox.',
    "* Tracker / Index / Template point at **(EFX TEST) copies**, not George's live files.",
    '* Every email goes to dbinns@team-group.com, including the **manager approval email**.',
    '* The approval link in that email points at the `-efxtest` webhook path.', '',
    'Set the fixture values in `Parse Email Data` before running.'
  ].join('\n') }));
  return w;
}

// ─── WF2 ──────────────────────────────────────────────────────────────────────
function buildWF2(src) {
  const w = prep(src, 'DEMO \u00b7 JR 2 \u00b7 Manager Response Handler (EFX TEST)');
  w.nodes.push(node('EFX TEST note', 'n8n-nodes-base.stickyNote', 1, [-460, -40], { width: 420, height: 240, content: [
    '## DEMO \u00b7 JR 2 (EFX TEST)', '',
    'Copy of **JR Approval \u2014 Manager Response Handler**.', '',
    '* Webhook path is `jr-manager-response-efxtest` \u2014 cannot collide with the live registration.',
    '* Reads/writes the **(EFX TEST) tracker**, moves files into the **(EFX TEST) Approved JRs** folder.',
    '* Both notification emails go to dbinns@team-group.com.', '',
    'This one must be **activated** for the approval link in the JR 1 email to work.'
  ].join('\n') }));
  return w;
}

// ─── WF3 ──────────────────────────────────────────────────────────────────────
function buildWF3(src) {
  const w = prep(src, 'DEMO \u00b7 JR 3 \u00b7 BOSS Assignment via EFX Router (EFX TEST)');
  const get = n => w.nodes.find(x => x.name === n);

  // 1. config node between the webhook and Parse & Validate
  w.nodes.push(node('EFX TEST Config', 'n8n-nodes-base.code', 2, [-140, -40], { jsCode: [
    '// -- EFX TEST switchboard --------------------------------------------------',
    "// Both BOSS values are deliberately BLANK so this copy cannot reach George's",
    '// production BOSS Lambda. Leave them blank to test the EFX portal-close path on',
    '// its own: the BOSS calls are simulated and everything else runs for real.',
    "const BOSS_API_BASE = '';   // e.g. https://<staging-api-id>.execute-api.us-east-1.amazonaws.com/<stage>",
    "const BOSS_SECRET   = '';   // the x-boss-secret for THAT stage - never the production one",
    '',
    'const skipBoss = !BOSS_API_BASE || !BOSS_SECRET;',
    'return $input.all().map(i => ({ json: { ...i.json,',
    '  bossApiBase: BOSS_API_BASE, bossSecret: BOSS_SECRET, skipBoss } }));'
  ].join('\n') }));
  const wh = w.nodes.find(n => n.type.endsWith('.webhook'));
  connect(w.connections, wh.name, 'EFX TEST Config');
  connect(w.connections, 'EFX TEST Config', 'Parse & Validate');

  // 2. BOSS calls become config-driven (no production URL, no production secret)
  for (const [nodeName, path] of [['Assign JR in BOSS', 'assign'], ['Apply Duty Changes', 'editDuties']]) {
    const n = get(nodeName);
    n.parameters.url = "={{ $('EFX TEST Config').first().json.bossApiBase }}/" + path;
    n.parameters.headerParameters.parameters = n.parameters.headerParameters.parameters.map(p =>
      p.name === 'x-boss-secret' ? { name: 'x-boss-secret', value: "={{ $('EFX TEST Config').first().json.bossSecret }}" } : p);
  }

  // 3. IF gates so a blank BOSS config simulates instead of failing
  const ifCond = {
    conditions: { options: { caseSensitive: true, version: 2 },
      conditions: [{ leftValue: "={{ $('EFX TEST Config').first().json.skipBoss }}", rightValue: false,
        operator: { type: 'boolean', operation: 'false', singleValue: true } }], combinator: 'and' }
  };
  w.nodes.push(node('BOSS configured?', 'n8n-nodes-base.if', 2, [620, -260], JSON.parse(JSON.stringify(ifCond))));
  w.nodes.push(node('Simulate BOSS Assign', 'n8n-nodes-base.code', 2, [840, -120], { jsCode:
    "// EFX TEST: BOSS not configured - simulate the assign so the rest of the chain can be tested.\nreturn [{ json: { ok: true, simulated: true, note: 'BOSS assign SIMULATED (EFX TEST Config is blank)' } }];" }));
  w.nodes.push(node('BOSS configured? (duties)', 'n8n-nodes-base.if', 2, [620, 300], JSON.parse(JSON.stringify(ifCond))));
  w.nodes.push(node('Simulate Duty Changes', 'n8n-nodes-base.code', 2, [840, 420], { jsCode:
    "// EFX TEST: BOSS not configured - simulate editDuties so Mark Portal JR Complete still runs.\nreturn [{ json: { ok: true, simulated: true, note: 'BOSS editDuties SIMULATED (EFX TEST Config is blank)' } }];" }));

  connect(w.connections, 'Lookup BOSS Job ID', 'BOSS configured?');
  w.connections['BOSS configured?'] = { main: [
    [{ node: 'Assign JR in BOSS', type: 'main', index: 0 }],
    [{ node: 'Simulate BOSS Assign', type: 'main', index: 0 }]] };
  connect(w.connections, 'Simulate BOSS Assign', 'Update Sheet \u2014 BOSS Assigned');

  connect(w.connections, 'Parse Duty Changes', 'BOSS configured? (duties)');
  w.connections['BOSS configured? (duties)'] = { main: [
    [{ node: 'Apply Duty Changes', type: 'main', index: 0 }],
    [{ node: 'Simulate Duty Changes', type: 'main', index: 0 }]] };
  connect(w.connections, 'Simulate Duty Changes', 'Mark Portal JR Complete');

  // 4. THE EFX SWAP - portal close goes through the Router, not /exec + shared password
  const mp = get('Mark Portal JR Complete');
  mp.type = 'n8n-nodes-base.executeWorkflow'; mp.typeVersion = 1.2; delete mp.credentials;
  mp.parameters = {
    workflowId: { __rl: true, value: CLOSE_JR_WRAPPER, mode: 'id', cachedResultName: 'Forms \u00b7 Close JR Task' },
    workflowInputs: { mappingMode: 'defineBelow', value: {
      idOrWorkflow: "={{ $('Find Row by Employee').first().json.portalTicketId }}",
      notes: 'JR title verified & assigned in BOSS (EFX TEST)',
      actor: '={{ { "id": "n8n:boss-jr", "email": "boss-jr-automation@team-group.com", "display": "BOSS JR Automation" } }}',
      idempotencyKey: "={{ $('Find Row by Employee').first().json.portalTicketId }}",
      treatAlreadyClosedAsSuccess: true
    }, matchingColumns: [], schema: [], attemptToConvertTypes: false, convertFieldsToString: true },
    options: {}
  };

  w.nodes.push(node('EFX TEST note', 'n8n-nodes-base.stickyNote', 1, [-460, -340], { width: 460, height: 340, content: [
    '## DEMO \u00b7 JR 3 (EFX TEST)', '',
    'Copy of **BOSS JR Assignment** with the EFX swap.', '',
    '**`Mark Portal JR Complete`** no longer POSTs to the production Apps Script `/exec` with a shared',
    'password. It calls **`Forms \u00b7 Close JR Task`** \u2192 EFX Router \u2192 Execution API, authenticated by the',
    'service-account credential. That removes one plaintext shared secret from this workflow.', '',
    '* Webhook path `boss-assign-efxtest`.',
    '* Tracker is the **(EFX TEST)** copy.',
    '* Both emails go to dbinns@team-group.com.', '',
    '**BOSS is OFF until you fill in `EFX TEST Config`.** Blank = the two BOSS calls are simulated,',
    'so the portal-close path can be tested on its own today.'
  ].join('\n') }));
  return w;
}

(async () => {
  const src = id => JSON.parse(fs.readFileSync('wf-' + id + '.json', 'utf8'));
  const built = [
    buildWF1(src('4InJ9cdAr5YxVgoT')),
    buildWF2(src('KFzI1VJBU01axjTb')),
    buildWF3(src('J7RU99n01pq9Xk3D'))
  ];

  const sources = ['4InJ9cdAr5YxVgoT', 'KFzI1VJBU01axjTb', 'J7RU99n01pq9Xk3D'].map(src);
  const secrets = harvestSecrets(sources);
  console.log('harvested ' + secrets.length + ' plaintext secret(s)/deployment id(s) from the source workflows'
            + ' (values not printed) -- asserting none survive');
  for (const w of built) {
    const s = JSON.stringify(w);
    for (const bad of FORBIDDEN) if (s.includes(bad)) throw new Error('LEAK in "' + w.name + '": ' + bad.slice(0, 42));
    for (const sec of secrets) if (s.includes(sec)) throw new Error('SECRET LEAK in "' + w.name + '" (value withheld)');
  }
  console.log('guard passed: no production id, address, URL or secret survives in any copy\n');

  if (process.argv.includes('--dry-run')) {
    for (const w of built) {
      fs.writeFileSync('built-' + w.name.replace(/[^\w]+/g, '_') + '.json', JSON.stringify(w, null, 1));
      console.log('DRY RUN  ' + w.name + '  (' + w.nodes.length + ' nodes)');
    }
    return;
  }

  const list = await (await fetch(API + '/workflows?limit=250', { headers: H })).json();
  for (const w of built) {
    const ex = list.data.find(x => x.name === w.name);
    let r, id;
    if (ex) { id = ex.id; r = await fetch(API + '/workflows/' + id, { method: 'PUT', headers: H, body: JSON.stringify(w) }); }
    else { r = await fetch(API + '/workflows', { method: 'POST', headers: H, body: JSON.stringify(w) }); }
    const j = await r.json();
    if (!r.ok) { console.error('FAILED  ' + w.name + '\n        ' + JSON.stringify(j).slice(0, 500)); continue; }
    id = j.id || id;
    console.log((ex ? 'UPDATED ' : 'CREATED ') + id + '  ' + w.name + '  (' + w.nodes.length + ' nodes, active=' + (j.active === true) + ')');
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
