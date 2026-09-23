'use strict';
// Make the ID Setup approval demo actually runnable and actually reviewable.
const fs = require('fs');
const H = { 'X-N8N-API-KEY': fs.readFileSync('D:/Credentials/n8n/api-key-staging.txt', 'utf8').trim(), 'Content-Type': 'application/json' };
const API = 'https://n8n-staging.team-group.com/api/v1';
const WF = 'qd3vlXvkAY8H2PC3';
const JOB_CODES = ['Hourly 1', 'Hourly 2', 'Salary 1', 'Salary 2', 'Supervisor', 'Manager'];

(async () => {
  const w = await (await fetch(API + '/workflows/' + WF, { headers: H })).json();
  const get = n => w.nodes.find(x => x.name === n);

  // ── 1. the approval form: show what is being approved, and constrain the enum ──
  const wait = get('Manager approves');
  wait.parameters.formDescription =
    '=Review what is about to be created for {{ $json.employeeName }} '
    + '(internal employee ID {{ $json.internalEmployeeId }}, {{ $json.positionTitle }} at {{ $json.siteName }}).\n\n'
    + 'DRAFTED VALUES — leave a box blank to accept it as shown:\n'
    + '• SiteDocs Worker ID: {{ $json.siteDocsWorkerId }}\n'
    + '• SiteDocs Job Code: {{ $json.siteDocsJobCode }}\n'
    + '• DSS Username: {{ $json.dssUsername }}\n\n'
    + 'Type a different value in any box to override the draft. A DSS password has already been '
    + 'generated and is not shown here.';
  wait.parameters.formFields = { values: [
    { fieldLabel: 'SiteDocs Worker ID', fieldType: 'text', requiredField: false,
      placeholder: '={{ $json.siteDocsWorkerId }}' },
    { fieldLabel: 'SiteDocs Job Code', fieldType: 'dropdown', requiredField: false,
      fieldOptions: { values: JOB_CODES.map(o => ({ option: o })) } },
    { fieldLabel: 'DSS Username', fieldType: 'text', requiredField: false,
      placeholder: '={{ $json.dssUsername }}' }
  ] };
  wait.parameters.options = { formSubmittedText: 'Approved. Account setup is being submitted now.' };

  // ── 2. a webhook trigger beside the manual one, so the workflow can be ACTIVATED ──
  // (an activated workflow is what gives the Wait node a production form URL rather than a test one)
  const path = 'efx-idsetup-' + require('crypto').randomBytes(6).toString('hex');
  if (!w.nodes.some(n => n.name === 'Run via webhook (EFX TEST)')) {
    w.nodes.push({ name: 'Run via webhook (EFX TEST)', type: 'n8n-nodes-base.webhook', typeVersion: 2,
      position: [-220, 200], webhookId: path,
      parameters: { path, httpMethod: 'POST', responseMode: 'lastNode' } });
    w.connections['Run via webhook (EFX TEST)'] = { main: [[{ node: 'Make test employee', type: 'main', index: 0 }]] };
    fs.writeFileSync('idsetup-webhook-path.txt', path);
    console.log('added webhook trigger, path ' + path);
  } else {
    console.log('webhook trigger already present');
  }

  const r = await fetch(API + '/workflows/' + WF, { method: 'PUT', headers: H,
    body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings || { executionOrder: 'v1' } }) });
  if (!r.ok) { console.error('FAILED: ' + JSON.stringify(await r.json()).slice(0, 400)); process.exit(1); }

  const a = await (await fetch(API + '/workflows/' + WF, { headers: H })).json();
  const f = a.nodes.find(n => n.name === 'Manager approves').parameters.formFields.values;
  console.log('\napproval form fields now:');
  f.forEach(x => console.log('   ' + x.fieldLabel.padEnd(22) + (x.fieldType || 'text').padEnd(10)
    + 'required=' + !!x.requiredField
    + (x.fieldOptions ? '  options: ' + x.fieldOptions.values.map(v => v.option).join(', ') : '')));
  console.log('\ndrafted values are now shown in the form description: '
    + a.nodes.find(n => n.name === 'Manager approves').parameters.formDescription.includes('DRAFTED VALUES'));
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
