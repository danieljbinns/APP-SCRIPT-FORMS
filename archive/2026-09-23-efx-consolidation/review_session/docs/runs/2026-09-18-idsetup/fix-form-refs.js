'use strict';
// At the Wait node, $json is the OUTPUT OF THE GMAIL NODE (message id / thread id), not the drafted
// accounts — so every {{ $json.* }} in the form title/description/placeholders rendered blank.
// The original workflow had the same bug; it was never caught because the form had never been opened.
// Reference the drafting node explicitly instead.
const fs = require('fs');
const H = { 'X-N8N-API-KEY': fs.readFileSync('D:/Credentials/n8n/api-key-staging.txt', 'utf8').trim(), 'Content-Type': 'application/json' };
const API = 'https://n8n-staging.team-group.com/api/v1';
const WF = 'qd3vlXvkAY8H2PC3';
const D = "$('Draft accounts').first().json";

(async () => {
  const w = await (await fetch(API + '/workflows/' + WF, { headers: H })).json();
  const i = w.nodes.findIndex(n => n.name === 'Manager approves');
  const wait = w.nodes[i];

  wait.parameters.formTitle = '=Approve account setup — {{ ' + D + '.employeeName }}';
  wait.parameters.formDescription =
    '=Review what is about to be created for {{ ' + D + '.employeeName }} '
    + '(internal employee ID {{ ' + D + '.internalEmployeeId }}, {{ ' + D + '.positionTitle }} '
    + 'at {{ ' + D + '.siteName }}).\n\n'
    + 'DRAFTED VALUES — leave a box blank to accept it as shown:\n'
    + '• SiteDocs Worker ID: {{ ' + D + '.siteDocsWorkerId }}\n'
    + '• SiteDocs Job Code: {{ ' + D + '.siteDocsJobCode }}\n'
    + '• DSS Username: {{ ' + D + '.dssUsername }}\n\n'
    + 'Type a different value in any box to override the draft. A DSS password has already been '
    + 'generated and is not shown here.';
  wait.parameters.formFields.values[0].placeholder = '={{ ' + D + '.siteDocsWorkerId }}';
  wait.parameters.formFields.values[2].placeholder = '={{ ' + D + '.dssUsername }}';

  const r = await fetch(API + '/workflows/' + WF, { method: 'PUT', headers: H,
    body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings || { executionOrder: 'v1' } }) });
  console.log('PUT HTTP ' + r.status);
  if (!r.ok) { console.error(JSON.stringify(await r.json()).slice(0, 300)); process.exit(1); }

  const a = await (await fetch(API + '/workflows/' + WF, { headers: H })).json();
  const p = a.nodes.find(n => n.name === 'Manager approves').parameters;
  console.log('title       : ' + p.formTitle);
  console.log('uses $json  : ' + /\{\{\s*\$json\./.test(p.formDescription + p.formTitle
    + p.formFields.values.map(v => v.placeholder || '').join('')));
  console.log('placeholders: ' + p.formFields.values.map(v => v.placeholder || '(none)').join('  |  '));
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
