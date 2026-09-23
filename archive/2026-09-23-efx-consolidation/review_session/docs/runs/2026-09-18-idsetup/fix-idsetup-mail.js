'use strict';
// Root cause of the silent update failures: the gmail nodes bind the Team Group credential
// ("Gmail account", ESH5aDZWt0qo7oKD) while this workflow lives in Binns' personal project.
// n8n honours the pre-existing binding but rejects any write that re-establishes it — silently on
// an in-place edit, explicitly once the node gets a new id. Switch to the credential Binns owns.
const fs = require('fs');
const H = { 'X-N8N-API-KEY': fs.readFileSync('D:/Credentials/n8n/api-key-staging.txt', 'utf8').trim(), 'Content-Type': 'application/json' };
const API = 'https://n8n-staging.team-group.com/api/v1';
const WF = 'qd3vlXvkAY8H2PC3';
const MINE = { gmailOAuth2: { id: 'hCxnU4lnRGvMs9Ne', name: 'Gmail - dbinns (EFX TEST)' } };

const OLD = '{{ $execution.resumeUrl }}';
const NEW = "{{ $execution.resumeUrl.replace('http://localhost:5678', 'https://n8n-staging.team-group.com') }}";

(async () => {
  const w = await (await fetch(API + '/workflows/' + WF, { headers: H })).json();
  let changed = [];
  for (let i = 0; i < w.nodes.length; i++) {
    const n = w.nodes[i];
    if (!n.type.includes('gmail')) continue;
    const rebuilt = JSON.parse(JSON.stringify(n));
    rebuilt.id = 'efxmail_' + Math.random().toString(36).slice(2, 10);   // fresh id so the write lands
    rebuilt.credentials = MINE;
    if (typeof rebuilt.parameters.message === 'string') {
      rebuilt.parameters.message = rebuilt.parameters.message.split(OLD).join(NEW);
    }
    w.nodes[i] = rebuilt;
    changed.push(n.name);
  }
  console.log('rebuilding: ' + changed.join(', '));

  const r = await fetch(API + '/workflows/' + WF, { method: 'PUT', headers: H,
    body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings || { executionOrder: 'v1' } }) });
  console.log('PUT HTTP ' + r.status);
  if (!r.ok) { console.error(JSON.stringify(await r.json()).slice(0, 400)); process.exit(1); }

  const a = await (await fetch(API + '/workflows/' + WF, { headers: H })).json();
  for (const n of a.nodes.filter(x => x.type.includes('gmail'))) {
    console.log('  ' + n.name.padEnd(26) + JSON.stringify(n.credentials));
  }
  const m = a.nodes.find(n => n.name === 'Email manager to review').parameters.message;
  console.log('\nresume-url rewrite present: ' + m.includes('n8n-staging.team-group.com'));
  console.log('still wired               : ' + JSON.stringify((a.connections['Email manager to review'] || {}).main));
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
