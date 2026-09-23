'use strict';
// Finding #2: after a Wait-for-form resumes, pre-wait node data is unavailable, so
// $('Draft accounts') throws "hasn't been executed" and Build ID Setup dies.
//
// Workaround needing no instance-level setting: stash the draft in the workflow's static data
// (keyed by execution id) BEFORE the wait, and read it back AFTER. Static data survives a resume for
// production executions, which is what a webhook trigger produces. Same trick the Router uses for its
// idempotency cache.
const fs = require('fs');
const H = { 'X-N8N-API-KEY': fs.readFileSync('D:/Credentials/n8n/api-key-staging.txt', 'utf8').trim(), 'Content-Type': 'application/json' };
const API = 'https://n8n-staging.team-group.com/api/v1';
const WF = 'qd3vlXvkAY8H2PC3';

const DRAFT = `// PLACEHOLDER account drafting. In the real flow this calls SiteDocs and DSS to reserve
// or propose the accounts. Here the values are generated so the gate can be demonstrated.
const created = $input.first().json;              // flattened Router envelope
const emp = $('Make test employee').first().json;
const wf = created.workflowId;
const id = created.internalEmployeeId;
const initials = (emp.firstName[0] + emp.lastName[0]).toLowerCase();

const out = {
  workflowId: wf,
  internalEmployeeId: id,
  employeeName: emp.firstName + ' ' + emp.lastName,
  siteName: emp.siteName,
  positionTitle: emp.positionTitle,
  managerEmail: emp.reportingManagerEmail,
  // ---- drafted, not yet created ----
  siteDocsWorkerId: 'SD-' + id,
  siteDocsJobCode: emp.employmentType === 'Salary' ? 'Salary 1' : 'Hourly 1',
  dssUsername: initials + id,
  dssPassword: 'Temp-' + Math.random().toString(36).slice(2, 10) + '!'
};

// Survive the approval wait: once a Wait-for-form resumes, $('Draft accounts') is NOT available.
// Stash the draft against this execution id so Build ID Setup can recover it.
const sd = $getWorkflowStaticData('global');
sd.drafts = sd.drafts || {};
const now = Date.now();
for (const k of Object.keys(sd.drafts)) {
  if (now - (sd.drafts[k]._at || 0) > 7 * 24 * 60 * 60 * 1000) delete sd.drafts[k];
}
sd.drafts['x' + $execution.id] = Object.assign({ _at: now }, out);

return [{ json: out }];`;

const BUILD = `// The manager's form answers come back on $json. Anything they edited wins.
// $('Draft accounts') is deliberately NOT used: after a Wait-for-form resume, pre-wait node data is
// unavailable and referencing it throws "Node 'Draft accounts' hasn't been executed".
const sd = $getWorkflowStaticData('global');
const d = (sd.drafts || {})['x' + $execution.id];
if (!d) {
  throw new Error('EFX TEST: no stashed draft for execution ' + $execution.id + ' (run started before the stash existed, or it expired).');
}
const f = $input.first().json;
const val = (k, fallback) => (f[k] !== undefined && f[k] !== null && f[k] !== '') ? f[k] : fallback;

return [{ json: {
  workflowId: d.workflowId,
  siteDocsWorkerId: val('SiteDocs Worker ID', d.siteDocsWorkerId),
  siteDocsJobCode:  val('SiteDocs Job Code',  d.siteDocsJobCode),
  dssUsername:      val('DSS Username',       d.dssUsername),
  dssPassword:      d.dssPassword,
  _employeeName:    d.employeeName,
  _internalEmployeeId: d.internalEmployeeId
} }];`;

// compile-check both before sending them anywhere
for (const [label, code] of [['Draft accounts', DRAFT], ['Build ID Setup', BUILD]]) {
  try { new Function('$input', '$getWorkflowStaticData', '$execution', '$json', code); }
  catch (e) { console.error('SYNTAX ERROR in ' + label + ': ' + e.message); process.exit(1); }
}
console.log('both code nodes compile');

(async () => {
  const w = await (await fetch(API + '/workflows/' + WF, { headers: H })).json();
  const set = (name, code) => {
    const i = w.nodes.findIndex(n => n.name === name);
    if (i < 0) throw new Error('missing node ' + name);
    w.nodes[i].parameters.jsCode = code;
  };
  set('Draft accounts', DRAFT);
  set('Build ID Setup', BUILD);

  const r = await fetch(API + '/workflows/' + WF, { method: 'PUT', headers: H,
    body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings || { executionOrder: 'v1' } }) });
  console.log('PUT HTTP ' + r.status);
  if (!r.ok) { console.error(JSON.stringify(await r.json()).slice(0, 300)); process.exit(1); }

  const a = await (await fetch(API + '/workflows/' + WF, { headers: H })).json();
  const d = a.nodes.find(n => n.name === 'Draft accounts').parameters.jsCode;
  const b = a.nodes.find(n => n.name === 'Build ID Setup').parameters.jsCode;
  console.log('stash written  : ' + d.includes("sd.drafts['x'"));
  console.log('stash read     : ' + b.includes("(sd.drafts || {})['x'"));
  console.log('no $() on read : ' + !/\$\('Draft accounts'\)/.test(b));
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
